import type { ReactElement } from "react";

import type { FormSchema, PresentationDevice } from "../../types";
import type { PreviewRuntime } from "../preview-runtime-context";

import { css } from "@emotion/react";
import { Button, CodeEditor, globalCssVars } from "@vef-framework-react/components";
import { useMemo, useState } from "react";

import { EditorIcon } from "../../icons";
import { FormRenderer } from "../../render/form-renderer";
import { useDeviceRegistries } from "../../store/engine-provider";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { applySchemaJson, downloadSchemaJson } from "../schema-apply";
import { notify } from "../toolbar/notify";

const splitCss = css({
  display: "flex",
  alignItems: "stretch",
  gap: 16,
  width: "100%"
});

const paneCss = css({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: 8,
  minWidth: 0
});

const headerCss = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: globalCssVars.fontSize,
  fontWeight: 600,
  color: globalCssVars.colorTextSecondary
});

const actionsCss = css({ display: "flex", gap: 4 });

const applyErrorCss = css({
  margin: 0,
  color: globalCssVars.colorErrorText,
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word"
});

const EMPTY_RUNTIME: PreviewRuntime = {};

/**
 * Editable schema JSON beside a live render of the same schema. The buffer is
 * a working copy: edits mark it dirty and unlock 应用 / 还原, and applying runs
 * the exact import pipeline (parse → validate → commit), so hand-edited JSON
 * gets the same error reporting as a pasted import. The right pane renders the
 * COMMITTED schema — it updates on apply, not per keystroke.
 */
export function JsonSplitView({
  device,
  runtime = EMPTY_RUNTIME,
  schema
}: { device: PresentationDevice; runtime?: PreviewRuntime; schema: FormSchema }): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const registries = useDeviceRegistries();
  // The whole view is kept alive (hidden) across mode switches so the draft
  // buffer survives; the render pane alone is NOT — a hidden live form buys
  // nothing (its state intentionally resets per visit, like the preview mode)
  // while still evaluating linkage on every schema edit made in edit mode.
  const visible = useFormEditorStore(state => state.viewMode === "json");
  const json = useMemo(() => JSON.stringify(schema, null, 2), [schema]);

  const [draft, setDraft] = useState(json);
  const [synced, setSynced] = useState(json);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Resync during render when the schema changes underneath (apply commit,
  // undo/redo from the shell shortcuts): an untouched buffer follows the new
  // schema; an in-flight edit is never clobbered.
  if (json !== synced) {
    if (draft === synced) {
      setDraft(json);
    }

    setSynced(json);
  }

  const dirty = draft !== json;

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(draft);
      notify("success", "已复制到剪贴板");
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "复制失败");
    }
  };

  const handleEdit = (next: string): void => {
    setDraft(next);

    if (errorText) {
      setErrorText(null);
    }
  };

  const handleApply = (): void => {
    const result = applySchemaJson({
      raw: draft,
      registries,
      storeApi
    });

    if (!result.ok) {
      setErrorText(result.errorText ?? "Schema 无效");
      return;
    }

    // Snap the buffer to the canonical pretty print so formatting noise does
    // not keep the view dirty after a successful apply.
    setDraft(JSON.stringify(storeApi.getState().schema, null, 2));
    setErrorText(null);
    notify("success", "已应用 JSON 修改");
  };

  const handleReset = (): void => {
    setDraft(json);
    setErrorText(null);
  };

  return (
    <div css={splitCss}>
      <div css={paneCss}>
        <div css={headerCss}>
          <span>Schema JSON</span>

          <div css={actionsCss}>
            {dirty
              ? (
                  <>
                    <Button autoInsertSpace={false} size="small" type="text" onClick={handleReset}>
                      还原
                    </Button>

                    <Button autoInsertSpace={false} size="small" type="primary" onClick={handleApply}>
                      应用
                    </Button>
                  </>
                )
              : null}

            <Button icon={<EditorIcon name="copy" />} size="small" type="text" onClick={() => void handleCopy()}>
              复制
            </Button>

            <Button icon={<EditorIcon name="download" />} size="small" type="text" onClick={() => downloadSchemaJson(draft, schema.id)}>
              下载
            </Button>
          </div>
        </div>

        <CodeEditor
          showFoldGutter
          showLineNumbers
          language="json"
          minHeight={480}
          value={draft}
          onChange={handleEdit}
        />

        {errorText === null
          ? null
          : <pre css={applyErrorCss} role="alert">{errorText}</pre>}
      </div>

      <div css={paneCss}>
        <div css={headerCss}>预览</div>

        {visible
          ? (
              <FormRenderer
                containOverlays
                dataSourceResolver={runtime.dataSourceResolver}
                device={device}
                evaluationContext={runtime.evaluationContext}
                evaluators={runtime.evaluators}
                schema={schema}
              />
            )
          : null}
      </div>
    </div>
  );
}
