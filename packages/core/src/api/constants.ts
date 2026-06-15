import { HTTP_CLIENT_KEY } from "../http";
import { QUERY_CLIENT_KEY } from "../query";

/**
 * HTTP methods that should have the abort signal injected.
 */
export const PROXIED_METHODS = new Set(["get", "post", "put", "delete", "upload", "download"]);

/**
 * Symbol for accessing the query client.
 */
export const QUERY_CLIENT = Symbol.for(QUERY_CLIENT_KEY);

/**
 * Symbol for accessing the HTTP client.
 */
export const HTTP_CLIENT = Symbol.for(HTTP_CLIENT_KEY);
