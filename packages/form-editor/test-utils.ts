import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { onTestFinished } from "vitest";

const ROW_PITCH = 50;
const ROW_HEIGHT = 40;

/**
 * The dragged row, which dnd-kit leaves a placeholder for.
 */
const LIFTED = "[data-dnd-dragging]";

function nearestCommonAncestor(elements: readonly Element[]): Element {
  let ancestor = elements[0]!.parentElement!;

  while (elements.some(element => !ancestor.contains(element))) {
    ancestor = ancestor.parentElement!;
  }

  return ancestor;
}

function centerOf(position: number): number {
  return position * ROW_PITCH + ROW_HEIGHT / 2;
}

/**
 * Reports what it observes as wholly in view, as a browser does once at first.
 */
class VisibleIntersectionObserver {
  readonly #callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    const rect = target.getBoundingClientRect();

    queueMicrotask(() => this.#callback(
      [
        {
          boundingClientRect: rect,
          intersectionRatio: 1,
          intersectionRect: rect,
          isIntersecting: true,
          target
        } as unknown as IntersectionObserverEntry
      ],
      this as unknown as IntersectionObserver
    ));
  }

  disconnect(): void {
    // Reports once; nothing to stop.
  }
}

/**
 * Stands in for the geometry and the animations jsdom has none of, so a real
 * drag can run: the rows of `list` are stacked in the order of their elements,
 * and the dragged one is under the pointer.
 */
function stubLayout(list: Element, pointerY: () => number): void {
  const measured = vi.spyOn(Element.prototype, "getBoundingClientRect");

  measured.mockImplementation(() => {
    const element = measured.mock.contexts.at(-1) as Element;
    const row = [...list.children].find(child => child.contains(element));

    if (row === undefined) {
      return new DOMRect(0, 0, 1000, 2000);
    }

    const top = row.matches(LIFTED)
      ? pointerY() - ROW_HEIGHT / 2
      : [...list.children].filter(child => !child.matches(LIFTED)).indexOf(row) * ROW_PITCH;

    return new DOMRect(0, top, 300, ROW_HEIGHT);
  });

  vi.stubGlobal("IntersectionObserver", VisibleIntersectionObserver);
  onTestFinished(() => {
    measured.mockRestore();
    vi.unstubAllGlobals();
  });

  Object.assign(document, { elementFromPoint: () => null, getAnimations: () => [] });
  Object.assign(Element.prototype, {
    animate: () => { return { cancel: () => undefined, finished: Promise.resolve() }; },
    getAnimations: () => []
  });
}

async function nextFrames(): Promise<void> {
  await act(async () => {
    for (let frame = 0; frame < 3; frame += 1) {
      await new Promise(resolve => {
        requestAnimationFrame(resolve);
      });
    }
  });
}

export interface SortableDrag {
  /**
   * The drag handles of the list's rows, in order.
   */
  handles: readonly HTMLElement[];
  /**
   * The row picked up, by its position.
   */
  from: number;
  /**
   * The position it is carried to.
   */
  to: number;
  /**
   * Carry it on and release it where no row is.
   */
  releaseOffList?: boolean;
}

/**
 * Drags a row of a sortable list with the pointer.
 */
export async function dragSortableRow({
  from,
  handles,
  releaseOffList = false,
  to
}: SortableDrag): Promise<void> {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  const target = handles[from]!;
  let y = centerOf(from);

  stubLayout(nearestCommonAncestor(handles), () => y);

  const moveTo = async (next: number): Promise<void> => {
    const start = y;

    for (let step = 1; step <= 4; step += 1) {
      y = start + (next - start) * step / 4;
      await user.pointer({ target, coords: { clientX: 10, clientY: y } });
      await nextFrames();
    }
  };

  await user.pointer({
    keys: "[MouseLeft>]",
    target,
    coords: { clientX: 10, clientY: y }
  });
  await nextFrames();
  await moveTo(centerOf(to));

  if (releaseOffList) {
    await moveTo(centerOf(handles.length + 10));
  }

  await user.pointer({
    keys: "[/MouseLeft]",
    target,
    coords: { clientX: 10, clientY: y }
  });
  await nextFrames();
}
