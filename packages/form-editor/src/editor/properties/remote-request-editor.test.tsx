import type { ReactElement } from "react";

import type { DataSourceApiParam, RemoteDataSourceRequest } from "../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { RemoteRequestEditor, RequestParamsEditor } from "./remote-request-editor";

interface RequestHarnessProps {
  initial: RemoteDataSourceRequest;
  onCommit?: (next: RemoteDataSourceRequest) => void;
}

/**
 * Stateful round-trip harness mirroring the controlled usage in the
 * option-source editors and the `api_call` action.
 */
function RequestHarness({ initial, onCommit }: RequestHarnessProps): ReactElement {
  const [request, setRequest] = useState(initial);

  return (
    <RemoteRequestEditor
      request={request}
      onChange={next => {
        onCommit?.(next);
        setRequest(next);
      }}
    />
  );
}

interface ParamsHarnessProps {
  declared?: DataSourceApiParam[];
  initial?: RemoteDataSourceRequest["params"];
  onCommit?: (next: RemoteDataSourceRequest["params"]) => void;
}

function ParamsHarness({
  declared,
  initial,
  onCommit
}: ParamsHarnessProps): ReactElement {
  const [params, setParams] = useState(initial);

  return (
    <RequestParamsEditor
      declared={declared}
      params={params}
      onChange={next => {
        onCommit?.(next);
        setParams(next);
      }}
    />
  );
}

const TWO_PARAMS: RemoteDataSourceRequest = {
  resource: "sys/ward",
  action: "find_options",
  params: {
    deptId: { kind: "literal", value: "1" },
    wardId: { kind: "expression", source: "$form.x" }
  }
};

describe("RemoteRequestEditor", () => {
  it("drops the version key when the version is cleared", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<RequestHarness initial={{ ...TWO_PARAMS, version: "v2" }} onCommit={onCommit} />);

    await user.clear(screen.getByRole("textbox", { name: "版本" }));

    expect(onCommit).toHaveBeenLastCalledWith(expect.not.objectContaining({ version: expect.anything() }));
  });

  describe("when a parameter is renamed", () => {
    it("commits a name nothing else holds", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<RequestHarness initial={TWO_PARAMS} onCommit={onCommit} />);

      const [, second] = screen.getAllByPlaceholderText("参数名");
      await user.clear(second as HTMLElement);
      await user.type(second as HTMLElement, "unitId{Enter}");

      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({
        params: {
          deptId: { kind: "literal", value: "1" },
          unitId: { kind: "expression", source: "$form.x" }
        }
      }));
    });

    it("never commits a name another parameter holds", async () => {
      // A record keeps the LAST entry for a duplicate key, so committing the
      // collision would delete the other row — its literal "1" and all.
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<RequestHarness initial={TWO_PARAMS} onCommit={onCommit} />);

      const [, second] = screen.getAllByPlaceholderText("参数名");
      await user.clear(second as HTMLElement);
      await user.type(second as HTMLElement, "deptId{Enter}");

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getAllByPlaceholderText("参数名")).toHaveLength(2);
    });

    it("warns while the draft collides", async () => {
      const user = userEvent.setup();

      render(<RequestHarness initial={TWO_PARAMS} />);

      const [, second] = screen.getAllByPlaceholderText("参数名");
      await user.clear(second as HTMLElement);
      await user.type(second as HTMLElement, "deptId");

      expect(screen.getByText("参数名已存在")).toBeInTheDocument();
    });

    it("keeps the previous name when the draft is left blank", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<RequestHarness initial={TWO_PARAMS} onCommit={onCommit} />);

      const [, second] = screen.getAllByPlaceholderText("参数名");
      await user.clear(second as HTMLElement);
      await user.tab();

      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("wardId")).toBeInTheDocument();
    });
  });
});

describe("RequestParamsEditor", () => {
  describe("when parameters are added", () => {
    it("keeps several unnamed rows apart", async () => {
      const user = userEvent.setup();

      render(<ParamsHarness />);

      await user.click(screen.getByRole("button", { name: /新增参数/ }));
      await user.click(screen.getByRole("button", { name: /新增参数/ }));

      expect(screen.getAllByPlaceholderText("参数名")).toHaveLength(2);
    });

    it("stores nothing until a row is named", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ParamsHarness onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /新增参数/ }));
      await user.type(screen.getByPlaceholderText("固定值"), "7");

      expect(onCommit).not.toHaveBeenCalled();
    });

    it("stores a named row with the value typed before it was named", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ParamsHarness onCommit={onCommit} />);

      await user.click(screen.getByRole("button", { name: /新增参数/ }));
      await user.type(screen.getByPlaceholderText("固定值"), "7");
      await user.type(screen.getByPlaceholderText("参数名"), "size{Enter}");

      expect(onCommit).toHaveBeenLastCalledWith({ size: { kind: "literal", value: "7" } });
    });
  });

  describe("when the parameters are declared", () => {
    const declared: DataSourceApiParam[] = [
      {
        name: "parentId",
        label: "上级部门",
        required: true,
        description: "留空查询顶级部门"
      }
    ];

    it("lists each declared parameter under its label", () => {
      render(<ParamsHarness declared={declared} />);

      expect(screen.getByText("上级部门")).toBeInTheDocument();
      expect(screen.getByText("parentId")).toBeInTheDocument();
      expect(screen.getByText("留空查询顶级部门")).toBeInTheDocument();
    });

    it("flags a required parameter while it is unbound", () => {
      render(<ParamsHarness declared={declared} />);

      expect(screen.getByText("必填参数尚未绑定")).toBeInTheDocument();
    });

    it("binds a value under the declared name", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ParamsHarness declared={declared} onCommit={onCommit} />);

      await user.type(screen.getByPlaceholderText("必填"), "d1");

      expect(onCommit).toHaveBeenLastCalledWith({ parentId: { kind: "literal", value: "d1" } });
    });

    it("omits a declared parameter once its value is cleared", async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();

      render(<ParamsHarness declared={declared} initial={{ parentId: { kind: "literal", value: "d1" } }} onCommit={onCommit} />);

      await user.clear(screen.getByDisplayValue("d1"));

      expect(onCommit).toHaveBeenLastCalledWith(undefined);
    });
  });
});
