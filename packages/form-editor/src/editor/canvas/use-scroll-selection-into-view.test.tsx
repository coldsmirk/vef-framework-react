import type { ReactElement } from "react";

import type { FormEditorStoreApi } from "../../store/form-store";
import type { FormSchema } from "../../types";

import { act, render } from "@testing-library/react";
import { useEffect, useRef } from "react";

import { FormEditorStoreProvider, useFormEditorStoreApi } from "../../store/form-store";
import { useScrollSelectionIntoView } from "./use-scroll-selection-into-view";

function schemaWith(ids: string[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: {
      pc: {
        children: ids.map(id => {
          return {
            id,
            type: "textfield",
            key: id,
            label: id
          };
        })
      }
    }
  };
}

interface HarnessProps {
  renderedIds: string[];
  onReady: (api: FormEditorStoreApi) => void;
}

function Harness({ onReady, renderedIds }: HarnessProps): ReactElement {
  const api = useFormEditorStoreApi();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => onReady(api), [api, onReady]);
  useScrollSelectionIntoView(containerRef);

  return (
    <div ref={containerRef}>
      {renderedIds.map(id => <div key={id} data-node-id={id}>{id}</div>)}
    </div>
  );
}

function setup(schema: FormSchema, renderedIds: string[]): FormEditorStoreApi {
  let api!: FormEditorStoreApi;

  render(
    <FormEditorStoreProvider initialState={{ schema }}>
      <Harness
        renderedIds={renderedIds}
        onReady={ready => {
          api = ready;
        }}
      />
    </FormEditorStoreProvider>
  );

  return api;
}

describe("useScrollSelectionIntoView", () => {
  it("scrolls the newly selected node into view", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const api = setup(schemaWith(["a", "b"]), ["a", "b"]);

    act(() => api.getState().selectNode("b"));

    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.contexts[0]).toHaveAttribute("data-node-id", "b");
  });

  it("does not scroll when the selection clears", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    const api = setup(schemaWith(["a", "b"]), ["a", "b"]);
    act(() => api.getState().selectNode("a"));
    scroll.mockClear();

    act(() => api.getState().selectNode(null));

    expect(scroll).not.toHaveBeenCalled();
  });

  it("ignores a selection whose node is not rendered on the canvas", () => {
    const scroll = vi.spyOn(Element.prototype, "scrollIntoView");
    // The schema knows "b" (so selectNode accepts it) but only "a" is rendered
    // here — the lookup misses and nothing scrolls, without throwing.
    const api = setup(schemaWith(["a", "b"]), ["a"]);

    act(() => api.getState().selectNode("b"));

    expect(scroll).not.toHaveBeenCalled();
  });
});
