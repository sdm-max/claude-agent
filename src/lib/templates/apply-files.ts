import path from "path";
import os from "os";
import { writeDiskWithSnapshot, type ResolvedPath } from "@/lib/disk-files";
import type { TemplateFile } from "@/lib/templates";

function resolveExtraFilePath(
  basePath: string,
  filePath: string,
  projectId: string | null,
): ResolvedPath {
  if (filePath.startsWith("~/")) {
    const rel = filePath.slice(2);
    return {
      absolutePath: path.join(os.homedir(), rel),
      relativePath: filePath,
      projectId: null,
    };
  }
  return {
    absolutePath: path.join(basePath, filePath),
    relativePath: filePath,
    projectId,
  };
}

export function applyExtraFiles(
  basePath: string,
  extraFiles: TemplateFile[],
  projectId: string | null,
): string[] {
  if (!extraFiles || extraFiles.length === 0) return [];

  const written: string[] = [];

  for (const ef of extraFiles) {
    if (ef.path.includes("..")) continue;
    if (path.isAbsolute(ef.path)) continue;

    const target = resolveExtraFilePath(basePath, ef.path, projectId);
    writeDiskWithSnapshot(target, ef.content);
    written.push(ef.path);
  }

  return written;
}
