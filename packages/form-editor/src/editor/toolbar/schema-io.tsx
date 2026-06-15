import type { ChangeEvent, ReactElement } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, Modal, ScrollArea } from "@vef-framework-react/components";
import { useEffect, useState } from "react";

import { useDeviceRegistries } from "../../store/engine-provider";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { applySchemaJson, downloadSchemaJson } from "../schema-apply";
import { notify } from "./notify";

const exportScrollCss = css({
  maxHeight: "60vh",
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgLayout,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const exportPreCss = css({
  margin: 0,
  padding: "14px 16px",
  color: globalCssVars.colorText,
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
});

const importErrorCss = css({
  marginTop: 8,
  color: globalCssVars.colorErrorText,
  fontSize: globalCssVars.fontSize,
  whiteSpace: "pre-wrap"
});

const textAreaStyle = {
  fontFamily: globalCssVars.fontFamilyCode,
  fontSize: globalCssVars.fontSize
} as const;

export type SchemaIoMode = null | "export" | "import";

export interface SchemaIoModalProps {
  mode: SchemaIoMode;
  onClose: () => void;
}

/**
 * Modal that hosts the JSON import / export dialogs. Kept as a single
 * component because both branches share the same shell (close, footer
 * style, transition) and only the body and confirm-action differ.
 */
export function SchemaIoModal({ mode, onClose }: SchemaIoModalProps): ReactElement {
  // Subscribe to the schema only while the export view is open. The modal is
  // permanently mounted by the toolbar, so an unconditional `s.schema` selector
  // would re-render it on every canvas keystroke even while closed; selecting
  // `null` outside export mode keeps the closed modal inert. Export stays live
  // (it tracks edits made while open), and the import branch reads the schema
  // imperatively on the open transition below.
  const exportSchema = useFormEditorStore(s => mode === "export" ? s.schema : null);
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();

  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  // Seed the import buffer with the current schema only on the transition INTO
  // import mode. The schema is read imperatively (not a dependency) so a
  // background schema change while the dialog is open — e.g. the editor-level
  // undo/redo shortcut firing regardless of dialog focus — does not re-run this
  // effect and clobber the user's in-progress edits. Clear on close so a
  // leftover error from a previous attempt does not flash on reopen.
  useEffect(() => {
    if (mode === "import") {
      setImportText(JSON.stringify(storeApi.getState().schema, null, 2));
      setImportError(null);
    } else if (mode === null) {
      setImportText("");
      setImportError(null);
    }
  }, [mode, storeApi]);

  const exportedJson = exportSchema ? JSON.stringify(exportSchema, null, 2) : "";

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(exportedJson);
      notify("success", "已复制到剪贴板");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "复制失败");
    }
  };

  const handleApply = (): void => {
    // Shared pipeline with the editable JSON view: same parsing, same error
    // reporting, same warning round-trip semantics.
    const result = applySchemaJson({
      raw: importText,
      registries,
      storeApi
    });

    if (!result.ok) {
      setImportError(result.errorText ?? "Schema 无效");
      return;
    }

    onClose();
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    setImportText(event.target.value);

    if (importError) {
      setImportError(null);
    }
  };

  return (
    <Modal
      cancelText="关闭"
      open={mode !== null}
      title={mode === "export" ? "导出 Schema" : "导入 Schema"}
      width={640}
      footer={mode === "export"
        ? (
            <>
              <Button autoInsertSpace={false} onClick={() => downloadSchemaJson(exportedJson, exportSchema?.id ?? "form")}>下载</Button>
              <Button autoInsertSpace={false} type="primary" onClick={handleCopy}>复制</Button>
            </>
          )
        : (
            <>
              <Button autoInsertSpace={false} onClick={onClose}>取消</Button>
              <Button autoInsertSpace={false} type="primary" onClick={handleApply}>应用</Button>
            </>
          )}
      onCancel={onClose}
    >
      {mode === "export"
        ? (
            <ScrollArea css={exportScrollCss}>
              <pre css={exportPreCss}>{exportedJson}</pre>
            </ScrollArea>
          )
        : (
            <>
              <Input.TextArea
                autoSize={{ minRows: 12, maxRows: 24 }}
                spellCheck={false}
                style={textAreaStyle}
                value={importText}
                onChange={handleChange}
              />

              {importError ? <div css={importErrorCss} role="alert">{importError}</div> : null}
            </>
          )}
    </Modal>
  );
}
