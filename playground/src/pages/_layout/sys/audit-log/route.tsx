import type { TableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";
import type { AuditLog } from "~apis";

import { createFileRoute } from "@tanstack/react-router";
import { CrudPage, Icon, OperationButton, Text } from "@vef-framework-react/components";
import { useSetAtom } from "@vef-framework-react/core";
import { ViewIcon } from "lucide-react";
import { findAuditLogPage } from "~apis";

import { BasicSearch } from "./components/basic-search";
import { DetailModal, openModalAtom } from "./components/detail-modal";
import { AuditLogOperationButtonGroup } from "./helpers";

export const Route = createFileRoute("/_layout/sys/audit-log")({
  component: RouteComponent
});

function renderResultCode(value: number): ReactNode {
  return <Text strong type={value === 0 ? "success" : "danger"}>{value}</Text>;
}

function getElapsedTimeType(value: number): { type: "success" | "secondary" | "warning" | "danger"; strong: boolean } {
  if (value < 100) {
    return { type: "success", strong: false };
  }

  if (value < 200) {
    return { type: "secondary", strong: true };
  }

  if (value < 500) {
    return { type: "warning", strong: true };
  }

  return { type: "danger", strong: true };
}

function renderElapsedTime(value: number): ReactNode {
  const { type, strong } = getElapsedTimeType(value);

  return (
    <Text strong={strong} type={type}>
      {value}
      {" ms"}
    </Text>
  );
}

const tableColumns: Array<TableColumn<AuditLog>> = [
  {
    title: "操作用户",
    dataIndex: "userName",
    width: 120
  },
  {
    title: "用户代理",
    dataIndex: "userAgent",
    width: 160,
    render(value) {
      return (
        <Text ellipsis={{ tooltip: value }} style={{ maxWidth: 160 }}>{value}</Text>
      );
    }
  },
  {
    title: "API资源",
    dataIndex: "apiResource",
    width: 180
  },
  {
    title: "API操作",
    dataIndex: "apiAction",
    width: 120
  },
  {
    title: "API版本",
    dataIndex: "apiVersion",
    width: 100,
    align: "center"
  },
  {
    title: "请求IP",
    dataIndex: "requestIp",
    width: 120
  },
  {
    title: "请求ID",
    dataIndex: "requestId",
    width: 320
  },
  {
    title: "结果代码",
    dataIndex: "resultCode",
    width: 100,
    align: "center",
    render: renderResultCode
  },
  {
    title: "结果消息",
    dataIndex: "resultMessage",
    width: 160
  },
  {
    title: "耗时",
    dataIndex: "elapsedTime",
    width: 120,
    align: "center",
    render: renderElapsedTime
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    width: 180
  }
];

function RouteComponent(): ReactNode {
  const openModal = useSetAtom(openModalAtom);

  return (
    <>
      <CrudPage
        basicSearch={<BasicSearch />}
        columnSettings={{ storageKey: "page.sys.audit_log" }}
        queryFn={findAuditLogPage}
        rowKey="id"
        tableColumns={tableColumns}
        operationColumn={{
          render(row) {
            return (
              <AuditLogOperationButtonGroup selector={state => [state.openForm, state.delete, state.refetchQuery] as const}>
                <OperationButton
                  color="primary"
                  icon={<Icon component={ViewIcon} />}
                  onClick={() => openModal(row)}
                >
                  请求数据
                </OperationButton>
              </AuditLogOperationButtonGroup>
            );
          }
        }}
      />

      <DetailModal />
    </>
  );
}
