import type { ReactNode } from "react";
import type { AuditLog } from "~apis";

import { CodeHighlighter, Modal, Tabs } from "@vef-framework-react/components";
import { atom, useAtomValue, useSetAtom } from "@vef-framework-react/core";
import { memo, useMemo } from "react";

interface ModalState {
  open: boolean;
  data: AuditLog | null;
}

const CODE_HIGHLIGHTER_STYLE = { maxHeight: "60vh", overflow: "auto" } as const;

const modalAtom = atom<ModalState>({
  open: false,
  data: null
});

const closeModalAtom = atom(null, (_, set) => {
  set(modalAtom, { open: false, data: null });
});

export const openModalAtom = atom(null, (_, set, data: AuditLog) => {
  set(modalAtom, { open: true, data });
});

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function JsonCodeBlock({ data }: { data: unknown }): ReactNode {
  return (
    <CodeHighlighter
      showLineNumbers
      language="json"
      style={CODE_HIGHLIGHTER_STYLE}
    >
      {formatJson(data)}
    </CodeHighlighter>
  );
}

function DetailModalContent(): ReactNode {
  const { open, data } = useAtomValue(modalAtom);
  const closeModal = useSetAtom(closeModalAtom);

  const tabItems = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        key: "requestParams",
        label: "请求参数",
        children: <JsonCodeBlock data={data.requestParams} />
      },
      {
        key: "requestMeta",
        label: "请求元数据",
        children: <JsonCodeBlock data={data.requestMeta} />
      },
      {
        key: "resultData",
        label: "响应数据",
        children: <JsonCodeBlock data={data.resultData} />
      }
    ];
  }, [data]);

  const modalTitle = data
    ? `请求数据详情 - ${data.apiResource} @ ${data.apiAction} @ ${data.apiVersion}`
    : "请求数据详情";

  return (
    <Modal
      footer={null}
      open={open}
      title={modalTitle}
      width={1000}
      onCancel={closeModal}
    >
      <Tabs defaultActiveKey="requestParams" items={tabItems} />
    </Modal>
  );
}

export const DetailModal = memo(DetailModalContent);
