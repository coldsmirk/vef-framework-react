import type { CompletionEntry } from "@vef-framework-react/components";

import type { Direction } from "../../types";

/**
 * Completion catalogs for every integration script surface, mirroring the
 * bindings and capability libraries the Go runtime actually installs
 * (`internal/integration/exec` + `internal/integration/auth` + the js engine
 * baseline). Keep them in lockstep with the backend — and with the human
 * summaries in `ScriptBindingHints`.
 */

const HTTP_RESPONSE_DOC = "返回响应对象：status / statusText / ok / url / redirected / headers / body / text() / json() / arrayBuffer()";

const SYSTEM_BINDING: CompletionEntry = {
  label: "system",
  type: "namespace",
  info: "当前外部系统的信息快照",
  boost: 2,
  children: [
    {
      label: "code",
      type: "property",
      info: "系统编码"
    },
    {
      label: "name",
      type: "property",
      info: "系统名称"
    },
    {
      label: "params",
      type: "property",
      info: "系统的非敏感公共参数（名称 → 值）"
    }
  ]
};

const HTTP_LIB: CompletionEntry = {
  label: "http",
  type: "namespace",
  info: "该系统的 HTTP 客户端：Base URL 已锁定，只允许相对路径，凭证由框架注入",
  boost: 2,
  children: [
    {
      label: "fetch",
      type: "function",
      detail: "(path, options?)",
      info: `发起请求。options：method / headers / query / body / redirect / timeout / envelope。${HTTP_RESPONSE_DOC}`
    },
    {
      label: "get",
      type: "function",
      detail: "(path, options?)",
      info: `GET 请求。${HTTP_RESPONSE_DOC}`
    },
    {
      label: "post",
      type: "function",
      detail: "(path, body, options?)",
      info: `POST 请求，body 为对象时按 JSON 发送。${HTTP_RESPONSE_DOC}`
    },
    {
      label: "put",
      type: "function",
      detail: "(path, body, options?)",
      info: `PUT 请求。${HTTP_RESPONSE_DOC}`
    },
    {
      label: "patch",
      type: "function",
      detail: "(path, body, options?)",
      info: `PATCH 请求。${HTTP_RESPONSE_DOC}`
    },
    {
      label: "delete",
      type: "function",
      detail: "(path, options?)",
      info: `DELETE 请求。${HTTP_RESPONSE_DOC}`
    }
  ]
};

const SQL_LIB: CompletionEntry = {
  label: "sql",
  type: "namespace",
  info: "绑定到该系统直连数据源的 SQL 能力（未配置数据源时不可用）",
  boost: 2,
  children: [
    {
      label: "query",
      type: "function",
      detail: "(sql, ...args)",
      info: "只读查询，返回行对象数组；? 占位符按序绑定参数"
    },
    {
      label: "queryOne",
      type: "function",
      detail: "(sql, ...args)",
      info: "只读查询，返回首行（无结果为 null）"
    },
    {
      label: "exec",
      type: "function",
      detail: "(sql, ...args)",
      info: "写入语句，返回 { rowsAffected }；仅数据源为读写模式时可用"
    }
  ]
};

const ERRORS_LIB: CompletionEntry = {
  label: "errors",
  type: "namespace",
  info: "失败分类工具",
  boost: 2,
  children: [
    {
      label: "upstream",
      type: "function",
      detail: "(message)",
      info: "抛出后按「上游故障」归类，例如 throw errors.upstream(\"余额不足\")"
    }
  ]
};

const CONSOLE_LIB: CompletionEntry = {
  label: "console",
  type: "namespace",
  info: "写入框架日志（js 记录器）",
  boost: 1,
  children: [
    {
      label: "info",
      type: "function",
      detail: "(...args)"
    },
    {
      label: "warn",
      type: "function",
      detail: "(...args)"
    },
    {
      label: "error",
      type: "function",
      detail: "(...args)"
    }
  ]
};

const CRYPTO_LIB: CompletionEntry = {
  label: "crypto",
  type: "namespace",
  info: "摘要、HMAC 与编码工具",
  boost: 1,
  children: [
    {
      label: "md5",
      type: "function",
      detail: "(data)",
      info: "十六进制 MD5 摘要"
    },
    {
      label: "sha1",
      type: "function",
      detail: "(data)",
      info: "十六进制 SHA-1 摘要"
    },
    {
      label: "sha256",
      type: "function",
      detail: "(data)",
      info: "十六进制 SHA-256 摘要"
    },
    {
      label: "sha512",
      type: "function",
      detail: "(data)",
      info: "十六进制 SHA-512 摘要"
    },
    {
      label: "sm3",
      type: "function",
      detail: "(data)",
      info: "十六进制 SM3 摘要"
    },
    {
      label: "hmac",
      type: "function",
      detail: "(algorithm, key, data)",
      info: "HMAC 摘要（md5 / sha1 / sha256 / sha512 / sm3），十六进制输出"
    },
    {
      label: "base64Encode",
      type: "function",
      detail: "(data)"
    },
    {
      label: "base64Decode",
      type: "function",
      detail: "(encoded)"
    },
    {
      label: "hexEncode",
      type: "function",
      detail: "(data)"
    },
    {
      label: "hexDecode",
      type: "function",
      detail: "(encoded)"
    },
    {
      label: "uuid",
      type: "function",
      detail: "()",
      info: "生成 UUID 字符串"
    }
  ]
};

const CACHE_LIB: CompletionEntry = {
  label: "cache",
  type: "namespace",
  info: "进程内缓存（如令牌缓存）",
  boost: 1,
  children: [
    {
      label: "get",
      type: "function",
      detail: "(key)",
      info: "读取缓存值，不存在为 null"
    },
    {
      label: "set",
      type: "function",
      detail: "(key, value, ttlMs)",
      info: "写入缓存并指定毫秒级过期时间"
    },
    {
      label: "has",
      type: "function",
      detail: "(key)"
    },
    {
      label: "delete",
      type: "function",
      detail: "(key)"
    }
  ]
};

const STDLIB_GLOBALS: CompletionEntry[] = [
  {
    label: "dayjs",
    type: "function",
    detail: "(date?)",
    info: "日期时间库（dayjs）"
  },
  {
    label: "BigNumber",
    type: "class",
    detail: "(value)",
    info: "任意精度数值运算（bignumber.js），金额计算首选"
  },
  {
    label: "fxp",
    type: "namespace",
    info: "XML 解析与构建（fast-xml-parser），SOAP 报文的标准工具",
    children: [
      {
        label: "XMLParser",
        type: "class",
        detail: "(options?)",
        info: "new fxp.XMLParser().parse(xml) 解析 XML"
      },
      {
        label: "XMLBuilder",
        type: "class",
        detail: "(options?)",
        info: "new fxp.XMLBuilder().build(obj) 生成 XML"
      },
      {
        label: "XMLValidator",
        type: "namespace",
        info: "fxp.XMLValidator.validate(xml) 校验 XML"
      }
    ]
  },
  {
    label: "radashi",
    type: "namespace",
    info: "实用函数库（radashi）：对象、数组、字符串工具"
  },
  {
    label: "z",
    type: "namespace",
    info: "运行时校验库（zod），中文错误消息"
  },
  {
    label: "URL",
    type: "class",
    detail: "(url, base?)",
    info: "URL 解析与拼装"
  },
  {
    label: "URLSearchParams",
    type: "class",
    detail: "(init?)",
    info: "查询字符串构建与解析"
  }
];

// The always-on engine baseline every integration script surface sees.
const BASELINE = [CONSOLE_LIB, CRYPTO_LIB, CACHE_LIB, ...STDLIB_GLOBALS];

const INBOUND_REQUEST_BINDING: CompletionEntry = {
  label: "request",
  type: "namespace",
  info: "外部系统投递的原始请求",
  boost: 2,
  children: [
    {
      label: "protocol",
      type: "property",
      info: "投递协议，HTTP 网关为 \"http\""
    },
    {
      label: "method",
      type: "property",
      info: "请求方法"
    },
    {
      label: "path",
      type: "property",
      info: "请求路径"
    },
    {
      label: "headers",
      type: "property",
      info: "请求头（键已小写）"
    },
    {
      label: "query",
      type: "property",
      info: "查询参数（名称 → 值）"
    },
    {
      label: "body",
      type: "property",
      info: "原始请求体文本"
    },
    {
      label: "clientAddr",
      type: "property",
      info: "来源地址"
    }
  ]
};

/**
 * Outbound adapter scripts: contract input plus the system-scoped
 * capabilities the invoker installs.
 */
const OUTBOUND_ADAPTER_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  {
    label: "input",
    type: "variable",
    info: "已按契约输入 Schema 校验的入参",
    boost: 2
  },
  SYSTEM_BINDING,
  HTTP_LIB,
  SQL_LIB,
  ERRORS_LIB,
  ...BASELINE
];

/**
 * Inbound adapter scripts: the delivered request, the system snapshot and
 * the dispatch bridge — deliberately no http / sql capability.
 */
const INBOUND_ADAPTER_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  INBOUND_REQUEST_BINDING,
  SYSTEM_BINDING,
  {
    label: "dispatch",
    type: "function",
    detail: "(input)",
    info: "校验契约输入 Schema，执行业务处理器，返回已校验的标准输出",
    boost: 2
  },
  ...BASELINE
];

/**
 * System-level envelope request scripts: rewrite the adapter's outgoing
 * request before it hits the wire.
 */
const ENVELOPE_REQUEST_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  {
    label: "request",
    type: "namespace",
    info: "适配器发起的请求；return 改写后的请求，省略的字段保持原值",
    boost: 2,
    children: [
      {
        label: "method",
        type: "property"
      },
      {
        label: "path",
        type: "property"
      },
      {
        label: "headers",
        type: "property"
      },
      {
        label: "query",
        type: "property"
      },
      {
        label: "body",
        type: "property"
      }
    ]
  },
  SYSTEM_BINDING,
  ERRORS_LIB,
  ...BASELINE
];

/**
 * System-level envelope response scripts: unwrap the completed response;
 * the return value replaces the Response object as the call's result.
 */
const ENVELOPE_RESPONSE_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  {
    label: "response",
    type: "namespace",
    info: "完整的上游响应；return 解包后的业务数据作为调用结果",
    boost: 2,
    children: [
      {
        label: "status",
        type: "property"
      },
      {
        label: "statusText",
        type: "property"
      },
      {
        label: "ok",
        type: "property"
      },
      {
        label: "url",
        type: "property"
      },
      {
        label: "redirected",
        type: "property"
      },
      {
        label: "headers",
        type: "property"
      },
      {
        label: "body",
        type: "property",
        info: "响应体文本"
      },
      {
        label: "json",
        type: "function",
        detail: "()",
        info: "按 JSON 解析响应体"
      },
      {
        label: "text",
        type: "function",
        detail: "()"
      }
    ]
  },
  SYSTEM_BINDING,
  ERRORS_LIB,
  ...BASELINE
];

/**
 * Outbound auth scripts: read the fully built request and the decrypted
 * params, return the credential headers to add — signing is just the most
 * common shape of that logic.
 */
const OUTBOUND_AUTH_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  {
    label: "request",
    type: "namespace",
    info: "已构建完成的出站请求（只读）",
    boost: 2,
    children: [
      {
        label: "method",
        type: "property"
      },
      {
        label: "url",
        type: "property",
        info: "完整请求地址"
      },
      {
        label: "path",
        type: "property"
      },
      {
        label: "query",
        type: "property",
        info: "从最终 URL 解析出的查询参数"
      },
      {
        label: "headers",
        type: "property",
        info: "请求头（键已小写）"
      },
      {
        label: "body",
        type: "property",
        info: "请求体文本"
      }
    ]
  },
  {
    label: "params",
    type: "variable",
    info: "已解密的认证参数（名称 → 值）；return 需追加的凭据请求头对象",
    boost: 2
  },
  ...BASELINE
];

/**
 * Inbound auth verification scripts: read the delivered request and the
 * decrypted params, return a truthy value to grant.
 */
const INBOUND_AUTH_SCRIPT_COMPLETIONS: CompletionEntry[] = [
  INBOUND_REQUEST_BINDING,
  {
    label: "params",
    type: "variable",
    info: "已解密的验证参数（名称 → 值）；return 真值即放行",
    boost: 2
  },
  ...BASELINE
];

/**
 * One script surface's documentation: the contract in one line plus the
 * bindings and libraries available to it. `entries` doubles as the editor's
 * completion catalog, so the doc popover and the autocomplete never drift.
 */
export interface ScriptDoc {
  /**
   * What the script receives and what its return value means.
   */
  summary: string;
  /**
   * The surface's bindings and libraries.
   */
  entries: CompletionEntry[];
}

/**
 * Outbound adapter scripts.
 */
export const OUTBOUND_ADAPTER_SCRIPT_DOC: ScriptDoc = {
  summary: "把已按输入 Schema 校验的 input 译成对外部系统的调用；顶层 return 的值经输出 Schema 校验后作为契约输出。",
  entries: OUTBOUND_ADAPTER_SCRIPT_COMPLETIONS
};

/**
 * Inbound adapter scripts.
 */
export const INBOUND_ADAPTER_SCRIPT_DOC: ScriptDoc = {
  summary: "把外部系统的原始请求译成契约调度：dispatch(input) 执行业务处理器；顶层 return 的值即回给外部系统的响应。",
  entries: INBOUND_ADAPTER_SCRIPT_COMPLETIONS
};

/**
 * System-level envelope request scripts.
 */
export const ENVELOPE_REQUEST_SCRIPT_DOC: ScriptDoc = {
  summary: "适配器每次 http 调用发出前执行：读取 request，return 改写后的请求，省略的字段保持适配器原值。",
  entries: ENVELOPE_REQUEST_SCRIPT_COMPLETIONS
};

/**
 * System-level envelope response scripts.
 */
export const ENVELOPE_RESPONSE_SCRIPT_DOC: ScriptDoc = {
  summary: "适配器每次 http 调用返回后执行：读取 response，return 的值将替代响应对象成为调用结果。",
  entries: ENVELOPE_RESPONSE_SCRIPT_COMPLETIONS
};

/**
 * Outbound auth scripts.
 */
export const OUTBOUND_AUTH_SCRIPT_DOC: ScriptDoc = {
  summary: "每次出站请求发出前在零 IO 沙箱中执行：读取 request 与解密后的 params，return 需追加的凭据请求头对象（名称 → 值）。",
  entries: OUTBOUND_AUTH_SCRIPT_COMPLETIONS
};

/**
 * Inbound auth verification scripts.
 */
export const INBOUND_AUTH_SCRIPT_DOC: ScriptDoc = {
  summary: "每次入站投递验证时在零 IO 沙箱中执行：读取 request 与解密后的 params，return 真值即放行，其余一律拒绝。",
  entries: INBOUND_AUTH_SCRIPT_COMPLETIONS
};

/**
 * The adapter-script documentation for a flow direction.
 */
export function adapterScriptDoc(direction: Direction): ScriptDoc {
  return direction === "inbound" ? INBOUND_ADAPTER_SCRIPT_DOC : OUTBOUND_ADAPTER_SCRIPT_DOC;
}
