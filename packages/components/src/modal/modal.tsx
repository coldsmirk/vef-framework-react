import type { ModalProps as ModalPropsInternal } from "antd";
import type { PointerEventHandler } from "react";

import { css } from "@emotion/react";
import { motion, useDragControls } from "@vef-framework-react/core";
import { Modal as ModalInternal } from "antd";
import { memo, useCallback, useMemo, useRef } from "react";

export interface ModalProps extends ModalPropsInternal {
  /**
   * Whether the modal can be dragged by its header.
   *
   * @default false
   */
  draggable?: boolean;
}

const titleStyle = css({
  cursor: "move",
  userSelect: "none"
});

const constraintsStyle = css({
  position: "fixed",
  inset: 0,
  pointerEvents: "none"
});

export const Modal = memo<ModalProps>(({
  draggable = false,
  title,
  modalRender: externalModalRender,
  ...restProps
}) => {
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleDrag = useCallback<PointerEventHandler<HTMLDivElement>>(event => {
    event.stopPropagation();
    dragControls.start(event);
  }, [dragControls]);

  const draggableModalRender = useCallback<NonNullable<ModalPropsInternal["modalRender"]>>(node => (
    <>
      <div ref={constraintsRef} css={constraintsStyle} />

      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragControls={dragControls}
        dragElastic={0.3}
        dragListener={false}
        dragMomentum={false}
      >
        {node}
      </motion.div>
    </>
  ), [dragControls]);

  const resolvedModalRender = useMemo<ModalPropsInternal["modalRender"]>(() => {
    if (!draggable) {
      return externalModalRender;
    }

    if (externalModalRender) {
      return node => draggableModalRender(externalModalRender(node));
    }

    return draggableModalRender;
  }, [draggable, externalModalRender, draggableModalRender]);

  const resolvedTitle = useMemo(() => {
    if (!draggable) {
      return title;
    }

    return (
      <div css={titleStyle} onPointerDown={handleDrag}>
        {title}
      </div>
    );
  }, [draggable, title, handleDrag]);

  return (
    <ModalInternal
      {...restProps}
      modalRender={resolvedModalRender}
      title={resolvedTitle}
    />
  );
});
Modal.displayName = "Modal";
