import type { ReactElement, ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { Component } from "react";

import { loadEngine, resetEngine } from "../engine/loader";
import { ExpressionEngineProvider } from "./provider";
import { useExpressionEngine } from "./use-expression-engine";

const zen = vi.hoisted(() => {
  return {
    init: vi.fn(),
    evaluateExpression: vi.fn(),
    evaluateUnaryExpression: vi.fn(),
    validateExpression: vi.fn(),
    validateUnaryExpression: vi.fn(),
    getCompletions: vi.fn(),
    isReady: vi.fn()
  };
});

vi.mock("@gorules/zen-engine-wasm", () => {
  return {
    default: zen.init,
    evaluateExpression: zen.evaluateExpression,
    evaluateUnaryExpression: zen.evaluateUnaryExpression,
    validateExpression: zen.validateExpression,
    validateUnaryExpression: zen.validateUnaryExpression,
    getCompletions: zen.getCompletions,
    isReady: zen.isReady
  };
});

function Probe(): ReactElement {
  const engine = useExpressionEngine();
  return <p>{String(engine.evaluate("1 + 1"))}</p>;
}

beforeEach(() => {
  resetEngine();
  vi.clearAllMocks();
  zen.isReady.mockReturnValue(true);
  zen.evaluateExpression.mockReturnValue(2);
});

describe("useExpressionEngine", () => {
  it("throws when rendered outside the provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // swallow React's expected render-error log for the missing-provider case
    });

    expect(() => render(<Probe />)).toThrow(/ExpressionEngineProvider/);

    consoleError.mockRestore();
  });

  it("shows the fallback while the engine loads", () => {
    const pending = Promise.withResolvers<never>();
    zen.init.mockReturnValue(pending.promise);

    render(
      <ExpressionEngineProvider fallback={<span>loading</span>}>
        <Probe />
      </ExpressionEngineProvider>
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders the engine output once the engine is ready", async () => {
    zen.init.mockResolvedValue({});
    await loadEngine();

    render(
      <ExpressionEngineProvider fallback={<span>loading</span>}>
        <Probe />
      </ExpressionEngineProvider>
    );

    expect(await screen.findByText("2")).toBeInTheDocument();
  });
});

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override render(): ReactNode {
    return this.state.hasError ? <p>caught</p> : this.props.children;
  }
}

describe("when the engine fails to load", () => {
  it("surfaces the wasm-load failure to the nearest error boundary", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // swallow React's expected render-error log for the caught load failure
    });

    zen.isReady.mockReturnValue(false);
    zen.init.mockRejectedValue(new Error("wasm boom"));
    // Prime the failure so getEngineError() is populated before the first render,
    // leaving engineSync null and engineError set — EngineGate throws the error.
    await loadEngine().catch(() => {
      // expected rejection; we only need getEngineError() populated
    });

    render(
      <ErrorBoundary>
        <ExpressionEngineProvider fallback={<span>loading</span>}>
          <Probe />
        </ExpressionEngineProvider>
      </ErrorBoundary>
    );

    expect(await screen.findByText("caught")).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
