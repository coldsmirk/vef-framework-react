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

    ".vef-modal-header": {
      borderBlockEnd: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorSplit}`,

      ".vef-modal-title": {
        paddingBlock: globalCssVars.spacingSm,
        paddingInline: globalCssVars.spacingXs
      }
    },

    ".vef-modal-body": {
      paddingInline: globalCssVars.spacingXxs,
      paddingBlock: globalCssVars.spacingXs
    },

    ".vef-modal-footer": {
      borderBlockStart: `${globalCssVars.lineWidth} ${globalCssVars.lineType} ${globalCssVars.colorSplit}`
    }
  }
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

export function Search() {
  const { isSearchVisible, setIsSearchVisible } = useLayoutStore();
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const panelRef = useFocusTrap(true);

  return (
    <ClassNames>
      {({ css }) => (
        <Modal
          centered
          destroyOnHidden
          afterClose={() => setKeyword("")}
          closable={false}
          css={modalStyle}
          keyboard={false}
          mask={maskClosable}
          open={isSearchVisible}
          panelRef={panelRef}
          width={600}
          wrapClassName={css(wrapperStyle)}
          footer={
            <KeyboardHelp />
          }
          title={(
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
          )}
          onCancel={() => setIsSearchVisible(false)}
        >
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
        </Modal>
      )}
    </ClassNames>
  );
}
