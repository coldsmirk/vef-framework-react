import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "../../../test-utils";
import { useForm } from "../use-form";
import { Form } from "./form";

// Function.prototype is a no-op function — useful for silencing console without
// running into `@typescript-eslint/no-empty-function`.
const silence = Function.prototype as () => void;

interface TestFormValues {
  name: string;
}

function TestForm(props: { onSubmit?: (values: TestFormValues) => void | Promise<void> }) {
  const form = useForm({
    defaultValues: { name: "" } as TestFormValues,
    onSubmit: ({ value }) => props.onSubmit?.(value)
  });

  return (
    <form.AppForm>
      <Form>
        <form.AppField name="name">
          {field => <field.Input label="名称" />}
        </form.AppField>

        <button type="submit">提交</button>
        <button type="reset">重置</button>
      </Form>
    </form.AppForm>
  );
}

describe("form/Form", () => {
  describe("native submit", () => {
    it("runs the form's onSubmit handler when the form is submitted", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<TestForm onSubmit={onSubmit} />);

      await user.type(screen.getByRole("textbox"), "hello");
      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ name: "hello" });
      });
    });

    it("contains a rejecting onSubmit instead of surfacing an unhandled rejection", async () => {
      // `handleSubmit` rethrows a rejecting user onSubmit; the native-submit
      // path has no awaiting caller, so the Form must contain the rejection.
      // An uncontained rejection would fail this test at the process level.
      const failure = new Error("boom");
      const consoleError = vi.spyOn(console, "error").mockImplementation(silence);
      const user = userEvent.setup();

      render(
        <TestForm
          onSubmit={() => {
            throw failure;
          }}
        />
      );

      await user.click(screen.getByRole("button", { name: "提交" }));

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("[Form] submit failed:", failure);
      });
      consoleError.mockRestore();
    });
  });

  describe("native reset", () => {
    it("restores default values when the form is reset", async () => {
      const user = userEvent.setup();
      render(<TestForm />);

      const input = screen.getByRole("textbox");
      await user.type(input, "draft");
      expect(input).toHaveValue("draft");

      await user.click(screen.getByRole("button", { name: "重置" }));

      await waitFor(() => {
        expect(input).toHaveValue("");
      });
    });
  });
});
