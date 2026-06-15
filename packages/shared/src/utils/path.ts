import path from "path-browserify";

export type PathObject = path.PathObject;

export function getBaseName(filePath: string, keepExt = true): string {
  const ext = keepExt ? undefined : path.extname(filePath);
  return path.basename(filePath, ext);
}

export function getExtName(filePath: string): string {
  return path.extname(filePath);
}

export function getDirName(filePath: string): string {
  return path.dirname(filePath);
}

export function joinPaths(...paths: string[]): string {
  return path.join(...paths);
}

export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath);
}

export function normalizePath(filePath: string): string {
  return path.normalize(filePath);
}

export function parsePath(filePath: string): PathObject {
  return path.parse(filePath);
}

export function formatPath(pathObject: PathObject): string {
  return path.format(pathObject);
}

export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

export function resolvePath(...pathSegments: string[]): string {
  return path.resolve(...pathSegments);
}

export const pathSeparator = path.sep;
