// @vitest-environment node

import type { IncomingMessage, ServerResponse } from "node:http";

import type { HttpClient } from "./client";
import type { AuthTokens } from "./types";

import { createServer } from "node:http";

interface TestServer {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<TestServer> {
  const server = createServer(handler);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("The test server did not bind to a TCP port");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    })
  };
}

let HttpClientConstructor: typeof HttpClient;

beforeAll(async () => {
  // Keep the shared ID module on its non-browser initialization path.
  vi.stubGlobal("navigator", undefined);
  const clientModule = await import("./client");
  HttpClientConstructor = clientModule.HttpClient;
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("http/HttpClient Node adapter", () => {
  it("returns arbitrary binary bytes as a typed blob with the server filename", async () => {
    const payload = Buffer.from([0, 1, 127, 128, 255]);
    const server = await startServer((_request, response) => {
      response.writeHead(200, {
        "Content-Disposition": "attachment; filename=node.bin",
        "Content-Type": "application/octet-stream"
      });
      response.end(payload);
    });

    try {
      const client = new HttpClientConstructor({ baseUrl: server.baseUrl });

      const result = await client.requestFile("/file");

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe("application/octet-stream");
      expect(result.filename).toBe("node.bin");
      expect([...new Uint8Array(await result.blob.arrayBuffer())]).toEqual([...payload]);
    } finally {
      await server.close();
    }
  });

  it("parses a Buffer 401 envelope and returns the retried binary response", async () => {
    const expiredCode = 41_001;
    const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
    const renewedTokens: Readonly<AuthTokens> = { accessToken: "NEW", refreshToken: "RT2" };
    const authorizationHeaders: Array<string | undefined> = [];
    let requestCount = 0;
    let currentTokens = oldTokens;
    const server = await startServer((request, response) => {
      requestCount += 1;
      authorizationHeaders.push(request.headers.authorization);

      if (requestCount === 1) {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          code: expiredCode,
          message: "token expired",
          data: null
        }));
        return;
      }

      response.writeHead(200, {
        "Content-Disposition": "attachment; filename=refreshed.bin",
        "Content-Type": "application/octet-stream"
      });
      response.end(Buffer.from([255, 0, 128]));
    });
    const refreshToken = vi.fn(() => renewedTokens);
    const setAuthTokens = vi.fn((tokens: Readonly<AuthTokens>) => {
      currentTokens = tokens;
    });

    try {
      const client = new HttpClientConstructor({
        baseUrl: server.baseUrl,
        getAuthTokens: () => currentTokens,
        setAuthTokens,
        refreshToken,
        tokenExpiredCode: expiredCode
      });

      const result = await client.requestFile("/file");

      expect(refreshToken).toHaveBeenCalledTimes(1);
      expect(setAuthTokens).toHaveBeenCalledWith(renewedTokens);
      expect(authorizationHeaders).toEqual(["Bearer OLD", "Bearer NEW"]);
      expect(result.filename).toBe("refreshed.bin");
      expect([...new Uint8Array(await result.blob.arrayBuffer())]).toEqual([255, 0, 128]);
    } finally {
      await server.close();
    }
  });

  it("cancels a request queued behind refresh without canceling the shared refresh", async () => {
    const expiredCode = 41_001;
    const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
    const renewedTokens: Readonly<AuthTokens> = { accessToken: "NEW", refreshToken: "RT2" };
    const refresh = Promise.withResolvers<Readonly<AuthTokens>>();
    const refreshStarted = Promise.withResolvers<void>();
    let currentTokens = oldTokens;
    let queuedRequestCount = 0;
    const server = await startServer((request, response) => {
      if (request.url === "/queued") {
        queuedRequestCount += 1;
      }

      if (request.headers.authorization === "Bearer OLD") {
        response.writeHead(401, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          code: expiredCode,
          message: "token expired",
          data: null
        }));
        return;
      }

      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        code: 0,
        message: "ok",
        data: request.url
      }));
    });

    try {
      const client = new HttpClientConstructor({
        baseUrl: server.baseUrl,
        getAuthTokens: () => currentTokens,
        setAuthTokens: tokens => {
          currentTokens = tokens;
        },
        refreshToken: () => {
          refreshStarted.resolve();
          return refresh.promise;
        },
        tokenExpiredCode: expiredCode
      });
      const triggeringRequest = client.get<string>("/trigger");

      await refreshStarted.promise;

      const controller = new AbortController();
      const queuedRequest = client.get("/queued", { signal: controller.signal });
      controller.abort();

      await expect(queuedRequest).rejects.toMatchObject({
        code: "ERR_CANCELED",
        name: "CanceledError"
      });
      expect(queuedRequestCount).toBe(0);

      refresh.resolve(renewedTokens);

      await expect(triggeringRequest).resolves.toMatchObject({ data: "/trigger" });
      expect(currentTokens).toBe(renewedTokens);
    } finally {
      refresh.resolve(renewedTokens);
      await server.close();
    }
  });

  it("cancels the 401 caller while allowing its shared refresh to finish", async () => {
    const expiredCode = 41_001;
    const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
    const renewedTokens: Readonly<AuthTokens> = { accessToken: "NEW", refreshToken: "RT2" };
    const refresh = Promise.withResolvers<Readonly<AuthTokens>>();
    const refreshStarted = Promise.withResolvers<void>();
    let currentTokens = oldTokens;
    let requestCount = 0;
    const server = await startServer((_request, response) => {
      requestCount += 1;
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        code: expiredCode,
        message: "token expired",
        data: null
      }));
    });

    try {
      const client = new HttpClientConstructor({
        baseUrl: server.baseUrl,
        getAuthTokens: () => currentTokens,
        setAuthTokens: tokens => {
          currentTokens = tokens;
        },
        refreshToken: () => {
          refreshStarted.resolve();
          return refresh.promise;
        },
        tokenExpiredCode: expiredCode
      });
      const controller = new AbortController();
      const request = client.get("/trigger", { signal: controller.signal });

      await refreshStarted.promise;

      const refreshCompletion = client.ensureTokenRefreshed(false);
      controller.abort();

      await expect(request).rejects.toMatchObject({
        code: "ERR_CANCELED",
        name: "CanceledError"
      });

      refresh.resolve(renewedTokens);

      await expect(refreshCompletion).resolves.toBe(true);
      expect(currentTokens).toBe(renewedTokens);
      expect(requestCount).toBe(1);
    } finally {
      refresh.resolve(renewedTokens);
      await server.close();
    }
  });

  it("notifies once when a canceled 401 caller's shared refresh fails", async () => {
    const expiredCode = 41_001;
    const oldTokens: Readonly<AuthTokens> = { accessToken: "OLD", refreshToken: "RT" };
    const refresh = Promise.withResolvers<Readonly<AuthTokens>>();
    const refreshStarted = Promise.withResolvers<void>();
    const notification = Promise.withResolvers<void>();
    const onUnauthenticated = vi.fn(() => notification.resolve());
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let requestCount = 0;
    const server = await startServer((_request, response) => {
      requestCount += 1;
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({
        code: expiredCode,
        message: "token expired",
        data: null
      }));
    });

    try {
      const client = new HttpClientConstructor({
        baseUrl: server.baseUrl,
        getAuthTokens: () => oldTokens,
        setAuthTokens: () => undefined,
        refreshToken: () => {
          refreshStarted.resolve();
          return refresh.promise;
        },
        tokenExpiredCode: expiredCode,
        onUnauthenticated
      });
      const controller = new AbortController();
      const request = client.get("/trigger", { signal: controller.signal });

      await refreshStarted.promise;

      const refreshObserver = client.ensureTokenRefreshed(false);
      controller.abort();

      await expect(request).rejects.toMatchObject({
        code: "ERR_CANCELED",
        name: "CanceledError"
      });

      refresh.reject(new Error("refresh failed"));

      await notification.promise;
      await expect(refreshObserver).resolves.toBe(false);
      expect(onUnauthenticated).toHaveBeenCalledTimes(1);
      expect(requestCount).toBe(1);
    } finally {
      refresh.reject(new Error("refresh failed"));
      consoleError.mockRestore();
      await server.close();
    }
  });
});
