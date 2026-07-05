import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "../../test-utils";
import { FormActions } from "./form-actions";
import { useForm } from "./use-form";

interface TestFormValues {
  name: string;
}

function TestForm(props: {
  onSubmit?: (values: TestFormValues) => void;
  onReset?: () => void;
  hideReset?: boolean;
  submitLabel?: string;
}) {
  const form = useForm({
    defaultValues: { name: "" } as TestFormValues,
    onSubmit: ({ value }) => {
      props.onSubmit?.(value);
    }
  });

  return (
    <form.AppForm>
      <FormActions
        resetButtonProps={props.hideReset ? false : undefined}
        submitButtonProps={props.submitLabel ? { children: props.submitLabel } : undefined}
        onReset={props.onReset}
      />
    </form.AppForm>
  );
}

describe("form/FormActions", () => {
  describe("default rendering", () => {
    it("renders both submit and reset buttons by default", () => {
      render(<TestForm />);

      expect(screen.getByRole("button", { name: /提\s*交/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /重\s*置/ })).toBeInTheDocument();
    });

    it("hides the reset button when resetButtonProps is false", () => {
      render(<TestForm hideReset />);

      expect(screen.getByRole("button", { name: /提\s*交/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /重\s*置/ })).not.toBeInTheDocument();
    });

    it("honors a custom submit label passed via submitButtonProps", () => {
      render(<TestForm submitLabel="保存" />);

      expect(screen.getByRole("button", { name: /保\s*存/ })).toBeInTheDocument();
    });
  });

  describe("submit interaction", () => {
    it("invokes the form's onSubmit handler when the submit button is clicked", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<TestForm onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: /提\s*交/ }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
      expect(onSubmit).toHaveBeenCalledWith({ name: "" });
    });
  });

  describe("reset interaction", () => {
    it("invokes the onReset callback when the reset button is clicked", async () => {
      const onReset = vi.fn();
      const user = userEvent.setup();
      render(<TestForm onReset={onReset} />);

      await user.click(screen.getByRole("button", { name: /重\s*置/ }));

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it("works without an onReset callback (default form.reset only)", async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const resetButton = screen.getByRole("button", { name: /重\s*置/ });

      await expect(user.click(resetButton)).resolves.toBeUndefined();
    });
  });
});
