import { Loader } from ".";
import { render } from "../../test-utils";

const silence = Function.prototype as () => void;

describe("Loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the spinner at a size antd still supports", () => {
    // antd reports a deprecated prop through console.error outside production;
    // `size="default"` was renamed `"medium"` in antd 6.
    const consoleError = vi.spyOn(console, "error").mockImplementation(silence);

    render(<Loader />);

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("deprecated"));
  });

  it("renders the spinner at a numeric size without a deprecated size", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(silence);

    render(<Loader size={48} />);

    expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("deprecated"));
  });
});
