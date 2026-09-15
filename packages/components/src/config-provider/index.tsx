import type { ReactNode } from "react";

import type { ConfigProviderProps } from "./props";

import { StyleProvider } from "@ant-design/cssinjs";
import createCache from "@emotion/cache";
import { CacheProvider, Global } from "@emotion/react";
import { App, ConfigProvider as ConfigProviderInternal } from "antd";
import locale from "antd/es/locale/zh_CN";
import { useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";

import AppComponent from "./app";
import { ComponentDefaultsProvider, resolveComponentDefaults } from "./component-defaults";
import ContextHolder from "./context-holder";
import { DarkModeProvider } from "./dark-mode-context";
import ErrorFallback from "./error-fallback";
import { globalStyle } from "./global-style";
import { useConfigProvider } from "./use-config-provider";

const emotionCache = createCache({ key: "vef" });

export function ConfigProvider({
  theme,
  components,
  children
}: ConfigProviderProps): ReactNode {
  const {
    themeConfig,
    globalCssVars,
    isDarkMode
  } = useConfigProvider(theme);
  const componentDefaults = useMemo(() => resolveComponentDefaults(components), [components]);

  return (
    <CacheProvider value={emotionCache}>
      <Global styles={[globalStyle, globalCssVars]} />

      <StyleProvider layer hashPriority="high">
        <ConfigProviderInternal
          componentSize="medium"
          drawer={{ closable: { placement: "end" }, mask: { closable: false } }}
          iconPrefixCls="vef-icon"
          image={componentDefaults.Image}
          input={componentDefaults.Input}
          locale={locale}
          modal={{ mask: { closable: false } }}
          pagination={componentDefaults.Pagination}
          popover={{ arrow: false }}
          prefixCls="vef"
          select={componentDefaults.Select}
          textArea={componentDefaults.TextArea}
          theme={themeConfig}
          variant="outlined"
        >
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <App
              component={AppComponent}
              message={{
                maxCount: 3,
                duration: 3,
                ...componentDefaults.Message
              }}
              notification={{
                maxCount: 8,
                duration: 3,
                showProgress: true,
                pauseOnHover: true,
                placement: "topRight",
                stack: { threshold: 3 },
                ...componentDefaults.Notification
              }}
            >
              <DarkModeProvider value={isDarkMode}>
                <ComponentDefaultsProvider value={componentDefaults}>
                  <ContextHolder>
                    {children}
                  </ContextHolder>
                </ComponentDefaultsProvider>
              </DarkModeProvider>
            </App>
          </ErrorBoundary>
        </ConfigProviderInternal>
      </StyleProvider>
    </CacheProvider>
  );
}

export type { ComponentDefaults } from "./component-defaults";
export { useIsDarkMode } from "./dark-mode-context";
export type { ConfigProviderProps, ThemeConfig } from "./props";
