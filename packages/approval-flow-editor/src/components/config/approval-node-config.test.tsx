import { expect, it } from "vitest";

import { render, screen } from "../../../../components/test-utils";
import { EditorPluginsContext } from "../../plugins";
import { EditorStoreProvider } from "../../store/editor";
import { ApprovalNodeConfig } from "./approval-node-config";

function panel(businessKind?: string) {
  return (
    <EditorPluginsContext value={{ businessKind }}>
      <EditorStoreProvider initialState={{
        readonly: false,
        nodes: [
          {
            id: "a",
            type: "approval",
            position: { x: 0, y: 0 },
            data: {}
          }
        ],
        edges: []
      }}
      >
        <ApprovalNodeConfig nodeId="a" />
      </EditorStoreProvider>
    </EditorPluginsContext>
  );
}

it("offers form rollback behavior only on ordinary flows", () => {
  const view = render(panel());
  expect(screen.getByText("回退数据策略")).toBeVisible();
  view.rerender(panel("meeting"));
  expect(screen.queryByText("回退数据策略")).not.toBeInTheDocument();
  expect(screen.getByText("允许回退")).toBeVisible();
});
