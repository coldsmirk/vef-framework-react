import type { ReactElement } from "react";

import type { DataSourceApi, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { DataSourceApisProvider } from "../data-source-apis";
import { RemoteOptionSourceEditor } from "./remote-option-source-editor";

const APIS: DataSourceApi[] = [
  {
    label: "部门列表",
    description: "按上级部门查询启用中的部门",
    group: "组织架构",
    resource: "sys/department",
    action: "find_options",
    mapping: { labelKey: "name", valueKey: "id" },
    params: [
      {
        name: "parentId",
        label: "上级部门",
        defaultValue: { kind: "expression", source: "$applicant.departmentId" }
      },
      { name: "status", label: "状态" }
    ]
  },
  {
    label: "用户列表",
    group: "组织架构",
    resource: "sys/user",
    action: "find_options",
    version: "v2"
  }
];

interface Committed {
  request: RemoteDataSourceRequest;
  mapping: RemoteOptionMapping | undefined;
}

interface HarnessProps {
  apis?: DataSourceApi[];
  initial?: Partial<Committed>;
  onCommit?: (next: Committed) => void;
}

function Harness({
  apis,
  initial,
  onCommit
}: HarnessProps): ReactElement {
  const [state, setState] = useState<Committed>({
    request: initial?.request ?? { resource: "", action: "" },
    mapping: initial?.mapping
  });

  return (
    <DataSourceApisProvider apis={apis}>
      <RemoteOptionSourceEditor
        mapping={state.mapping}
        request={state.request}
        onChange={(request, mapping) => {
          onCommit?.({ request, mapping });
          setState({ request, mapping });
        }}
      />
    </DataSourceApisProvider>
  );
}

describe("RemoteOptionSourceEditor", () => {
  describe("without an API catalog", () => {
    it("edits the request by hand", () => {
      render(<Harness />);

      expect(screen.getByRole("textbox", { name: "资源" })).toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "接口" })).not.toBeInTheDocument();
    });

    it("drops a cleared mapping key instead of storing it blank", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={{ mapping: { labelKey: "name", valueKey: "id" } }} onCommit={onCommit} />);

      await user.clear(screen.getByDisplayValue("name"));

      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ mapping: { valueKey: "id" } }));
    });

    it("shows default key placeholders for disabled and description and lists all default mapping keys in the hint", () => {
      render(<Harness initial={{ request: { resource: "md/department", action: "find_options" } }} />);

      expect(screen.getByPlaceholderText("label")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("value")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("disabled")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("description")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("children")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("可选（平铺建树）")).toBeInTheDocument();
      expect(screen.getByText(/label \/ value \/ disabled \/ description \/ children/)).toBeInTheDocument();
    });

    it("edits childrenKey and parentKey hierarchy mapping fields", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness initial={{ request: { resource: "md/department", action: "find_flat_options" } }} onCommit={onCommit} />);

      await user.type(screen.getByPlaceholderText("可选（平铺建树）"), "parentId");
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({
        mapping: { parentKey: "parentId" }
      }));

      await user.type(screen.getByPlaceholderText("children"), "sub");
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({
        mapping: { parentKey: "parentId", childrenKey: "sub" }
      }));
    });
  });

  describe("with an API catalog", () => {
    it("asks for an API before showing any request fields", () => {
      render(<Harness apis={APIS} />);

      expect(screen.getByRole("combobox", { name: "接口" })).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "资源" })).not.toBeInTheDocument();
    });

    it("stores the picked API's endpoint, mapping, and parameter defaults", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness apis={APIS} onCommit={onCommit} />);

      await user.click(screen.getByRole("combobox", { name: "接口" }));
      await user.click(await screen.findByText("部门列表"));

      expect(onCommit).toHaveBeenLastCalledWith({
        request: {
          resource: "sys/department",
          action: "find_options",
          params: { parentId: { kind: "expression", source: "$applicant.departmentId" } }
        },
        mapping: { labelKey: "name", valueKey: "id" }
      });
    });

    it("shows a stored request picked from the catalog as that API", () => {
      render(<Harness apis={APIS} initial={{ request: { resource: "sys/department", action: "find_options" } }} />);

      expect(screen.getByText("按上级部门查询启用中的部门")).toBeInTheDocument();
      expect(screen.getByText("上级部门")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "资源" })).not.toBeInTheDocument();
    });

    it("drops parameters the picked API does not declare", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          apis={APIS}
          initial={{
            request: {
              resource: "sys/department",
              action: "find_options",
              params: { status: { kind: "literal", value: "enabled" } }
            }
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("combobox", { name: "接口" }));
      await user.click(await screen.findByText("用户列表"));

      expect(onCommit).toHaveBeenLastCalledWith({
        request: {
          resource: "sys/user",
          action: "find_options",
          version: "v2"
        },
        mapping: undefined
      });
    });

    it("keeps a value already bound to a parameter the picked API declares", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(
        <Harness
          apis={APIS}
          initial={{
            request: {
              resource: "biz/department",
              action: "find_options",
              params: { parentId: { kind: "literal", value: "d-1" } }
            }
          }}
          onCommit={onCommit}
        />
      );

      await user.click(screen.getByRole("combobox", { name: "接口" }));
      await user.click(await screen.findByText("部门列表"));

      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({
        request: expect.objectContaining({ params: { parentId: { kind: "literal", value: "d-1" } } })
      }));
    });

    it("treats a request matching no API as hand-typed", () => {
      render(<Harness apis={APIS} initial={{ request: { resource: "biz/ward", action: "find_options" } }} />);

      expect(screen.getByDisplayValue("biz/ward")).toBeInTheDocument();
    });

    it("keeps the request when the designer switches to typing it by hand", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<Harness apis={APIS} initial={{ request: { resource: "sys/department", action: "find_options" } }} onCommit={onCommit} />);

      await user.click(screen.getByRole("combobox", { name: "接口" }));
      await user.click(await screen.findByText("自定义接口"));

      expect(screen.getByDisplayValue("sys/department")).toBeInTheDocument();
      expect(onCommit).not.toHaveBeenCalled();
    });
  });
});
