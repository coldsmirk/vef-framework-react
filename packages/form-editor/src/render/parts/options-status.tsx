import type { ReactElement } from "react";

import { errorTextCss, helperTextCss } from "./field-shell";

export interface OptionsStatusProps {
  error: boolean;
  loading: boolean;
}

/**
 * The placeholder a selection field (radio / checkbox group) shows in place of
 * an option list it has none of yet: a quiet hint while a remote source loads or
 * a static source is empty, an error line when the resolver failed. Keeps a
 * freshly-dropped or failed field from rendering as a blank void. A field that
 * already has options renders the control instead (a refresh spins over the
 * existing options), so this only ever stands in for the empty state.
 */
export function OptionsStatus({ error, loading }: OptionsStatusProps): ReactElement {
  if (loading) {
    return <span css={helperTextCss}>加载中…</span>;
  }

  if (error) {
    return <span css={errorTextCss} role="alert">选项加载失败</span>;
  }

  return <span css={helperTextCss}>暂无选项</span>;
}
