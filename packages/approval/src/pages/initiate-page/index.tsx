import type { AvailableFlow } from "../../types";

import {
  Card,
  Empty,
  Flex,
  globalCssVars,
  Input,
  Pagination,
  Spin,
  Stack,
  SYMBOL_PAGINATION,
  Text,
  Title
} from "@vef-framework-react/components";
import { keepPreviousData, useQuery } from "@vef-framework-react/core";
import { useMemo, useState } from "react";

import { useMyApprovalApi } from "../../api";
import { LabelFilterSelect } from "../../components";
import { FlowIcon } from "../../components/icon";
import { StartInstanceDrawer } from "./start-drawer";

export { StartInstanceDrawer, type StartInstanceDrawerProps } from "./start-drawer";

const PAGE_SIZE = 48;

export interface ApprovalInitiatePageProps {
  /**
   * The tenant whose flows are offered.
   *
   * @default "default"
   */
  tenantId?: string;
  /**
   * A fixed label pre-filter (e.g. `{ mobile: "" }` to offer only
   * mobile-initiable flows). Combined with the user's own label filter.
   */
  labels?: Record<string, string>;
  /**
   * Optional page title.
   */
  title?: string;
  /**
   * Fired after an instance is submitted.
   */
  onStarted?: () => void;
}

/**
 * One initiable flow as a clickable card.
 */
function FlowCard({ flow, onClick }: { flow: AvailableFlow; onClick: () => void }) {
  return (
    <Card
      hoverable
      size="small"
      style={{ width: "100%" }}
      onClick={onClick}
    >
      <Flex align="flex-start" gap="middle">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 10,
            flexShrink: 0,
            background: `color-mix(in srgb, ${globalCssVars.colorPrimary} 10%, transparent)`,
            color: globalCssVars.colorPrimary
          }}
        >
          <FlowIcon name={flow.flowIcon ?? "file-check"} size={20} />
        </div>

        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text ellipsis strong>{flow.flowName}</Text>

          <Text
            ellipsis
            style={{ fontSize: globalCssVars.fontSizeSm }}
            type="secondary"
          >
            {flow.description ?? flow.flowCode}
          </Text>
        </Stack>
      </Flex>
    </Card>
  );
}

/**
 * The initiation portal: every flow the current user may start, grouped by
 * category, searchable by keyword and label. Clicking a card opens the start
 * drawer with the published form.
 */
export function ApprovalInitiatePage({
  tenantId = "default",
  labels,
  title = "发起审批",
  onStarted
}: ApprovalInitiatePageProps) {
  const api = useMyApprovalApi();

  const [keyword, setKeyword] = useState("");
  const [labelFilter, setLabelFilter] = useState<Record<string, string>>();
  const [page, setPage] = useState(1);
  const [startTarget, setStartTarget] = useState<string | null>(null);

  const mergedLabels = useMemo(
    () => {
      const merged = { ...labels, ...labelFilter };

      return Object.keys(merged).length > 0 ? merged : undefined;
    },
    [labels, labelFilter]
  );

  const { data, isLoading } = useQuery({
    queryFn: api.findAvailableFlows,
    queryKey: [
      api.findAvailableFlows.key,
      {
        tenantId,
        keyword: keyword.trim() || undefined,
        labels: mergedLabels,
        [SYMBOL_PAGINATION]: { page, size: PAGE_SIZE }
      }
    ],
    placeholderData: keepPreviousData
  });

  const flows = useMemo(() => data?.items ?? [], [data]);

  // Group the current page by category, preserving the server's name order.
  const groups = useMemo(() => {
    const byCategory = new Map<string, { name: string; flows: AvailableFlow[] }>();

    for (const flow of flows) {
      const group = byCategory.get(flow.categoryId) ?? { name: flow.categoryName, flows: [] };
      group.flows.push(flow);
      byCategory.set(flow.categoryId, group);
    }

    return byCategory.values().toArray();
  }, [flows]);

  return (
    <Stack gap={20} style={{ padding: 24 }}>
      <Flex align="center" gap="middle" justify="space-between" wrap="wrap">
        <Title level={4} style={{ margin: 0 }}>{title}</Title>

        <Flex align="center" gap="small" wrap="wrap">
          <Input.Search
            allowClear
            placeholder="搜索流程名称"
            style={{ width: 240 }}
            onSearch={value => {
              setKeyword(value);
              setPage(1);
            }}
          />

          <LabelFilterSelect
            value={labelFilter}
            onChange={next => {
              setLabelFilter(next);
              setPage(1);
            }}
          />
        </Flex>
      </Flex>

      {isLoading
        ? (
            <Flex align="center" justify="center" style={{ minHeight: 240 }}>
              <Spin />
            </Flex>
          )
        : groups.length === 0
          ? <Empty description="没有可发起的流程" />
          : groups.map(group => (
              <Stack key={group.name} gap={12}>
                <Text strong type="secondary">{group.name}</Text>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 12
                  }}
                >
                  {group.flows.map(flow => <FlowCard key={flow.flowId} flow={flow} onClick={() => setStartTarget(flow.flowCode)} />)}
                </div>
              </Stack>
            ))}

      {(data?.total ?? 0) > PAGE_SIZE && (
        <Flex justify="flex-end">
          <Pagination
            current={page}
            pageSize={PAGE_SIZE}
            showSizeChanger={false}
            total={data?.total ?? 0}
            onChange={setPage}
          />
        </Flex>
      )}

      <StartInstanceDrawer
        flowCode={startTarget}
        tenantId={tenantId}
        onClose={() => setStartTarget(null)}
        onStarted={onStarted}
      />
    </Stack>
  );
}
