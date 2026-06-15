export interface ThemeColorTokens {
  colors: Record<string, string | number>;
}

export interface GlobalThemeTokens {
  light: ThemeColorTokens;
  dark: ThemeColorTokens;
}

export const globalThemeTokens: GlobalThemeTokens = Object.freeze({
  light: {
    colors: {
      inverted: "#001428"
    }
  },
  dark: {
    colors: {}
  }
});
