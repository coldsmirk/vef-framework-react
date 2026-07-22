import type {
  AxiosAdapter,
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig
} from "axios";
import type * as AxiosModule from "axios";

import type { ApiResult, AuthTokens, HttpClientOptions } from "./types";

import { AxiosHeaders, CanceledError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HttpClient } from "./client";
import { BODY_ENCODING_HEADER, SKIP_AUTH_HEADER, SKIP_AUTH_VALUE } from "./constants";
import { BusinessError } from "./errors";

// ──────────────────────────────────────────────────────────────────────────
// Module-level mock infrastructure
// ──────────────────────────────────────────────────────────────────────────

// `vi.hoisted` makes the mock instance available inside the `vi.mock("axios")`
// factory (which Vitest hoists to the top of the file) and in tests. We need a
// shared reference so the spec can observe interceptor registration and inject
// responses through the same mock that HttpClient sees.

const mocks = vi.hoisted(() => {
  return {
    adapter: undefined as AxiosAdapter | undefined,
    instance: {
      get: vi.fn(),
      post: vi.fn(),
      postForm: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      // Invoked when HttpClient does `this.#axiosInstance(config)` (retryRequest).
      call: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() }
      }
    }
  };
});

vi.mock("axios", async importOriginal => {
  const original = await importOriginal<typeof AxiosModule>();
  const { CanceledError } = original;

  // axios.create() must return a callable that also exposes get/post/.../interceptors.
  const create = vi.fn((config?: AxiosRequestConfig) => {
    if (mocks.adapter) {
      return original.default.create({ ...config, adapter: mocks.adapter });
    }

    const fn = mocks.instance.call as unknown as Record<string, unknown>;
    Object.assign(fn, {
      get: mocks.instance.get,
      post: mocks.instance.post,
      postForm: mocks.instance.postForm,
      put: mocks.instance.put,
      delete: mocks.instance.delete,
      interceptors: mocks.instance.interceptors
    });
    return fn;
  });

  return {
    ...original,
    default: { create, CanceledError },
    CanceledError
  };
});

// ──────────────────────────────────────────────────────────────────────────
// Shared helpers and stubs (module scope to satisfy lint and to keep tests
// focused on the behavior being verified rather than callback wiring).
// ──────────────────────────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function defer<T>(): Deferred<T> {
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<T>();

  return {
    promise,
    resolve,
    reject
  };
}

const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
const renewedTokens: Readonly<AuthTokens> = { accessToken: "NEW", refreshToken: "RT2" };

function getOldTokens(): Readonly<AuthTokens> {
  return oldTokens;
}

function getRenewedTokens(): Readonly<AuthTokens> {
  return renewedTokens;
}

function rejectRefresh(): never {
  throw new Error("refresh failed");
}

// Function.prototype is a no-op function — useful for silencing console without
// running into `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

function silenceConsole(method: "warn" | "info" | "error"): void {
  vi.spyOn(console, method).mockImplementation(silence);
}

// Independently derive the base64 the client should produce, using the same
// portable path (btoa) rather than the not-yet-universal Uint8Array#toBase64.
function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 0x80_00) {
    binary += String.fromCodePoint(...bytes.subarray(offset, offset + 0x80_00));
  }

  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Browser support for Uint8Array#toBase64 is still not universal.
  return btoa(binary);
}

type RequestHandler = (config: InternalAxiosRequestConfig) => Promise<InternalAxiosRequestConfig>;

type ResponseHandler = (response: AxiosResponse<unknown>) => AxiosResponse<unknown>;

type ResponseErrorHandler = (error: AxiosError<unknown>) => Promise<unknown>;

type Transport = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse<unknown>>;

interface Handlers {
  request: RequestHandler;
  responseSuccess: ResponseHandler;
  responseError: ResponseErrorHandler;
}

function buildHttpClient(options?: Partial<HttpClientOptions>): {
  client: HttpClient;
  handlers: Handlers;
} {
  const client = new HttpClient({ baseUrl: "http://test", ...options } as HttpClientOptions);

  const lastRequestUse = mocks.instance.interceptors.request.use.mock.calls.at(-1);
  const lastResponseUse = mocks.instance.interceptors.response.use.mock.calls.at(-1);

  if (!lastRequestUse || !lastResponseUse) {
    throw new Error("HttpClient did not register interceptors");
  }

  return {
    client,
    handlers: {
      request: lastRequestUse[0] as RequestHandler,
      responseSuccess: lastResponseUse[0] as ResponseHandler,
      responseError: lastResponseUse[1] as ResponseErrorHandler
    }
  };
}

function makeConfig(overrides: Partial<InternalAxiosRequestConfig> = {}): InternalAxiosRequestConfig {
  return {
    url: "/test",
    method: "get",
    headers: {} as InternalAxiosRequestConfig["headers"],
    ...overrides
  } as InternalAxiosRequestConfig;
}

function makeOkResponse<T>(data: T, code = 0, message = "ok"): AxiosResponse<ApiResult<T>> {
  return {
    data: {
      code,
      message,
      data
    },
    status: 200,
    statusText: "OK",
    headers: {},
    config: makeConfig()
  } as AxiosResponse<ApiResult<T>>;
}

function makeResponse<T>(
  data: T,
  config = makeConfig(),
  headers: AxiosResponse<T>["headers"] = {}
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers,
    config
  };
}

function emptyJson(): Record<string, unknown> {
  return {};
}

function makeAxiosError(
  status: number,
  body: unknown,
  config?: Partial<InternalAxiosRequestConfig>
): AxiosError<unknown> {
  const fullConfig = makeConfig(config);
  return {
    name: "AxiosError",
    message: `Request failed with status code ${status}`,
    isAxiosError: true,
    toJSON: emptyJson,
    response: {
      data: body,
      status,
      statusText: "",
      headers: {},
      config: fullConfig
    },
    config: fullConfig
  } as AxiosError<unknown>;
}

function normalizeRequestHeaders(headers: AxiosRequestConfig["headers"]): AxiosHeaders {
  if (!headers) {
    return new AxiosHeaders();
  }

  if (headers instanceof AxiosHeaders) {
    return AxiosHeaders.from(headers);
  }

  const normalized = new AxiosHeaders();

  for (const [name, value] of Object.entries(headers)) {
    if (!(value instanceof AxiosHeaders)) {
      normalized.set(name, value);
    }
  }

  return normalized;
}

function installAxiosDriver(handlers: Handlers, transport: Transport): void {
  async function dispatch(config: InternalAxiosRequestConfig): Promise<AxiosResponse<unknown> | unknown> {
    const requestConfig = await handlers.request(config);
    let response: AxiosResponse<unknown>;

    try {
      response = await transport(requestConfig);
    } catch (error) {
      return handlers.responseError(error as AxiosError<unknown>);
    }

    return handlers.responseSuccess(response);
  }

  mocks.instance.get.mockImplementation((url: string, config?: AxiosRequestConfig) => dispatch(makeConfig({
    ...config,
    headers: normalizeRequestHeaders(config?.headers),
    method: "get",
    url
  })));
  mocks.instance.post.mockImplementation((url: string, data?: unknown, config?: AxiosRequestConfig) => dispatch(makeConfig({
    ...config,
    data,
    headers: normalizeRequestHeaders(config?.headers),
    method: "post",
    url
  })));
  mocks.instance.call.mockImplementation((config: InternalAxiosRequestConfig) => dispatch(config));
}

function mockBrowserDownload(): {
  click: ReturnType<typeof vi.spyOn>;
  createObjectURL: ReturnType<typeof vi.spyOn>;
  revokeObjectURL: ReturnType<typeof vi.spyOn>;
} {
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(silence);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(silence);

  return {
    click,
    createObjectURL,
    revokeObjectURL
  };
}

const EXPIRED_CODE = 10_086;
const NON_EXPIRED_AUTH_CODE = 99_999;

const EXPIRED_BODY: ApiResult = {
  code: EXPIRED_CODE,
  message: "expired",
  data: null
};

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("http/HttpClient", () => {
  beforeEach(() => {
    mocks.adapter = undefined;
    mocks.instance.get.mockReset();
    mocks.instance.post.mockReset();
    mocks.instance.postForm.mockReset();
    mocks.instance.put.mockReset();
    mocks.instance.delete.mockReset();
    mocks.instance.call.mockReset();
    mocks.instance.interceptors.request.use.mockClear();
    mocks.instance.interceptors.response.use.mockClear();
  });

  afterEach(() => {
    if (vi.isFakeTimers()) {
      vi.clearAllTimers();
      vi.useRealTimers();
    }

    vi.restoreAllMocks();
  });

  describe("request interceptor", () => {
    describe("path parameter replacement", () => {
      it("replaces a single :param with its value from params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: { id: 123 } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/123");
      });

      it("replaces multiple :params from params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({
          url: "/orgs/:orgId/users/:userId",
          params: { orgId: "acme", userId: 7 }
        });
        const result = await handlers.request(config);

        expect(result.url).toBe("/orgs/acme/users/7");
      });

      it("substitutes 'unknown' when the params object lacks the key", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(silence);
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: {} });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/unknown");
        expect(warnSpy).toHaveBeenCalled();
      });

      it("substitutes 'unknown' when the param value is null", async () => {
        silenceConsole("warn");
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/users/:id", params: { id: null } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/users/unknown");
      });

      it("replaces :params in an absolute URL while leaving the port untouched", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "http://192.168.10.198:8100/api/files/:id", params: { id: 5 } });
        const result = await handlers.request(config);

        expect(result.url).toBe("http://192.168.10.198:8100/api/files/5");
      });

      it("leaves an absolute URL with a port untouched when it has no :params", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(silence);
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "https://minio.local:9000/bucket/report.pdf", params: {} });
        const result = await handlers.request(config);

        expect(result.url).toBe("https://minio.local:9000/bucket/report.pdf");
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it("ignores a colon inside a path segment", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/schedule/12:30", params: {} });
        const result = await handlers.request(config);

        expect(result.url).toBe("/schedule/12:30");
      });

      it("leaves the URL untouched when there are no :params", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig({ url: "/health", params: { foo: "bar" } });
        const result = await handlers.request(config);

        expect(result.url).toBe("/health");
      });
    });

    describe("auth token injection", () => {
      it("injects a Bearer Authorization header from getAuthTokens", async () => {
        const getAuthTokens = vi.fn(getOldTokens);
        const { handlers } = buildHttpClient({ getAuthTokens });

        const config = makeConfig();
        const result = await handlers.request(config);

        expect(result.headers.Authorization).toBe("Bearer OLD");
      });

      it("does not set Authorization when getAuthTokens is not configured", async () => {
        const { handlers } = buildHttpClient();

        const config = makeConfig();
        const result = await handlers.request(config);

        expect(result.headers.Authorization).toBeUndefined();
      });

      it("skips auth and strips the skip-auth header when SKIP_AUTH_HEADER is set", async () => {
        const getAuthTokens = vi.fn(getOldTokens);
        const { handlers } = buildHttpClient({ getAuthTokens });

        const config = makeConfig({
          headers: { [SKIP_AUTH_HEADER]: SKIP_AUTH_VALUE } as unknown as InternalAxiosRequestConfig["headers"]
        });
        const result = await handlers.request(config);

        expect(getAuthTokens).not.toHaveBeenCalled();
        expect(result.headers[SKIP_AUTH_HEADER]).toBeUndefined();
        expect(result.headers.Authorization).toBeUndefined();
      });
    });
  });

  describe("response interceptor (business code)", () => {
    it("returns the response when the business code matches the default okCode (0)", () => {
      const { handlers } = buildHttpClient();
      const response = makeOkResponse({ id: 1 });

      const result = handlers.responseSuccess(response);

      expect(result).toBe(response);
    });

    it("throws BusinessError when the business code does not match okCode", () => {
      silenceConsole("warn");
      const { handlers } = buildHttpClient();
      const response = makeOkResponse(null, 1001, "validation failed");

      function trigger() {
        handlers.responseSuccess(response);
      }

      expect(trigger).toThrow(BusinessError);
      expect(trigger).toThrow("validation failed");
    });

    it("accepts an array of okCodes", () => {
      const { handlers } = buildHttpClient({ okCode: [0, 200] });

      const responseA = makeOkResponse(null, 0);
      const responseB = makeOkResponse(null, 200);

      expect(handlers.responseSuccess(responseA)).toBe(responseA);
      expect(handlers.responseSuccess(responseB)).toBe(responseB);
    });

    it("returns raw blob responses without applying business-code handling", () => {
      const { handlers } = buildHttpClient();
      const config = makeConfig({ responseType: "blob" });
      Reflect.set(config, "__vefResponseMode", "raw");
      const response = makeResponse(new Blob(["file"]), config);

      expect(handlers.responseSuccess(response)).toBe(response);
    });
  });

  describe("response error handling", () => {
    it("invokes onAccessDenied on 403 and rethrows", async () => {
      const onAccessDenied = vi.fn();
      silenceConsole("warn");
      const { handlers } = buildHttpClient({ onAccessDenied });

      const error = makeAxiosError(403, {
        code: 403,
        message: "forbidden",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
      expect(onAccessDenied).toHaveBeenCalledTimes(1);
    });

    it("logs and rethrows on non-handled status codes (500)", async () => {
      silenceConsole("error");
      const { handlers } = buildHttpClient();

      const error = makeAxiosError(500, {
        code: 500,
        message: "server error",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
    });

    it("rethrows network errors that have no response", async () => {
      silenceConsole("error");
      const { handlers } = buildHttpClient();

      const error = {
        name: "Error",
        message: "Network Error",
        isAxiosError: true,
        toJSON: emptyJson
      } as AxiosError<ApiResult>;

      await expect(handlers.responseError(error)).rejects.toBe(error);
    });
  });

  describe("401 token refresh queue", () => {
    it("invokes refreshToken exactly once when multiple requests fail concurrently with a token-expired 401", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const getAuthTokens = vi.fn(getOldTokens);
      const setAuthTokens = vi.fn();
      const refreshToken = vi.fn(() => refreshDeferred.promise);
      mocks.instance.call.mockResolvedValue(makeOkResponse(null));

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens,
        setAuthTokens,
        refreshToken
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));
      const p2 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));
      const p3 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));

      // Let microtasks settle so the refresh kicks off.
      await Promise.resolve();
      await Promise.resolve();

      expect(refreshToken).toHaveBeenCalledTimes(1);

      refreshDeferred.resolve(renewedTokens);
      await Promise.allSettled([p1, p2, p3]);

      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
    });

    it("resolves the triggering request with the retried response after a successful refresh", async () => {
      const retriedResponse = makeOkResponse({ id: 42 });
      const setAuthTokens = vi.fn();
      mocks.instance.call.mockResolvedValue(retriedResponse);

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: getOldTokens,
        setAuthTokens,
        refreshToken: getRenewedTokens
      });

      const result = await handlers.responseError(makeAxiosError(401, EXPIRED_BODY));

      expect(result).toBe(retriedResponse);
    });

    it("invokes onUnauthenticated for queued requests when the refresh fails", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      silenceConsole("info");

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise,
        onUnauthenticated
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));

      await Promise.resolve();
      await Promise.resolve();

      refreshDeferred.reject(new Error("refresh failed"));
      await expect(p1).rejects.toThrow();

      expect(onUnauthenticated).toHaveBeenCalled();
    });

    it("queues new requests during refresh and dispatches them with the refreshed token", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      let currentTokens: Readonly<AuthTokens> = oldTokens;
      silenceConsole("error");
      mocks.instance.call.mockResolvedValue(makeOkResponse(null));

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: () => currentTokens,
        setAuthTokens: tokens => {
          currentTokens = tokens;
        },
        refreshToken: () => refreshDeferred.promise
      });

      // p1 triggers the refresh path; a successful refresh resolves it with the
      // retried response. We only assert how the *queued* request is dispatched,
      // so p1's own result is irrelevant here.
      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY));
      await Promise.resolve();
      await Promise.resolve();

      // A new request arriving while #isRefreshing=true must queue in the
      // request interceptor and resume once the refresh resolves.
      const queuedRequest = handlers.request(makeConfig({ url: "/queued" }));

      refreshDeferred.resolve(renewedTokens);
      const queuedConfig = await queuedRequest;
      await p1;

      expect(queuedConfig.headers.Authorization).toBe("Bearer NEW");
    });

    it("rejects queued requests with '登录已过期' when refresh fails", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      silenceConsole("error");
      silenceConsole("info");

      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise
      });

      const p1 = handlers.responseError(makeAxiosError(401, EXPIRED_BODY))
        .catch(silence);
      await Promise.resolve();
      await Promise.resolve();

      const queuedRequest = handlers.request(makeConfig({ url: "/queued" }));

      refreshDeferred.reject(new Error("refresh failed"));

      await expect(queuedRequest).rejects.toThrow("登录已过期");
      await p1;
    });

    it("calls onUnauthenticated immediately for a non-expired 401", async () => {
      const onUnauthenticated = vi.fn();
      const { handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        onUnauthenticated
      });

      const error = makeAxiosError(401, {
        code: NON_EXPIRED_AUTH_CODE,
        message: "auth required",
        data: null
      });

      await expect(handlers.responseError(error)).rejects.toBe(error);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });

  describe("ensureTokenRefreshed (public)", () => {
    it("returns true and persists new tokens when refresh succeeds", async () => {
      const setAuthTokens = vi.fn();
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens,
        refreshToken: getRenewedTokens
      });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(true);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
    });

    it("returns false and triggers onUnauthenticated when refresh fails", async () => {
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: rejectRefresh,
        onUnauthenticated
      });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(false);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });

    it("triggers onUnauthenticated once when concurrent callers share a failed refresh", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise,
        onUnauthenticated
      });

      const firstRefresh = client.ensureTokenRefreshed();
      const secondRefresh = client.ensureTokenRefreshed();

      refreshDeferred.reject(new Error("refresh failed"));

      await expect(firstRefresh).resolves.toBe(false);
      await expect(secondRefresh).resolves.toBe(false);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });

    it("does not trigger onUnauthenticated when a false caller owns the failed refresh", async () => {
      const refreshDeferred = defer<Readonly<AuthTokens>>();
      const onUnauthenticated = vi.fn();
      silenceConsole("error");
      const { client } = buildHttpClient({
        getAuthTokens: getOldTokens,
        setAuthTokens: silence,
        refreshToken: () => refreshDeferred.promise,
        onUnauthenticated
      });

      const refresh = client.ensureTokenRefreshed(false);

      refreshDeferred.reject(new Error("refresh failed"));

      await expect(refresh).resolves.toBe(false);
      expect(onUnauthenticated).not.toHaveBeenCalled();
    });

    it("returns false when refresh callbacks are missing", async () => {
      const onUnauthenticated = vi.fn();
      const { client } = buildHttpClient({ onUnauthenticated });

      const success = await client.ensureTokenRefreshed();

      expect(success).toBe(false);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    });
  });

  describe("public HTTP methods", () => {
    it("get() unwraps the response.data field from axios's response envelope", async () => {
      mocks.instance.get.mockResolvedValue({
        data: {
          code: 0,
          message: "ok",
          data: { id: 1 }
        }
      });
      const { client } = buildHttpClient();

      const result = await client.get<{ id: number }>("/users/1");

      expect(result).toEqual({
        code: 0,
        message: "ok",
        data: { id: 1 }
      });
      expect(mocks.instance.get).toHaveBeenCalledWith("/users/1", undefined);
    });

    it("post() passes data and options separately to axios.post", async () => {
      mocks.instance.post.mockResolvedValue({
        data: {
          code: 0,
          message: "ok",
          data: null
        }
      });
      const { client } = buildHttpClient();

      await client.post("/users", { data: { name: "alice" }, headers: { "X-Trace": "t1" } });

      expect(mocks.instance.post).toHaveBeenCalledWith(
        "/users",
        { name: "alice" },
        expect.objectContaining({ headers: { "X-Trace": "t1" } })
      );
    });
  });

  describe("body encoding", () => {
    beforeEach(() => {
      mocks.instance.post.mockResolvedValue({
        data: {
          code: 0,
          message: "ok",
          data: null
        }
      });
    });

    it("base64-encodes the request body and marks it with the header", async () => {
      const { client } = buildHttpClient();
      const payload = { resource: "integration/adapter", action: "save" };

      await client.post("/api", { data: payload, bodyEncoding: "base64" });

      expect(mocks.instance.post).toHaveBeenCalledWith(
        "/api",
        base64Utf8(JSON.stringify(payload)),
        expect.objectContaining({ headers: { [BODY_ENCODING_HEADER]: "base64" } })
      );
    });

    it("sends the raw object and no marker header when encoding is not requested", async () => {
      const { client } = buildHttpClient();
      const payload = { resource: "integration/contract" };

      await client.post("/api", { data: payload });

      expect(mocks.instance.post).toHaveBeenCalledWith("/api", payload, {});
    });

    it("applies the client default encoding when a request does not specify one", async () => {
      const { client } = buildHttpClient({ defaultBodyEncoding: "base64" });
      const payload = { resource: "integration/route" };

      await client.post("/api", { data: payload });

      expect(mocks.instance.post).toHaveBeenCalledWith(
        "/api",
        base64Utf8(JSON.stringify(payload)),
        expect.objectContaining({ headers: { [BODY_ENCODING_HEADER]: "base64" } })
      );
    });

    it("lets a request opt out of the client default with none", async () => {
      const { client } = buildHttpClient({ defaultBodyEncoding: "base64" });
      const payload = { resource: "integration/route" };

      await client.post("/api", { data: payload, bodyEncoding: "none" });

      expect(mocks.instance.post).toHaveBeenCalledWith("/api", payload, {});
    });

    it("does not encode a multipart body", async () => {
      const { client } = buildHttpClient({ defaultBodyEncoding: "base64" });
      const form = new FormData();
      form.append("field", "value");

      await client.post("/api", { data: form });

      expect(mocks.instance.post).toHaveBeenCalledWith("/api", form, {});
    });
  });

  describe("requestFile", () => {
    it("returns the blob and the filename parsed from Content-Disposition", async () => {
      const blob = new Blob(["binary"], { type: "application/pdf" });
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(blob, config, {
        "content-disposition": "attachment; filename=report.pdf"
      })));

      const result = await client.requestFile("/files/1");

      expect(result.blob).toBe(blob);
      expect(result.filename).toBe("report.pdf");
    });

    it("returns an undefined filename when the header is missing", async () => {
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config)));

      const result = await client.requestFile("/files/1");

      expect(result.filename).toBeUndefined();
    });

    it("normalizes an ArrayBuffer response to a blob with the response content type", async () => {
      const data = new TextEncoder().encode("binary").buffer;
      const { client, handlers } = buildHttpClient();
      const controller = new AbortController();
      const onProgress = vi.fn();
      const transport = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(makeResponse(data, config, {
        "content-type": "application/pdf"
      })));
      installAxiosDriver(handlers, transport);

      const result = await client.requestFile("/files/1", {
        signal: controller.signal,
        onProgress
      });

      expect(transport).toHaveBeenCalledWith(expect.objectContaining({
        onDownloadProgress: onProgress,
        responseEncoding: "binary",
        responseType: "arraybuffer",
        signal: controller.signal
      }));
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("application/pdf");
      expect(await result.blob.text()).toBe("binary");
    });

    it("normalizes the typed array returned by the Node adapter to a blob", async () => {
      const data = new TextEncoder().encode("node-binary");
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(data, config, {
        "content-type": "application/octet-stream"
      })));

      const result = await client.requestFile("/files/1");

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("application/octet-stream");
      expect(await result.blob.text()).toBe("node-binary");
    });

    it("throws BusinessError for an error envelope returned as a successful blob", async () => {
      silenceConsole("warn");
      const blob = new Blob([
        JSON.stringify({
          code: 1001,
          message: "export failed",
          data: null
        })
      ], { type: "application/json" });
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(blob, config, {
        "content-type": "application/json"
      })));

      await expect(client.requestFile("/files/1")).rejects.toMatchObject({
        name: "BusinessError",
        code: 1001,
        message: "export failed"
      });
    });
  });

  describe("download", () => {
    it("preserves raw response handling through the real Axios interceptor pipeline", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const blob = new Blob(["file"]);
      let responseMode: unknown;

      const adapter: AxiosAdapter = config => {
        responseMode = Reflect.get(config, "__vefResponseMode");
        return Promise.resolve(makeResponse(blob, config, AxiosHeaders.from({
          "content-disposition": "attachment; filename=report.pdf"
        })));
      };

      mocks.adapter = adapter;
      const client = new HttpClient({ baseUrl: "http://test" });

      await client.download("/reports/1");

      expect(responseMode).toBe("raw");
      expect(browser.click).toHaveBeenCalledTimes(1);
      expect(browser.click.mock.instances[0]).toMatchObject({ download: "report.pdf" });
    });

    it("downloads an oversized binary response without reading its body as text", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const blob = new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "application/octet-stream" });
      const textSpy = vi.spyOn(blob, "text");
      const { client, handlers } = buildHttpClient();
      const transport = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(makeResponse(blob, config, {
        "content-disposition": "attachment; filename=report.pdf"
      })));
      installAxiosDriver(handlers, transport);

      await client.download("/reports/1");

      expect(transport).toHaveBeenCalledTimes(1);
      expect(transport).toHaveBeenCalledWith(expect.objectContaining({
        method: "get",
        responseEncoding: "binary",
        responseType: "arraybuffer",
        url: "/reports/1"
      }));
      expect(textSpy).not.toHaveBeenCalled();
      expect(browser.createObjectURL).toHaveBeenCalledWith(blob);
      expect(browser.click).toHaveBeenCalledTimes(1);
      expect(browser.click.mock.instances[0]).toMatchObject({
        download: "report.pdf",
        href: "blob:test"
      });
      expect(browser.revokeObjectURL).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    });

    it("passes the request body to POST downloads", async () => {
      vi.useFakeTimers();
      mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      const transport = vi.fn((config: InternalAxiosRequestConfig) => Promise.resolve(makeResponse(
        new Blob(["file"]),
        config,
        { "content-disposition": "attachment; filename=report.pdf" }
      )));
      installAxiosDriver(handlers, transport);

      await client.download("/reports", { data: { id: 1 }, method: "post" });

      expect(transport).toHaveBeenCalledWith(expect.objectContaining({
        data: { id: 1 },
        method: "post",
        url: "/reports"
      }));
    });

    it("revokes the object URL when triggering the download throws", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const clickError = new Error("click failed");
      browser.click.mockImplementation(() => {
        throw clickError;
      });
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; filename=report.pdf"
      })));

      await expect(client.download("/reports/1")).rejects.toBe(clickError);
      expect(browser.revokeObjectURL).not.toHaveBeenCalled();

      vi.runAllTimers();

      expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:test");
    });

    it("throws BusinessError for an error envelope returned as a successful blob", async () => {
      silenceConsole("warn");
      const browser = mockBrowserDownload();
      const blob = new Blob([
        JSON.stringify({
          code: 1001,
          message: "export failed",
          data: { reason: "empty" }
        })
      ], { type: "application/json" });
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(blob, config, {
        "content-disposition": "attachment; filename=error.json",
        "content-type": "application/json"
      })));

      const promise = client.download("/reports/1");

      await expect(promise).rejects.toMatchObject({
        name: "BusinessError",
        code: 1001,
        message: "export failed",
        data: { reason: "empty" }
      });
      expect(browser.createObjectURL).not.toHaveBeenCalled();
      expect(browser.click).not.toHaveBeenCalled();
    });

    it("downloads JSON files that are not API response envelopes", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const blob = new Blob([JSON.stringify({ rows: [1, 2] })], { type: "application/json" });
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(blob, config, {
        "content-type": "application/json"
      })));

      await client.download("/reports/1", { filename: "report.json" });

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "report.json" });
    });

    it("refreshes an expired token from a binary 401 response and downloads the retry", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      let currentTokens: Readonly<AuthTokens> = oldTokens;
      let requestCount = 0;
      const setAuthTokens = vi.fn((tokens: Readonly<AuthTokens>) => {
        currentTokens = tokens;
      });
      const refreshToken = vi.fn(getRenewedTokens);
      const onUnauthenticated = vi.fn();
      const { client, handlers } = buildHttpClient({
        tokenExpiredCode: EXPIRED_CODE,
        getAuthTokens: () => currentTokens,
        setAuthTokens,
        refreshToken,
        onUnauthenticated
      });
      const transport = vi.fn((config: InternalAxiosRequestConfig) => {
        requestCount += 1;

        if (requestCount === 1) {
          const errorBytes = new TextEncoder().encode(JSON.stringify(EXPIRED_BODY));
          return Promise.reject(makeAxiosError(401, errorBytes, config));
        }

        return Promise.resolve(makeResponse(new TextEncoder().encode("file"), config, {
          "content-disposition": "attachment; filename=report.pdf"
        }));
      });
      installAxiosDriver(handlers, transport);

      await client.download("/reports/1");

      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
      expect(onUnauthenticated).not.toHaveBeenCalled();
      expect(transport).toHaveBeenCalledTimes(2);
      const retriedConfig = transport.mock.calls[1]?.[0];

      if (!retriedConfig) {
        throw new Error("The download request was not retried");
      }

      expect(retriedConfig.headers.Authorization).toBe("Bearer NEW");
      expect(Reflect.get(retriedConfig, "__vefResponseMode")).toBe("raw");
      expect(browser.click).toHaveBeenCalledTimes(1);
    });

    it("does not read oversized blob error bodies", async () => {
      silenceConsole("error");
      const { handlers } = buildHttpClient();
      const blob = new Blob([new Uint8Array(1024 * 1024 + 1)]);
      const textSpy = vi.spyOn(blob, "text");
      const error = makeAxiosError(500, blob);

      await expect(handlers.responseError(error)).rejects.toBe(error);
      expect(textSpy).not.toHaveBeenCalled();
    });

    it("preserves cancellation errors", async () => {
      const { handlers } = buildHttpClient();
      const error = new CanceledError("cancelled");

      await expect(handlers.responseError(error)).rejects.toBe(error);
    });

    it("removes quotes from a Content-Disposition filename", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; filename=\"report.pdf\""
      })));

      await client.download("/reports/1");

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "report.pdf" });
    });

    it("decodes and prefers an RFC 5987 filename", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; filename=report.pdf; filename*=UTF-8''%E6%B5%8B%E8%AF%95.pdf"
      })));

      await client.download("/reports/1");

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "测试.pdf" });
    });

    it("keeps literal percent characters in regular filenames", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; filename=\"100%.pdf\""
      })));

      await client.download("/reports/1");

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "100%.pdf" });
    });

    it("matches the filename parameter by its exact name", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; x-filename=wrong.txt; filename=right.pdf"
      })));

      await client.download("/reports/1");

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "right.pdf" });
    });

    it("uses an explicit filename when Content-Disposition is missing", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config)));

      await client.download("/reports/1", { filename: "report.pdf" });

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "report.pdf" });
    });

    it("uses a deterministic fallback when no filename is available", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config)));

      await client.download("/reports/1");

      expect(browser.click.mock.instances[0]).toMatchObject({ download: "download" });
    });

    it("passes the decoded server filename to a filename callback", async () => {
      vi.useFakeTimers();
      const browser = mockBrowserDownload();
      const filename = vi.fn((originalFilename: string) => `copy-${originalFilename}`);
      const { client, handlers } = buildHttpClient();
      installAxiosDriver(handlers, config => Promise.resolve(makeResponse(new Blob(["file"]), config, {
        "content-disposition": "attachment; filename*=UTF-8''report%20final.pdf"
      })));

      await client.download("/reports/1", { filename });

      expect(filename).toHaveBeenCalledWith("report final.pdf");
      expect(browser.click.mock.instances[0]).toMatchObject({ download: "copy-report final.pdf" });
    });
  });
});
