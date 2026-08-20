import type { LoginChallenge } from "./payload";
import type { LoginChallengeRenderers } from "./props";
import type { LoginFlow } from "./use-login-flow";

import { useMemo, useState } from "react";

import { render, screen } from "../../../test-utils";
import { LoginChallengeOutlet } from "./challenge-outlet";

/**
 * A flow stub holding one pending challenge. The outlet reads nothing else, so
 * the rest of the contract is filled with inert values.
 */
function flowWith(type: string): LoginFlow {
  return {
    login: vi.fn(),
    challenge: {
      type,
      data: {},
      required: true
    } as LoginChallenge,
    resolve: vi.fn(),
    cancel: vi.fn(),
    pending: false,
    error: null,
    clearError: vi.fn()
  };
}

/**
 * Two renderers with deliberately different hook shapes. Called as plain
 * functions their hooks would share the outlet's single hook list, so moving
 * from the first to the second changes the list's length mid-life — the
 * condition React refuses to continue from.
 */
function WideChallenge() {
  const label = useMemo(() => "wide", []);
  const [value] = useState("wide-state");

  return <p>{`${label}:${value}`}</p>;
}

function NarrowChallenge() {
  const [value] = useState("narrow-state");

  return <p>{`narrow:${value}`}</p>;
}

function FirstChallenge() {
  const [value] = useState("first-initial");

  return <p>{`first:${value}`}</p>;
}

function SecondChallenge() {
  const [value] = useState("second-initial");

  return <p>{`second:${value}`}</p>;
}

const differentHookShapes = {
  wide: WideChallenge,
  narrow: NarrowChallenge
} as unknown as LoginChallengeRenderers;

const sameHookShape = {
  first: FirstChallenge,
  second: SecondChallenge
} as unknown as LoginChallengeRenderers;

describe("LoginChallengeOutlet", () => {
  it("renders nothing while the flow holds no challenge", () => {
    const { container } = render(
      <LoginChallengeOutlet flow={{ ...flowWith("wide"), challenge: null }} renderers={differentHookShapes} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("switches to a renderer with a different hook shape without crashing", () => {
    const { rerender } = render(
      <LoginChallengeOutlet flow={flowWith("wide")} renderers={differentHookShapes} />
    );
    expect(screen.getByText("wide:wide-state")).toBeInTheDocument();

    // A chain such as department selection followed by a forced password change
    // produces exactly this transition.
    rerender(<LoginChallengeOutlet flow={flowWith("narrow")} renderers={differentHookShapes} />);

    expect(screen.getByText("narrow:narrow-state")).toBeInTheDocument();
  });

  it("gives each challenge a fresh renderer instance rather than reusing state", () => {
    const { rerender } = render(
      <LoginChallengeOutlet flow={flowWith("first")} renderers={sameHookShape} />
    );
    expect(screen.getByText("first:first-initial")).toBeInTheDocument();

    rerender(<LoginChallengeOutlet flow={flowWith("second")} renderers={sameHookShape} />);

    // Sharing a hook list would carry the first renderer's state over, so the
    // second would read "first-initial" despite its own initializer.
    expect(screen.getByText("second:second-initial")).toBeInTheDocument();
  });

  it("falls back to a readable alert for a challenge type no renderer covers", () => {
    render(<LoginChallengeOutlet flow={flowWith("unknown_type")} renderers={sameHookShape} />);

    expect(document.body).toHaveTextContent("unknown_type");
  });

  it("prefers a caller-supplied fallback over the built-in alert", () => {
    render(
      <LoginChallengeOutlet
        fallback={challenge => <p>{`custom:${challenge.type}`}</p>}
        flow={flowWith("unknown_type")}
        renderers={sameHookShape}
      />
    );

    expect(screen.getByText("custom:unknown_type")).toBeInTheDocument();
  });
});
