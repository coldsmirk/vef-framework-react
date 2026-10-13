import type { SelectProps } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type { DataSourceApi, DynamicValue, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { css } from "@emotion/react";
import { globalCssVars, Input, Select } from "@vef-framework-react/components";
import { useState } from "react";

import { normalizeOptionMapping } from "../../engine/option-mapping";
import { endpointKey, findDataSourceApi, useDataSourceApis } from "../data-source-apis";
import {
  LabeledControl,
  requestEditorCss,
  RequestEndpointFields,
  requestGridCss,
  RequestParamsEditor,
  RequestSection,
  withRequestParams
} from "./remote-request-editor";

/**
 * The picker value standing for "a request typed by hand" — distinct from any
 * {@link endpointKey}, which always holds two NUL separators.
 */
const CUSTOM_API = "custom";

const selectStyle = { width: "100%" } as const;

const optionCss = css({
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  lineHeight: 1.4
});

const endpointCss = css({
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
});

const optionHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const summaryCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 2,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

function describeEndpoint(endpoint: Pick<RemoteDataSourceRequest, "action" | "resource" | "version">): string {
  return [endpoint.resource, endpoint.action, endpoint.version].filter(Boolean).join(" · ");
}

function describeMapping(mapping: RemoteOptionMapping | undefined): string | undefined {
  if (mapping === undefined) {
    return undefined;
  }

  const parts = [
    mapping.labelKey === undefined ? undefined : `显示 ${mapping.labelKey}`,
    mapping.valueKey === undefined ? undefined : `取值 ${mapping.valueKey}`,
    mapping.disabledKey === undefined ? undefined : `禁用 ${mapping.disabledKey}`,
    mapping.descriptionKey === undefined ? undefined : `描述 ${mapping.descriptionKey}`
  ].filter(part => part !== undefined);

  return parts.length > 0 ? `字段映射：${parts.join("，")}` : undefined;
}

interface ApiOption {
  value: string;
  label: string;
  title: string;
}

/**
 * Picker options, grouped by the catalog's `group` headings (ungrouped APIs
 * first), then the hand-typed escape hatch. `title` carries the endpoint so a
 * search matches it as well as the name.
 */
function apiOptions(apis: readonly DataSourceApi[]): NonNullable<SelectProps["options"]> {
  const ungrouped: ApiOption[] = [];
  const groups = new Map<string, ApiOption[]>();

  for (const api of apis) {
    const option = {
      value: endpointKey(api),
      label: api.label,
      title: describeEndpoint(api)
    };

    if (api.group === undefined) {
      ungrouped.push(option);
    } else {
      groups.set(api.group, [...groups.get(api.group) ?? [], option]);
    }
  }

  return [
    ...ungrouped,
    ...[...groups].map(([group, options]) => {
      return {
        label: group,
        title: group,
        options
      };
    }),
    {
      value: CUSTOM_API,
      label: "自定义接口",
      title: "手动填写 resource / action"
    }
  ];
}

/**
 * The request and mapping an API pick produces: the API's endpoint and
 * mapping, with each declared parameter keeping the value already bound to a
 * parameter of the same name, else taking its declared default. Parameters
 * the API does not declare belonged to the previous endpoint and are dropped.
 */
function pickApi(api: DataSourceApi, current: RemoteDataSourceRequest): { request: RemoteDataSourceRequest; mapping: RemoteOptionMapping | undefined } {
  const entries = (api.params ?? []).flatMap(param => {
    const value = current.params?.[param.name] ?? param.defaultValue;

    return value === undefined ? [] : [[param.name, value] as const];
  });
  const params: Record<string, DynamicValue> | undefined = entries.length > 0 ? Object.fromEntries(entries) : undefined;

  return {
    request: withRequestParams({
      resource: api.resource,
      action: api.action,
      ...api.version !== undefined && { version: api.version }
    }, params),
    mapping: normalizeOptionMapping(api.mapping)
  };
}

export interface RemoteOptionSourceEditorProps {
  request: RemoteDataSourceRequest;
  mapping: RemoteOptionMapping | undefined;
  onChange: (request: RemoteDataSourceRequest, mapping: RemoteOptionMapping | undefined) => void;
}

/**
 * Editor for a remote option source — a form-global data source or a field's
 * inline one. With a host API catalog it leads with a picker, so a designer
 * chooses "部门列表" and binds its declared parameters instead of typing an
 * endpoint and a field mapping; "自定义接口" (and every source without a
 * catalog) keeps the hand-entered request.
 */
export function RemoteOptionSourceEditor({
  mapping,
  onChange,
  request
}: RemoteOptionSourceEditorProps): ReactElement {
  const apis = useDataSourceApis();
  const picked = findDataSourceApi(apis, request);
  // Set when the designer chooses to type a request by hand: a blank request,
  // or one still matching a catalog entry, would otherwise read as "pick one".
  const [customChosen, setCustomChosen] = useState(false);
  const blank = request.resource.length === 0 && request.action.length === 0;
  const custom = apis.length === 0 || customChosen || (picked === undefined && !blank);

  const handlePick = (value: unknown): void => {
    if (value === CUSTOM_API) {
      setCustomChosen(true);
      return;
    }

    const api = apis.find(candidate => endpointKey(candidate) === value);

    if (api !== undefined) {
      setCustomChosen(false);

      const next = pickApi(api, request);

      onChange(next.request, next.mapping);
    }
  };

  const mappingSummary = describeMapping(mapping);

  return (
    <div css={requestEditorCss}>
      {apis.length > 0
        ? (
            <Select
              aria-label="接口"
              options={apiOptions(apis)}
              placeholder="选择接口"
              showSearch={{ optionFilterProp: ["label", "title"] }}
              style={selectStyle}
              value={custom ? CUSTOM_API : picked === undefined ? undefined : endpointKey(picked)}
              optionRender={option => (
                <span css={optionCss}>
                  <span>{option.label}</span>
                  <span css={option.value === CUSTOM_API ? optionHintCss : endpointCss}>{option.data.title}</span>
                </span>
              )}
              onChange={handlePick}
            />
          )
        : null}

      {custom
        ? (
            <>
              <RequestEndpointFields request={request} onChange={next => onChange(next, mapping)} />
              <OptionMappingFields mapping={mapping} onChange={next => onChange(request, next)} />
              <RequestParamsEditor params={request.params} onChange={params => onChange(withRequestParams(request, params), mapping)} />
            </>
          )
        : null}

      {!custom && picked !== undefined
        ? (
            <>
              <span css={summaryCss}>
                {picked.description === undefined ? null : <span>{picked.description}</span>}
                <span css={endpointCss}>{describeEndpoint(picked)}</span>
                {mappingSummary === undefined ? null : <span>{mappingSummary}</span>}
              </span>

              <RequestParamsEditor
                declared={picked.params}
                params={request.params}
                onChange={params => onChange(withRequestParams(request, params), mapping)}
              />
            </>
          )
        : null}
    </div>
  );
}

interface OptionMappingFieldsProps {
  mapping: RemoteOptionMapping | undefined;
  onChange: (mapping: RemoteOptionMapping | undefined) => void;
}

/**
 * The four record → option keys. A cleared key is dropped rather than stored
 * blank, so it falls back to its default instead of reading a property named
 * `""` (see {@link normalizeOptionMapping}).
 */
function OptionMappingFields({ mapping, onChange }: OptionMappingFieldsProps): ReactElement {
  const patch = (next: Partial<RemoteOptionMapping>): void => {
    onChange(normalizeOptionMapping({ ...mapping, ...next }));
  };

  return (
    <RequestSection hint="留空时读取记录的 label / value" title="字段映射">
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
      </div>
    </RequestSection>
  );
}
