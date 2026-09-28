import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { Button, Modal } from "@vef-framework-react/components";
import { useState } from "react";

const footerStyle = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  marginTop: 12
});

export interface ActionDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * The action form — its draft and its {@link ActionFooter}.
   */
  children: ReactNode;
}

/**
 * Hosts a confirm-style action form. The form owns its draft and footer, so
 * typing re-renders the form alone and never the Modal: a Modal re-rendered on
 * every keystroke re-runs its portal's dependency-less container effect
 * (@rc-component/portal), whose no-op state update React cannot always skip,
 * and fast typing then stacks those updates past React's nested-update limit.
 * destroyOnHidden remounts the form on every opening — which is what resets
 * its draft — and keeps a closed dialog's portal unmounted altogether.
 */
export function ActionDialog({
  open,
  title,
  onClose,
  children
}: ActionDialogProps) {
  return (
    <Modal destroyOnHidden footer={null} open={open} title={title} onCancel={onClose}>
      {children}
    </Modal>
  );
}

export interface ActionFooterProps {
  okText: string;
  /**
   * Renders the ok button in danger style.
   */
  danger?: boolean;
  disabled?: boolean;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

/**
 * The cancel / confirm pair an {@link ActionDialog} form renders below itself.
 */
export function ActionFooter({
  okText,
  danger,
  disabled,
  submitting,
  onCancel,
  onOk
}: ActionFooterProps) {
  return (
    <div css={footerStyle}>
      <Button onClick={onCancel}>取消</Button>
      <Button danger={danger} disabled={disabled} loading={submitting} type="primary" onClick={onOk}>{okText}</Button>
    </div>
  );
}

/**
 * Drives one confirm-style dialog: local `submitting` while the async confirm
 * runs, closing only on success (errors are surfaced by the mutation layer
 * and keep the dialog open for retry).
 */
export function useConfirm(onClose: () => void) {
  const [submitting, setSubmitting] = useState(false);

  async function run(action: () => Promise<void>): Promise<void> {
    setSubmitting(true);

    try {
      await action();
      onClose();
    } catch {
      /* surfaced by the mutation */
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, run };
}
