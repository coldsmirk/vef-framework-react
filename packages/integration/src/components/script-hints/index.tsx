import type { Direction } from "../../types";

import { globalCssVars, Stack, Text } from "@vef-framework-react/components";

interface Binding {
  name: string;
  desc: string;
}

const OUTBOUND_BINDINGS: Binding[] = [
  { name: "input", desc: "已按契约输入 Schema 校验的入参" },
  { name: "system", desc: "system.code / name / params" },
  { name: "http", desc: "该系统的 httpx 客户端（相对路径，凭证已注入）" },
  { name: "sql", desc: "绑定到系统数据源（若已配置）；默认只读，读写模式可用 sql.exec" },
  { name: "errors", desc: "errors.upstream(msg) 标记为上游故障" }
];

const INBOUND_BINDINGS: Binding[] = [
  { name: "request", desc: "protocol / method / path / headers（小写）/ query / body / clientAddr" },
  { name: "system", desc: "system.code / name / params" },
  { name: "dispatch", desc: "dispatch(input)：校验并交给业务处理器，返回标准输出" }
];

/**
 * The available script bindings for a flow direction, shown beside the editor.
 */
export function ScriptBindingHints({ direction }: { direction: Direction }) {
  const bindings = direction === "inbound" ? INBOUND_BINDINGS : OUTBOUND_BINDINGS;

  return (
    <Stack gap={4}>
      <Text type="secondary">
        {direction === "inbound" ? "入站" : "出站"}
        脚本可用绑定
      </Text>

      <Stack gap={2}>
        {bindings.map(binding => (
          <Text key={binding.name} style={{ fontSize: globalCssVars.fontSizeSm }}>
            <Text code>{binding.name}</Text>
            {` — ${binding.desc}`}
          </Text>
        ))}
      </Stack>
    </Stack>
  );
}
