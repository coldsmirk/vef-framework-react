import type { ReactElement } from "react";

import type {
  AlertBlockField,
  DividerField,
  FieldComponentProps,
  FieldDefinition,
  HeadingField,
  HeadingLevel,
  ParagraphField,
  PropertiesDescriptor,
  PropertyEntryOption,
  TextTone
} from "../../types";

import { css } from "@emotion/react";
import { Alert, Divider, Paragraph, Title } from "@vef-framework-react/components";

import { defineFieldDefinition, definePropertyEntry } from "../../types";

// antd's typography carries its own document-flow margins. A form block's
// spacing belongs to the stack that lays it out, so the text adds none.
const flushTextCss = css({ margin: 0 });

const textToneOptions: Array<PropertyEntryOption & { value: TextTone }> = [
  { value: "secondary", label: "次要" },
  { value: "success", label: "成功" },
  { value: "warning", label: "警告" },
  { value: "danger", label: "危险" }
];

/* ------------------------------------------------------------------ divider */

function DividerView({ field }: FieldComponentProps<DividerField, undefined>): ReactElement {
  return field.title
    ? <Divider dashed={field.dashed} titlePlacement={field.titlePlacement}>{field.title}</Divider>
    : <Divider dashed={field.dashed} />;
}

const dividerProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<DividerField, string | undefined>({
        id: "title",
        label: "标题",
        type: "text",
        placeholder: "可选 — 分割线文字",
        read: field => field.title,
        write: (field, title) => { return { ...field, title }; }
      }),
      definePropertyEntry<DividerField, DividerField["titlePlacement"]>({
        id: "titlePlacement",
        label: "标题位置",
        type: "select",
        options: [
          { value: "left", label: "左" },
          { value: "center", label: "居中" },
          { value: "right", label: "右" }
        ],
        visible: field => Boolean(field.title),
        read: field => field.titlePlacement,
        write: (field, titlePlacement) => { return { ...field, titlePlacement }; }
      }),
      definePropertyEntry<DividerField, boolean | undefined>({
        id: "dashed",
        label: "虚线",
        type: "checkbox",
        read: field => field.dashed,
        write: (field, dashed) => { return { ...field, dashed: dashed === true }; }
      })
    ]
  }
];

export const dividerDefinition: FieldDefinition = defineFieldDefinition<DividerField, undefined>({
  config: {
    type: "divider",
    name: "分割线",
    group: "presentation",
    keyed: false,
    icon: "minus",
    create: () => {
      return { type: "divider" };
    }
  },
  Component: DividerView,
  properties: dividerProperties
});

/* -------------------------------------------------------------- alert block */

function AlertBlockView({ field }: FieldComponentProps<AlertBlockField, undefined>): ReactElement {
  return (
    <Alert
      banner={field.banner}
      closable={field.closable}
      description={field.description}
      showIcon={field.showIcon ?? true}
      title={field.message ?? ""}
      type={field.alertType ?? "info"}
    />
  );
}

const alertBlockProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<AlertBlockField, string | undefined>({
        id: "message",
        label: "标题",
        type: "text",
        read: field => field.message,
        write: (field, message) => { return { ...field, message }; }
      }),
      definePropertyEntry<AlertBlockField, string | undefined>({
        id: "description",
        label: "描述",
        type: "text",
        read: field => field.description,
        write: (field, description) => { return { ...field, description }; }
      }),
      definePropertyEntry<AlertBlockField, AlertBlockField["alertType"]>({
        id: "alertType",
        label: "类型",
        type: "select",
        options: [
          { value: "info", label: "信息" },
          { value: "success", label: "成功" },
          { value: "warning", label: "警告" },
          { value: "error", label: "错误" }
        ],
        read: field => field.alertType ?? "info",
        write: (field, alertType) => { return { ...field, alertType }; }
      }),
      definePropertyEntry<AlertBlockField, boolean | undefined>({
        id: "showIcon",
        label: "显示图标",
        type: "checkbox",
        read: field => field.showIcon ?? true,
        write: (field, showIcon) => { return { ...field, showIcon: showIcon === true }; }
      }),
      definePropertyEntry<AlertBlockField, boolean | undefined>({
        id: "closable",
        label: "可关闭",
        type: "checkbox",
        read: field => field.closable,
        write: (field, closable) => { return { ...field, closable: closable === true }; }
      }),
      definePropertyEntry<AlertBlockField, boolean | undefined>({
        id: "banner",
        label: "横幅模式",
        type: "checkbox",
        read: field => field.banner,
        write: (field, banner) => { return { ...field, banner: banner === true }; }
      })
    ]
  }
];

export const alertBlockDefinition: FieldDefinition = defineFieldDefinition<AlertBlockField, undefined>({
  config: {
    type: "alert-block",
    name: "提示",
    group: "presentation",
    keyed: false,
    icon: "info",
    create: () => {
      return {
        type: "alert-block",
        message: "提示信息",
        alertType: "info"
      };
    }
  },
  Component: AlertBlockView,
  properties: alertBlockProperties
});

/* ------------------------------------------------------------------ heading */

/**
 * The level a heading renders at while it sets none.
 */
export const DEFAULT_HEADING_LEVEL: HeadingLevel = 3;

const headingLevels: Array<{ level: HeadingLevel; label: string }> = [
  { level: 1, label: "一级标题" },
  { level: 2, label: "二级标题" },
  { level: 3, label: "三级标题" },
  { level: 4, label: "四级标题" },
  { level: 5, label: "五级标题" }
];

function HeadingView({ field }: FieldComponentProps<HeadingField, undefined>): ReactElement {
  return (
    <Title
      css={[flushTextCss, { textAlign: field.align }]}
      level={field.level ?? DEFAULT_HEADING_LEVEL}
      type={field.textType}
    >
      {field.text ?? ""}
    </Title>
  );
}

const headingProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<HeadingField, string | undefined>({
        id: "text",
        label: "文本",
        type: "text",
        read: field => field.text,
        write: (field, text) => { return { ...field, text }; }
      }),
      // The select entry reads and writes strings.
      definePropertyEntry<HeadingField, string>({
        id: "level",
        label: "级别",
        type: "select",
        options: headingLevels.map(({ label, level }) => { return { value: String(level), label }; }),
        read: field => String(field.level ?? DEFAULT_HEADING_LEVEL),
        write: (field, value) => { return { ...field, level: headingLevels.find(({ level }) => String(level) === value)?.level }; }
      }),
      definePropertyEntry<HeadingField, HeadingField["align"]>({
        id: "align",
        label: "对齐",
        type: "select",
        options: [
          { value: "left", label: "左" },
          { value: "center", label: "居中" },
          { value: "right", label: "右" }
        ],
        read: field => field.align ?? "left",
        write: (field, align) => { return { ...field, align }; }
      }),
      definePropertyEntry<HeadingField, HeadingField["textType"]>({
        id: "textType",
        label: "文本类型",
        type: "select",
        options: textToneOptions,
        read: field => field.textType,
        write: (field, textType) => { return { ...field, textType }; }
      })
    ]
  }
];

export const headingDefinition: FieldDefinition = defineFieldDefinition<HeadingField, undefined>({
  config: {
    type: "heading",
    name: "标题",
    group: "presentation",
    keyed: false,
    icon: "heading",
    create: () => {
      return { type: "heading", text: "标题" };
    }
  },
  Component: HeadingView,
  properties: headingProperties
});

/* ---------------------------------------------------------------- paragraph */

function ParagraphView({ field }: FieldComponentProps<ParagraphField, undefined>): ReactElement {
  return (
    <Paragraph css={flushTextCss} italic={field.italic} strong={field.strong} type={field.textType}>
      {field.text ?? ""}
    </Paragraph>
  );
}

const paragraphProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<ParagraphField, string | undefined>({
        id: "text",
        label: "文本",
        type: "text",
        read: field => field.text,
        write: (field, text) => { return { ...field, text }; }
      }),
      definePropertyEntry<ParagraphField, ParagraphField["textType"]>({
        id: "textType",
        label: "文本类型",
        type: "select",
        options: textToneOptions,
        read: field => field.textType,
        write: (field, textType) => { return { ...field, textType }; }
      }),
      definePropertyEntry<ParagraphField, boolean | undefined>({
        id: "strong",
        label: "加粗",
        type: "checkbox",
        read: field => field.strong,
        write: (field, strong) => { return { ...field, strong: strong === true }; }
      }),
      definePropertyEntry<ParagraphField, boolean | undefined>({
        id: "italic",
        label: "斜体",
        type: "checkbox",
        read: field => field.italic,
        write: (field, italic) => { return { ...field, italic: italic === true }; }
      })
    ]
  }
];

export const paragraphDefinition: FieldDefinition = defineFieldDefinition<ParagraphField, undefined>({
  config: {
    type: "paragraph",
    name: "段落",
    group: "presentation",
    keyed: false,
    icon: "pilcrow",
    create: () => {
      return { type: "paragraph", text: "说明文字" };
    }
  },
  Component: ParagraphView,
  properties: paragraphProperties
});
