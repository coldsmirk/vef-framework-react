import type { DescriptionsItem } from "@vef-framework-react/components";

import type { ConnectionCheck, DatabaseProbe, HttpProbe } from "../../types";

import { Button, Descriptions, Drawer, Empty, Flex, Icon, Input, Stack, Tag, Text } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { ActivityIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useOpsApi } from "../../api";
import { Labeled } from "../labeled";

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
            <Labeled label="HTTP 探测">
              <Descriptions bordered column={1} items={httpItems(check.http)} size="small" />
            </Labeled>
          )
        : null}

      {check.database
        ? (
            <Labeled label="数据库探测">
              <Descriptions bordered column={1} items={databaseItems(check.database)} size="small" />
            </Labeled>
          )
        : null}
    </Stack>
  );
}

export interface TestConnectionDrawerProps {
  open: boolean;
  systemCode: string;
  onClose: () => void;
}

/**
 * A drawer that probes a saved system's configured transports (HTTP and
 * database) and shows what each probe found.
 */
export function TestConnectionDrawer({
  open,
  systemCode,
  onClose
}: TestConnectionDrawerProps) {
  const { testConnection } = useOpsApi();
  const {
    mutate,
    data,
    isPending,
    reset
  } = useMutation({ mutationFn: testConnection });
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");

  // Reset the probe and inputs when the drawer targets a different system, so
  // a previous system's result never lingers under a new system's title.
  useEffect(() => {
    reset();
    setMethod("GET");
    setPath("/");
  }, [systemCode, reset]);

  return (
    <Drawer open={open} size={520} title={`测试连接 · ${systemCode}`} onClose={onClose}>
      <Stack gap="middle">
        <Flex align="flex-end" gap="small">
          <Labeled label="探测方法">
            <Input aria-label="探测方法" placeholder="GET" style={{ width: 100 }} value={method} onChange={event => setMethod(event.target.value)} />
          </Labeled>

          <div style={{ flex: 1, minWidth: 0 }}>
            <Labeled label="探测路径">
              <Input aria-label="探测路径" placeholder="如 /health" value={path} onChange={event => setPath(event.target.value)} />
            </Labeled>
          </div>

          <Button
            icon={<Icon component={ActivityIcon} />}
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

        {data
          ? <ProbeResult check={data} />
          : <Empty description="开始探测后在此查看结果" style={{ padding: "32px 0" }} />}
      </Stack>
    </Drawer>
  );
}
