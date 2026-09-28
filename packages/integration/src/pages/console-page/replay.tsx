import type { MutationFunction } from "@vef-framework-react/core";

import type { InvocationLog, InvocationOutcome, ReplayParams, ReplayResult } from "../../types";

import {
  Alert,
  Button,
  Checkbox,
  CodeEditor,
  Flex,
  Grid,
  Icon,
  Labeled,
  PermissionGate,
  Popconfirm,
  Stack,
  Text
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { adapterScriptDoc, FailureKindTag, JsonView, WireTraceTimeline } from "../../components";

function OutcomeColumn({ outcome, title }: { outcome: InvocationOutcome; title: string }) {
  return (
    <Stack gap="small">
      <Flex align="center" gap="small">
        <Text strong>{title}</Text>
        <FailureKindTag failureKind={outcome.failureKind} />
        <Text type="secondary">{`${outcome.durationMs} ms`}</Text>
      </Flex>

      {outcome.error ? <Alert showIcon title={outcome.error} type="error" /> : null}

      <Labeled label="输入">
        <JsonView value={outcome.input ?? null} />
      </Labeled>

      <Labeled label="输出">
        <JsonView value={outcome.output ?? null} />
      </Labeled>
    </Stack>
  );
}

function ReplayComparison({ log, result }: { log: InvocationLog; result: ReplayResult }) {
  return (
    <Stack gap="middle">
      {result.definitionChanged
        ? <Alert showIcon title="契约、系统或适配器在这次调用之后修改过，结果差异可能来自这些修改" type="warning" />
        : null}

      <Grid columnGap="medium">
        <Grid.Item span={12}>
          <OutcomeColumn outcome={log} title="原始调用" />
        </Grid.Item>

        <Grid.Item span={12}>
          <OutcomeColumn outcome={result} title="重放结果" />
        </Grid.Item>
      </Grid>

      <Labeled label="重放通信轨迹">
        <WireTraceTimeline trace={result.httpTrace} />
      </Labeled>
    </Stack>
  );
}

export interface ReplayPanelProps {
  log: InvocationLog;
  /**
   * Permission code gating the replay action.
   */
  permission: string;
  replay: MutationFunction<ReplayResult, ReplayParams>;
}

/**
 * Re-runs a recorded invocation against the current definitions — optionally
 * with an unsaved script — and compares the outcome with the original.
 */
export function ReplayPanel({
  log,
  permission,
  replay
}: ReplayPanelProps) {
  const [overridesScript, setOverridesScript] = useState(false);
  const [script, setScript] = useState("");
  const {
    mutate,
    data: result,
    isPending
  } = useMutation({ mutationFn: replay });

  if (!log.replayable) {
    return <Alert showIcon title="该调用未保留重放数据（需开启 vef.integration.log.replay）" type="info" />;
  }

  const isOutbound = log.direction === "outbound";
  const run = () => mutate({ id: log.id, script: overridesScript && script ? script : undefined });
  const replayButton = (
    <Button icon={<Icon component={RotateCcwIcon} />} loading={isPending} type="primary" onClick={isOutbound ? undefined : run}>
      重放
    </Button>
  );

  return (
    <Stack gap="middle">
      <Flex align="center" gap="middle" wrap="wrap">
        <PermissionGate requiredPermissions={permission}>
          {isOutbound
            ? <Popconfirm title="出站重放会真实调用外部系统，确认继续？" onConfirm={run}>{replayButton}</Popconfirm>
            : replayButton}
        </PermissionGate>

        <Checkbox checked={overridesScript} onChange={event => setOverridesScript(event.target.checked)}>使用临时脚本</Checkbox>

        <Text type="secondary">
          {isOutbound
            ? "以原始输入按当前定义重新执行，不写入统计与调用日志。"
            : "以原始请求重新执行入站脚本，跳过验签，业务处理器以原始结果应答，不会重复执行业务。"}
        </Text>
      </Flex>

      {overridesScript
        ? (
            <CodeEditor
              showLineNumbers
              completions={adapterScriptDoc(log.direction).entries}
              height={200}
              language="javascript"
              placeholder="// 留空则使用已保存的适配器脚本"
              value={script}
              onChange={setScript}
            />
          )
        : null}

      {result ? <ReplayComparison log={log} result={result} /> : null}
    </Stack>
  );
}
