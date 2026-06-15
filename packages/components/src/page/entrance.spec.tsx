import type { ReactElement, ReactNode } from "react";

import type { PageEntranceStore } from "./entrance";

import { act, render, renderHook } from "../../test-utils";
import {
  createPageEntranceController,
  PageEntranceContext,
  usePageEntranceEffect,
  usePageEntranceSettled
} from "./entrance";
import { Page } from "./index";

function wrapperFor(store: PageEntranceStore) {
  return function EntranceWrapper({ children }: { children: ReactNode }): ReactElement {
    return <PageEntranceContext value={store}>{children}</PageEntranceContext>;
  };
}

describe("createPageEntranceController", () => {
  it("starts unsettled and notifies subscribers on each transition", () => {
    const controller = createPageEntranceController();
    const listener = vi.fn();
    controller.store.subscribe(listener);

    expect(controller.store.isSettled()).toBe(false);

    controller.setSettled(true);

    expect(controller.store.isSettled()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.setSettled(false);

    expect(controller.store.isSettled()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("skips notification when the state does not change", () => {
    const controller = createPageEntranceController();
    const listener = vi.fn();
    controller.store.subscribe(listener);

    controller.setSettled(false);

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", () => {
    const controller = createPageEntranceController();
    const listener = vi.fn();
    const unsubscribe = controller.store.subscribe(listener);

    unsubscribe();
    controller.setSettled(true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("usePageEntranceSettled", () => {
  it("reports settled immediately outside a Page", () => {
    const { result } = renderHook(() => usePageEntranceSettled());

    expect(result.current).toBe(true);
  });

  it("tracks the hosting store through transitions", () => {
    const controller = createPageEntranceController();
    const { result } = renderHook(() => usePageEntranceSettled(), {
      wrapper: wrapperFor(controller.store)
    });

    expect(result.current).toBe(false);

    act(() => {
      controller.setSettled(true);
    });

    expect(result.current).toBe(true);
  });
});

describe("usePageEntranceEffect", () => {
  it("fires immediately when the entrance is already settled", () => {
    const controller = createPageEntranceController();
    controller.setSettled(true);
    const effect = vi.fn();

    renderHook(() => usePageEntranceEffect(effect), {
      wrapper: wrapperFor(controller.store)
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("defers the effect until the entrance settles", () => {
    const controller = createPageEntranceController();
    const effect = vi.fn();

    renderHook(() => usePageEntranceEffect(effect), {
      wrapper: wrapperFor(controller.store)
    });

    expect(effect).not.toHaveBeenCalled();

    act(() => {
      controller.setSettled(true);
    });

    expect(effect).toHaveBeenCalledTimes(1);
  });

  it("re-arms with cleanup when a replayed entrance settles again", () => {
    const controller = createPageEntranceController();
    const cleanup = vi.fn();
    const effect = vi.fn(() => cleanup);

    renderHook(() => usePageEntranceEffect(effect), {
      wrapper: wrapperFor(controller.store)
    });

    act(() => {
      controller.setSettled(true);
    });
    // A page reload replays the entrance: the signal drops, the previous
    // run's cleanup fires, and the effect runs again on the next settle.
    act(() => {
      controller.setSettled(false);
    });

    expect(cleanup).toHaveBeenCalledTimes(1);

    act(() => {
      controller.setSettled(true);
    });

    expect(effect).toHaveBeenCalledTimes(2);
  });

  it("runs the cleanup on unmount", () => {
    const controller = createPageEntranceController();
    controller.setSettled(true);
    const cleanup = vi.fn();

    const { unmount } = renderHook(() => usePageEntranceEffect(() => cleanup), {
      wrapper: wrapperFor(controller.store)
    });

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

// The settled flip in the real Page rides framer-motion's animation
// callbacks, which do not fire under jsdom — the wiring is verified in the
// browser. These pin the synchronous half of the integration.
describe("Page integration", () => {
  it("marks the root as entering while the entrance animation is in flight", () => {
    const { container } = render(
      <Page>
        <span>body</span>
      </Page>
    );

    // eslint-disable-next-line testing-library/no-container -- the attribute lives on Page's root container, which has no accessible role
    expect(container.querySelector("[data-entrance]")).toHaveAttribute("data-entrance", "entering");
  });
});
