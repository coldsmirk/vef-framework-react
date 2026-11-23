import type { ApiClient, AppContext, DataOption } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import type {
  Block,
  ButtonField,
  CodeSetQueryFn,
  DataSourceResolver,
  FieldOption,
  FormDataSource,
  FormSchema,
  LinkageEvaluators,
  SubformNode,
  TextfieldField
} from "../types";

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiClientProvider, AppContextProvider, createApiClient } from "@vef-framework-react/core";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

function makeField(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function submitButton(): ButtonField {
  return {
    id: "Field_submit",
    type: "button",
    label: "提交",
    action: "submit"
  };
}

function schemaOf(blocks: Block[], options: { dataSources?: FormDataSource[]; mobile?: Block[] } = {}): FormSchema {
  return {
    id: "Form_fixed_rows",
    version: 2,
    ...options.dataSources && { dataSources: options.dataSources },
    presentations: {
      pc: { children: blocks },
      ...options.mobile && { mobile: { children: options.mobile } }
    }
  };
}

function renderRuntime(
  form: ReactNode,
  { apiClient, appContext = {} }: { apiClient?: ApiClient; appContext?: AppContext } = {}
): void {
  const pc = createDefaultRegistry();
  const content = <RegistryProvider registries={{ pc, mobile: pc }}>{form}</RegistryProvider>;

  render(
    <AppContextProvider value={appContext}>
      {apiClient === undefined ? content : <ApiClientProvider value={apiClient}>{content}</ApiClientProvider>}
    </AppContextProvider>
  );
}

const evaluators: LinkageEvaluators = {
  evaluateAssignExpression: (source, values) => values[source]
};

const silence = Function.prototype as () => void;

function boundRemoteSubform(required = false): SubformNode {
  return {
    id: "Sub_remote",
    type: "subform",
    variant: "stack",
    key: "checks",
    label: "科室检查项",
    rows: {
      mode: "fixed",
      itemKey: "item",
      required,
      source: {
        kind: "remote",
        request: {
          resource: "hosp/checklist",
          action: "find_items",
          params: {
            deptId: { kind: "expression", source: "deptId" }
          }
        }
      }
    },
    template: [makeField("note", { label: "整改措施" })]
  };
}

describe("FormRenderer fixed-row subform", () => {
  describe("static and ref-to-static sources", () => {
    it("renders a read-only header column in PC table mode without add or delete controls and preserves item snapshots on submit", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const subform: SubformNode = {
        id: "Sub_check",
        type: "subform",
        variant: "table",
        key: "checks",
        label: "依法执业自查",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "自查内容",
          headerWidth: 280,
          required: true,
          source: {
            kind: "static",
            options: [
              { label: "虚构不存在手术加收患者费用的（8分）", value: "fee_fake" },
              { label: "使用非卫生技术人员从事诊疗工作的（10分）", value: "non_licensed" }
            ]
          }
        },
        template: [makeField("owner", { label: "责任人" })]
      };

      renderRuntime(<FormRenderer schema={schemaOf([subform, submitButton()])} onSubmit={onSubmit} />);

      const headerCell = screen.getByText("虚构不存在手术加收患者费用的（8分）");
      const firstRow = headerCell.closest("tr") as HTMLElement;

      expect(screen.getAllByText("自查内容").length).toBeGreaterThan(0);
      expect(headerCell).toBeInTheDocument();
      expect(screen.getByText("使用非卫生技术人员从事诊疗工作的（10分）")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /新增/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /编\s*辑/ })).not.toBeInTheDocument();

      // Template columns are immediately editable without an operation column;
      // the row-header cell stays read-only.
      const inputs = within(firstRow).getAllByRole("textbox");
      expect(inputs).toHaveLength(1);
      await user.type(inputs[0] as HTMLElement, "张三");

      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).toHaveBeenCalledWith({
        checks: [
          {
            item: { value: "fee_fake", label: "虚构不存在手术加收患者费用的（8分）" },
            owner: "张三"
          },
          {
            item: { value: "non_licensed", label: "使用非卫生技术人员从事诊疗工作的（10分）" },
            owner: ""
          }
        ]
      });
    });

    it("renders titled cards in PC stack mode from a ref-to-static source without add or delete controls", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const subform: SubformNode = {
        id: "Sub_ref",
        type: "subform",
        variant: "stack",
        key: "checks",
        label: "自查条款",
        rows: {
          mode: "fixed",
          itemKey: "clause",
          source: { kind: "ref", dataSourceId: "DS_items" }
        },
        template: [makeField("note", { label: "问题描述" })]
      };
      const schema = schemaOf([subform, submitButton()], {
        dataSources: [
          {
            id: "DS_items",
            kind: "static",
            name: "检查条款",
            options: [
              { label: "条款甲", value: "a" },
              { label: "条款乙", value: "b" }
            ]
          }
        ]
      });

      renderRuntime(<FormRenderer schema={schema} onSubmit={onSubmit} />);

      expect(screen.getByText("条款甲")).toBeInTheDocument();
      expect(screen.getByText("条款乙")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /新增/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /删除此行/ })).not.toBeInTheDocument();

      const inputs = screen.getAllByRole("textbox", { name: "问题描述" });
      await user.type(inputs[0] as HTMLElement, "已核查");
      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).toHaveBeenCalledWith({
        checks: [
          { clause: { value: "a", label: "条款甲" }, note: "已核查" },
          { clause: { value: "b", label: "条款乙" }, note: "" }
        ]
      });
    });
  });

  describe("codeSet source", () => {
    it("loads dictionary items via collectCodeSets and submits top-level item snapshots", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const apiClient = createApiClient({
        // eslint-disable-next-line unicorn/prefer-https -- non-routable test host
        http: { baseUrl: "http://vef-test.invalid" }
      });
      const load = vi.fn((codeSets: string[]): Record<string, DataOption[]> => Object.fromEntries(codeSets.map(codeSet => [
        codeSet,
        codeSet === "hosp.self_check"
          ? [
              {
                label: "执业资质核查",
                value: "qual",
                children: [{ label: "子项不应展开", value: "qual_child" }]
              },
              { label: "病历质量核查", value: "record" }
            ]
          : []
      ])));
      const queryFn: CodeSetQueryFn = apiClient.createQueryFn<Record<string, DataOption[]>, string[]>(
        "test/fixed-code-set",
        () => load
      );

      const subform: SubformNode = {
        id: "Sub_dict",
        type: "subform",
        variant: "stack",
        key: "checks",
        label: "字典检查表",
        rows: {
          mode: "fixed",
          itemKey: "item",
          source: { kind: "codeSet", codeSet: "hosp.self_check" }
        },
        template: [makeField("note", { label: "说明" })]
      };

      renderRuntime(
        <FormRenderer schema={schemaOf([subform, submitButton()])} onSubmit={onSubmit} />,
        { apiClient, appContext: { codeSetQueryFn: queryFn } }
      );

      expect(await screen.findByText("执业资质核查")).toBeInTheDocument();
      expect(screen.getByText("病历质量核查")).toBeInTheDocument();
      expect(screen.queryByText("子项不应展开")).not.toBeInTheDocument();
      expect(load.mock.calls[0]?.[0]).toEqual(["hosp.self_check"]);

      const inputs = screen.getAllByRole("textbox", { name: "说明" });
      await user.type(inputs[0] as HTMLElement, "合格");
      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).toHaveBeenCalledWith({
        checks: [
          { item: { value: "qual", label: "执业资质核查" }, note: "合格" },
          { item: { value: "record", label: "病历质量核查" }, note: "" }
        ]
      });
    });
  });

  describe("remote source and bound-parameter re-resolution", () => {
    it("rebuilds rows on bound-parameter change while keeping filled cells of surviving items", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const resolve = vi.fn((req: { params?: Record<string, unknown> }): Promise<FieldOption[]> => Promise.resolve(
        req.params?.deptId === "B"
          ? [
              { label: "条款二（B科版）", value: "c2" },
              { label: "条款三", value: "c3" }
            ]
          : [
              { label: "条款一", value: "c1" },
              { label: "条款二", value: "c2" }
            ]
      ));
      const resolver: DataSourceResolver = { resolve };

      renderRuntime(
        <FormRenderer
          dataSourceResolver={resolver}
          defaultValues={{ deptId: "A" }}
          evaluators={evaluators}
          schema={schemaOf([makeField("deptId", { label: "科室" }), boundRemoteSubform(), submitButton()])}
          onSubmit={onSubmit}
        />
      );

      expect(await screen.findByText("条款一")).toBeInTheDocument();
      expect(screen.getByText("条款二")).toBeInTheDocument();

      const initialNotes = screen.getAllByRole("textbox", { name: "整改措施" });
      await user.type(initialNotes[0] as HTMLElement, "将随c1丢弃");
      await user.type(initialNotes[1] as HTMLElement, "保留的整改措施");

      // Change the bound parameter from A to B.
      const deptInput = screen.getByRole("textbox", { name: "科室" });
      await user.clear(deptInput);
      await user.type(deptInput, "B");

      expect(await screen.findByText("条款二（B科版）")).toBeInTheDocument();
      expect(screen.getByText("条款三")).toBeInTheDocument();
      expect(screen.queryByText("条款一")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).toHaveBeenCalledWith({
        deptId: "B",
        checks: [
          { item: { value: "c2", label: "条款二（B科版）" }, note: "保留的整改措施" },
          { item: { value: "c3", label: "条款三" }, note: "" }
        ]
      });
    });

    it("locks onto stored non-empty defaultValues without calling the resolver even when bound params change", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const resolve = vi.fn().mockResolvedValue([{ label: "线上新条款", value: "live" }]);
      const resolver: DataSourceResolver = { resolve };

      renderRuntime(
        <FormRenderer
          dataSourceResolver={resolver}
          evaluators={evaluators}
          schema={schemaOf([makeField("deptId", { label: "科室" }), boundRemoteSubform(), submitButton()])}
          defaultValues={{
            deptId: "A",
            checks: [{ item: { value: "old_1", label: "历史快照条款" }, note: "原记录" }]
          }}
          onSubmit={onSubmit}
        />
      );

      expect(screen.getByText("历史快照条款")).toBeInTheDocument();
      expect(screen.getByDisplayValue("原记录")).toBeInTheDocument();
      expect(resolve).not.toHaveBeenCalled();

      const deptInput = screen.getByRole("textbox", { name: "科室" });
      await user.clear(deptInput);
      await user.type(deptInput, "B");

      expect(resolve).not.toHaveBeenCalled();
      expect(screen.getByText("历史快照条款")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "提交" }));

      expect(onSubmit).toHaveBeenCalledWith({
        deptId: "B",
        checks: [{ item: { value: "old_1", label: "历史快照条款" }, note: "原记录" }]
      });
    });

    it("shows loading state while pending, clears rows and shows error on failure, and blocks required submission", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const deferred = Promise.withResolvers<FieldOption[]>();
      const warn = vi.spyOn(console, "warn").mockImplementation(silence);
      const resolve = vi.fn(() => deferred.promise);

      renderRuntime(
        <FormRenderer
          dataSourceResolver={{ resolve }}
          evaluators={evaluators}
          schema={schemaOf([boundRemoteSubform(true), submitButton()])}
          onSubmit={onSubmit}
        />
      );

      expect(await screen.findByRole("status")).toHaveTextContent("正在加载行项目…");

      deferred.reject(new Error("network down"));

      expect(await screen.findByRole("alert")).toHaveTextContent("行项目加载失败");

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(screen.getByText("此项为必填")).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();

      warn.mockRestore();
    });

    it("blocks submission when required is true and the resolved source is empty, and allows submission when optional", async () => {
      const user = userEvent.setup();
      const onRequiredSubmit = vi.fn();
      const resolver: DataSourceResolver = { resolve: vi.fn().mockResolvedValue([]) };

      const { unmount } = renderRuntimeWithUnmount(
        <FormRenderer
          dataSourceResolver={resolver}
          evaluators={evaluators}
          schema={schemaOf([boundRemoteSubform(true), submitButton()])}
          onSubmit={onRequiredSubmit}
        />
      );

      expect(await screen.findByText("暂无行项目")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(screen.getByText("此项为必填")).toBeInTheDocument();
      });
      expect(onRequiredSubmit).not.toHaveBeenCalled();

      unmount();

      const onOptionalSubmit = vi.fn();
      renderRuntime(
        <FormRenderer
          dataSourceResolver={resolver}
          evaluators={evaluators}
          schema={schemaOf([boundRemoteSubform(false), submitButton()])}
          onSubmit={onOptionalSubmit}
        />
      );

      expect(await screen.findByText("暂无行项目")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onOptionalSubmit).toHaveBeenCalledWith({ checks: [] });
      });
    });
  });
});

function renderRuntimeWithUnmount(form: ReactNode) {
  const pc = createDefaultRegistry();

  return render(
    <RegistryProvider registries={{ pc, mobile: pc }}>
      {form}
    </RegistryProvider>
  );
}
