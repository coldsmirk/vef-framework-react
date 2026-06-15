/**
 * Business error returned by the API when the response code indicates a business logic failure.
 */
export class BusinessError extends Error {
  /**
   * The business error code from the API response.
   */
  readonly code: number;
  /**
   * The original API response data.
   */
  readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "BusinessError";
    this.code = code;
    this.data = data;
  }
}
