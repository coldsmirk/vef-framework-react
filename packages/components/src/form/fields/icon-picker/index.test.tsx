import type { FormApi } from "../../types";
import type { IconPickerFieldProps } from "./props";

import userEvent from "@testing-library/user-event";

import { render, screen, waitFor } from "../../../../test-utils";
import { useForm } from "../../use-form";

// The picker's grid is virtualized off element size, which jsdom reports as 0.
// Give it a real box so the grid mounts cells when the popup opens.
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

beforeAll(() => {
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get: () => 320 },
    offsetHeight: { configurable: true, get: () => 264 }
  });
});

afterAll(() => {
  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  }

  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  }
});

interface TestValues {
  icon: string | null | undefined;
}

type TestFormApi = FormApi<TestValues>;

interface TestFormProps extends IconPickerFieldProps {
  defaultValue?: string | null;
  formDisabled?: boolean;
  onForm?: (form: TestFormApi) => void;
}

function TestForm({
  defaultValue = null,
  formDisabled = false,
  onForm,
  ...fieldProps
}: TestFormProps) {
  const form = useForm({
    defaultValues: {
      icon: defaultValue
    } as TestValues
  });

  onForm?.(form);

  return (
    <form.AppForm>
      <form.Form
        component="div"
        disabled={formDisabled}
      >
        <form.AppField
          name="icon"
          validators={{
            onBlur: ({ value }) => value ? undefined : "请选择图标"
          }}
        >
          {field => (
            <field.IconPicker
              {...fieldProps}
              label="图标"
            />
          )}
        </form.AppField>
      </form.Form>
    </form.AppForm>
  );
}

describe("form/fields/IconPickerField", () => {
  describe("value synchronization", () => {
    it("writes the picked icon name into the form value", async () => {
      const user = userEvent.setup();
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          onForm={form => {
            formApi = form;
          }}
        />
      );

      await user.click(screen.getByRole("combobox"));
      await user.type(screen.getByRole("combobox"), "heart");
      await user.click(await screen.findByRole("button", { name: "heart-handshake" }));

      await waitFor(() => {
        expect(formApi?.getFieldValue("icon")).toBe("heart-handshake");
      });
    });

    it("clears to undefined in the form value", async () => {
      const user = userEvent.setup();
      let formApi: TestFormApi | undefined;
      render(
        <TestForm
          defaultValue="house"
          onForm={form => {
            formApi = form;
          }}
        />
      );

      const clear = screen.getByRole("combobox").closest(".vef-select")?.querySelector(".vef-select-clear");

      if (!(clear instanceof HTMLElement)) {
        throw new TypeError("clear control not found");
      }

      await user.click(clear);

      await waitFor(() => {
        expect(formApi?.getFieldValue("icon")).toBeUndefined();
      });
    });
  });

  describe("disabled state", () => {
    it("disables the trigger from the form disabled context", () => {
      render(<TestForm formDisabled />);

      expect(screen.getByRole("combobox")).toBeDisabled();
    });

    it("disables the trigger from the field disabled prop", () => {
      render(<TestForm disabled />);

      expect(screen.getByRole("combobox")).toBeDisabled();
    });
  });

  describe("validation", () => {
    it("shows the blur validation error after the trigger loses focus", async () => {
      render(<TestForm defaultValue={null} />);

      const combobox = screen.getByRole("combobox");
      combobox.focus();
      combobox.blur();

      expect(await screen.findByText("请选择图标")).toBeInTheDocument();
    });
  });
});
