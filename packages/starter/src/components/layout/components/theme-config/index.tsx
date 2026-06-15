import { ClassNames, css } from "@emotion/react";
import { Divider, Drawer, globalCssVars, ScrollArea } from "@vef-framework-react/components";

import { useThemeStore } from "../../../../stores";
import { ColorScheme } from "./color-scheme";
import { MenuLayout } from "./menu-layout";
import { Operations } from "./operations";
import { ThemeColors } from "./theme-colors";

const drawerBodyStyle = css({
  padding: 0
});

const contentStyle = css({
  height: "100%",
  paddingInline: globalCssVars.spacingSm,
  paddingBlockStart: globalCssVars.spacingXs,
  paddingBlockEnd: globalCssVars.spacingLg
});

const containerStyle = css({
  paddingInline: globalCssVars.spacingXs
});

export function ThemeConfig(): React.JSX.Element {
  const isThemeConfigVisible = useThemeStore(state => state.isThemeConfigVisible);

  function handleClose(): void {
    useThemeStore.setState(state => {
      state.isThemeConfigVisible = false;
    });
  }

  return (
    <ClassNames>
      {({ css }) => (
        <Drawer
          footer={<Operations />}
          mask={{ closable: true }}
          open={isThemeConfigVisible}
          title="主题配置"
          classNames={{
            body: css(drawerBodyStyle)
          }}
          onClose={handleClose}
        >
          <ScrollArea
            className={css(contentStyle)}
            viewportClassName={css(containerStyle)}
          >
            <Divider>主题模式</Divider>
            <ColorScheme />
            <Divider>布局模式</Divider>
            <MenuLayout />
            <Divider>主题颜色</Divider>
            <ThemeColors />
          </ScrollArea>
        </Drawer>
      )}
    </ClassNames>
  );
}
