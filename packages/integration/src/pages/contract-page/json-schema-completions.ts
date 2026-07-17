import type { CompletionEntry } from "@vef-framework-react/components";

function keyword(label: string, detail: string, info: string, boost?: number): CompletionEntry {
  return {
    label,
    type: "property",
    detail,
    info,
    boost
  };
}

/**
 * JSON Schema draft 2020-12 keyword catalog for the contract schema editors.
 * Entries complete as object keys inside the JSON documents.
 */
export const JSON_SCHEMA_COMPLETIONS: CompletionEntry[] = [
  keyword("type", "string | string[]", "实例类型：object / array / string / number / integer / boolean / null", 3),
  keyword("properties", "{ 属性名: 子 Schema }", "对象各属性的 Schema", 3),
  keyword("required", "string[]", "对象必填的属性名列表", 3),
  keyword("items", "Schema", "数组元素的 Schema（prefixItems 之后的元素）", 2),
  keyword("enum", "any[]", "实例必须等于列表中的某个值", 2),
  keyword("const", "any", "实例必须等于该常量值"),
  keyword("title", "string", "标题，供文档与界面展示", 1),
  keyword("description", "string", "描述，供文档与界面展示", 1),
  keyword("default", "any", "默认值（标注性关键字，不参与校验）"),
  keyword("examples", "any[]", "示例值列表（标注性关键字）"),
  keyword("deprecated", "boolean", "标记该部分已废弃"),
  keyword("readOnly", "boolean", "标记只读：仅由服务端产生"),
  keyword("writeOnly", "boolean", "标记只写：仅由客户端提交"),

  keyword("minLength", "number", "字符串最小长度"),
  keyword("maxLength", "number", "字符串最大长度"),
  keyword("pattern", "string", "字符串须匹配的正则表达式（ECMA-262）"),
  keyword("format", "string", "语义格式标注：date-time / date / time / email / uri / uuid / ipv4 / ipv6 …"),
  keyword("contentEncoding", "string", "字符串内容的编码，如 base64"),
  keyword("contentMediaType", "string", "字符串内容的媒体类型，如 application/json"),

  keyword("minimum", "number", "数值下界（含）"),
  keyword("maximum", "number", "数值上界（含）"),
  keyword("exclusiveMinimum", "number", "数值下界（不含）"),
  keyword("exclusiveMaximum", "number", "数值上界（不含）"),
  keyword("multipleOf", "number", "数值须为该数的倍数（须大于 0）"),

  keyword("minProperties", "number", "对象最少属性数"),
  keyword("maxProperties", "number", "对象最多属性数"),
  keyword("patternProperties", "{ 正则: 子 Schema }", "属性名匹配正则时应用对应 Schema"),
  keyword("additionalProperties", "boolean | Schema", "properties / patternProperties 之外属性的 Schema，false 表示禁止"),
  keyword("propertyNames", "Schema", "对象所有属性名须满足的 Schema"),
  keyword("dependentRequired", "{ 属性名: string[] }", "某属性存在时，这些属性也必填"),
  keyword("dependentSchemas", "{ 属性名: Schema }", "某属性存在时，实例须满足对应 Schema"),
  keyword("unevaluatedProperties", "boolean | Schema", "未被任何子 Schema 评估过的属性的 Schema"),

  keyword("prefixItems", "Schema[]", "数组前若干元素按位置逐一校验（元组）"),
  keyword("contains", "Schema", "数组须包含满足该 Schema 的元素"),
  keyword("minContains", "number", "满足 contains 的元素最少个数"),
  keyword("maxContains", "number", "满足 contains 的元素最多个数"),
  keyword("minItems", "number", "数组最少元素数"),
  keyword("maxItems", "number", "数组最多元素数"),
  keyword("uniqueItems", "boolean", "数组元素须互不相同"),
  keyword("unevaluatedItems", "boolean | Schema", "未被任何子 Schema 评估过的元素的 Schema"),

  keyword("allOf", "Schema[]", "须同时满足所有子 Schema", 1),
  keyword("anyOf", "Schema[]", "须满足至少一个子 Schema", 1),
  keyword("oneOf", "Schema[]", "须恰好满足一个子 Schema", 1),
  keyword("not", "Schema", "须不满足该 Schema"),
  keyword("if", "Schema", "条件：满足时应用 then，否则应用 else"),
  keyword("then", "Schema", "if 满足时须额外满足的 Schema"),
  keyword("else", "Schema", "if 不满足时须额外满足的 Schema"),

  keyword("$schema", "string", "所用规范版本，如 https://json-schema.org/draft/2020-12/schema"),
  keyword("$id", "string", "该 Schema 的标识 URI，作为 $ref 解析基准"),
  keyword("$ref", "string", "引用其他 Schema，如 #/$defs/name"),
  keyword("$defs", "{ 名称: Schema }", "内部复用的子 Schema 定义"),
  keyword("$anchor", "string", "供 $ref 定位的锚点名"),
  keyword("$dynamicRef", "string", "动态引用，与 $dynamicAnchor 配合实现递归扩展"),
  keyword("$dynamicAnchor", "string", "动态锚点，可被扩展 Schema 覆盖"),
  keyword("$comment", "string", "维护者注释（不参与校验，不对外展示）")
];
