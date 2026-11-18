import type { PaginationResult } from "@vef-framework-react/core";

import type { Flow, VoidPolicy } from "../../../types";
import type { FlowDraftBasic } from "./types";

import { Card, Labeled, Radio, Select, Stack, SYMBOL_PAGINATION, Text } from "@vef-framework-react/components";
import { useApiClient, useInfiniteQuery, useQuery } from "@vef-framework-react/core";
import { useMemo, useState } from "react";

import { fetchFlows } from "../../../api/flow-api";
import { VOID_REQUEST_KIND } from "../../../types";

const PAGE_SIZE = 30;
const policies: Array<{ label: string; value: VoidPolicy }> = [
  { label: "不允许作废", value: "disabled" },
  { label: "直接作废", value: "direct" },
  { label: "审批后作废", value: "approval" }
];

function filter(tenantId: string, keyword: string, page: number) {
  return {
    tenantId,
    includeShared: true,
    businessKind: VOID_REQUEST_KIND,
    keyword,
    [SYMBOL_PAGINATION]: { page, size: PAGE_SIZE }
  };
}

/**
 * A previously saved code can lie beyond the first page of name/code matches.
 */
export function useSelectedVoidFlow(tenantId: string, code?: string) {
  const api = useApiClient();
  const lookup = useMemo(() => api.createQueryFn<Flow | null, { tenantId: string; code: string }>(
    "approval_selected_void_flow",
    ({ post }) => async params => {
      for (let page = 1; ; page++) {
        const data = await fetchFlows(post, filter(params.tenantId, params.code, page));
        const found = data.items.find(flow => flow.code === params.code && flow.businessKind === VOID_REQUEST_KIND);

        if (found) {
          return found;
        }

        if (data.items.length === 0 || page * PAGE_SIZE >= data.total) {
          return null;
        }
      }
    }
  ), [api]);
  return useQuery({
    queryFn: lookup,
    queryKey: [lookup.key, { tenantId, code: code ?? "" }],
    enabled: Boolean(code)
  });
}

function VoidFlowPicker({
  tenantId,
  selected,
  onChange
}: { tenantId: string; selected?: Flow | null; onChange: (code: string) => void }) {
  const api = useApiClient();
  const search = useMemo(() => api.createQueryFn<PaginationResult<Flow>, { tenantId: string; keyword: string }, number>(
    "approval_void_flow_options",
    ({ post }) => (params, page) => fetchFlows(post, filter(params.tenantId, params.keyword, page))
  ), [api]);
  const [keyword, setKeyword] = useState("");
  const choices = useInfiniteQuery({
    queryKey: [search.key, { tenantId, keyword }],
    initialPageParam: 1,
    queryFn: search,
    getNextPageParam: (last, pages) => last.items.length > 0 && pages.length * PAGE_SIZE < last.total ? pages.length + 1 : undefined
  });
  const options = new Map<string, string>();
  const pages = choices.data?.pages ?? [];

  for (const page of pages) {
    for (const flow of page.items) {
      if (flow.businessKind === VOID_REQUEST_KIND) {
        options.set(flow.code, flow.name);
      }
    }
  }

  return (
    <Select<string>
      aria-label="作废申请流程"
      labelRender={() => selected?.name ?? "请选择作废申请流程"}
      loading={choices.isFetching}
      options={[...options].map(([value, label]) => { return { value, label }; })}
      placeholder="搜索作废申请流程"
      showSearch={{ filterOption: false, onSearch: setKeyword }}
      value={selected?.code}
      onChange={onChange}
      onPopupScroll={event => {
        const list = event.currentTarget;

        if (choices.hasNextPage && !choices.isFetching && list.scrollTop + list.clientHeight >= list.scrollHeight - 12) {
          void choices.fetchNextPage();
        }
      }}
    />
  );
}

export function voidPolicyIssue(basic: FlowDraftBasic, isVoidable: boolean, selected?: Flow | null): string | undefined {
  const policy = basic.voidPolicy ?? "disabled";

  if (policies.every(p => p.value !== policy)) {
    return "请选择有效的作废方式";
  }

  if (policy !== "disabled" && !isVoidable) {
    return "该业务类型不支持作废";
  }

  if (policy !== "approval" && basic.voidFlowCode) {
    return "只有审批后作废可以指定作废申请流程";
  }

  if (policy === "approval" && (!basic.voidFlowCode || selected?.code !== basic.voidFlowCode || selected.businessKind !== VOID_REQUEST_KIND)) {
    return "请选择本机构可用的作废申请流程";
  }
}

export function VoidPolicySection({
  basic,
  isVoidable,
  selected,
  onChange
}: {
  basic: FlowDraftBasic;
  isVoidable: boolean;
  selected?: Flow | null;
  onChange: (patch: Partial<FlowDraftBasic>) => void;
}) {
  const policy = basic.voidPolicy ?? "disabled";
  return (
    <Card title="作废">
      <Stack gap={12}>
        <Radio.Group
          aria-label="作废方式"
          options={policies.map(option => { return { ...option, disabled: option.value !== "disabled" && !isVoidable }; })}
          value={policy}
          onChange={event => onChange({ voidPolicy: event.target.value, voidFlowCode: undefined })}
        />

        {!isVoidable && <Text type="secondary">{basic.businessKind === VOID_REQUEST_KIND ? "作废申请流程本身不能作废。" : "该业务类型不支持作废。"}</Text>}
        {policy === "approval" && <Labeled required label="作废申请流程"><VoidFlowPicker selected={selected} tenantId={basic.tenantId} onChange={voidFlowCode => onChange({ voidFlowCode })} /></Labeled>}
      </Stack>
    </Card>
  );
}
