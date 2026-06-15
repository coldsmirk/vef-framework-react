import { describe, expect, it } from "vitest";

import { render, screen } from "../../test-utils";
import { Grid } from "./index";

describe("grid/Grid", () => {
  it("renders each GridItem child", () => {
    render(
      <Grid>
        <Grid.Item>
          <span data-testid="item-1">one</span>
        </Grid.Item>

        <Grid.Item>
          <span data-testid="item-2">two</span>
        </Grid.Item>
      </Grid>
    );

    expect(screen.getByTestId("item-1")).toBeInTheDocument();
    expect(screen.getByTestId("item-2")).toBeInTheDocument();
  });

  it("ignores plain (non-GridItem) children", () => {
    render(
      <Grid>
        <Grid.Item>
          <span data-testid="grid-child">inside grid item</span>
        </Grid.Item>

        <div data-testid="bare-div">bare div should be skipped</div>
      </Grid>
    );

    expect(screen.getByTestId("grid-child")).toBeInTheDocument();
    expect(screen.queryByTestId("bare-div")).not.toBeInTheDocument();
  });

  it("renders nothing when no GridItem children are supplied", () => {
    const { container } = render(<Grid />);

    // The Grid wrapper itself still exists, but no GridItem children render.
    expect(container.firstChild).toBeInTheDocument();
  });

  describe("Grid.Item", () => {
    it("renders Grid.Item children inside the grid", () => {
      render(
        <Grid>
          <Grid.Item span={12}>
            <span data-testid="span-12">wide item</span>
          </Grid.Item>
        </Grid>
      );

      expect(screen.getByTestId("span-12")).toBeInTheDocument();
    });
  });
});
