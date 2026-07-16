import type { DescriptionsItem } from "@vef-framework-react/components";

import type { RouteFinding, RouteFindingKind } from "../../types";

import { Button, Card, Descriptions, Flex, PermissionGate, Result, Stack, Text } from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";

import { useOpsApi } from "../../api";
import { FindingKindTag } from "../../components";

function findingItems(finding: RouteFinding): DescriptionsItem[] {
  const items: DescriptionsItem[] = [
    {
      key: "routeKey",
      label: "路由键",
      children: finding.routeKey || "默认路由"
    }
  ];

  if (finding.contractCode) {
    items.push({
      key: "contract",
      label: "契约",
      children: finding.contractName ?? finding.contractCode
    });
  }

  if (finding.systemCode) {
    items.push({
      key: "system",
      label: "系统",
      children: finding.systemName ?? finding.systemCode
    });
  }

  return items;
}

function groupByKind(findings: RouteFinding[]): Array<{ kind: RouteFindingKind; findings: RouteFinding[] }> {
  const map = new Map<RouteFindingKind, RouteFinding[]>();

  for (const finding of findings) {
    const list = map.get(finding.kind) ?? [];
    list.push(finding);
    map.set(finding.kind, list);
  }

  return [...map].map(([kind, list]) => {
    return { kind, findings: list };
  });
}

function FindingGroup({ kind, findings }: { kind: RouteFindingKind; findings: RouteFinding[] }) {
  return (
    <Card
      size="small"
      title={(
        <Flex align="center" gap="small">
          <FindingKindTag kind={kind} />

          <Text type="secondary">
            {findings.length}
            {" "}
            项
          </Text>
        </Flex>
      )}
    >
      <Stack gap="small">
        {findings.map((finding, index) => <Descriptions key={finding.routeId || index} column={2} items={findingItems(finding)} size="small" />)}
      </Stack>
    </Card>
  );
}

export interface DiagnosticsPanelProps {
  permission: string;
}

/**
 * The on-demand routing diagnosis: run it, then read findings grouped by kind.
 */
export function DiagnosticsPanel({ permission }: DiagnosticsPanelProps) {
  const { diagnoseRoutes } = useOpsApi();
  const mutation = useMutation({ mutationFn: diagnoseRoutes });
  const report = mutation.data;

  return (
    <Stack gap="middle">
      <PermissionGate requiredPermissions={permission}>
        <Button loading={mutation.isPending} type="primary" onClick={() => mutation.mutate()}>
          开始诊断
        </Button>
      </PermissionGate>

      {report
        ? report.findings.length === 0
          ? <Result status="success" subTitle="未发现任何路由配置问题。" title="路由配置健康" />
          : <Stack gap="middle">{groupByKind(report.findings).map(group => <FindingGroup key={group.kind} findings={group.findings} kind={group.kind} />)}</Stack>
        : null}
    </Stack>
  );
}
