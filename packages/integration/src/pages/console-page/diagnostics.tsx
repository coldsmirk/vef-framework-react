import type { DescriptionsItem } from "@vef-framework-react/components";

import type { RouteFinding, RouteFindingKind } from "../../types";

import { css } from "@emotion/react";
import {
  Button,
  Card,
  Center,
  Descriptions,
  Empty,
  Flex,
  FlexCard,
  globalCssVars,
  Icon,
  PermissionGate,
  Result,
  ScrollArea,
  Stack,
  Text
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { SearchCheckIcon } from "lucide-react";

import { useOpsApi } from "../../api";
import { FindingKindTag } from "../../components";

const panelCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

const resultAreaCss = css({
  flex: 1,
  minHeight: 0
});

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
    <FlexCard>
      <div css={panelCss}>
        <Flex align="center" gap="middle" justify="space-between" wrap="wrap">
          <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
            检查悬空适配器、通配缺口、停用的目标与未覆盖的契约。
          </Text>

          <PermissionGate requiredPermissions={permission}>
            <Button icon={<Icon component={SearchCheckIcon} />} loading={mutation.isPending} type="primary" onClick={() => mutation.mutate()}>
              开始诊断
            </Button>
          </PermissionGate>
        </Flex>

        {report && report.findings.length > 0
          ? (
              <ScrollArea css={resultAreaCss} scrollbars="vertical">
                <Stack gap="middle">
                  {groupByKind(report.findings).map(group => <FindingGroup key={group.kind} findings={group.findings} kind={group.kind} />)}
                </Stack>
              </ScrollArea>
            )
          : (
              <Center css={resultAreaCss}>
                {report
                  ? <Result status="success" subTitle="未发现任何路由配置问题。" title="路由配置健康" />
                  : <Empty description="尚未运行诊断" />}
              </Center>
            )}
      </div>
    </FlexCard>
  );
}
