import type { DescriptionsItem } from "@vef-framework-react/components";

import type { ConnectionCheck, DatabaseProbe, HttpProbe } from "../../types";

import { Button, Descriptions, Empty, Flex, Input, Modal, Stack, Tag, Text } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useEffect, useState } from "react";

import { useOpsApi } from "../../api";

function reachableTag(reachable: boolean) {
  return <Tag color={reachable ? "success" : "error"}>{reachable ? "可达" : "不可达"}</Tag>;
}

function httpItems(probe: HttpProbe): DescriptionsItem[] {
  const items: DescriptionsItem[] = [
    {
      key: "reachable",
      label: "状态",
      children: reachableTag(probe.reachable)
    },
    {
      key: "duration",
      label: "耗时",
      children: `${probe.durationMs} ms`
    }
  ];

  if (probe.status) {
    items.push({
      key: "status",
      label: "HTTP 状态",
      children: `${probe.status} ${probe.statusText ?? ""}`
    });
  }

  if (probe.error) {
    items.push({
      key: "error",
      label: "错误",
      children: <Text type="danger">{probe.error}</Text>
    });
  }

  return items;
}

function databaseItems(probe: DatabaseProbe): DescriptionsItem[] {
  const items: DescriptionsItem[] = [
    {
      key: "reachable",
      label: "状态",
      children: reachableTag(probe.reachable)
    },
    {
      key: "duration",
      label: "耗时",
      children: `${probe.durationMs} ms`
    }
  ];

  if (probe.version) {
    items.push({
      key: "version",
      label: "版本",
      children: probe.version
    });
  }

  if (probe.error) {
    items.push({
      key: "error",
      label: "错误",
      children: <Text type="danger">{probe.error}</Text>
    });
  }

  return items;
}

function ProbeResult({ check }: { check: ConnectionCheck }) {
  if (!check.http && !check.database) {
    return <Empty description="该系统未配置任何可探测的传输" />;
  }

  return (
    <Stack gap="middle">
      {check.http
        ? (
            <Stack gap="small">
              <Text strong>HTTP 探测</Text>
              <Descriptions bordered column={1} items={httpItems(check.http)} size="small" />
            </Stack>
          )
        : null}

      {check.database
        ? (
            <Stack gap="small">
              <Text strong>数据库探测</Text>
              <Descriptions bordered column={1} items={databaseItems(check.database)} size="small" />
            </Stack>
          )
        : null}
    </Stack>
  );
}

export interface TestConnectionDialogProps {
  open: boolean;
  systemCode: string;
  onClose: () => void;
}

/**
 * A modal that probes a saved system's configured transports and shows the result.
 */
export function TestConnectionDialog({
  open,
  systemCode,
  onClose
}: TestConnectionDialogProps) {
  const { testConnection } = useOpsApi();
  const {
    mutate,
    data,
    isPending,
    reset
  } = useMutation({ mutationFn: testConnection });
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");

  // Reset the probe and inputs when the dialog targets a different system, so a
  // previous system's result never lingers under a new system's title.
  useEffect(() => {
    reset();
    setMethod("GET");
    setPath("/");
  }, [systemCode, reset]);

  return (
    <Modal footer={null} open={open} title={`测试连接 · ${systemCode}`} width={540} onCancel={onClose}>
      <Stack gap="middle">
        <Flex gap="small">
          <Input aria-label="探测方法" placeholder="方法" style={{ width: 110 }} value={method} onChange={event => setMethod(event.target.value)} />
          <Input aria-label="探测路径" placeholder="探测路径，如 /health" style={{ flex: 1 }} value={path} onChange={event => setPath(event.target.value)} />

          <Button
            loading={isPending}
            type="primary"
            onClick={() => mutate({
              systemCode,
              method,
              path
            })}
          >
            开始探测
          </Button>
        </Flex>

        {data ? <ProbeResult check={data} /> : null}
      </Stack>
    </Modal>
  );
}
