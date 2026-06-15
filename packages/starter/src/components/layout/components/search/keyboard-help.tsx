import { css } from "@emotion/react";
import { globalCssVars, Icon } from "@vef-framework-react/components";

import { Keyboard } from "./keyboard";
import { KeyboardArrowDownIcon } from "./keyboard-arrow-down-icon";
import { KeyboardArrowUpIcon } from "./keyboard-arrow-up-icon";
import { KeyboardControlIcon } from "./keyboard-control-icon";
import { KeyboardEscIcon } from "./keyboard-esc-icon";
import { KeyboardReturnIcon } from "./keyboard-return-icon";
import { KeyboardShiftIcon } from "./keyboard-shift-icon";
import { LetterSIcon } from "./letter-s-icon";

const keyboardHelpStyle = css({
  padding: globalCssVars.spacingMd,
  display: "flex",
  justifyContent: "space-between"
});

const hotkeyStyle = css({
  display: "flex",
  alignItems: "center",
  columnGap: globalCssVars.spacingXs
});

export function KeyboardHelp() {
  return (
    <div css={keyboardHelpStyle}>
      <div css={hotkeyStyle}>
        <Keyboard icon={<Icon component={KeyboardReturnIcon} />}>
          选择
        </Keyboard>

        <Keyboard
          icon={(
            <>
              <Icon component={KeyboardArrowUpIcon} />
              <Icon component={KeyboardArrowDownIcon} />
            </>
          )}
        >
          切换
        </Keyboard>

        <Keyboard icon={<Icon component={KeyboardEscIcon} />}>
          关闭
        </Keyboard>
      </div>

      <div css={hotkeyStyle}>
        <Keyboard
          icon={(
            <>
              <Icon component={KeyboardControlIcon} fontSize={12} />
              <Icon component={KeyboardShiftIcon} fontSize={12} />
              <Icon component={LetterSIcon} fontSize={16} />
            </>
          )}
        >
          打开搜索
        </Keyboard>
      </div>
    </div>
  );
}
