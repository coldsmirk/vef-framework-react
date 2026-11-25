import type { ReactElement } from "react";

import type { RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { Input } from "@vef-framework-react/components";

import { normalizeOptionMapping } from "../../engine/option-mapping";
import {
  CatalogRemoteRequestEditor,
  LabeledControl,
  requestGridCss,
  RequestSection
} from "./remote-request-editor";

function describeMapping(mapping: RemoteOptionMapping | undefined): string | undefined {
  if (mapping === undefined) {
    return undefined;
  }

  const parts = [
    mapping.labelKey === undefined ? undefined : `显示 ${mapping.labelKey}`,
    mapping.valueKey === undefined ? undefined : `取值 ${mapping.valueKey}`,
    mapping.disabledKey === undefined ? undefined : `禁用 ${mapping.disabledKey}`,
    mapping.descriptionKey === undefined ? undefined : `描述 ${mapping.descriptionKey}`,
    mapping.childrenKey === undefined ? undefined : `子级 ${mapping.childrenKey}`,
    mapping.parentKey === undefined ? undefined : `父级 ${mapping.parentKey}`
  ].filter(part => part !== undefined);

  return parts.length > 0 ? `字段映射：${parts.join("，")}` : undefined;
}

export interface RemoteOptionSourceEditorProps {
  request: RemoteDataSourceRequest;
  mapping: RemoteOptionMapping | undefined;
  onChange: (request: RemoteDataSourceRequest, mapping: RemoteOptionMapping | undefined) => void;
}

/**
 * Editor for a remote option source — a form-global data source or a field's
 * inline one. Built on {@link CatalogRemoteRequestEditor} so remote option
 * sources and `api_call` actions share one API catalog picker and parameter
 * editor, adding only option-field mapping on top.
 */
export function RemoteOptionSourceEditor({
  mapping,
  onChange,
  request
}: RemoteOptionSourceEditorProps): ReactElement {
  const mappingSummary = describeMapping(mapping);

  return (
    <CatalogRemoteRequestEditor
      customExtra={<OptionMappingFields mapping={mapping} onChange={next => onChange(request, next)} />}
      pickedSummaryExtra={() => mappingSummary === undefined ? null : <span>{mappingSummary}</span>}
      request={request}
      onChange={nextRequest => onChange(nextRequest, mapping)}
      onPickApi={(api, nextRequest) => onChange(nextRequest, normalizeOptionMapping(api.mapping))}
    />
  );
}

interface OptionMappingFieldsProps {
  mapping: RemoteOptionMapping | undefined;
  onChange: (mapping: RemoteOptionMapping | undefined) => void;
}

/**
 * The six record → option keys (`label`, `value`, `disabled`, `description`,
 * `children`, `parent`). A cleared key is dropped rather than stored blank, so
 * it falls back to its default instead of reading a property named `""` (see
 * {@link normalizeOptionMapping}).
 */
function OptionMappingFields({ mapping, onChange }: OptionMappingFieldsProps): ReactElement {
  const patch = (next: Partial<RemoteOptionMapping>): void => {
    onChange(normalizeOptionMapping({ ...mapping, ...next }));
  };

  return (
    <RequestSection hint="留空时读取 label / value / children；填写父级字段后按平铺记录建树" title="字段映射">
      <div css={requestGridCss}>
        <LabeledControl label="显示字段">
          <Input placeholder="label" value={mapping?.labelKey ?? ""} onChange={event => patch({ labelKey: event.target.value })} />
        </LabeledControl>

        <LabeledControl label="取值字段">
          <Input placeholder="value" value={mapping?.valueKey ?? ""} onChange={event => patch({ valueKey: event.target.value })} />
        </LabeledControl>

        <LabeledControl label="禁用字段">
          <Input placeholder="可选" value={mapping?.disabledKey ?? ""} onChange={event => patch({ disabledKey: event.target.value })} />
        </LabeledControl>

        <LabeledControl label="描述字段">
          <Input placeholder="可选" value={mapping?.descriptionKey ?? ""} onChange={event => patch({ descriptionKey: event.target.value })} />
        </LabeledControl>

        <LabeledControl label="子级字段">
          <Input placeholder="children" value={mapping?.childrenKey ?? ""} onChange={event => patch({ childrenKey: event.target.value })} />
        </LabeledControl>

        <LabeledControl label="父级字段">
          <Input placeholder="可选（平铺建树）" value={mapping?.parentKey ?? ""} onChange={event => patch({ parentKey: event.target.value })} />
        </LabeledControl>
      </div>
    </RequestSection>
  );
}
