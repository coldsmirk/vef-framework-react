import type { ReactNode } from "react";

import type { FormRendererApi } from "../render/form-renderer";
import type {
  Block,
  ButtonField,
  FormSchema,
  NumberField,
  SelectField,
  SubformNode,
  SwitchField,
  TextareaField,
  TextfieldField
} from "../types";

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfigProvider } from "@vef-framework-react/components";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { createDefaultMobileRegistry } from "../engine/registry/defaults-mobile";
import { FormRenderer } from "../render/form-renderer";
import { RegistryProvider } from "../store/engine-provider";

function textField(key: string, overrides: Partial<TextfieldField> = {}): TextfieldField {
  return {
    id: `Field_${key}`,
    type: "textfield",
    key,
    label: key,
    ...overrides
  };
}

function numberField(key: string, overrides: Partial<NumberField> = {}): NumberField {
  return {
    id: `Field_${key}`,
    type: "number",
    key,
    label: key,
    ...overrides
  };
}

function textareaField(key: string, overrides: Partial<TextareaField> = {}): TextareaField {
  return {
    id: `Field_${key}`,
    type: "textarea",
    key,
    label: key,
    ...overrides
  };
}

function selectField(key: string, overrides: Partial<SelectField> = {}): SelectField {
  return {
    id: `Field_${key}`,
    type: "select",
    key,
    label: key,
    ...overrides
  };
}

function switchField(key: string, overrides: Partial<SwitchField> = {}): SwitchField {
  return {
    id: `Field_${key}`,
    type: "switch",
    key,
    label: key,
    ...overrides
  };
}

function submitButton(label = "提交"): ButtonField {
  return {
    id: "Btn_submit",
    type: "button",
    label,
    action: "submit"
  };
}

function schemaOf(
  blocks: Block[],
  options: {
    linkage?: FormSchema["linkage"];
    mobile?: Block[];
    variables?: FormSchema["variables"];
  } = {}
): FormSchema {
  return {
    id: "Form_seq",
    version: 2,
    ...options.linkage && { linkage: options.linkage },
    ...options.variables && { variables: options.variables },
    presentations: {
      pc: { children: blocks },
      ...options.mobile && { mobile: { children: options.mobile } }
    }
  };
}

function renderForm(ui: ReactNode): ReturnType<typeof render> {
  const pc = createDefaultRegistry();
  const mobile = createDefaultMobileRegistry();

  return render(
    <ConfigProvider>
      <RegistryProvider registries={{ pc, mobile }}>{ui}</RegistryProvider>
    </ConfigProvider>
  );
}

/**
 * Reusable neutral staff-lookup rule: commit on `empCode` (guarded by notEmpty)
 * → `api_call` → `select_record` → `set_fields`.
 */
function staffLookupSchema(options: {
  includeSelectRecord?: boolean;
  selectRecordOverrides?: Partial<{
    columns: Array<{ path: string; label: string }>;
    emptyMessage: string;
    title: string;
    whenNone: "continue" | "stop";
  }>;
  extraFields?: Block[];
  mobile?: boolean;
} = {}): FormSchema {
  const {
    extraFields = [],
    includeSelectRecord = true,
    mobile = false,
    selectRecordOverrides = {}
  } = options;

  const actions: NonNullable<TextfieldField["linkage"]>["rules"] = [
    {
      id: "Rule_lookup",
      trigger: {
        kind: "commit",
        when: {
          kind: "leaf",
          sourceKey: "empCode",
          operator: "notEmpty"
        }
      },
      actions: includeSelectRecord
        ? [
            {
              type: "api_call",
              request: {
                resource: "hr/staff",
                action: "find",
                params: { code: { kind: "reference", path: "$form.empCode" } }
              },
              output: "res"
            },
            {
              type: "select_record",
              source: { kind: "reference", path: "$steps.res" },
              output: "picked",
              ...selectRecordOverrides
            },
            {
              type: "set_fields",
              assignments: [
                { targetKey: "staffName", value: { kind: "reference", path: "$steps.picked.name" } },
                { targetKey: "deptName", value: { kind: "reference", path: "$steps.picked.dept" } }
              ]
            }
          ]
        : [
            {
              type: "api_call",
              request: {
                resource: "hr/staff",
                action: "find",
                params: { code: { kind: "reference", path: "$form.empCode" } }
              },
              output: "res"
            },
            {
              type: "set_fields",
              assignments: [
                { targetKey: "staffName", value: { kind: "reference", path: "$steps.res.name" } },
                { targetKey: "deptName", value: { kind: "reference", path: "$steps.res.dept" } }
              ]
            }
          ]
    }
  ];

  const blocks: Block[] = [
    textField("empCode", { label: "工号", linkage: { rules: actions } }),
    textField("staffName", { label: "姓名" }),
    textField("deptName", { label: "部门" }),
    ...extraFields
  ];

  return schemaOf(blocks, mobile ? { mobile: blocks } : {});
}

describe("form action sequences runtime", () => {
  describe("commit trigger semantics", () => {
    it("commits PC textfield on Enter (without submitting form) and dirty blur, ignoring IME Enter and clean blur", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const notify = vi.fn();
      const schema = schemaOf([
        textField("empCode", {
          label: "工号",
          linkage: {
            rules: [
              {
                id: "R_commit",
                trigger: { kind: "commit" },
                actions: [{ type: "alert", message: { kind: "reference", path: "$form.empCode" } }]
              }
            ]
          }
        }),
        textField("other", { label: "备注" }),
        submitButton()
      ]);

      renderForm(<FormRenderer schema={schema} services={{ notify }} onSubmit={onSubmit} />);

      const input = screen.getByRole("textbox", { name: "工号" });
      const other = screen.getByRole("textbox", { name: "备注" });

      // Typing does not commit.
      await user.type(input, "E001");
      expect(notify).not.toHaveBeenCalled();

      // IME composition Enter must NOT commit or submit.
      // fireEvent is used only because userEvent cannot synthesize IME composition events.
      fireEvent.compositionStart(input);
      fireEvent.keyDown(input, { key: "Enter", isComposing: true });
      fireEvent.compositionEnd(input);
      expect(notify).not.toHaveBeenCalled();
      expect(onSubmit).not.toHaveBeenCalled();

      // Plain Enter commits and prevents outer form submission.
      await user.keyboard("{Enter}");
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenLastCalledWith("info", "E001");
      expect(onSubmit).not.toHaveBeenCalled();

      // Blurring right after Enter without further edits does NOT re-commit.
      await user.click(other);
      expect(notify).toHaveBeenCalledTimes(1);

      // Editing again and blurring commits once.
      await user.type(input, "2");
      expect(notify).toHaveBeenCalledTimes(1);
      await user.click(other);
      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenLastCalledWith("info", "E0012");

      // Focus + blur without editing does NOT commit.
      await user.click(input);
      await user.click(other);
      expect(notify).toHaveBeenCalledTimes(2);
    });

    it("flushes typed PC number draft before commit runs on Enter and prevents form submit", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const request = vi.fn().mockResolvedValue({ total: 500 });
      const schema = schemaOf([
        numberField("qty", {
          label: "数量",
          linkage: {
            rules: [
              {
                id: "R_calc",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "inv/price",
                      action: "calc",
                      params: { qty: { kind: "reference", path: "$form.qty" } }
                    },
                    output: "res"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "total", value: { kind: "reference", path: "$steps.res.total" } }]
                  }
                ]
              }
            ]
          }
        }),
        numberField("total", { label: "合计" }),
        submitButton()
      ]);

      renderForm(<FormRenderer schema={schema} services={{ request }} onSubmit={onSubmit} />);

      const qtyInput = screen.getByRole("spinbutton", { name: "数量" });
      await user.type(qtyInput, "5{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("spinbutton", { name: "合计" })).toHaveValue("500");
      });
      expect(request).toHaveBeenCalledWith(
        {
          resource: "inv/price",
          action: "calc",
          params: { qty: 5 }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("keeps Enter as newline on textarea and commits on dirty blur", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const schema = schemaOf([
        textareaField("notes", {
          label: "说明",
          linkage: {
            rules: [
              {
                id: "R_blur",
                trigger: { kind: "commit" },
                actions: [{ type: "alert", message: { kind: "reference", path: "$form.notes" } }]
              }
            ]
          }
        }),
        textField("other", { label: "其他" })
      ]);

      renderForm(<FormRenderer schema={schema} services={{ notify }} />);

      const textarea = screen.getByRole("textbox", { name: "说明" });
      await user.type(textarea, "line1{Enter}line2");
      expect(notify).not.toHaveBeenCalled();
      expect(textarea).toHaveValue("line1\nline2");

      await user.click(screen.getByRole("textbox", { name: "其他" }));
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify).toHaveBeenLastCalledWith("info", "line1\nline2");
    });

    it("never fires commit or change on programmatic set_fields writes and keeps blur baseline clean", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const schema = schemaOf([
        textField("source", {
          label: "来源",
          linkage: {
            rules: [
              {
                id: "R_push",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "target", value: { kind: "literal", value: "AUTO" } }]
                  }
                ]
              }
            ]
          }
        }),
        textField("target", {
          label: "目标",
          linkage: {
            rules: [
              {
                id: "R_target_commit",
                trigger: { kind: "commit" },
                actions: [{ type: "alert", message: { kind: "literal", value: "target-committed" } }]
              },
              {
                id: "R_target_change",
                trigger: { kind: "change" },
                actions: [{ type: "alert", message: { kind: "literal", value: "target-changed" } }]
              }
            ]
          }
        }),
        textField("other", { label: "其他" })
      ]);

      renderForm(<FormRenderer schema={schema} services={{ notify }} />);

      await user.type(screen.getByRole("textbox", { name: "来源" }), "go{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "目标" })).toHaveValue("AUTO");
      });
      expect(notify).not.toHaveBeenCalled();

      // Focusing and blurring the programmatically populated target must not treat it as dirty.
      await user.click(screen.getByRole("textbox", { name: "目标" }));
      await user.click(screen.getByRole("textbox", { name: "其他" }));
      expect(notify).not.toHaveBeenCalled();
    });

    it("sets enterKeyHint='done' on mobile textfield only when a commit rule is present and commits on Enter", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const fields: Block[] = [
        textField("withCommit", {
          label: "带提交",
          linkage: {
            rules: [
              {
                id: "R_mobile",
                trigger: { kind: "commit" },
                actions: [{ type: "alert", message: { kind: "reference", path: "$form.withCommit" } }]
              }
            ]
          }
        }),
        textField("plain", { label: "普通" })
      ];

      renderForm(<FormRenderer device="mobile" schema={schemaOf(fields, { mobile: fields })} services={{ notify }} />);

      const commitInput = screen.getByRole("textbox", { name: "带提交" });
      const plainInput = screen.getByRole("textbox", { name: "普通" });

      expect(commitInput).toHaveAttribute("enterkeyhint", "done");
      expect(plainInput).not.toHaveAttribute("enterkeyhint", "done");

      await user.type(commitInput, "M01{Enter}");
      expect(notify).toHaveBeenCalledWith("info", "M01");
    });

    it("commits selection controls on user change", async () => {
      const user = userEvent.setup();
      const request = vi.fn().mockResolvedValue({ manager: "Grace" });
      const schema = schemaOf([
        selectField("dept", {
          label: "部门",
          dataSource: {
            kind: "static",
            options: [{ label: "研发部", value: "eng" }]
          },
          linkage: {
            rules: [
              {
                id: "R_sel",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "org/dept",
                      action: "detail",
                      params: { id: { kind: "reference", path: "$form.dept" } }
                    },
                    output: "info"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "manager", value: { kind: "reference", path: "$steps.info.manager" } }]
                  }
                ]
              }
            ]
          }
        }),
        textField("manager", { label: "负责人" })
      ]);

      renderForm(<FormRenderer schema={schema} services={{ request }} />);

      await user.click(screen.getByRole("combobox", { name: "部门" }));
      await user.click(await screen.findByText("研发部"));

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "负责人" })).toHaveValue("Grace");
      });
    });
  });

  describe("runtime control rules (Section 3)", () => {
    it("enforces single-flight per (scope, rule): aborts superseded request without affecting sibling rules", async () => {
      const user = userEvent.setup();
      const firstLookup = Promise.withResolvers<unknown>();
      const secondLookup = Promise.withResolvers<unknown>();
      const siblingLookup = Promise.withResolvers<unknown>();
      const signals: AbortSignal[] = [];

      const request = vi.fn((req: { resource: string; params?: Record<string, unknown> }, opts?: { signal: AbortSignal }) => {
        if (opts?.signal) {
          signals.push(opts.signal);
        }

        if (req.resource === "hr/badge") {
          return siblingLookup.promise;
        }

        return (req.params?.code === "E1" ? firstLookup : secondLookup).promise;
      });

      const schema = schemaOf([
        textField("empCode", {
          label: "工号",
          linkage: {
            rules: [
              {
                id: "R_primary",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "hr/staff",
                      action: "find",
                      params: { code: { kind: "reference", path: "$form.empCode" } }
                    },
                    output: "res"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "staffName", value: { kind: "reference", path: "$steps.res.name" } }]
                  }
                ]
              },
              {
                id: "R_sibling",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "hr/badge",
                      action: "find",
                      params: { code: { kind: "reference", path: "$form.empCode" } }
                    },
                    output: "badge"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "badgeNo", value: { kind: "reference", path: "$steps.badge.no" } }]
                  }
                ]
              }
            ]
          }
        }),
        textField("staffName", { label: "姓名" }),
        textField("badgeNo", { label: "胸卡" })
      ]);

      renderForm(<FormRenderer schema={schema} services={{ request }} />);

      const input = screen.getByRole("textbox", { name: "工号" });
      await user.type(input, "E1{Enter}");
      expect(signals).toHaveLength(2);
      const firstPrimarySignal = signals[0]!;
      const firstSiblingSignal = signals[1]!;

      // Re-trigger same field: each rule supersedes only its own prior run.
      await user.clear(input);
      await user.type(input, "E2{Enter}");
      expect(firstPrimarySignal.aborted).toBe(true);
      expect(firstSiblingSignal.aborted).toBe(true);

      // Resolving the superseded first run must NOT overwrite with stale data.
      firstLookup.resolve({ name: "Old Staff" });
      secondLookup.resolve({ name: "New Staff" });
      siblingLookup.resolve({ no: "B-200" });

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("New Staff");
        expect(screen.getByRole("textbox", { name: "胸卡" })).toHaveValue("B-200");
      });
    });

    it("discards stale api_call responses when bound inputs changed while in flight", async () => {
      const user = userEvent.setup();
      const deferred = Promise.withResolvers<unknown>();
      const request = vi.fn(() => deferred.promise);

      renderForm(<FormRenderer schema={staffLookupSchema({ includeSelectRecord: false })} services={{ request }} />);

      const codeInput = screen.getByRole("textbox", { name: "工号" });
      await user.type(codeInput, "E1{Enter}");
      expect(request).toHaveBeenCalledTimes(1);

      // User changes empCode while E1 request is still in flight (without committing yet).
      await user.type(codeInput, "9");
      expect(codeInput).toHaveValue("E19");

      // E1 resolves after input diverged → must be discarded.
      deferred.resolve({ name: "Stale Name", dept: "Stale Dept" });
      await Promise.resolve();
      await Promise.resolve();

      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("");
      expect(screen.getByRole("textbox", { name: "部门" })).toHaveValue("");
    });

    it("aborts in-flight requests on form reset and on unmount", async () => {
      const user = userEvent.setup();
      const apiRef = createRef<FormRendererApi>();
      const deferred1 = Promise.withResolvers<unknown>();
      const deferred2 = Promise.withResolvers<unknown>();
      const signals: AbortSignal[] = [];

      const request = vi.fn((_req, opts?: { signal: AbortSignal }) => {
        if (opts?.signal) {
          signals.push(opts.signal);
        }

        return (signals.length === 1 ? deferred1 : deferred2).promise;
      });

      const { unmount } = renderForm(
        <FormRenderer apiRef={apiRef} schema={staffLookupSchema({ includeSelectRecord: false })} services={{ request }} />
      );

      const codeInput = screen.getByRole("textbox", { name: "工号" });
      await user.type(codeInput, "E1{Enter}");
      expect(signals[0]?.aborted).toBe(false);

      // Reset aborts the in-flight run.
      act(() => {
        apiRef.current?.reset();
      });
      expect(signals[0]?.aborted).toBe(true);
      deferred1.resolve({ name: "Should Not Write", dept: "Ops" });

      // Start a second run, then unmount.
      await user.type(codeInput, "E2{Enter}");
      expect(signals[1]?.aborted).toBe(false);
      unmount();
      expect(signals[1]?.aborted).toBe(true);
      deferred2.resolve({ name: "Unmounted", dept: "Ops" });
    });

    it("aborts a deleted subform row's run while a surviving shifted sibling row writes to its new index", async () => {
      const user = userEvent.setup();
      const row0Deferred = Promise.withResolvers<unknown>();
      const row1Deferred = Promise.withResolvers<unknown>();
      const signalsBySku = new Map<string, AbortSignal>();

      const request = vi.fn((req: { params?: Record<string, unknown> }, opts?: { signal: AbortSignal }) => {
        const sku = String(req.params?.sku ?? "");

        if (opts?.signal) {
          signalsBySku.set(sku, opts.signal);
        }

        return (sku === "SKU-A" ? row0Deferred : row1Deferred).promise;
      });

      const subform: SubformNode = {
        id: "Sub_items",
        type: "subform",
        variant: "stack",
        key: "items",
        label: "物料",
        template: [
          textField("sku", {
            label: "编码",
            linkage: {
              rules: [
                {
                  id: "R_sku",
                  trigger: { kind: "commit" },
                  actions: [
                    {
                      type: "api_call",
                      request: {
                        resource: "inv/item",
                        action: "find",
                        params: { sku: { kind: "reference", path: "$form.sku" } }
                      },
                      output: "item"
                    },
                    {
                      type: "set_fields",
                      assignments: [{ targetKey: "title", value: { kind: "reference", path: "$steps.item.title" } }]
                    }
                  ]
                }
              ]
            }
          }),
          textField("title", { label: "名称" })
        ]
      };

      const onSubmit = vi.fn();
      renderForm(
        <FormRenderer
          defaultValues={{ items: [{ sku: "", title: "" }, { sku: "", title: "" }] }}
          schema={schemaOf([subform, submitButton()])}
          services={{ request }}
          onSubmit={onSubmit}
        />
      );

      const skuInputs = screen.getAllByRole("textbox", { name: "编码" });
      await user.type(skuInputs[0]!, "SKU-A{Enter}");
      await user.type(skuInputs[1]!, "SKU-B{Enter}");

      expect(signalsBySku.get("SKU-A")?.aborted).toBe(false);
      expect(signalsBySku.get("SKU-B")?.aborted).toBe(false);

      // Delete row 0: row 0 aborts; row 1 shifts to index 0 and remains live!
      const deleteButtons = screen.getAllByRole("button", { name: "删除此行" });
      await user.click(deleteButtons[0]!);

      expect(signalsBySku.get("SKU-A")?.aborted).toBe(true);
      expect(signalsBySku.get("SKU-B")?.aborted).toBe(false);

      row0Deferred.resolve({ title: "Deleted Row Item" });
      row1Deferred.resolve({ title: "Surviving Item B" });

      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "名称" })).toHaveValue("Surviving Item B");
      });

      await user.click(screen.getByRole("button", { name: "提交" }));
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          items: [{ sku: "SKU-B", title: "Surviving Item B" }]
        });
      });
    });

    it("waits for pending requests before validating/submitting via native button, submit action, and apiRef.submit, while getSubmitValues stays sync", async () => {
      const user = userEvent.setup();
      const apiRef = createRef<FormRendererApi>();
      const deferred = Promise.withResolvers<unknown>();
      const request = vi.fn(() => deferred.promise);
      const onSubmit = vi.fn();

      const actionSubmitBtn: ButtonField = {
        id: "Btn_action_submit",
        type: "button",
        label: "联动提交",
        action: "button",
        linkage: {
          rules: [
            {
              id: "R_sub",
              trigger: { kind: "click" },
              actions: [{ type: "submit" }]
            }
          ]
        }
      };

      const schema = schemaOf([
        textField("empCode", {
          label: "工号",
          linkage: {
            rules: [
              {
                id: "R_lookup",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: {
                      resource: "hr/staff",
                      action: "find",
                      params: { code: { kind: "reference", path: "$form.empCode" } }
                    },
                    output: "res"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "staffName", value: { kind: "reference", path: "$steps.res.name" } }]
                  }
                ]
              }
            ]
          }
        }),
        textField("staffName", { label: "姓名", validate: { required: true } }),
        submitButton("原生提交"),
        actionSubmitBtn
      ]);

      renderForm(<FormRenderer apiRef={apiRef} schema={schema} services={{ request }} onSubmit={onSubmit} />);

      await user.type(screen.getByRole("textbox", { name: "工号" }), "E1{Enter}");

      // getSubmitValues() must NOT wait — returns current snapshot synchronously.
      expect(apiRef.current?.getSubmitValues()).toEqual({ empCode: "E1", staffName: "" });

      // Trigger native submit while request is in flight — must wait, not fail required validation yet.
      await user.click(screen.getByRole("button", { name: "原生提交" }));
      expect(onSubmit).not.toHaveBeenCalled();

      deferred.resolve({ name: "Ada" });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ empCode: "E1", staffName: "Ada" });
      });

      // Also verify apiRef.submit() and click-triggered submit wait for a new pending run.
      const deferred2 = Promise.withResolvers<unknown>();
      request.mockReturnValueOnce(deferred2.promise);
      await user.clear(screen.getByRole("textbox", { name: "工号" }));
      await user.type(screen.getByRole("textbox", { name: "工号" }), "E2{Enter}");

      const submitPromise = apiRef.current?.submit();
      expect(onSubmit).toHaveBeenCalledTimes(1);
      deferred2.resolve({ name: "Linus" });
      await submitPromise;

      await waitFor(() => {
        expect(onSubmit).toHaveBeenLastCalledWith({ empCode: "E2", staffName: "Linus" });
      });

      const deferred3 = Promise.withResolvers<unknown>();
      request.mockReturnValueOnce(deferred3.promise);
      await user.clear(screen.getByRole("textbox", { name: "工号" }));
      await user.type(screen.getByRole("textbox", { name: "工号" }), "E3{Enter}");

      await user.click(screen.getByRole("button", { name: "联动提交" }));
      expect(onSubmit).toHaveBeenCalledTimes(2);
      deferred3.resolve({ name: "Ken" });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenLastCalledWith({ empCode: "E3", staffName: "Ken" });
      });
    });

    it("does not deadlock when a sequence ends with its own submit step after an api_call", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const request = vi.fn().mockResolvedValue({ token: "TK-9" });
      const btn: ButtonField = {
        id: "Btn_auto",
        type: "button",
        label: "校验并提交",
        action: "button",
        linkage: {
          rules: [
            {
              id: "R_check_submit",
              trigger: { kind: "click" },
              actions: [
                {
                  type: "api_call",
                  request: { resource: "sec/token", action: "issue" },
                  output: "tk"
                },
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "token", value: { kind: "reference", path: "$steps.tk.token" } }]
                },
                { type: "submit" }
              ]
            }
          ]
        }
      };

      renderForm(<FormRenderer schema={schemaOf([textField("token", { label: "令牌" }), btn])} services={{ request }} onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: "校验并提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ token: "TK-9" });
      });
    });

    it("blocks submit when beforeSubmit fails under default onError:'stop', and proceeds under onError:'continue'", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const onSubmitBlocked = vi.fn();
      const requestFail = vi.fn().mockRejectedValue(new Error("duplicate record"));

      const blockedSchema = schemaOf([textField("name", { label: "名称" }), submitButton()], {
        linkage: {
          rules: [
            {
              id: "R_pre",
              trigger: { kind: "beforeSubmit" },
              actions: [{ type: "api_call", request: { resource: "hr/staff", action: "check" } }]
            }
          ]
        }
      });

      const { unmount } = renderForm(
        <FormRenderer schema={blockedSchema} services={{ request: requestFail, notify }} onSubmit={onSubmitBlocked} />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));
      await waitFor(() => {
        expect(requestFail).toHaveBeenCalledTimes(1);
      });
      await Promise.resolve();
      expect(onSubmitBlocked).not.toHaveBeenCalled();
      // Host services own request failure notifications; runtime never double-notifies.
      expect(notify).not.toHaveBeenCalled();

      unmount();

      const onSubmitAllowed = vi.fn();
      const continueSchema = schemaOf([textField("name", { label: "名称" }), submitButton()], {
        linkage: {
          rules: [
            {
              id: "R_pre_continue",
              trigger: { kind: "beforeSubmit" },
              actions: [
                {
                  type: "api_call",
                  request: { resource: "hr/staff", action: "check" },
                  onError: "continue"
                }
              ]
            }
          ]
        }
      });

      renderForm(
        <FormRenderer schema={continueSchema} services={{ request: requestFail, notify }} onSubmit={onSubmitAllowed} />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));
      await waitFor(() => {
        expect(onSubmitAllowed).toHaveBeenCalledTimes(1);
      });
    });

    it("shows busy indicator only on the triggering field across PC input, PC table cell, Button, and mobile input", async () => {
      const user = userEvent.setup();
      const rootDeferred = Promise.withResolvers<unknown>();
      const btnDeferred = Promise.withResolvers<unknown>();
      const request = vi.fn((req: { resource: string }) => (req.resource === "btn/run" ? btnDeferred : rootDeferred).promise);

      const actionBtn: ButtonField = {
        id: "Btn_run",
        type: "button",
        label: "查询按钮",
        action: "button",
        linkage: {
          rules: [
            {
              id: "R_btn",
              trigger: { kind: "click" },
              actions: [{ type: "api_call", request: { resource: "btn/run", action: "do" } }]
            }
          ]
        }
      };

      const { unmount } = renderForm(
        <FormRenderer
          schema={staffLookupSchema({ includeSelectRecord: false, extraFields: [actionBtn] })}
          services={{ request }}
        />
      );

      const codeInput = screen.getByRole("textbox", { name: "工号" });
      await user.type(codeInput, "E1{Enter}");

      await waitFor(() => {
        expect(screen.getByRole("status", { name: "加载中" })).toBeInTheDocument();
      });
      // Busy indicator renders inside the triggering field's control box only, never on staffName.
      const staffNameInput = screen.getByRole("textbox", { name: "姓名" });
      expect(codeInput.parentElement?.querySelector("[data-field-busy='true']")).not.toBeNull();
      expect(staffNameInput.parentElement?.querySelector("[data-field-busy='true']")).toBeNull();

      rootDeferred.resolve({ name: "Ada", dept: "Eng" });
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: "加载中" })).not.toBeInTheDocument();
      });

      // Button shows antd loading state while its own api_call is pending.
      const btn = screen.getByRole("button", { name: "查询按钮" });
      await user.click(btn);
      await waitFor(() => {
        expect(btn.className).toMatch(/loading/);
      });
      btnDeferred.resolve({});
      await waitFor(() => {
        expect(btn.className).not.toMatch(/loading/);
      });

      unmount();

      // PC table subform cell busy indicator.
      const cellDeferred = Promise.withResolvers<unknown>();
      const cellReq = vi.fn(() => cellDeferred.promise);
      const tableSubform: SubformNode = {
        id: "Sub_busy",
        type: "subform",
        variant: "table",
        key: "lines",
        label: "清单",
        template: [
          textField("sku", {
            label: "编码",
            linkage: {
              rules: [
                {
                  id: "R_cell",
                  trigger: { kind: "commit" },
                  actions: [{ type: "api_call", request: { resource: "inv/item", action: "find" } }]
                }
              ]
            }
          }),
          textField("title", { label: "品名" })
        ]
      };
      const tableRender = renderForm(
        <FormRenderer
          defaultValues={{ lines: [{ sku: "", title: "" }] }}
          schema={schemaOf([tableSubform])}
          services={{ request: cellReq }}
        />
      );
      const cellInput = screen.getByRole("textbox", { name: "编码" });
      await user.type(cellInput, "S1{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("status", { name: "加载中" })).toBeInTheDocument();
      });
      const titleCellInput = screen.getByRole("textbox", { name: "品名" });
      expect(cellInput.closest("td")?.querySelector("[data-field-busy='true']")).not.toBeNull();
      expect(titleCellInput.closest("td")?.querySelector("[data-field-busy='true']")).toBeNull();
      cellDeferred.resolve({});
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: "加载中" })).not.toBeInTheDocument();
      });
      tableRender.unmount();

      // Mobile input busy state.
      const mobileDeferred = Promise.withResolvers<unknown>();
      const mobileReq = vi.fn(() => mobileDeferred.promise);
      renderForm(
        <FormRenderer
          device="mobile"
          schema={staffLookupSchema({ includeSelectRecord: false, mobile: true })}
          services={{ request: mobileReq }}
        />
      );

      await user.type(screen.getByRole("textbox", { name: "工号" }), "E9{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("status", { name: "加载中" })).toBeInTheDocument();
      });
      mobileDeferred.resolve({ name: "Mobile Staff", dept: "Ops" });
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: "加载中" })).not.toBeInTheDocument();
      });
    });

    it("never writes fields on disabled forms and halts on select_record, submit, and reset", async () => {
      const notify = vi.fn();
      const onSubmit = vi.fn();
      const request = vi.fn().mockResolvedValue([
        { name: "Alice", dept: "R&D" },
        { name: "Bob", dept: "Ops" }
      ]);

      const schema = schemaOf(
        [
          textField("empCode", { label: "工号" }),
          textField("staffName", { label: "姓名" })
        ],
        {
          linkage: {
            rules: [
              {
                id: "R_load_write",
                trigger: { kind: "load" },
                actions: [
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "staffName", value: { kind: "literal", value: "MUTATED" } }]
                  },
                  { type: "alert", message: { kind: "literal", value: "after-write" } }
                ]
              },
              {
                id: "R_load_select",
                trigger: { kind: "load" },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "hr/staff", action: "find" },
                    output: "res"
                  },
                  {
                    type: "select_record",
                    source: { kind: "reference", path: "$steps.res" },
                    output: "picked"
                  },
                  { type: "alert", message: { kind: "literal", value: "should-not-run-after-select" } }
                ]
              },
              {
                id: "R_load_submit",
                trigger: { kind: "load" },
                actions: [
                  { type: "submit" },
                  { type: "alert", message: { kind: "literal", value: "should-not-run-after-submit" } }
                ]
              }
            ]
          }
        }
      );

      renderForm(
        <FormRenderer
          disabled
          defaultValues={{ empCode: "E1", staffName: "Original" }}
          schema={schema}
          services={{ request, notify }}
          onSubmit={onSubmit}
        />
      );

      await waitFor(() => {
        expect(notify).toHaveBeenCalledWith("info", "after-write");
      });
      // Disabled form preserved original value, opened no picker, never submitted, and halted after select_record/submit.
      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Original");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalledWith("info", "should-not-run-after-select");
      expect(notify).not.toHaveBeenCalledWith("info", "should-not-run-after-submit");
    });

    it("normalizes select option types against known static options and clears targets on broken references", async () => {
      const user = userEvent.setup();
      const apiRef = createRef<FormRendererApi>();
      const request = vi.fn().mockResolvedValue({ level: "2", nickname: undefined });

      const schema = schemaOf([
        textField("empCode", {
          label: "工号",
          linkage: {
            rules: [
              {
                id: "R_norm",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "hr/staff", action: "find" },
                    output: "res"
                  },
                  {
                    type: "set_fields",
                    assignments: [
                      { targetKey: "level", value: { kind: "reference", path: "$steps.res.level" } },
                      { targetKey: "nickname", value: { kind: "reference", path: "$steps.res.missing.path" } }
                    ]
                  }
                ]
              }
            ]
          }
        }),
        selectField("level", {
          label: "职级",
          dataSource: {
            kind: "static",
            options: [
              { label: "初级", value: 1 },
              { label: "高级", value: 2 }
            ]
          }
        }),
        textField("nickname", { label: "别名" })
      ]);

      renderForm(
        <FormRenderer
          apiRef={apiRef}
          defaultValues={{ nickname: "OldNick" }}
          schema={schema}
          services={{ request }}
        />
      );

      expect(screen.getByRole("textbox", { name: "别名" })).toHaveValue("OldNick");

      await user.type(screen.getByRole("textbox", { name: "工号" }), "E1{Enter}");

      await waitFor(() => {
        expect(apiRef.current?.getValues()).toMatchObject({
          level: 2,
          nickname: ""
        });
      });
    });

    it("tolerates malformed external schema action payloads without crashing", async () => {
      const user = userEvent.setup();
      const malformed = {
        id: "Form_bad",
        version: 2,
        presentations: {
          pc: {
            children: [
              {
                id: "F_a",
                type: "textfield",
                key: "a",
                label: "甲",
                linkage: {
                  rules: [
                    {
                      id: "R_bad",
                      trigger: { kind: "commit", when: "not-a-condition" },
                      actions: [
                        { type: "set_fields", assignments: null },
                        { type: "api_call", request: null },
                        { type: "unknown_future_action" }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        }
      } as unknown as FormSchema;

      renderForm(<FormRenderer schema={malformed} />);
      await user.type(screen.getByRole("textbox", { name: "甲" }), "ok{Enter}");
      expect(screen.getByRole("textbox", { name: "甲" })).toHaveValue("ok");
    });
  });

  describe("generality across scopes and trigger kinds", () => {
    it("runs load with when guard to fill only empty fields while preserving pre-filled defaultValues", async () => {
      const request = vi.fn().mockResolvedValue({ name: "Fetched Name", dept: "Fetched Dept" });
      const schema = schemaOf(
        [
          textField("staffName", { label: "姓名" }),
          textField("deptName", { label: "部门" })
        ],
        {
          linkage: {
            rules: [
              {
                id: "R_init",
                trigger: {
                  kind: "load",
                  when: {
                    kind: "leaf",
                    sourceKey: "staffName",
                    operator: "empty"
                  }
                },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "hr/profile", action: "me" },
                    output: "me"
                  },
                  {
                    type: "set_fields",
                    assignments: [
                      { targetKey: "staffName", value: { kind: "reference", path: "$steps.me.name" } },
                      { targetKey: "deptName", value: { kind: "reference", path: "$steps.me.dept" } }
                    ]
                  }
                ]
              }
            ]
          }
        }
      );

      // Empty initial value → load fires and fills.
      const { unmount } = renderForm(<FormRenderer schema={schema} services={{ request }} />);
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Fetched Name");
        expect(screen.getByRole("textbox", { name: "部门" })).toHaveValue("Fetched Dept");
      });
      expect(request).toHaveBeenCalledTimes(1);

      unmount();

      // Pre-populated draft → when guard is false → request never runs and defaults stay intact.
      request.mockClear();
      renderForm(
        <FormRenderer
          defaultValues={{ staffName: "Existing Draft", deptName: "Finance" }}
          schema={schema}
          services={{ request }}
        />
      );
      expect(request).not.toHaveBeenCalled();
      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Existing Draft");
      expect(screen.getByRole("textbox", { name: "部门" })).toHaveValue("Finance");
    });

    it("runs api_call → set_fields inside PC table subform rows isolated per row", async () => {
      const user = userEvent.setup();
      const request = vi.fn((req: { params?: Record<string, unknown> }) => Promise.resolve(
        req.params?.sku === "A1"
          ? { title: "Keyboard", price: 199 }
          : { title: "Mouse", price: 89 }
      ));

      const subform: SubformNode = {
        id: "Sub_tbl",
        type: "subform",
        variant: "table",
        key: "lines",
        label: "清单",
        template: [
          textField("sku", {
            label: "编码",
            linkage: {
              rules: [
                {
                  id: "R_row_lookup",
                  trigger: {
                    kind: "commit",
                    when: {
                      kind: "leaf",
                      sourceKey: "sku",
                      operator: "notEmpty"
                    }
                  },
                  actions: [
                    {
                      type: "api_call",
                      request: {
                        resource: "catalog/item",
                        action: "find",
                        params: { sku: { kind: "reference", path: "$form.sku" } }
                      },
                      output: "item"
                    },
                    {
                      type: "set_fields",
                      assignments: [
                        { targetKey: "title", value: { kind: "reference", path: "$steps.item.title" } },
                        { targetKey: "price", value: { kind: "reference", path: "$steps.item.price" } }
                      ]
                    }
                  ]
                }
              ]
            }
          }),
          textField("title", { label: "品名" }),
          numberField("price", { label: "单价" })
        ]
      };

      renderForm(
        <FormRenderer
          schema={schemaOf([subform])}
          services={{ request }}
          defaultValues={{
            lines: [
              {
                sku: "",
                title: "",
                price: undefined
              },
              {
                sku: "",
                title: "",
                price: undefined
              }
            ]
          }}
        />
      );

      const skus = screen.getAllByRole("textbox", { name: "编码" });
      await user.type(skus[0]!, "A1{Enter}");

      await waitFor(() => {
        expect(screen.getAllByRole("textbox", { name: "品名" })[0]).toHaveValue("Keyboard");
        expect(screen.getAllByRole("spinbutton", { name: "单价" })[0]).toHaveValue("199");
      });
      // Row 2 remains untouched.
      expect(screen.getAllByRole("textbox", { name: "品名" })[1]).toHaveValue("");
    });

    it("runs button click → api_call → set_fields → navigate and condition trigger → api_call → set_fields", async () => {
      const user = userEvent.setup();
      const navigate = vi.fn();
      const request = vi.fn((req: { resource: string }) => Promise.resolve(
        req.resource === "order/create"
          ? { orderId: "ORD-77" }
          : { rate: "0.08" }
      ));

      const createBtn: ButtonField = {
        id: "Btn_create",
        type: "button",
        label: "生成单据",
        action: "button",
        linkage: {
          rules: [
            {
              id: "R_create",
              trigger: { kind: "click" },
              actions: [
                {
                  type: "api_call",
                  request: { resource: "order/create", action: "run" },
                  output: "created"
                },
                {
                  type: "set_fields",
                  assignments: [{ targetKey: "orderId", value: { kind: "reference", path: "$steps.created.orderId" } }]
                },
                {
                  type: "navigate",
                  to: { kind: "expression", source: "'/orders/' + $steps.created.orderId" }
                }
              ]
            }
          ]
        }
      };

      const schema = schemaOf([
        switchField("taxable", { label: "含税" }),
        textField("taxRate", {
          label: "税率",
          linkage: {
            rules: [
              {
                id: "R_tax",
                trigger: {
                  kind: "condition",
                  condition: {
                    kind: "leaf",
                    sourceKey: "taxable",
                    operator: "eq",
                    value: true
                  }
                },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "fin/tax", action: "rate" },
                    output: "tax"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "taxRate", value: { kind: "reference", path: "$steps.tax.rate" } }]
                  }
                ]
              }
            ]
          }
        }),
        textField("orderId", { label: "单号" }),
        createBtn
      ]);

      renderForm(<FormRenderer schema={schema} services={{ request, navigate }} />);

      await user.click(screen.getByRole("switch", { name: "含税" }));
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "税率" })).toHaveValue("0.08");
      });

      await user.click(screen.getByRole("button", { name: "生成单据" }));
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "单号" })).toHaveValue("ORD-77");
        expect(navigate).toHaveBeenCalledWith("/orders/ORD-77");
      });
    });
  });

  describe("select_record UI and semantics", () => {
    it("auto-selects a single record (plain array, single object, or paginated .items) without opening a dialog", async () => {
      const user = userEvent.setup();
      const request = vi.fn()
        .mockResolvedValueOnce([{ name: "Alice", dept: "Design" }])
        .mockResolvedValueOnce({ name: "Bob", dept: "QA" })
        .mockResolvedValueOnce({ items: [{ name: "Carol", dept: "Security" }], total: 1 });

      renderForm(<FormRenderer schema={staffLookupSchema()} services={{ request }} />);

      const input = screen.getByRole("textbox", { name: "工号" });

      await user.type(input, "E1{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Alice");
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.clear(input);
      await user.type(input, "E2{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Bob");
      });

      await user.clear(input);
      await user.type(input, "E3{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Carol");
      });
    });

    it("notifies on 0 records and respects whenNone:'stop' vs whenNone:'continue'", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const request = vi.fn().mockResolvedValue([]);

      const { unmount } = renderForm(
        <FormRenderer
          defaultValues={{ staffName: "KeepMe", deptName: "KeepDept" }}
          services={{ request, notify }}
          schema={staffLookupSchema({
            selectRecordOverrides: { emptyMessage: "未查到匹配职员", whenNone: "stop" }
          })}
        />
      );

      await user.type(screen.getByRole("textbox", { name: "工号" }), "NONE{Enter}");
      await waitFor(() => {
        expect(notify).toHaveBeenCalledWith("info", "未查到匹配职员");
      });
      // `whenNone: "stop"` halted before `set_fields`, keeping existing values.
      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("KeepMe");

      unmount();

      // `whenNone: "continue"` binds $steps.picked = undefined → downstream set_fields clears targets.
      renderForm(
        <FormRenderer
          defaultValues={{ staffName: "ClearMe", deptName: "ClearDept" }}
          services={{ request, notify }}
          schema={staffLookupSchema({
            selectRecordOverrides: { emptyMessage: "无记录", whenNone: "continue" }
          })}
        />
      );

      await user.type(screen.getByRole("textbox", { name: "工号" }), "NONE{Enter}");
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("");
        expect(screen.getByRole("textbox", { name: "部门" })).toHaveValue("");
      });
    });

    it("opens PC Modal on >1 records with inferred labels from downstream set_fields, supports Arrow/Enter keyboard selection and Escape cancel", async () => {
      const user = userEvent.setup();
      const request = vi.fn().mockResolvedValue([
        { name: "Alice", dept: "Design" },
        { name: "Bob", dept: "Platform" }
      ]);

      renderForm(
        <FormRenderer
          schema={staffLookupSchema({ selectRecordOverrides: { title: "请选择职员" } })}
          services={{ request }}
        />
      );

      const input = screen.getByRole("textbox", { name: "工号" });
      await user.type(input, "A{Enter}");

      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByText("请选择职员")).toBeInTheDocument();
      // Inferred column headers match the downstream set_fields target labels.
      expect(within(dialog).getByRole("columnheader", { name: "姓名" })).toBeInTheDocument();
      expect(within(dialog).getByRole("columnheader", { name: "部门" })).toBeInTheDocument();

      // ArrowDown moves selection from row 0 (Alice) to row 1 (Bob); Enter confirms Bob.
      await user.keyboard("{ArrowDown}{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Bob");
        expect(screen.getByRole("textbox", { name: "部门" })).toHaveValue("Platform");
      });

      // Open again and cancel via Escape → stops without overwriting.
      await user.clear(input);
      await user.type(input, "B{Enter}");
      await screen.findByRole("dialog");

      await user.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Bob");
    });

    it("renders mobile select_record Popup contained inside the mobile frame container when containOverlays is set", async () => {
      const user = userEvent.setup();
      const request = vi.fn().mockResolvedValue([
        { name: "Alice", dept: "Design" },
        { name: "Bob", dept: "Platform" }
      ]);

      const { container } = renderForm(
        <FormRenderer
          containOverlays
          device="mobile"
          schema={staffLookupSchema({ mobile: true, selectRecordOverrides: { title: "选择人员" } })}
          services={{ request }}
        />
      );

      await user.type(screen.getByRole("textbox", { name: "工号" }), "E{Enter}");

      const title = await screen.findByText("选择人员");
      // Contained inside the rendered FormRenderer subtree rather than escaping to document.body.
      expect(container).toContainElement(title);

      await user.click(screen.getByText("Alice"));
      await waitFor(() => {
        expect(screen.queryByText("选择人员")).not.toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "姓名" })).toHaveValue("Alice");
      });
    });

    it("closes an open select_record modal cleanly when the form resets", async () => {
      const user = userEvent.setup();
      const apiRef = createRef<FormRendererApi>();
      const request = vi.fn().mockResolvedValue([
        { name: "Alice", dept: "Design" },
        { name: "Bob", dept: "Platform" }
      ]);

      renderForm(<FormRenderer apiRef={apiRef} schema={staffLookupSchema()} services={{ request }} />);

      await user.type(screen.getByRole("textbox", { name: "工号" }), "E{Enter}");
      await screen.findByRole("dialog");

      act(() => {
        apiRef.current?.reset();
      });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });
  });

  describe("onError and default notify", () => {
    it("stops on api_call failure by default, continues with undefined output when onError:'continue', and defaults alert notify without throwing", async () => {
      const user = userEvent.setup();
      const notify = vi.fn();
      const request = vi.fn().mockRejectedValue(new Error("service unavailable"));

      const schema = schemaOf([
        textField("code", {
          label: "编码",
          linkage: {
            rules: [
              {
                id: "R_stop",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "hr/staff", action: "find" },
                    output: "res",
                    onError: "stop"
                  },
                  { type: "alert", message: { kind: "literal", value: "after-stop" } }
                ]
              },
              {
                id: "R_continue",
                trigger: { kind: "commit" },
                actions: [
                  {
                    type: "api_call",
                    request: { resource: "hr/staff", action: "fallback" },
                    output: "res2",
                    onError: "continue"
                  },
                  {
                    type: "set_fields",
                    assignments: [{ targetKey: "target", value: { kind: "reference", path: "$steps.res2.name" } }]
                  },
                  { type: "alert", message: { kind: "literal", value: "after-continue" } }
                ]
              }
            ]
          }
        }),
        textField("target", { label: "目标" })
      ]);

      const { unmount } = renderForm(
        <FormRenderer defaultValues={{ target: "PreFilled" }} schema={schema} services={{ request, notify }} />
      );

      await user.type(screen.getByRole("textbox", { name: "编码" }), "X{Enter}");

      await waitFor(() => {
        expect(notify).toHaveBeenCalledWith("info", "after-continue");
        expect(screen.getByRole("textbox", { name: "目标" })).toHaveValue("");
      });
      expect(notify).not.toHaveBeenCalledWith("error", expect.anything());
      expect(notify).not.toHaveBeenCalledWith("info", "after-stop");

      unmount();

      // Default notify fallback (no services prop at all) works without throwing.
      const defaultNotifySchema = schemaOf([
        textField("code", {
          label: "编码",
          linkage: {
            rules: [
              {
                id: "R_alert",
                trigger: { kind: "commit" },
                actions: [{ type: "alert", message: { kind: "literal", value: "hello" } }]
              }
            ]
          }
        })
      ]);
      renderForm(<FormRenderer schema={defaultNotifySchema} />);
      await user.type(screen.getByRole("textbox", { name: "编码" }), "ok{Enter}");
      expect(screen.getByRole("textbox", { name: "编码" })).toHaveValue("ok");
    });
  });
});
