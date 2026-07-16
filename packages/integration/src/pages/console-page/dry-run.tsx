import type { Direction, DryRunResult, InboundDryRunResult, JsonValue } from "../../types";

import {
  Alert,
  Button,
  CodeEditor,
  Flex,
  Input,
  PermissionGate,
  Segmented,
  Select,
  showErrorMessage,
  showWarningMessage,
  Stack,
  Text
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { useMemo, useState } from "react";

import { useOpsApi } from "../../api";
import { DIRECTION_OPTIONS, FailureKindTag, JsonView, ParamsEditor, useContractDirectory, useSystemDirectory, WireTraceTimeline } from "../../components";

type ParseResult = { ok: true; value: JsonValue } | { ok: false };

function parseJson(text: string): ParseResult {
  if (!text.trim()) {
    return { ok: true, value: null };
  }

  try {
    const value: JsonValue = JSON.parse(text);

    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

function OutboundResult({ result }: { result: DryRunResult }) {
  return (
    <Stack gap="small">
      <Flex align="center" gap="small">
        <Text strong>结果</Text>
        <FailureKindTag failureKind={result.failureKind} />
      </Flex>

      {result.error ? <Alert showIcon message={result.error} type="error" /> : null}
      <Text type="secondary">输出</Text>
      <JsonView value={result.output} />
      <Text type="secondary">Wire Trace</Text>
      <WireTraceTimeline trace={result.trace} />
    </Stack>
  );
}

function InboundResult({ result }: { result: InboundDryRunResult }) {
  return (
    <Stack gap="small">
      <Flex align="center" gap="small">
        <Text strong>结果</Text>
        <FailureKindTag failureKind={result.failureKind} />
      </Flex>

      {result.error ? <Alert showIcon message={result.error} type="error" /> : null}
      <Text type="secondary">回给外部系统的响应</Text>
      <JsonView value={result.reply} />
      <Text type="secondary">dispatch 出去的标准入参</Text>
      <JsonView value={result.dispatchedInput} />
    </Stack>
  );
}

export interface DryRunPanelProps {
  outboundPermission: string;
  inboundPermission: string;
}

/**
 * The script test console. An outbound dry run calls the real external system;
 * an inbound dry run stubs the business handler and records nothing.
 */
export function DryRunPanel({ outboundPermission, inboundPermission }: DryRunPanelProps) {
  const { dryRun, dryRunInbound } = useOpsApi();
  const systemDir = useSystemDirectory();
  const contractDir = useContractDirectory();
  const systemOptions = useMemo(() => systemDir.items.map(item => {
    return { label: `${item.name}（${item.code}）`, value: item.code };
  }), [systemDir.items]);
  const contractOptions = useMemo(() => contractDir.items.map(item => {
    return { label: `${item.name}（${item.code}）`, value: item.code };
  }), [contractDir.items]);

  const [direction, setDirection] = useState<Direction>("outbound");
  const [systemCode, setSystemCode] = useState<string>();
  const [contractCode, setContractCode] = useState<string>();
  const [script, setScript] = useState("");
  const [input, setInput] = useState("{}");
  const [method, setMethod] = useState("POST");
  const [path, setPath] = useState("/");
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState("");
  const [handlerOutput, setHandlerOutput] = useState("{}");

  const {
    mutate: mutateOutbound,
    data: outboundResult,
    isPending: outboundPending,
    reset: resetOutbound
  } = useMutation({ mutationFn: dryRun });
  const {
    mutate: mutateInbound,
    data: inboundResult,
    isPending: inboundPending,
    reset: resetInbound
  } = useMutation({ mutationFn: dryRunInbound });

  // A result belongs to the target that produced it, so drop both results the
  // moment the system, contract, or direction changes — the panel must never
  // show a previous target's outcome.
  const clearResults = () => {
    resetOutbound();
    resetInbound();
  };

  const ensureTarget = (): boolean => {
    if (!systemCode || !contractCode) {
      showWarningMessage("请先选择系统与契约");

      return false;
    }

    return true;
  };

  const runOutbound = () => {
    if (!ensureTarget() || !systemCode || !contractCode) {
      return;
    }

    const parsed = parseJson(input);

    if (!parsed.ok) {
      showErrorMessage("输入不是合法 JSON");

      return;
    }

    mutateOutbound({
      systemCode,
      contractCode,
      script: script || undefined,
      input: parsed.value
    });
  };

  const runInbound = () => {
    if (!ensureTarget() || !systemCode || !contractCode) {
      return;
    }

    const parsed = parseJson(handlerOutput);

    if (!parsed.ok) {
      showErrorMessage("业务处理器样例输出不是合法 JSON");

      return;
    }

    mutateInbound({
      systemCode,
      contractCode,
      script: script || undefined,
      request: {
        method,
        path,
        headers,
        query,
        body: requestBody
      },
      handlerOutput: parsed.value
    });
  };

  return (
    <Stack gap="middle">
      {direction === "outbound"
        ? <Alert showIcon message="出站调试会真实调用外部系统，且不写入统计与调用日志。" type="warning" />
        : <Alert showIcon message="入站调试使用桩业务处理器，不触发真实业务，也不写入统计与调用日志。" type="info" />}

      <Segmented<Direction>
        options={DIRECTION_OPTIONS}
        value={direction}
        onChange={next => {
          setDirection(next);
          clearResults();
        }}
      />

      <Flex gap="small">
        <Select
          loading={systemDir.loading}
          options={systemOptions}
          placeholder="选择系统"
          style={{ flex: 1 }}
          value={systemCode}
          onChange={code => {
            setSystemCode(code);
            clearResults();
          }}
        />

        <Select
          loading={contractDir.loading}
          options={contractOptions}
          placeholder="选择契约"
          style={{ flex: 1 }}
          value={contractCode}
          onChange={code => {
            setContractCode(code);
            clearResults();
          }}
        />
      </Flex>

      <Stack gap={4}>
        <Text type="secondary">脚本（留空则使用已保存的适配器脚本）</Text>
        <CodeEditor showLineNumbers height={200} language="javascript" value={script} onChange={setScript} />
      </Stack>

      {direction === "outbound"
        ? (
            <Stack gap="small">
              <Stack gap={4}>
                <Text type="secondary">输入（JSON）</Text>
                <CodeEditor showLineNumbers height={160} language="json" value={input} onChange={setInput} />
              </Stack>

              <PermissionGate requiredPermissions={outboundPermission}>
                <Button loading={outboundPending} type="primary" onClick={runOutbound}>
                  运行出站调试
                </Button>
              </PermissionGate>

              {outboundResult ? <OutboundResult result={outboundResult} /> : null}
            </Stack>
          )
        : (
            <Stack gap="small">
              <Flex gap="small">
                <Input aria-label="请求方法" placeholder="方法" style={{ width: 110 }} value={method} onChange={event => setMethod(event.target.value)} />
                <Input aria-label="请求路径" placeholder="路径，如 /callback" style={{ flex: 1 }} value={path} onChange={event => setPath(event.target.value)} />
              </Flex>

              <Stack gap={4}>
                <Text type="secondary">请求头</Text>
                <ParamsEditor value={headers} onChange={setHeaders} />
              </Stack>

              <Stack gap={4}>
                <Text type="secondary">查询参数</Text>
                <ParamsEditor value={query} onChange={setQuery} />
              </Stack>

              <Stack gap={4}>
                <Text type="secondary">请求体</Text>
                <CodeEditor showLineNumbers height={140} language="json" value={requestBody} onChange={setRequestBody} />
              </Stack>

              <Stack gap={4}>
                <Text type="secondary">业务处理器样例输出（JSON）</Text>
                <CodeEditor showLineNumbers height={140} language="json" value={handlerOutput} onChange={setHandlerOutput} />
              </Stack>

              <PermissionGate requiredPermissions={inboundPermission}>
                <Button loading={inboundPending} type="primary" onClick={runInbound}>
                  运行入站调试
                </Button>
              </PermissionGate>

              {inboundResult ? <InboundResult result={inboundResult} /> : null}
            </Stack>
          )}
    </Stack>
  );
}
