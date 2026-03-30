import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { promisify } from "util";
import { execFile } from "child_process";
import { Worker } from "bullmq";
import unzipper from "unzipper";
import { env } from "../config/env.js";
import { redisConnection } from "../config/redis.js";
import { analyzeProject } from "../services/analyzer.js";
import { markCompleted, markFailed, markProcessing } from "../services/reportRepository.js";

const queueName = "analysis-jobs";
const execFileAsync = promisify(execFile);

export const analysisWorker = new Worker(
  queueName,
  async (job) => {
    const { reportId, zipPath, repoUrl } = job.data as { reportId: string; zipPath?: string; repoUrl?: string };
    const analysisDir = path.join(env.tempDir, reportId);
    let targetDir = analysisDir;

    await markProcessing(reportId);

    try {
      await fs.mkdir(analysisDir, { recursive: true });

      if (zipPath) {
        await extractZip(zipPath, analysisDir);
      } else if (repoUrl) {
        targetDir = path.join(analysisDir, "repo");
        await cloneGithubRepo(repoUrl, targetDir);
      } else {
        throw new Error("Invalid analysis job payload. Expected zipPath or repoUrl.");
      }

      const result = await analyzeProject(targetDir);

      await markCompleted(reportId, result);
    } catch (error) {
      await markFailed(reportId, error instanceof Error ? error.message : "Analysis failed");
      throw error;
    } finally {
      await cleanup(zipPath, analysisDir);
    }
  },
  {
    connection: redisConnection,
    concurrency: 2
  }
);

analysisWorker.on("completed", (job) => {
  // eslint-disable-next-line no-console
  console.log(`Analysis completed for ${job.id}`);
});

analysisWorker.on("failed", (job, error) => {
  // eslint-disable-next-line no-console
  console.error(`Analysis failed for ${job?.id}`, error);
});

async function extractZip(zipPath: string, destination: string): Promise<void> {
  await createReadStream(zipPath).pipe(unzipper.Extract({ path: destination })).promise();
}

async function cloneGithubRepo(repoUrl: string, destination: string): Promise<void> {
  await execFileAsync("git", ["clone", "--depth", "1", repoUrl, destination]);
}

async function cleanup(zipPath: string | undefined, analysisDir: string): Promise<void> {
  const tasks: Array<Promise<unknown>> = [fs.rm(analysisDir, { recursive: true, force: true })];
  if (zipPath) {
    tasks.push(fs.rm(zipPath, { force: true }));
  }

  await Promise.allSettled(tasks);
}
