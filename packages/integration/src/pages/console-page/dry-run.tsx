import type { Direction, DryRunResult, InboundDryRunResult, JsonValue } from "../../types";

import { css } from "@emotion/react";
import {
  Alert,
  Button,
  Center,
  CodeEditor,
  Empty,
  Flex,
  FlexCard,
  globalCssVars,
  Grid,
  Icon,
  Input,
  Labeled,
  PermissionGate,
  ScrollArea,
  Segmented,
  Select,
  showErrorMessage,
  showWarningMessage,
  Spin,
  Stack,
  Text
} from "@vef-framework-react/components";
import { useMutation } from "@vef-framework-react/core";
import { PlayIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { useOpsApi } from "../../api";
import {
  adapterScriptDoc,
  DIRECTION_OPTIONS,
  FailureKindTag,
  JsonView,
  ParamsEditor,
  ScriptDocLabel,
  useContractDirectory,
  useSystemDirectory,
  WireTraceTimeline
} from "../../components";

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

const rootCss = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  gap: 16
});

// Both cards split the remaining height and scroll internally; single-column
// (narrow) mode stacks them into two equal rows instead.
const workbenchCss = css({
  flex: 1,
  minHeight: 0,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(420px, 100%), 1fr))",
  gridAutoRows: "minmax(0, 1fr)",
  gap: 16
});

const scrollFillCss = css({
  height: "100%"
});

const modeHintCss = css({
  fontSize: globalCssVars.fontSizeSm
});

function OutboundResult({ result }: { result: DryRunResult }) {
  return (
    <Stack gap="middle">
      {result.error ? <Alert showIcon title={result.error} type="error" /> : null}

      <Labeled label="输出">
        <JsonView value={result.output} />
      </Labeled>

      <Labeled label="通信轨迹">
        <WireTraceTimeline trace={result.trace} />
      </Labeled>
    </Stack>
  );
}

function InboundResult({ result }: { result: InboundDryRunResult }) {
  return (
    <Stack gap="middle">
      {result.error ? <Alert showIcon title={result.error} type="error" /> : null}

      <Labeled label="外部系统收到的响应">
        <JsonView value={result.reply} />
      </Labeled>

      <Labeled label="业务处理器收到的入参（dispatch）">
        <JsonView value={result.dispatchedInput} />
      </Labeled>
    </Stack>
  );
}

export interface DryRunPanelProps {
  outboundPermission: string;
  inboundPermission: string;
}

/**
 * The script test console, laid out as a request → result workbench. An
 * outbound dry run calls the real external system; an inbound dry run stubs
 * the business handler and records nothing.
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
      showErrorMessage("处理器样例输出不是合法 JSON");

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

  const isOutbound = direction === "outbound";
  const pending = isOutbound ? outboundPending : inboundPending;
  const activeResult = isOutbound ? outboundResult : inboundResult;

  const resultContent = isOutbound
    ? outboundResult && <OutboundResult result={outboundResult} />
    : inboundResult && <InboundResult result={inboundResult} />;

  const runAction = (
    <PermissionGate requiredPermissions={isOutbound ? outboundPermission : inboundPermission}>
      <Button
        icon={<Icon component={PlayIcon} />}
        loading={pending}
        type="primary"
        onClick={isOutbound ? runOutbound : runInbound}
      >
        运行调试
      </Button>
    </PermissionGate>
  );

  return (
    <div css={rootCss}>
      <Flex align="center" gap="middle" wrap="wrap">
        <Segmented<Direction>
          options={DIRECTION_OPTIONS}
          value={direction}
          onChange={next => {
            setDirection(next);
            clearResults();
          }}
        />

        {isOutbound
          ? <Text css={modeHintCss} type="warning">出站调试会真实调用外部系统，但不写入统计与调用日志。</Text>
          : <Text css={modeHintCss} type="secondary">入站调试使用桩业务处理器，不触发真实业务，也不写入统计与调用日志。</Text>}
      </Flex>

      <div css={workbenchCss}>
        <FlexCard extra={runAction} title="请求">
          <ScrollArea css={scrollFillCss} scrollbars="vertical">
            <Stack gap="middle">
              <Grid columnGap="small">
                <Grid.Item span={12}>
                  <Labeled label="系统">
                    <Select
                      aria-label="系统"
                      loading={systemDir.loading}
                      options={systemOptions}
                      placeholder="选择系统"
                      style={{ width: "100%" }}
                      value={systemCode}
                      onChange={code => {
                        setSystemCode(code);
                        clearResults();
                      }}
                    />
                  </Labeled>
                </Grid.Item>

                <Grid.Item span={12}>
                  <Labeled label="契约">
                    <Select
                      aria-label="契约"
                      loading={contractDir.loading}
                      options={contractOptions}
                      placeholder="选择契约"
                      style={{ width: "100%" }}
                      value={contractCode}
                      onChange={code => {
                        setContractCode(code);
                        clearResults();
                      }}
                    />
                  </Labeled>
                </Grid.Item>
              </Grid>

              <Labeled label={<ScriptDocLabel doc={adapterScriptDoc(direction)} label="脚本" />}>
                <CodeEditor
                  showLineNumbers
                  completions={adapterScriptDoc(direction).entries}
                  height={240}
                  language="javascript"
                  placeholder="// 留空则使用已保存的适配器脚本"
                  value={script}
                  onChange={setScript}
                />
              </Labeled>

              {isOutbound
                ? (
                    <Labeled label="输入（JSON）">
                      <CodeEditor
                        showLineNumbers
                        height={160}
                        language="json"
                        value={input}
                        onChange={setInput}
                      />
                    </Labeled>
                  )
                : (
                    <>
                      <Flex gap="small">
                        <Labeled label="请求方法">
                          <Input aria-label="请求方法" placeholder="POST" style={{ width: 110 }} value={method} onChange={event => setMethod(event.target.value)} />
                        </Labeled>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Labeled label="请求路径">
                            <Input aria-label="请求路径" placeholder="如 /callback" value={path} onChange={event => setPath(event.target.value)} />
                          </Labeled>
                        </div>
                      </Flex>

                      <Labeled label="请求头">
                        <ParamsEditor namePlaceholder="Header 名，如 X-Api-Key" value={headers} onChange={setHeaders} />
                      </Labeled>

                      <Labeled label="查询参数">
                        <ParamsEditor namePlaceholder="参数名，如 orderId" value={query} onChange={setQuery} />
                      </Labeled>

                      <Labeled label="请求体">
                        <CodeEditor
                          showLineNumbers
                          height={140}
                          language="json"
                          placeholder="原样投递的请求体文本"
                          value={requestBody}
                          onChange={setRequestBody}
                        />
                      </Labeled>

                      <Labeled hint="入站调试不执行真实业务，dispatch 将原样返回这份样例" label="处理器样例输出（JSON）">
                        <CodeEditor
                          showLineNumbers
                          height={140}
                          language="json"
                          value={handlerOutput}
                          onChange={setHandlerOutput}
                        />
                      </Labeled>
                    </>
                  )}
            </Stack>
          </ScrollArea>
        </FlexCard>

        <FlexCard
          extra={activeResult ? <FailureKindTag failureKind={activeResult.failureKind} /> : null}
          title="结果"
        >
          {!pending && resultContent
            ? (
                <ScrollArea css={scrollFillCss} scrollbars="vertical">
                  {resultContent}
                </ScrollArea>
              )
            : (
                <Center css={scrollFillCss}>
                  {pending ? <Spin /> : <Empty description="运行后在此查看结果" />}
                </Center>
              )}
        </FlexCard>
      </div>
    </div>
  );
}
