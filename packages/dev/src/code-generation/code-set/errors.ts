/**
 * Thrown when code generation input or configuration is invalid (bad config shape,
 * key charset violation, output path escape, output is a symlink, etc.).
 *
 * The CLI always surfaces these errors so misconfiguration or
 * backend-injected bad data never silently slips through to the generated
 * type file.
 */
export class CodeGenerationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeGenerationValidationError";
  }
}
