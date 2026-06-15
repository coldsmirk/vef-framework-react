import type { ReactNode } from "react";

import { memo } from "react";

import { DataProvider } from "../context";

interface TableSummaryProps {
  summary: ReactNode;
  data: readonly unknown[];
}

export const TableSummary = memo<TableSummaryProps>(({ summary, data }) => <DataProvider value={data}>{summary}</DataProvider>);

TableSummary.displayName = "TableSummary";
