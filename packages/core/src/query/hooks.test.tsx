import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { createQueryClient } from "./helpers";
import { useQueries, useQuery } from "./hooks";

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

describe("query/useQueries", () => {
  it("recovers the failed query on remount while its fresh sibling stays cached", async () => {
    const client = createQueryClient();
    const retry = vi.fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce("recovered");
    const cached = vi.fn(() => "ready");

    function Observer() {
      const [first, second] = useQueries({
        queries: [
          { queryKey: ["retry"], queryFn: retry },
          {
            queryKey: ["cached"],
            queryFn: cached,
            staleTime: Infinity
          }
        ]
      });
      return <output>{`${first.data ?? first.status} / ${second.data ?? second.status}`}</output>;
    }

    const { rerender } = render(<QueryClientProvider client={client}><Observer /></QueryClientProvider>);
    expect(await screen.findByText("error / ready")).toBeInTheDocument();
    rerender(<QueryClientProvider client={client} />);
    expect(client.getQueryState(["retry"])).toMatchObject({ status: "error", data: undefined });
    rerender(<QueryClientProvider client={client}><Observer /></QueryClientProvider>);
    expect(await screen.findByText("recovered / ready")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(2);
    expect(cached).toHaveBeenCalledTimes(1);
  });
});
