import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export type AnalysisJobData = {
  reportId: string;
  zipPath?: string;
  repoUrl?: string;
};

export const analysisQueueName = "analysis-jobs";

export const analysisQueue = new Queue<AnalysisJobData>(analysisQueueName, {
  connection: redisConnection
});
