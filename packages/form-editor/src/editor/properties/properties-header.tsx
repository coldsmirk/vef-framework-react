import type { ReactElement } from "react";

import type { FieldDefinition, FormField } from "../../types";

import { css } from "@emotion/react";

import { EditorIcon } from "../../icons";
import { PanelHeader } from "./panel-header";

const iconImgCss = css({
  width: 20,
  height: 20,
  objectFit: "contain"
});

export interface PropertiesHeaderProps {
  field: FormField;
  definition: FieldDefinition;
  onClose: () => void;
}

/**
 * Header for the properties panel when a field is selected. Shows the
 * field's display name (or definition name as fallback) and its stable
 * `id` so the user can correlate the panel with an item in the canvas.
 */
export function PropertiesHeader({
  definition,
  field,
  onClose
}: PropertiesHeaderProps): ReactElement {
  return (
    <PanelHeader
      subtitle={field.id}
      title={field.label || definition.config.name}
      icon={definition.config.iconUrl
        ? <img alt="" css={iconImgCss} src={definition.config.iconUrl} />
        : <EditorIcon name={definition.config.icon ?? "square"} />}
      onClose={onClose}
    />
  );
}
