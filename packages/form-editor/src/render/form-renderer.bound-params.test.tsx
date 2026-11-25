import type { ReactNode } from "react";

import type { Block, FormSchema, LinkageEvaluators, SelectField, TextfieldField } from "../types";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createDefaultRegistry } from "../engine/registry/defaults";
import { RegistryProvider } from "../store/engine-provider";
import { FormRenderer } from "./form-renderer";

function renderRuntime(children: ReactNode): void {
  const registry = createDefaultRegistry();

  render(
    <RegistryProvider registries={{ pc: registry, mobile: registry }}>
      {children}
    </RegistryProvider>
  );
}

function stack(...blocks: Block[]): FormSchema {
  return {
    id: "Form_1",
    version: 2,
    presentations: { pc: { children: blocks } }
  };
}

const departmentField: TextfieldField = {
  id: "Field_dept",
  type: "textfield",
  key: "deptId",
  label: "deptId"
};

function teamSelect(source = "deptId"): SelectField {
  return {
    id: "Field_team",
    type: "select",
    key: "teamId",
    label: "teamId",
    dataSource: {
      kind: "remote",
      request: {
        resource: "org/team",
        action: "find_options",
        params: {
          departmentId: { kind: "expression", source },
          active: { kind: "literal", value: true }
        }
      }
    }
  };
}

const evaluators: LinkageEvaluators = {
  evaluateAssignExpression: (source, values) => values[source]
};

describe("FormRenderer bound data-source params", () => {
  it("evaluates expression params before services.request and refetches on change", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue([{ label: "Team A", value: "t1" }]);

    renderRuntime(
      <FormRenderer
        evaluators={evaluators}
        schema={stack(departmentField, teamSelect())}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request.mock.calls[0]?.[0]).toEqual({
      resource: "org/team",
      action: "find_options",
      params: { departmentId: "", active: true }
    });

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(
        {
          resource: "org/team",
          action: "find_options",
          params: { departmentId: "D1", active: true }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("evaluates reference params in remote option sources and cascades on change", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue([{ label: "Team A", value: "t1" }]);
    const refSelect: SelectField = {
      id: "Field_team",
      type: "select",
      key: "teamId",
      label: "teamId",
      dataSource: {
        kind: "remote",
        request: {
          resource: "org/team",
          action: "find_options",
          params: {
            departmentId: { kind: "reference", path: "deptId" }
          }
        }
      }
    };

    renderRuntime(
      <FormRenderer
        schema={stack(departmentField, refSelect)}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D9");

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(
        {
          resource: "org/team",
          action: "find_options",
          params: { departmentId: "D9" }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("uses built-in evaluators when host omits evaluators", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue([{ label: "Team A", value: "t1" }]);

    renderRuntime(
      <FormRenderer
        schema={stack(departmentField, teamSelect("$form.deptId"))}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalled());
    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    await waitFor(() => {
      expect(request).toHaveBeenLastCalledWith(
        {
          resource: "org/team",
          action: "find_options",
          params: { departmentId: "D1", active: true }
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it("evaluates subform row bound params against each row's own scope", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue([{ label: "Team A", value: "t1" }]);
    const subform: Block = {
      id: "Sub_lines",
      type: "subform",
      variant: "stack",
      key: "lines",
      label: "明细",
      rows: { mode: "dynamic", min: 2 },
      template: [departmentField, teamSelect()]
    };

    renderRuntime(
      <FormRenderer
        evaluators={evaluators}
        schema={stack(subform)}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalled());

    const inputs = screen.getAllByRole("textbox", { name: "deptId" });
    await user.type(inputs[0] as HTMLElement, "D1");
    await user.type(inputs[1] as HTMLElement, "D2");

    const boundDepartments = (): unknown[] => request.mock.calls.map(call => (call[0] as { params?: Record<string, unknown> }).params?.departmentId);

    await waitFor(() => {
      expect(boundDepartments()).toEqual(expect.arrayContaining(["D1", "D2"]));
    });
  });

  it("does not refetch in-flight fixed-param sources on unrelated keystrokes", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockReturnValue(new Promise<never>(() => {
      // Deliberately never settles.
    }));
    const fixedSelect: SelectField = {
      ...teamSelect(),
      id: "Field_fixed",
      key: "fixed",
      dataSource: {
        kind: "remote",
        request: { resource: "sys/fixed", action: "find_options" }
      }
    };

    renderRuntime(
      <FormRenderer
        evaluators={evaluators}
        schema={stack(departmentField, teamSelect(), fixedSelect)}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalled());

    const fixedCalls = (): number => request.mock.calls.filter(call => (call[0] as { resource: string }).resource === "sys/fixed").length;
    const before = fixedCalls();

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "abc");

    expect(fixedCalls()).toBe(before);
  });

  it("does not refetch literal-only remote sources when form values change", async () => {
    const user = userEvent.setup();
    const request = vi.fn().mockResolvedValue([{ label: "Team A", value: "t1" }]);
    const fixedSelect: SelectField = {
      ...teamSelect(),
      dataSource: {
        kind: "remote",
        request: {
          resource: "org/team",
          action: "find_options",
          params: { active: { kind: "literal", value: true } }
        }
      }
    };

    renderRuntime(
      <FormRenderer
        evaluators={evaluators}
        schema={stack(departmentField, fixedSelect)}
        services={{ request }}
      />
    );

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));

    await user.type(screen.getByRole("textbox", { name: "deptId" }), "D1");

    expect(request).toHaveBeenCalledTimes(1);
  });
});
