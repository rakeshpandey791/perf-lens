import fs from "fs/promises";

export async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}
