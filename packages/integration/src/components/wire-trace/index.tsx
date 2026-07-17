import type { TimelineItem } from "@vef-framework-react/components";

import type { HttpExchange } from "../../types";

import { css } from "@emotion/react";
import { CodeEditor, Empty, Flex, globalCssVars, Stack, Tag, Text, Timeline } from "@vef-framework-react/components";
import { useMemo } from "react";

const bodyBlockStyle = css({
  margin: 0,
  padding: globalCssVars.spacingXs,
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  backgroundColor: globalCssVars.colorFillQuaternary,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRadius: globalCssVars.borderRadiusSm,
  maxHeight: 240,
  overflow: "auto"
});

interface DetectedBody {
  language: "json" | "xml" | null;
  content: string;
}

// Bodies are captured as raw text; JSON ones are re-indented and highlighted,
// XML ones highlighted verbatim, anything else falls back to a plain block.
function detectBody(body: string): DetectedBody {
  try {
    return { language: "json", content: JSON.stringify(JSON.parse(body), null, 2) };
  } catch {
    // not JSON, fall through to the other shapes
  }

  if (body.trimStart().startsWith("<")) {
    return { language: "xml", content: body };
  }

  return { language: null, content: body };
}

function ExchangeBody({ body, label }: { body: string; label: string }) {
  const detected = useMemo(() => detectBody(body), [body]);

  return (
    <Stack gap={2}>
      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">{label}</Text>

      {detected.language
        ? (
            <CodeEditor
              readOnly
              language={detected.language}
              maxHeight={240}
              size="small"
              value={detected.content}
            />
          )
        : <pre css={bodyBlockStyle}>{detected.content}</pre>}
    </Stack>
  );
}

function isExchangeFailed(exchange: HttpExchange): boolean {
  return Boolean(exchange.error) || (exchange.status !== undefined && exchange.status >= 400);
}

function ExchangeSummary({ exchange }: { exchange: HttpExchange }) {
  return (
    <Flex align="center" gap="small" wrap="wrap">
      <Tag>{exchange.method}</Tag>
      <Text code style={{ fontSize: globalCssVars.fontSizeSm }}>{exchange.url}</Text>
      {exchange.status ? <Tag color={isExchangeFailed(exchange) ? "error" : "success"}>{exchange.status}</Tag> : null}

      <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">
        {exchange.durationMs}
        {" "}
        ms
      </Text>
    </Flex>
  );
}

function ExchangeDetail({ exchange }: { exchange: HttpExchange }) {
  return (
    <Stack gap={4}>
      {exchange.error ? <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="danger">{exchange.error}</Text> : null}
      {exchange.requestBody ? <ExchangeBody body={exchange.requestBody} label="请求体" /> : null}
      {exchange.responseBody ? <ExchangeBody body={exchange.responseBody} label="响应体" /> : null}
    </Stack>
  );
}

/**
 * The captured HTTP exchanges of an invocation, rendered as a timeline. The
 * trace may be null (an invocation that issued no HTTP call serializes to a
 * null slice), which reads as an empty timeline.
 */
export function WireTraceTimeline({ trace }: { trace: HttpExchange[] | null | undefined }) {
  const exchanges = trace ?? [];

  if (exchanges.length === 0) {
    return <Empty description="脚本未发起 HTTP 调用" />;
  }

  const items: TimelineItem[] = exchanges.map((exchange, index) => {
    return {
      key: String(index),
      color: isExchangeFailed(exchange) ? "red" : "green",
      title: <ExchangeSummary exchange={exchange} />,
      content: <ExchangeDetail exchange={exchange} />
    };
  });

  return <Timeline items={items} mode="left" />;
}
