import type { ReactElement, ReactNode } from "react";

import { css } from "@emotion/react";
import { Button, globalCssVars, Modal, ScrollArea } from "@vef-framework-react/components";

import { confirmDialog } from "../toolbar/notify";

const MODAL_STYLES = {
  body: {
    padding: 0
  }
} as const;

// The one scroll region: the modal's own chrome (title, footer, outer margin)
// keeps its room, so the buttons stay reachable in a short window.
const VIEWPORT_STYLE = {
  maxHeight: "calc(100vh - 230px)"
} as const;

const formCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 16,
  // Keeps antd focus rings unclipped inside the scroll viewport and the
  // vertical scrollbar off the controls.
  padding: "4px 12px 8px 2px"
});

const fieldCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0
});

const labelCss = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});

const requiredMarkCss = css({
  marginLeft: 2,
  color: globalCssVars.colorError
});

const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorTextTertiary
});

const errorCss = css({
  fontSize: globalCssVars.fontSizeSm,
  lineHeight: 1.5,
  color: globalCssVars.colorErrorText
});

export interface DraftModalProps {
  children: ReactNode;
  /**
   * Whether the draft differs from what it was opened with: closing a dirty
   * draft asks first.
   */
  dirty: boolean;
  open: boolean;
  title: string;
  width: number;
  onAfterClose: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Shell of a modal that edits a draft: nothing is written back until 确定, so
 * one confirmed edit is one undo step. Title and buttons stay pinned around a
 * single scroll region.
 */
export function DraftModal({
  children,
  dirty,
  open,
  title,
  width,
  onAfterClose,
  onClose,
  onSubmit
}: DraftModalProps): ReactElement {
  const requestClose = (): void => {
    if (!dirty) {
      onClose();
      return;
    }

    confirmDialog("放弃未保存的修改？", "关闭后本次修改将不会保存。", {
      okText: "放弃修改",
      cancelText: "继续编辑",
      onOk: onClose
    });
  };

  return (
    <Modal
      centered
      destroyOnHidden
      afterClose={onAfterClose}
      open={open}
      styles={MODAL_STYLES}
      title={title}
      width={width}
      footer={(
        <>
          <Button autoInsertSpace={false} onClick={requestClose}>取消</Button>
          <Button autoInsertSpace={false} type="primary" onClick={onSubmit}>确定</Button>
        </>
      )}
      onCancel={requestClose}
    >
      <ScrollArea scrollbars="vertical" viewportStyle={VIEWPORT_STYLE}>
        <div css={formCss}>{children}</div>
      </ScrollArea>
    </Modal>
  );
}

export interface DraftFieldProps {
  children: ReactNode;
  error?: string | null;
  hint?: string;
  /**
   * Id of the control the label names; omitted for a control that cannot be
   * labelled this way (a `Segmented`, a list editor).
   */
  htmlFor?: string;
  label: string;
  required?: boolean;
}

/**
 * One labelled row of a {@link DraftModal}. An error takes the hint's place.
 */
export function DraftField({
  children,
  error,
  hint,
  htmlFor,
  label,
  required = false
}: DraftFieldProps): ReactElement {
  const LabelTag = htmlFor === undefined ? "span" : "label";

  return (
    <div css={fieldCss}>
      <LabelTag css={labelCss} htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden css={requiredMarkCss}>*</span> : null}
      </LabelTag>

      {children}

      {error
        ? <span css={errorCss} role="alert">{error}</span>
        : hint === undefined
          ? null
          : <span css={hintCss}>{hint}</span>}
    </div>
  );
}
