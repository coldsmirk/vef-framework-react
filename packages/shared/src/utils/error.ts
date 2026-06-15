import * as stackTrace from "stacktrace-js";

import { getBaseName } from "./path";

export type StackFrame = stackTrace.StackFrame;

/**
 * Parse error stack and optionally filter frames.
 */
export function parseErrorStack(error: Error, filter?: (frame: StackFrame) => boolean): Promise<StackFrame[]> {
  return stackTrace.fromError(error, {
    offline: true,
    filter
  });
}

/**
 * Filter to exclude node_modules frames (user code only).
 */
export function filterUserFrame(stackFrame: StackFrame): boolean {
  return !stackFrame.fileName || !stackFrame.fileName.includes("node_modules");
}

/**
 * Format stack frame for display.
 */
function formatStackFrame(frame: StackFrame): string {
  const functionName = frame.functionName || "anonymous";
  const fileName = frame.fileName ? getBaseName(frame.fileName, true) : "unknown";
  const location = `${fileName}:${frame.lineNumber}:${frame.columnNumber}`;
  return `    at ${functionName} (${location})`;
}

/**
 * Get sanitized error stack with user frames only.
 */
export async function getSanitizedErrorStack(error: Error): Promise<string> {
  const frames = await parseErrorStack(error, filterUserFrame);
  const cleanStack = frames.map(frame => formatStackFrame(frame)).join("\n");
  return `${error.name}: ${error.message}\n${cleanStack}`;
}

/**
 * Get current call stack.
 */
export function getCurrentStack(filter?: (frame: StackFrame) => boolean): Promise<StackFrame[]> {
  return stackTrace.get({
    offline: true,
    filter
  });
}

/**
 * Get current call stack synchronously.
 */
export function getCurrentStackSync(filter?: (frame: StackFrame) => boolean): StackFrame[] {
  return stackTrace.getSync({
    offline: true,
    filter
  });
}
