import type { ApiClient } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen, waitFor } from "../../../test-utils";
import { useFormContext } from "../../form";
import { CrudStoreProvider, useCrudStore } from "../store";
import { SceneForm } from "./scene-form";

interface SceneFormValues {
  create: { title: string };
  update: { title: string };
}

function TitleField(): ReactNode {
  const { AppField } = useFormContext<{ title: string }>();

  return (
    <AppField name="title">
      {field => <field.Input label="标题" />}
    </AppField>
  );
}

function FormDriver(): ReactNode {
  const openForm = useCrudStore(state => state.openForm);
  const closeForm = useCrudStore(state => state.closeForm);

  return (
    <>
      <button
        type="button"
        onClick={() => openForm({ scene: "create", values: { title: "create-value" } })}
      >
        打开创建
      </button>

      <button
        type="button"
        onClick={() => openForm({ scene: "update", values: { title: "update-value" } })}
      >
        打开修改
      </button>

      <button
        type="button"
        onClick={() => openForm({
          scene: "update",
          values: { title: "drawer-value" },
          mode: "drawer"
        })}
      >
        打开抽屉
      </button>

      <button type="button" onClick={() => closeForm()}>
        关闭表单
      </button>
    </>
  );
}

function renderSceneForm(apiClient: ApiClient) {
  return render(
    <CrudStoreProvider initialState={{
      defaultSearchValues: undefined,
      sceneDefaultFormValues: {},
      selectedRowKeys: []
    }}
    >
      <SceneForm<SceneFormValues> renderForm={() => <TitleField />} />
      <FormDriver />
    </CrudStoreProvider>,
    { apiClient }
  );
}

describe("crud/scene-form close", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = createTestApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resets edited values when the form is closed via the store closeForm", async () => {
    const user = userEvent.setup();
    renderSceneForm(apiClient);

    await user.click(screen.getByRole("button", { name: "打开创建" }));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveValue("create-value");

    await user.clear(input);
    await user.type(input, "edited");

    await user.click(screen.getByRole("button", { name: "关闭表单" }));
    await user.click(screen.getByRole("button", { name: "打开创建" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("create-value");
    });
  });

  it("resets edited values when the form is closed via the modal close icon", async () => {
    const user = userEvent.setup();
    renderSceneForm(apiClient);

    await user.click(screen.getByRole("button", { name: "打开创建" }));
    const input = await screen.findByRole("textbox");

    await user.clear(input);
    await user.type(input, "edited");

    await user.click(screen.getByRole("button", { name: /close/i }));
    await user.click(screen.getByRole("button", { name: "打开修改" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("update-value");
    });
  });

  it("resets edited values when a drawer form is closed via the store closeForm", async () => {
    const user = userEvent.setup();
    renderSceneForm(apiClient);

    await user.click(screen.getByRole("button", { name: "打开抽屉" }));
    const input = await screen.findByRole("textbox");
    expect(input).toHaveValue("drawer-value");

    await user.clear(input);
    await user.type(input, "edited");

    await user.click(screen.getByRole("button", { name: "关闭表单" }));
    await user.click(screen.getByRole("button", { name: "打开抽屉" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveValue("drawer-value");
    });
  });
});
