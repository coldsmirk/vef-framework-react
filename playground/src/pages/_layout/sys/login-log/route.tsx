import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { LoginLog } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, Tag, Text } from "@vef-framework-react/components";
import { findLoginLogPage } from "~apis";

import { BasicSearch } from "./components/basic-search";

export const Route = createFileRoute("/_layout/sys/login-log")({
  component: RouteComponent
});

const tableColumns: Array<TableColumn<LoginLog>> = [
  {
    dataIndex: "username",
    title: "用户账号",
    width: 160
  },
  {
    dataIndex: "userName",
    title: "用户姓名",
    width: 120
  },
  {
    dataIndex: "userAgent",
    title: "用户代理",
    width: 300,
    render(value: string): ReactNode {
      return (
        <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 300 }}>{value}</Text>
      );
    }
  },
  {
    dataIndex: "loginIp",
    title: "登录IP",
    width: 120
  },
  {
    align: "center",
    dataIndex: "isOk",
    title: "是否成功",
    width: 100,
    render(value: boolean): ReactNode {
      return <Tag color={value ? "success" : "error"}>{value ? "成功" : "失败"}</Tag>;
    }
  },
  {
    dataIndex: "failReason",
    minWidth: 200,
    title: "失败原因",
    render(value: string | null | undefined): ReactNode {
      return (
        <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 200 }}>{value ?? "-"}</Text>
      );
    }
  },
  {
    dataIndex: "traceId",
    title: "追踪ID",
    width: 320
  },
  {
    dataIndex: "createdAt",
    title: "登录时间",
    width: 180
  }
];

function RouteComponent(): ReactNode {
  return (
    <CrudPage
      basicSearch={<BasicSearch />}
      columnSettings={{ storageKey: "page.sys.login_log" }}
      queryFn={findLoginLogPage}
      rowKey="id"
      tableColumns={tableColumns}
    />
  );
}
