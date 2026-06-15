import { css } from "@emotion/react";
import modernNormalizeCss from "modern-normalize/modern-normalize.css?raw";

import { globalCssVars } from "../_base";
import { ROOT_ELEMENT_ID } from "./app";

export const globalStyle = css`
  @layer reset, antd, react-flow, vef;
  @layer reset {
    ${modernNormalizeCss}
  }

  html {
    view-transition-name: none;
    /* Tabular figures keep digits aligned across data rows, stats, and inputs. */
    font-variant-numeric: tabular-nums;

    &.color-blind-mode {
      filter: invert(80%);
    }

    &.grayscale-mode {
      filter: grayscale(100%);
    }
  }

  html, body, #${ROOT_ELEMENT_ID} {
    height: 100%;
    overflow: hidden;
  }

  * {
    scrollbar-width: thin;
    scrollbar-color: rgba(0, 0, 0, 0.15) transparent;
  }

  .dark * {
    scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
  }

  button:focus {
    outline: none;
    -webkit-focus-ring-color: transparent;
  }

  .vef-result {
    & > .vef-result-content {
      border-radius: 12px;
    }
  }

  .vef-menu-inline-collapsed > .vef-menu-item,
  .vef-menu-inline-collapsed > .vef-menu-item-group > .vef-menu-item-group-list > .vef-menu-item,
  .vef-menu-inline-collapsed > .vef-menu-item-group > .vef-menu-item-group-list > .vef-menu-submenu > .vef-menu-submenu-title,
  .vef-menu-inline-collapsed > .vef-menu-submenu > .vef-menu-submenu-title {
    padding-inline: calc(50% - calc(var(--vef-menu-collapsed-icon-size) / 2 + 1px) - var(--vef-menu-item-margin-inline));
  }

  .vef-checkbox, .vef-tree-checkbox {
    --vef-control-interactive-size: 18px;
  }

  .vef-btn {
    &.vef-btn-loading {
      .vef-icon > svg {
        width: 1.2em;
        height: 1.2em;
      }
    }
  }

  .vef-dropdown-menu {
    padding: calc(${globalCssVars.spacingXxs} * 1.5);

    .vef-dropdown-menu-item {
      --vef-dropdown-padding-block: calc(${globalCssVars.spacingXxs} * 1.5);

      border-radius: ${globalCssVars.borderRadius};
    }
  }

  .vef-select-dropdown {
    padding: calc(${globalCssVars.spacingXxs} * 1.5);

    &.vef-tree-select-dropdown {
      padding: calc(${globalCssVars.spacingXxs} * 1.5);

      .vef-select-tree {
        .vef-select-tree-treenode:last-child {
          margin-block-end: 0;
        }
      }
    }

    .vef-select-item {
      border-radius: ${globalCssVars.borderRadius};
    }
  }

  .vef-modal {
    .vef-modal-container {
      border-radius: calc(${globalCssVars.borderRadiusLg} * 1.5);
    }

    .vef-modal-close {
      --vef-control-height: ${globalCssVars.controlHeightSm}
    }

    .vef-modal-header {
      --vef-modal-header-margin-bottom: ${globalCssVars.spacingMd};
    }

    .vef-modal-footer {
      & > .vef-btn + .vef-btn {
        margin-inline-start: ${globalCssVars.spacingSm};
      }
    }
  }

  .vef-drawer {
    .vef-drawer-section {
      & > .vef-drawer-footer {
        text-align: right;

        & > .vef-btn + .vef-btn {
          margin-inline-start: ${globalCssVars.spacingSm};
        }
      }
    }
  }

  .vef-popover {
    & > .vef-popover-container {
      --vef-popover-inner-padding: ${globalCssVars.spacingMd};
    }
  }

  /*
   * Stretch flex-height tables (scroll.y set -> fixed-header) to fill their
   * container: body flexes and scrolls, pagination stays pinned, and an empty
   * table keeps its placeholder vertically filled instead of collapsing.
   * Mirrors the antd v6 DOM: table-wrapper > spin > spin-container; the v6
   * spin indicator (.vef-spin-section) centers itself absolutely, so only the
   * heights along this chain need forwarding.
   */
  .vef-table-wrapper:has(.vef-table:is(.vef-table-fixed-header)) {
    height: 100%;

    & > .vef-spin {
      height: 100%;

      & > .vef-spin-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        row-gap: ${globalCssVars.spacingMd};

        & > .vef-table {
          flex: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;

          & > .vef-table-title {
            flex: none;
          }

          & > .vef-table-container {
            flex: auto;
            min-height: 0;
            display: flex;
            flex-direction: column;

            & > .vef-table-header {
              flex: none;
            }

            & > .vef-table-tbody.vef-table-tbody-virtual {
              overflow: hidden;
            }

            & > .vef-table-body {
              flex: auto;
              min-height: 0;

              & > table:has(tr.vef-table-placeholder) {
                height: 100%;
              }
            }
          }

          & > .vef-table-footer {
            flex: none;
          }
        }

        & > .vef-pagination {
          flex: none;
          margin: 0;
        }
      }
    }
  }
`;
