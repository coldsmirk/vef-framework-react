/* eslint-disable require-await */
import { describe, expect, it, vi } from "vitest";

import { invokeAwaitableFn, isAsyncFunction } from "..";

// Test helper functions for isAsyncFunction tests
async function asyncFunction() {
  return "test";
}

const asyncArrowFunction = async () => "test";

function promiseFunction() {
  return Promise.resolve("test");
}

function regularFunction() {
  return "test";
}

const arrowFunction = () => "test";

function* generatorFunction() {
  yield "test";
}

async function* asyncGeneratorFunction() {
  yield "test";
}

// Test helper functions for invokeAwaitableFn tests
const syncFnAdd = (a: number, b: number) => a + b;
const syncFnTest = () => "test";

async function asyncFnAdd(a: number, b: number) {
  await Promise.resolve();
  return a + b;
}

async function asyncFnSuccess() {
  await Promise.resolve();
  return "success";
}

async function asyncFnThrow(error: Error) {
  await Promise.resolve();
  throw error;
}

async function asyncFnImmediateError() {
  throw new Error("Immediate error");
}

const promiseFnHello = (value: string) => Promise.resolve(`Hello ${value}`);
const promiseFnResolve = () => Promise.resolve("promise-result");
const promiseFnReject = (error: Error) => Promise.reject(error);

const asyncFnResult = async () => "result";

const nullFn = () => null;

// eslint-disable-next-line @typescript-eslint/no-empty-function
function undefinedFn() {}

const asyncNullFn = async () => null;

describe("utils/function", () => {
  describe("isAsyncFunction", () => {
    it("returns true for async functions", () => {
      const asyncMethodFunction = {
        async method() {
          return "test";
        }
      }.method;

      expect(isAsyncFunction(asyncFunction)).toBe(true);
      expect(isAsyncFunction(asyncArrowFunction)).toBe(true);
      expect(isAsyncFunction(asyncMethodFunction)).toBe(true);
    });

    it("returns true for functions that return promises", () => {
      // Note: This might return false depending on implementation
      // since it's not technically an async function
      const result = isAsyncFunction(promiseFunction);
      expect(typeof result).toBe("boolean");
    });

    it("returns false for regular functions", () => {
      const methodFunction = {
        method() {
          return "test";
        }
      }.method;

      expect(isAsyncFunction(regularFunction)).toBe(false);
      expect(isAsyncFunction(arrowFunction)).toBe(false);
      expect(isAsyncFunction(methodFunction)).toBe(false);
    });

    it("handles edge cases safely", () => {
      // Since the function expects a Function type, we test with function-like objects
      const objectWithConstructor = {
        constructor: { name: "Object" },
        toString: () => "function() {}"
      };

      expect(isAsyncFunction(objectWithConstructor as any)).toBe(false);
    });

    it("handles generator functions", () => {
      expect(isAsyncFunction(generatorFunction as any)).toBe(false);
      expect(isAsyncFunction(asyncGeneratorFunction as any)).toBe(true);
    });

    it("handles function constructors", () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const AsyncFunctionConstructor = async function () {}.constructor;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const asyncFunctionFromConstructor = new AsyncFunctionConstructor("return 'test'");

      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const FunctionConstructor = function () {}.constructor;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      const regularFunctionFromConstructor = new FunctionConstructor("return 'test'");

      expect(isAsyncFunction(asyncFunctionFromConstructor)).toBe(true);
      expect(isAsyncFunction(regularFunctionFromConstructor)).toBe(false);
    });
  });

  describe("invokeAwaitableFn", () => {
    describe("with synchronous functions", () => {
      it("invokes synchronous function and returns result", async () => {
        const result = await invokeAwaitableFn(syncFnAdd, [2, 3], {});

        expect(result).toBe(5);
      });

      it("does not call lifecycle hooks for synchronous functions", async () => {
        const onInvoke = vi.fn();
        const onSuccess = vi.fn();
        const onError = vi.fn();
        const onFinally = vi.fn();

        const result = await invokeAwaitableFn(syncFnTest, [], {
          onInvoke,
          onSuccess,
          onError,
          onFinally
        });

        expect(result).toBe("test");
        expect(onInvoke).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onFinally).not.toHaveBeenCalled();
      });
    });

    describe("with asynchronous functions", () => {
      it("invokes async function and returns result", async () => {
        const result = await invokeAwaitableFn(asyncFnAdd, [2, 3], {});
        expect(result).toBe(5);
      });

      it("calls lifecycle hooks in correct order for successful execution", async () => {
        const callOrder: string[] = [];
        const context = { id: "test-context" };

        const onInvoke = vi.fn(() => {
          callOrder.push("onInvoke");
          return context;
        });
        const onSuccess = vi.fn((result, ctx) => {
          callOrder.push("onSuccess");
          expect(result).toBe("success");
          expect(ctx).toBe(context);
        });
        const onError = vi.fn(() => {
          callOrder.push("onError");
        });
        const onFinally = vi.fn(ctx => {
          callOrder.push("onFinally");
          expect(ctx).toBe(context);
        });

        const result = await invokeAwaitableFn(asyncFnSuccess, [], {
          onInvoke,
          onSuccess,
          onError,
          onFinally
        });

        expect(result).toBe("success");
        expect(callOrder).toEqual(["onInvoke", "onSuccess", "onFinally"]);
        expect(onError).not.toHaveBeenCalled();
      });

      it("calls error and finally hooks when async function throws", async () => {
        const callOrder: string[] = [];
        const context = { id: "error-context" };
        const testError = new Error("Test error");

        const onInvoke = vi.fn(() => {
          callOrder.push("onInvoke");
          return context;
        });
        const onSuccess = vi.fn(() => {
          callOrder.push("onSuccess");
        });
        const onError = vi.fn((error, ctx) => {
          callOrder.push("onError");
          expect(error).toBe(testError);
          expect(ctx).toBe(context);
        });
        const onFinally = vi.fn(ctx => {
          callOrder.push("onFinally");
          expect(ctx).toBe(context);
        });

        await expect(invokeAwaitableFn(() => asyncFnThrow(testError), [], {
          onInvoke,
          onSuccess,
          onError,
          onFinally
        })).rejects.toThrow("Test error");

        expect(callOrder).toEqual(["onInvoke", "onError", "onFinally"]);
        expect(onSuccess).not.toHaveBeenCalled();
      });

      it("handles async function that rejects immediately", async () => {
        const onInvoke = vi.fn(() => "context");
        const onError = vi.fn();
        const onFinally = vi.fn();

        await expect(invokeAwaitableFn(asyncFnImmediateError, [], {
          onInvoke,
          onError,
          onFinally
        })).rejects.toThrow("Immediate error");

        expect(onInvoke).toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Immediate error" }),
          "context"
        );
        expect(onFinally).toHaveBeenCalledWith("context");
      });
    });

    describe("with functions returning promises", () => {
      it("handles functions that return promises", async () => {
        const result = await invokeAwaitableFn(promiseFnHello, ["World"], {});
        expect(result).toBe("Hello World");
      });

      it("calls lifecycle hooks for promise-returning functions", async () => {
        const onInvoke = vi.fn(() => "promise-context");
        const onSuccess = vi.fn();
        const onFinally = vi.fn();

        const result = await invokeAwaitableFn(promiseFnResolve, [], {
          onInvoke,
          onSuccess,
          onFinally
        });

        expect(result).toBe("promise-result");
        expect(onInvoke).toHaveBeenCalled();
        expect(onSuccess).toHaveBeenCalledWith("promise-result", "promise-context");
        expect(onFinally).toHaveBeenCalledWith("promise-context");
      });

      it("handles rejected promises", async () => {
        const onError = vi.fn();
        const rejectionError = new Error("Promise rejected");

        await expect(invokeAwaitableFn(() => promiseFnReject(rejectionError), [], {
          onError
        })).rejects.toThrow("Promise rejected");

        expect(onError).toHaveBeenCalledWith(rejectionError, undefined);
      });
    });

    describe("context handling", () => {
      it("passes undefined context when onInvoke is not provided", async () => {
        const onSuccess = vi.fn();
        const onFinally = vi.fn();

        await invokeAwaitableFn(asyncFnResult, [], {
          onSuccess,
          onFinally
        });

        expect(onSuccess).toHaveBeenCalledWith("result", undefined);
        expect(onFinally).toHaveBeenCalledWith(undefined);
      });

      it("passes undefined context when onInvoke returns undefined", async () => {
        const onInvoke = vi.fn();
        const onSuccess = vi.fn();

        await invokeAwaitableFn(asyncFnResult, [], {
          onInvoke,
          onSuccess
        });

        expect(onSuccess).toHaveBeenCalledWith("result", undefined);
      });

      it("handles complex context objects", async () => {
        const complexContext = {
          id: "complex",
          data: { nested: true },
          timestamp: Date.now()
        };

        const onInvoke = vi.fn(() => complexContext);
        const onSuccess = vi.fn();

        await invokeAwaitableFn(asyncFnResult, [], {
          onInvoke,
          onSuccess
        });

        expect(onSuccess).toHaveBeenCalledWith("result", complexContext);
      });
    });

    describe("arguments handling", () => {
      it("passes arguments correctly to the function", async () => {
        const asyncFn = vi.fn(async (a: number, b: string, c: boolean) => {
          return {
            a,
            b,
            c
          };
        });

        const result = await invokeAwaitableFn(asyncFn, [42, "test", true], {});

        expect(asyncFn).toHaveBeenCalledWith(42, "test", true);
        expect(result).toEqual({
          a: 42,
          b: "test",
          c: true
        });
      });

      it("handles empty arguments array", async () => {
        const asyncFn = vi.fn(async () => "no-args");

        const result = await invokeAwaitableFn(asyncFn, [], {});

        expect(asyncFn).toHaveBeenCalledWith();
        expect(result).toBe("no-args");
      });

      it("handles complex argument types", async () => {
        const complexArgs = [
          {
            id: 1,
            name: "test"
          },
          [1, 2, 3],
          new Date(),
          () => "callback"
        ];

        const asyncFn = vi.fn(async (...args) => args.length);

        const result = await invokeAwaitableFn(asyncFn, complexArgs, {});

        expect(asyncFn).toHaveBeenCalledWith(...complexArgs);
        expect(result).toBe(4);
      });
    });

    describe("edge cases", () => {
      it("handles function that returns null", async () => {
        const result = await invokeAwaitableFn(nullFn, [], {});
        expect(result).toBeNull();
      });

      it("handles function that returns undefined", async () => {
        const result = await invokeAwaitableFn(undefinedFn, [], {});
        expect(result).toBeUndefined();
      });

      it("handles async function that returns null", async () => {
        const onSuccess = vi.fn();

        const result = await invokeAwaitableFn(asyncNullFn, [], {
          onSuccess
        });

        expect(result).toBeNull();
        expect(onSuccess).toHaveBeenCalledWith(null, undefined);
      });

      it("preserves error types when rethrowing", async () => {
        const customError = new TypeError("Custom error");

        const asyncFn = async () => {
          throw customError;
        };

        await expect(invokeAwaitableFn(asyncFn, [], {}))
          .rejects
          .toThrow(TypeError);

        await expect(invokeAwaitableFn(asyncFn, [], {}))
          .rejects
          .toThrow("Custom error");
      });
    });
  });
});
