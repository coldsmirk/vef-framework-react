import type { Options as MinifyOptions } from "html-minifier-terser";
import type { PluginOption } from "vite";

import { minify } from "html-minifier-terser";

const VIRTUAL_MODULE_ID = "index.html";

const HTML_CONTENT = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="%VEF_APP_FAVICON%" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Powered by VEF framework" />
    <meta name="app-version" content="%VEF_APP_VERSION%" />
    <meta name="app-changelog" content="%VEF_APP_CHANGELOG%" />
    <title>%VEF_APP_TITLE%</title>
  </head>
  <body>
    <noscript>
      <h2>很抱歉，如果没有启用 JavaScript，%VEF_APP_NAME% 无法正常工作。请启用 JavaScript 再继续。</h2>
    </noscript>
    <div id="__vef-initialization-loader">
      <style>
        #__vef-initialization-loader {
          --loader-bg: #f6f9fc;
          --loader-grid: rgba(15, 76, 129, 0.06);
          --loader-primary: #0f4c81;
          --loader-accent: #06b6d4;
          --loader-muted: #64748b;
          --loader-status: #22c55e;

          position: fixed;
          inset: 0;
          z-index: 9999;
          overflow: hidden;
          background-color: var(--loader-bg);
          background-image:
            linear-gradient(var(--loader-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--loader-grid) 1px, transparent 1px);
          background-size: 48px 48px;
          background-position: center center;
          color: var(--loader-primary);
          /* Match antd default font stack so the loader doesn't flash from
             the UA serif default (e.g. SimSun on Windows) to the app's
             sans-serif once the JS bundle injects global styles. */
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
        }

        #__vef-initialization-loader::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 55% at 50% 45%, rgba(246, 249, 252, 0) 0%, var(--loader-bg) 75%);
          pointer-events: none;
        }

        #__vef-initialization-loader::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--loader-accent), transparent);
          opacity: 0.7;
          animation: vef-loader-scan 3.2s linear infinite;
        }

        #__vef-initialization-loader .loader-header {
          position: absolute;
          top: 28px;
          left: 32px;
          display: flex;
          align-items: center;
          column-gap: 10px;
          color: var(--loader-primary);
        }

        #__vef-initialization-loader .loader-header svg {
          width: 22px;
          height: 22px;
        }

        #__vef-initialization-loader .loader-header-name {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        #__vef-initialization-loader .loader-stage {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          row-gap: 28px;
          padding: 0 24px;
          text-align: center;
        }

        #__vef-initialization-loader .loader-eyebrow {
          font-size: 11px;
          letter-spacing: 0.36em;
          color: var(--loader-muted);
          text-transform: uppercase;
        }

        #__vef-initialization-loader .loader-title {
          display: flex;
          column-gap: 0.06em;
          font-size: 30px;
          font-weight: 300;
          letter-spacing: 0.14em;
          color: var(--loader-primary);
        }

        #__vef-initialization-loader .loader-title > span {
          display: inline-block;
          animation: vef-loader-fade-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
        }

        #__vef-initialization-loader .loader-title > span:nth-child(1) { animation-delay: 0.10s; }
        #__vef-initialization-loader .loader-title > span:nth-child(2) { animation-delay: 0.18s; }
        #__vef-initialization-loader .loader-title > span:nth-child(3) { animation-delay: 0.26s; }
        #__vef-initialization-loader .loader-title > span:nth-child(4) { animation-delay: 0.34s; }
        #__vef-initialization-loader .loader-title > span:nth-child(5) { animation-delay: 0.42s; }
        #__vef-initialization-loader .loader-title > span:nth-child(6) { animation-delay: 0.50s; }

        #__vef-initialization-loader .loader-wave {
          width: 360px;
          height: 56px;
          stroke: var(--loader-accent);
          stroke-width: 1.5;
          fill: none;
          stroke-linecap: round;
        }

        #__vef-initialization-loader .loader-wave .wave-back {
          opacity: 0.25;
          stroke-dasharray: 18 82;
          animation: vef-loader-wave-back 3.6s linear infinite;
        }

        #__vef-initialization-loader .loader-wave .wave-front {
          opacity: 0.9;
          stroke-dasharray: 14 86;
          animation: vef-loader-wave-front 2.4s linear infinite;
        }

        #__vef-initialization-loader .loader-status {
          display: flex;
          align-items: center;
          column-gap: 10px;
          min-height: 18px;
          font-size: 13px;
          letter-spacing: 0.06em;
          color: var(--loader-muted);
          font-feature-settings: "tnum";
        }

        #__vef-initialization-loader .loader-status::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--loader-status);
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
          animation: vef-loader-pulse 1.6s ease-out infinite;
        }

        #__vef-initialization-loader .loader-footer {
          position: absolute;
          left: 32px;
          right: 32px;
          bottom: 24px;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          letter-spacing: 0.12em;
          color: var(--loader-muted);
          font-feature-settings: "tnum";
        }

        @keyframes vef-loader-scan {
          0% { transform: translateY(0); opacity: 0; }
          12% { opacity: 0.7; }
          88% { opacity: 0.7; }
          100% { transform: translateY(100vh); opacity: 0; }
        }

        @keyframes vef-loader-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes vef-loader-wave-back {
          to { stroke-dashoffset: -100; }
        }

        @keyframes vef-loader-wave-front {
          to { stroke-dashoffset: 100; }
        }

        @keyframes vef-loader-pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          #__vef-initialization-loader *,
          #__vef-initialization-loader *::before,
          #__vef-initialization-loader *::after {
            animation: none !important;
          }
        }
      </style>

      <div class="loader-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
        <span class="loader-header-name">%VEF_APP_NAME%</span>
      </div>

      <div class="loader-stage">
        <div class="loader-eyebrow">SYSTEM&nbsp;&nbsp;INITIALIZING</div>
        <div class="loader-title">
          <span>正</span><span>在</span><span>启</span><span>动</span><span>服</span><span>务</span>
        </div>
        <svg class="loader-wave" viewBox="0 0 360 56" preserveAspectRatio="none" aria-hidden="true">
          <path class="wave-back" pathLength="100" d="M0 28 Q 45 6 90 28 T 180 28 T 270 28 T 360 28" />
          <path class="wave-front" pathLength="100" d="M0 28 Q 30 16 60 28 T 120 28 T 180 28 T 240 28 T 300 28 T 360 28" />
        </svg>
        <div class="loader-status" id="__vef-loader-status">建立安全连接</div>
      </div>

      <div class="loader-footer">
        <span>v%VEF_APP_VERSION%</span>
        <span>POWERED BY VEF FRAMEWORK</span>
      </div>

      <script>
        (function() {
          const steps = [
            "建立安全连接",
            "加载核心模块",
            "校验运行环境",
            "准备工作台"
          ];
          const el = document.getElementById("__vef-loader-status");
          if (!el) return;
          let i = 0;
          function tick() {
            el.textContent = steps[i % steps.length];
            i += 1;
            setTimeout(tick, 900);
          }
          setTimeout(tick, 800);
        })();
      </script>
    </div>
    <div id="root"></div>
    <script type="module" src="src/main.ts"></script>
  </body>
</html>
`;

/**
 * HTML minification options for production builds
 */
const MINIFY_OPTIONS: MinifyOptions = {
  collapseBooleanAttributes: true,
  collapseInlineTagWhitespace: true,
  collapseWhitespace: true,
  conservativeCollapse: false,
  html5: true,
  keepClosingSlash: true,
  minifyCSS: true,
  minifyJS: true,
  minifyURLs: true,
  noNewlinesBeforeTagClose: true,
  quoteCharacter: "\"",
  removeAttributeQuotes: false,
  removeComments: true,
  removeEmptyAttributes: true,
  removeEmptyElements: false,
  removeOptionalTags: false,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: false,
  removeStyleLinkTypeAttributes: false,
  removeTagWhitespace: false,
  sortAttributes: true,
  sortClassName: true,
  trimCustomFragments: true,
  useShortDoctype: true
};

/**
 * Check if a bundle is the HTML asset that needs minification
 */
function isHtmlAsset(bundle: { type: string; source?: unknown; fileName: string }): bundle is { type: "asset"; source: string; fileName: string } {
  return bundle.type === "asset"
    && typeof bundle.source === "string"
    && bundle.fileName === VIRTUAL_MODULE_ID;
}

/**
 * Create the HTML virtual module plugin
 *
 * @returns The HTML plugin array
 */
export function createHtmlPlugin(): PluginOption {
  return [
    {
      name: "vef-framework:html",
      resolveId(source) {
        return source === VIRTUAL_MODULE_ID ? VIRTUAL_MODULE_ID : null;
      },
      load(id) {
        return id === VIRTUAL_MODULE_ID ? HTML_CONTENT : null;
      },
      transformIndexHtml: {
        order: "pre",
        handler: () => HTML_CONTENT
      }
    },
    {
      name: "vef-framework:html-minify",
      enforce: "post",
      async generateBundle(_, bundles) {
        for (const bundle of Object.values(bundles)) {
          if (isHtmlAsset(bundle)) {
            bundle.source = await minify(bundle.source, MINIFY_OPTIONS);
          }
        }
      }
    }
  ];
}
