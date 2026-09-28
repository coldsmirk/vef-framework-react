import { ClassNames, css } from "@emotion/react";
import { globalCssVars, Icon, Input, Modal, ScrollArea } from "@vef-framework-react/components";
import { useFocusTrap } from "@vef-framework-react/hooks";
import { SearchIcon } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { useLayoutStore } from "../../store";
import { KeyboardHelp } from "./keyboard-help";
import { SearchResult } from "./search-result";

const wrapperStyle = css({
  overflow: "hidden"
});

const modalStyle = css({
  "&.vef-modal .vef-modal-container": {
    "--vef-modal-content-padding": "0",

    ".vef-modal-body": {
      padding: 0
    },

    ".vef-modal-footer": {
      borderBlockStart: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorSplit}`
    }
  }
});

const searchBarStyle = css({
  paddingBlock: globalCssVars.spacingSm,
  paddingInline: globalCssVars.spacingXs,
  marginBlockEnd: globalCssVars.spacingMd,
  borderBlockEnd: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorSplit}`
});

const resultAreaStyle = css({
  paddingInline: globalCssVars.spacingXxs,
  paddingBlock: globalCssVars.spacingXs
});

const contentStyle = css({
  paddingInline: globalCssVars.spacingSm
});

const resultContainerStyle = css({
  maxHeight: "calc(80vh - 200px)"
});

const iconStyle = css({
  color: globalCssVars.colorGray300
});

const maskClosable = { closable: true } as const;

/**
 * The keyword input and its results. The keyword lives here, not beside the
 * Modal, so typing re-renders this panel alone: a Modal re-rendered per
 * keystroke re-runs its portal's dependency-less container effect
 * (@rc-component/portal), which fast typing can stack past React's
 * nested-update limit. destroyOnHidden remounts the panel per opening, which
 * is what clears the keyword.
 */
function SearchPanel() {
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);

  return (
    <>
      <div css={searchBarStyle}>
        <Input
          allowClear
          data-autofocus
          placeholder="关键词"
          prefix={<Icon component={SearchIcon} css={iconStyle} />}
          value={keyword}
          variant="borderless"
          onChange={event => setKeyword(event.currentTarget.value)}
          onKeyDown={event => {
            // Prevent arrow keys from moving cursor in the input field
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
            }
          }}
        />
      </div>

      <div css={resultAreaStyle}>
        <ClassNames>
          {({ css }) => (
            <ScrollArea
              className={css(contentStyle)}
              type="scroll"
              viewportClassName={css(resultContainerStyle)}
            >
              <SearchResult keyword={deferredKeyword} />
            </ScrollArea>
          )}
        </ClassNames>
      </div>
    </>
  );
}

export function Search() {
  const { isSearchVisible, setIsSearchVisible } = useLayoutStore();
  const panelRef = useFocusTrap(true);

  return (
    <ClassNames>
      {({ css }) => (
        <Modal
          centered
          destroyOnHidden
          closable={false}
          css={modalStyle}
          footer={<KeyboardHelp />}
          keyboard={false}
          mask={maskClosable}
          open={isSearchVisible}
          panelRef={panelRef}
          width={600}
          wrapClassName={css(wrapperStyle)}
          onCancel={() => setIsSearchVisible(false)}
        >
          <SearchPanel />
        </Modal>
      )}
    </ClassNames>
  );
}
