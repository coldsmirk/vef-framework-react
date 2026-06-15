import type { Transition, Variants } from "@vef-framework-react/core";
import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { AnimatePresence, motion, useShallow } from "@vef-framework-react/core";
import { memo, useCallback } from "react";

import { globalCssVars } from "../../_base";
import { Button } from "../../button";
import { Text } from "../../typography";
import { useCrudStore } from "../store";

const selectionWrapperStyle = css({
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.sizeSm,
  backgroundColor: globalCssVars.colorFillQuaternary,
  paddingInline: globalCssVars.sizeSm,
  borderRadius: globalCssVars.borderRadius,
  fontWeight: "normal",
  "> .vef-btn-variant-link": {
    padding: 0
  }
});

const selectedCountStyle = css({
  color: globalCssVars.colorPrimary,
  fontWeight: globalCssVars.fontWeightStrong
});

const variants: Variants = {
  hidden: { opacity: 0, x: 10 },
  visible: { opacity: 1, x: 0 }
};

const transition: Transition = {
  duration: 0.2,
  ease: "easeOut"
};

interface SelectionIndicatorProps {
  selectionSummary?: (selectedRows: unknown[]) => ReactNode;
}

export const SelectionIndicator = memo(({ selectionSummary }: SelectionIndicatorProps) => {
  const {
    selectedRowKeys,
    setSelectedRows,
    setSelectedRowKeys
  } = useCrudStore(
    useShallow(state => {
      return {
        selectedRowKeys: state.selectedRowKeys,
        setSelectedRows: state.setSelectedRows,
        setSelectedRowKeys: state.setSelectedRowKeys
      };
    })
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  }, [setSelectedRowKeys, setSelectedRows]);

  if (selectedRowKeys.length === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        animate="visible"
        css={selectionWrapperStyle}
        exit="hidden"
        initial="hidden"
        transition={transition}
        variants={variants}
      >
        <Text type="secondary">
          已选择
          {" "}
          <span css={selectedCountStyle}>{selectedRowKeys.length}</span>
          {" "}
          项

          {selectionSummary && (
            <>
              {" "}
              {selectionSummary(selectedRowKeys)}
            </>
          )}
        </Text>

        <Button type="link" onClick={handleClearSelection}>
          取消选择
        </Button>
      </motion.div>
    </AnimatePresence>
  );
});
SelectionIndicator.displayName = "SelectionIndicator";
