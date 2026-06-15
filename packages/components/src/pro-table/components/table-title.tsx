import type { ReactNode } from "react";

import { memo } from "react";

import { DataProvider } from "../context";

interface TableTitleProps {
  title: ReactNode;
  data: readonly unknown[];
}

export const TableTitle = memo<TableTitleProps>(({ title, data }) => <DataProvider value={data}>{title}</DataProvider>);

TableTitle.displayName = "TableTitle";
