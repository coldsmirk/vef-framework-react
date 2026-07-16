import type { TimelineItem } from "@vef-framework-react/components";

import type { HttpExchange } from "../../types";

import { Empty, Flex, globalCssVars, Stack, Tag, Text, Timeline } from "@vef-framework-react/components";

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

      {exchange.requestBody
        ? (
            <Stack gap={2}>
              <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">请求体</Text>
              <Text code style={{ fontSize: globalCssVars.fontSizeSm, whiteSpace: "pre-wrap" }}>{exchange.requestBody}</Text>
            </Stack>
          )
        : null}

      {exchange.responseBody
        ? (
            <Stack gap={2}>
              <Text style={{ fontSize: globalCssVars.fontSizeSm }} type="secondary">响应体</Text>
              <Text code style={{ fontSize: globalCssVars.fontSizeSm, whiteSpace: "pre-wrap" }}>{exchange.responseBody}</Text>
            </Stack>
          )
        : null}
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
