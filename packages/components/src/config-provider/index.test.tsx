import { act, render, screen, waitFor } from "../../test-utils";
import { showInfoMessage } from "../_base";
import { FormModal } from "../form-modal";
import { Pagination } from "../pagination";

describe("config-provider/ConfigProvider", () => {
  describe("component defaults", () => {
    it("applies an application default to an antd-backed component", () => {
      render(<Pagination total={20} />, {
        configProviderProps: { components: { Pagination: { showSizeChanger: true } } }
      });

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("lets an explicitly passed prop override the application default", () => {
      render(<Pagination showSizeChanger={false} total={20} />, {
        configProviderProps: { components: { Pagination: { showSizeChanger: true } } }
      });

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });

    it("ignores props outside a component's whitelist", () => {
      // A pre-built value escapes excess-property checking, which is how a
      // non-whitelisted prop would actually reach the provider.
      const components = { FormModal: { draggable: false, title: "Injected title" } };

      render(<FormModal open />, { configProviderProps: { components } });

      expect(screen.queryByText("Injected title")).not.toBeInTheDocument();
    });

    it("applies an application default to the framework's message holder", async () => {
      render(<div />, {
        configProviderProps: { components: { Message: { maxCount: 1 } } }
      });

      act(() => {
        showInfoMessage("first");
        showInfoMessage("second");
      });

      expect(await screen.findByText("second")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.queryByText("first")).not.toBeInTheDocument();
      });
    });
  });
});
