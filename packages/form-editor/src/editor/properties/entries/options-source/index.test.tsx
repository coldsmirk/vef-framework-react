import type { FieldOptionSource, FormSchema, SelectField } from "../../../../types";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { definePropertyEntry } from "../../../../types";
import { CodeSetCatalogProvider } from "../../../code-set-catalog";
import { OptionsSourceEntry } from "./index";

const entry = definePropertyEntry<SelectField, FieldOptionSource | undefined>({
  id: "options",
  label: "可选项",
  type: "options-editor",
  read: field => field.dataSource,
  write: (field, dataSource) => { return { ...field, dataSource }; }
});

function makeField(dataSource?: FieldOptionSource): SelectField {
  return {
    id: "Field_s",
    type: "select",
    key: "s",
    label: "城市",
    dataSource
  };
}

function schemaWith(dataSources: FormSchema["dataSources"] = []): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    dataSources,
    presentations: { pc: { children: [] } }
  };
}

function renderEntry(field: SelectField, onChange: (value: unknown) => void, schema = schemaWith()): void {
  render(<OptionsSourceEntry entry={entry} field={field} schema={schema} onChange={onChange} />);
}

describe("options source entry", () => {
  describe("static", () => {
    it("appends a blank option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "static", options: [{ label: "北京", value: "bj" }] }), onChange);

      await user.click(screen.getByRole("button", { name: /添加选项/ }));

      expect(onChange).toHaveBeenCalledWith({ kind: "static", options: [{ label: "北京", value: "bj" }, { label: "", value: "" }] });
    });

    it("removes an option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "static", options: [{ label: "北京", value: "bj" }] }), onChange);

      await user.click(screen.getByRole("button", { name: "删除选项" }));

      expect(onChange).toHaveBeenCalledWith({ kind: "static", options: [] });
    });

    it("edits an option label", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "static", options: [{ label: "北京", value: "bj" }] }), onChange);

      await user.type(screen.getByDisplayValue("北京"), "市");

      expect(onChange).toHaveBeenLastCalledWith({ kind: "static", options: [{ label: "北京市", value: "bj" }] });
    });
  });

  describe("switching kind", () => {
    it("switches to a remote source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "static", options: [] }), onChange);

      await user.click(screen.getByText("远程请求"));

      expect(onChange).toHaveBeenCalledWith({ kind: "remote", request: { resource: "", action: "" } });
    });

    it("switches to a data dictionary source", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "static", options: [] }), onChange);

      await user.click(screen.getByText("数据字典"));

      expect(onChange).toHaveBeenCalledWith({ kind: "codeSet", codeSet: "" });
    });
  });

  describe("ref", () => {
    it("lists the form's data sources", () => {
      renderEntry(
        makeField({ kind: "ref", dataSourceId: "" }),
        vi.fn(),
        schemaWith([
          {
            id: "ds1",
            name: "城市",
            kind: "static",
            options: []
          }
        ])
      );

      expect(screen.getByText("选择数据源")).toBeInTheDocument();
    });

    it("hints when the form has no data sources", () => {
      renderEntry(makeField({ kind: "ref", dataSourceId: "" }), vi.fn());

      expect(screen.getByText(/表单暂无数据源/)).toBeInTheDocument();
    });
  });

  describe("codeSet", () => {
    it("picks a dictionary from the host catalog", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <CodeSetCatalogProvider codeSets={[
          {
            codeSet: "sys.user.gender",
            name: "性别",
            group: "人事"
          }
        ]}
        >
          <OptionsSourceEntry entry={entry} field={makeField({ kind: "codeSet", codeSet: "" })} schema={schemaWith()} onChange={onChange} />
        </CodeSetCatalogProvider>
      );

      await user.click(screen.getByRole("combobox", { name: "数据字典" }));
      await user.click(await screen.findByText("性别 · sys.user.gender"));

      expect(onChange).toHaveBeenCalledWith({ kind: "codeSet", codeSet: "sys.user.gender" });
    });

    it("commits a typed key on blur rather than per keystroke", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "codeSet", codeSet: "" }), onChange);

      await user.type(screen.getByRole("textbox", { name: "数据字典" }), " sys.user.gender ");

      expect(onChange).not.toHaveBeenCalled();

      await user.tab();

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ kind: "codeSet", codeSet: "sys.user.gender" });
    });
  });

  describe("remote", () => {
    it("edits the request resource", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      renderEntry(makeField({ kind: "remote", request: { resource: "geo", action: "" } }), onChange);

      // One keystroke appended to the existing value (the field prop is static in
      // this test, so a multi-char type would re-fire from the same base).
      await user.type(screen.getByRole("textbox", { name: "资源" }), "s");

      expect(onChange).toHaveBeenLastCalledWith({ kind: "remote", request: { resource: "geos", action: "" } });
    });
  });
});
