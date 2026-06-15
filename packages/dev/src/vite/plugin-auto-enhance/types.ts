import type { types } from "recast";

/**
 * Context information for auto-enhance plugins
 */
export interface AutoEnhanceContext {
  /**
   * File ID (full path)
   */
  id: string;
  /**
   * File name (last few levels of relative path)
   */
  fileName: string;
  /**
   * Original source code
   */
  code: string;
  /**
   * AST root node
   */
  ast: types.ASTNode;
}

/**
 * Transform result from auto-enhance plugins
 */
export interface TransformResult {
  /**
   * Whether changes were made
   */
  hasChanges: boolean;
  /**
   * Log messages
   */
  logs?: string[];
}

/**
 * Auto-enhance sub-plugin interface
 */
export interface AutoEnhancePlugin {
  /**
   * Plugin name
   */
  name: string;
  /**
   * Plugin description
   */
  description?: string;
  /**
   * Whether this file should be processed
   */
  shouldProcess?: (context: AutoEnhanceContext) => boolean;
  /**
   * Execute transformation
   */
  transform: (context: AutoEnhanceContext) => TransformResult;
}

/**
 * File pattern type for include/exclude options
 */
export type FilePattern = string | RegExp | Array<string | RegExp>;

/**
 * Auto-enhance plugin configuration
 */
export interface AutoEnhanceOptions {
  /**
   * List of enabled sub-plugins
   */
  plugins?: AutoEnhancePlugin[];
  /**
   * File filter, only process matching files
   */
  include?: FilePattern;
  /**
   * File excluder, skip matching files
   */
  exclude?: FilePattern;
  /**
   * Custom log prefix
   */
  logPrefix?: string;
}
