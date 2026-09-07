import type { StoredFileValue } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type {
  FieldComponentProps,
  FieldDefinition,
  PropertiesDescriptor,
  UploadField
} from "../../types";

import { StoredFileUpload } from "@vef-framework-react/components";

import { FieldShell } from "../../render/parts/field-shell";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { requiredEntry } from "../field-entries";

const DEFAULT_MAX_COUNT = 1;

/**
 * Storage-backed upload. The value is the object key (or keys) the framework's
 * chunked upload returns — never a browser `File` — so a saved form reloads by
 * key and the backend validates the same shape it stored.
 */
function UploadInput({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}: FieldComponentProps<UploadField, StoredFileValue>): ReactElement {
  const maxCount = field.maxCount ?? DEFAULT_MAX_COUNT;

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "附件"}
      labelledBy="group"
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      <StoredFileUpload
        accept={field.accept}
        disabled={disabled}
        maxCount={maxCount}
        public={field.public}
        type={field.dragger === true ? "drag" : "select"}
        value={value ?? null}
        onChange={onChange}
      />
    </FieldShell>
  );
}

function uploadProperties(): PropertiesDescriptor {
  return [
    {
      id: "basic",
      label: "基础",
      tab: "props",
      entries: [
        definePropertyEntry<UploadField, number | undefined>({
          id: "maxCount",
          label: "最多文件数",
          type: "number",
          description: "为 1 时值是单个存储键，大于 1 时是键数组",
          read: field => field.maxCount ?? DEFAULT_MAX_COUNT,
          write: (field, maxCount) => { return { ...field, maxCount }; }
        }),
        definePropertyEntry<UploadField, string | undefined>({
          id: "accept",
          label: "允许的文件类型",
          type: "text",
          description: "输入框的 accept，如 .pdf,image/*",
          read: field => field.accept,
          write: (field, accept) => { return { ...field, accept }; }
        }),
        definePropertyEntry<UploadField, boolean>({
          id: "dragger",
          label: "拖拽上传区",
          type: "checkbox",
          read: field => field.dragger === true,
          write: (field, dragger) => { return { ...field, dragger: dragger === true }; }
        }),
        definePropertyEntry<UploadField, boolean>({
          id: "public",
          label: "公开访问",
          type: "checkbox",
          description: "落到 pub/ 前缀，需后端开启 allow_public_uploads",
          read: field => field.public === true,
          write: (field, isPublic) => { return { ...field, public: isPublic === true }; }
        })
      ]
    },
    {
      id: "validation",
      label: "基础",
      tab: "validation",
      entries: [requiredEntry<UploadField>()]
    }
  ];
}

export const uploadFieldDefinition: FieldDefinition = defineFieldDefinition<UploadField, StoredFileValue>({
  config: {
    type: "upload",
    name: "附件",
    group: "date-file",
    keyed: true,
    icon: "paperclip",
    create: () => {
      return {
        type: "upload",
        label: "附件",
        maxCount: DEFAULT_MAX_COUNT
      };
    }
  },
  Component: UploadInput,
  properties: uploadProperties()
});
