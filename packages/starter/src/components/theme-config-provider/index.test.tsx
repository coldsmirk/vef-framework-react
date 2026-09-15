import { render } from "../../../test-utils";
import { useThemeStore } from "../../stores";
import { ThemeConfigProvider } from "./index";

describe("theme-config-provider/ThemeConfigProvider", () => {
  beforeEach(() => {
    useThemeStore.setState(useThemeStore.getInitialState(), true);
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  describe("default theme", () => {
    it("starts from the application's default color scheme", () => {
      render(
        <ThemeConfigProvider defaultTheme={{ colorScheme: "dark" }}>
          <div />
        </ThemeConfigProvider>
      );

      expect(document.documentElement).toHaveClass("dark");
    });

    it("keeps the user's own color scheme over the application default", () => {
      useThemeStore.setState({ colorScheme: "light" });

      render(
        <ThemeConfigProvider defaultTheme={{ colorScheme: "dark" }}>
          <div />
        </ThemeConfigProvider>
      );

      expect(document.documentElement).not.toHaveClass("dark");
    });
  });
});
