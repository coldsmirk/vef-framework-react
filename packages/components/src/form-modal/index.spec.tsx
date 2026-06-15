import type { ApiClient, ApiResult, HttpClient } from "@vef-framework-react/core";

import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestApiClient, render, screen, waitFor } from "../../test-utils";
import { FormModal } from "./index";

interface PostValues {
  title: string;
}

interface PostResponse {
  id: number;
}

const RESPONSE_OK: ApiResult<PostResponse> = {
  code: 0,
  message: "ok",
  data: { id: 99 }
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

describe("form-modal/FormModal", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = createTestApiClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("visibility", () => {
    it("renders the dialog with the provided title when open is true", () => {
      render(<FormModal<PostValues> open title="新建文章" />, { apiClient });

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("新建文章")).toBeInTheDocument();
    });

    it("does not render the dialog when open is false", () => {
      render(<FormModal<PostValues> title="新建文章" />, { apiClient });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("content fallback", () => {
    it("renders the empty placeholder when no children are provided", () => {
      render(<FormModal<PostValues> open title="新建" />, { apiClient });

      expect(screen.getByText("请提供表单内容")).toBeInTheDocument();
    });

    it("renders children passed as ReactNode", () => {
      render(
        <FormModal<PostValues> open title="新建">
          <span data-testid="custom-body">自定义内容</span>
        </FormModal>,
        { apiClient }
      );

      expect(screen.getByTestId("custom-body")).toBeInTheDocument();
    });

    it("invokes children rendered as a function with the form API", () => {
      const renderChildren = vi.fn(() => <span data-testid="fn-body">via fn</span>);

      render(
        <FormModal<PostValues> open title="新建">
          {renderChildren}
        </FormModal>,
        { apiClient }
      );

      expect(renderChildren).toHaveBeenCalled();
      const [formApi] = renderChildren.mock.calls[0] as unknown as [
        { AppForm: unknown; reset: unknown }
      ];
      expect(formApi).toHaveProperty("AppForm");
      expect(formApi).toHaveProperty("reset");
      expect(screen.getByTestId("fn-body")).toBeInTheDocument();
    });
  });

  describe("submit", () => {
    it("invokes onSubmit with the current form values when submit is clicked", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <FormModal<PostValues>
          open
          defaultValues={{ title: "hello" }}
          title="新建"
          onSubmit={onSubmit}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ title: "hello" });
      });
    });

    it("transforms values via beforeSubmit before delivering them to onSubmit", async () => {
      const onSubmit = vi.fn();
      const beforeSubmit = vi.fn((values: PostValues) => {
        return {
          ...values,
          title: `[edited] ${values.title}`
        };
      });
      const user = userEvent.setup();

      render(
        <FormModal<PostValues>
          open
          beforeSubmit={beforeSubmit}
          defaultValues={{ title: "raw" }}
          title="新建"
          onSubmit={onSubmit}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ title: "[edited] raw" });
      });
    });

    it("invokes mutationFn, fires afterSubmit, and closes when the mutation succeeds", async () => {
      const mutationFn = buildOkMutationFn(apiClient);
      const afterSubmit = vi.fn();
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <FormModal<PostValues, PostResponse>
          open
          afterSubmit={afterSubmit}
          defaultValues={{ title: "x" }}
          mutationFn={mutationFn}
          title="新建"
          onClose={onClose}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(afterSubmit).toHaveBeenCalledWith({ title: "x" }, { id: 99 });
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("closes the modal automatically when neither onSubmit nor mutationFn is configured", async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();

      render(
        <FormModal<PostValues>
          open
          defaultValues={{ title: "x" }}
          title="新建"
          onClose={onClose}
        />,
        { apiClient }
      );

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("reset", () => {
    it("invokes onReset with the default values when the reset button is clicked", async () => {
      const onReset = vi.fn();
      const user = userEvent.setup();

      render(
        <FormModal<PostValues>
          open
          defaultValues={{ title: "x" }}
          title="新建"
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
      const renderActions = vi.fn(() => <button data-testid="custom-action" type="button">Go</button>);

      render(
        <FormModal<PostValues>
          open
          renderActions={renderActions}
          title="新建"
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
      expect(screen.getByTestId("custom-action")).toBeInTheDocument();
    });

    it("renders no footer buttons when renderActions returns null", () => {
      render(
        <FormModal<PostValues>
          open
          renderActions={() => null}
          title="新建"
        />,
        { apiClient }
      );

      expect(screen.queryByRole("button", { name: /提\s*交/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /重\s*置/ })).not.toBeInTheDocument();
    });
  });
});
