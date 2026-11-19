import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { createQueryClient } from "./helpers";
import { useQuery } from "./hooks";

describe("query/useQuery", () => {
  it("recovers from a first-load error when its observer remounts", async () => {
    const client = createQueryClient();
    const queryFn = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce("recovered");

    function Observer() {
      const { data, status } = useQuery({ queryKey: ["remount"], queryFn });
      return <output>{data ?? status}</output>;
    }

    const { rerender } = render(<QueryClientProvider client={client}><Observer /></QueryClientProvider>);
    expect(await screen.findByText("error")).toBeInTheDocument();

    rerender(<QueryClientProvider client={client} />);
    expect(client.getQueryState(["remount"])).toMatchObject({ status: "error", data: undefined });
    rerender(<QueryClientProvider client={client}><Observer /></QueryClientProvider>);

    expect(await screen.findByText("recovered")).toBeInTheDocument();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
