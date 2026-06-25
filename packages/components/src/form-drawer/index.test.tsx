import type { ApiClient, ApiResult, HttpClient } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen, waitFor } from "../../test-utils";
import { FormDrawer } from "./index";

interface PostValues {
  title: string;
}

interface PostResponse {
  id: number;
}

const RESPONSE_OK: ApiResult<PostResponse> = {
  code: 0,
  message: "ok",
  data: { id: 42 }
};

function okHandler(): ApiResult<PostResponse> {
  return RESPONSE_OK;
}

function okFactory(_http: Readonly<HttpClient>): typeof okHandler {
  return okHandler;
}

function buildOkMutationFn(apiClient: ApiClient) {
  return apiClient.createMutationFn<ApiResult<PostResponse>, PostValues>(
    "posts/create",
    okFactory
  );
}

describe("form-drawer/FormDrawer", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = createTestApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("visibility", () => {
    it("renders the drawer with the provided title when open is true", () => {
      render(<FormDrawer<PostValues> open title="编辑文章" />, { apiClient });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("编辑文章")).toBeInTheDocument();
    });

    it("does not render the drawer when open is false", () => {
      render(<FormDrawer<PostValues> title="编辑文章" />, { apiClient });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("content fallback", () => {
    it("renders the empty placeholder when no children are provided", () => {
      render(<FormDrawer<PostValues> open title="编辑" />, { apiClient });

      expect(screen.getByText("请提供表单内容")).toBeInTheDocument();
    });

    it("renders children passed as ReactNode", () => {
      render(
        <FormDrawer<PostValues> open title="编辑">
          <span data-testid="drawer-body">drawer body</span>
        </FormDrawer>,
        { apiClient }
      );

      expect(screen.getByTestId("drawer-body")).toBeInTheDocument();
    });
  });

  describe("submit", () => {
    it("invokes onSubmit with the current form values when submit is clicked", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <FormDrawer<PostValues>
          open
          defaultValues={{ title: "draft" }}
          title="编辑"
          onSubmit={onSubmit}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ title: "draft" });
      });
    });

    it("invokes mutationFn, fires afterSubmit, and closes when the mutation succeeds", async () => {
      const mutationFn = buildOkMutationFn(apiClient);
      const afterSubmit = vi.fn();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <FormDrawer<PostValues, PostResponse>
          open
          afterSubmit={afterSubmit}
          defaultValues={{ title: "x" }}
          mutationFn={mutationFn}
          title="编辑"
          onClose={onClose}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(afterSubmit).toHaveBeenCalledWith({ title: "x" }, { id: 42 });
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("reset", () => {
    it("invokes onReset with the default values when the reset button is clicked", async () => {
      const onReset = vi.fn();
      const user = userEvent.setup();

      render(
        <FormDrawer<PostValues>
          open
          defaultValues={{ title: "x" }}
          title="编辑"
          onReset={onReset}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /重\s*置/ }));

      expect(onReset).toHaveBeenCalledWith({ title: "x" });
    });
  });

  describe("renderActions", () => {
    it("invokes renderActions with the form API and default buttons", () => {
      const renderActions = vi.fn(() => <button data-testid="drawer-action" type="button">Go</button>);

      render(
        <FormDrawer<PostValues>
          open
          renderActions={renderActions}
          title="编辑"
        />,
        { apiClient }
      );

      expect(renderActions).toHaveBeenCalled();
      const [api, defaults] = renderActions.mock.calls[0] as unknown as [
        { reset: () => void },
        { submitButton: unknown; resetButton: unknown }
      ];
      expect(api).toHaveProperty("reset");
      expect(defaults).toHaveProperty("submitButton");
      expect(defaults).toHaveProperty("resetButton");
      expect(screen.getByTestId("drawer-action")).toBeInTheDocument();
    });

    it("renders no footer buttons when renderActions returns null", () => {
      render(
        <FormDrawer<PostValues>
          open
          renderActions={() => null}
          title="编辑"
        />,
        { apiClient }
      );

      expect(screen.queryByRole("button", { name: /提\s*交/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /重\s*置/ })).not.toBeInTheDocument();
    });
  });
});
