import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function listFiles(dirPath: string, predicate?: (filePath: string) => boolean): string[] {
  const results: string[] = [];
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    if (!fs.existsSync(current)) {
      continue;
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(nextPath);
        continue;
      }
      if (!predicate || predicate(nextPath)) {
        results.push(nextPath);
      }
    }
  }
  return results.sort();
}

export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}
