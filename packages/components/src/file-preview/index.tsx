import type { MaybeNull } from "@vef-framework-react/shared";
import type { ReactElement, ReactNode } from "react";

import type { FilePreviewHandler } from "./types";

import { createContext, use } from "react";

const FilePreviewContext = createContext<MaybeNull<FilePreviewHandler>>(null);
FilePreviewContext.displayName = "FilePreviewContext";

export interface FilePreviewProviderProps {
  /**
   * The application's preview host. See `FilePreviewHandler`.
   */
  handler: FilePreviewHandler;
  children?: ReactNode;
}

/**
 * Install an application-provided file-preview host. Components that offer
 * a preview affordance (`<Upload>` and everything built on it) dispatch
 * non-image files to the nearest provider instead of handling them.
 */
export function FilePreviewProvider({ handler, children }: FilePreviewProviderProps): ReactElement {
  return <FilePreviewContext value={handler}>{children}</FilePreviewContext>;
}

/**
 * Read the nearest file-preview host, or null when none is installed.
 */
export function useFilePreview(): MaybeNull<FilePreviewHandler> {
  return use(FilePreviewContext);
}

export type { FilePreviewHandler, FilePreviewTarget } from "./types";
