import { css } from "@emotion/react";

export const globalStyle = css`
  html {
    &.color-scheme-transition {
      view-transition-name: root;

      /* .vef-layout-sidebar {
        view-transition-name: none;
      }

      .vef-layout-main-content {
        view-transition-name: none;
      } */

      &::view-transition-group(root) {
        animation: none;
        mix-blend-mode: normal;
      }

      &::view-transition-old(root) {
        z-index: 2;
      }
      &::view-transition-new(root) {
        z-index: 1;
      }

      &.dark::view-transition-old(root) {
        z-index: 1;
      }
      &.dark::view-transition-new(root) {
        z-index: 2;
      }
    }
  }

  /* ::view-transition-group(sidebar) {
    z-index: 2;
  }
  ::view-transition-group(main-content) {
    z-index: 1;
  }

  ::view-transition-old(main-content) {
    animation: page-slide-out 300ms cubic-bezier(0.2, 0, 0, 1) both;
  }
  ::view-transition-new(main-content) {
    animation: page-slide-in 400ms cubic-bezier(0.2, 0, 0, 1) both;
  }

  @keyframes page-slide-in {
    from {
      transform: translateX(-100px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes page-slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100px);
      opacity: 0;
    }
  } */
`;
