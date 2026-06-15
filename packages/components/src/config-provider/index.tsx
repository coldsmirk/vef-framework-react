import type { ReactNode } from "react";

import type { ConfigProviderProps } from "./props";

import { StyleProvider } from "@ant-design/cssinjs";
import createCache from "@emotion/cache";
import { CacheProvider, Global } from "@emotion/react";
import { App, ConfigProvider as ConfigProviderInternal } from "antd";
import locale from "antd/es/locale/zh_CN";
import { ErrorBoundary } from "react-error-boundary";

import AppComponent from "./app";
import ContextHolder from "./context-holder";
import { DarkModeProvider } from "./dark-mode-context";
import ErrorFallback from "./error-fallback";
import { globalStyle } from "./global-style";
import { useConfigProvider } from "./use-config-provider";

const emotionCache = createCache({ key: "vef" });

export function ConfigProvider({ theme, children }: ConfigProviderProps): ReactNode {
  const {
    themeConfig,
    globalCssVars,
    isDarkMode
  } = useConfigProvider(theme);

  return (
    <CacheProvider value={emotionCache}>
      <Global styles={[globalStyle, globalCssVars, theme?.globalStyle]} />

      <StyleProvider layer hashPriority="high">
        <ConfigProviderInternal
          componentSize="medium"
          drawer={{ closable: { placement: "end" }, mask: { closable: false } }}
          iconPrefixCls="vef-icon"
          locale={locale}
          modal={{ mask: { closable: false } }}
          popover={{ arrow: false }}
          prefixCls="vef"
          theme={themeConfig}
          variant="outlined"
        >
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <App
              component={AppComponent}
              message={{ maxCount: 3, duration: 3 }}
              notification={{
                maxCount: 8,
                duration: 3,
                showProgress: true,
                pauseOnHover: true,
                placement: "topRight",
                stack: { threshold: 3 }
              }}
            >
              <DarkModeProvider value={isDarkMode}>
                <ContextHolder>
                  {children}
                </ContextHolder>
              </DarkModeProvider>
            </App>
          </ErrorBoundary>
        </ConfigProviderInternal>
      </StyleProvider>
    </CacheProvider>
  );
}

export { useIsDarkMode } from "./dark-mode-context";
export type { ConfigProviderProps, ThemeConfig } from "./props";
