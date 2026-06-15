import type { FC, ReactNode } from "react";

import { css } from "@emotion/react";
import { Collapse, globalCssVars, Input } from "@vef-framework-react/components";

import { ChevronRightIcon } from "../../icons";
import { configSectionContentStyle, configSectionStyle, formFieldLabelStyle, formFieldStyle } from "../../styles";
import { isPrincipalKind } from "../../types";
import { PrincipalPicker } from "./principal-picker";

/* ── Collapsible Section ───────────────────────────────────────────────── */

const chevronOpenStyle = css({ transform: "rotate(90deg)" });

/**
 * Override antd Collapse styles to match config panel design
 */
const collapseOverrideStyle = css({
  "&.vef-collapse": {
    background: "transparent",
    border: "none",
    borderRadius: 0,

    ".vef-collapse-item": {
      border: "none",

      "> .vef-collapse-header": {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: 0,
        fontSize: globalCssVars.fontSize,
        fontWeight: 600,
        color: globalCssVars.colorText,
        cursor: "pointer",
        userSelect: "none",

        ".vef-collapse-expand-icon": {
          padding: 0,
          margin: 0
        },

        ".vef-collapse-header-text": {
          flex: 1
        },

        "&:focus-visible": {
          outline: `2px solid ${globalCssVars.colorPrimary}`,
          outlineOffset: 2,
          borderRadius: 4
        }
      },

      "> .vef-collapse-content > .vef-collapse-content-box": {
        padding: 0
      }
    }
  }
});

interface ConfigSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export const ConfigSection: FC<ConfigSectionProps> = ({
  title,
  defaultOpen = true,
  children
}) => (
  <div css={configSectionStyle}>
    <Collapse
      ghost
      css={collapseOverrideStyle}
      defaultActiveKey={defaultOpen ? ["section"] : []}
      expandIcon={({ isActive }) => (
        <ChevronRightIcon
          css={isActive ? chevronOpenStyle : undefined}
          size={16}
        />
      )}
      items={[
        {
          key: "section",
          label: title,
          children: <div css={configSectionContentStyle}>{children}</div>
        }
      ]}
    />
  </div>
);

/* ── Form Field Wrapper ────────────────────────────────────────────────── */

interface FormFieldProps {
  label: string;
  children: ReactNode;
}

export const FormField: FC<FormFieldProps> = ({ label, children }) => (
  <div css={formFieldStyle}>
    <div css={formFieldLabelStyle}>{label}</div>
    {children}
  </div>
);

/* ── Vertical Checkbox List ───────────────────────────────────────────── */

const checkboxListStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: 12
});

interface CheckboxListProps {
  children: ReactNode;
}

export const CheckboxList: FC<CheckboxListProps> = ({ children }) => <div css={checkboxListStyle}>{children}</div>;

/* ── Principal / Form-field List Item ──────────────────────────────────── */

/**
 * Item-card styles shared by the assignee-list and cc-list editors, kept in one
 * place so the two near-identical principal lists cannot drift apart.
 */
export const principalListItemStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingSm,
  padding: globalCssVars.spacingSm,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorFillAlter
});

export const principalListItemHeaderStyle = css({
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingXs
});

export const principalListItemIndexStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 600,
  color: globalCssVars.colorTextTertiary,
  flexShrink: 0,
  width: 20
});

interface PrincipalListEntry {
  kind: string;
  ids?: string[];
  formField?: string;
}

interface PrincipalKindPickerProps {
  item: PrincipalListEntry;
  disabled?: boolean;
  /**
   * The patch shape is the intersection of what assignee / cc rows accept, so a
   * single component drives both without per-list typing.
   */
  onPatch: (partial: { ids?: string[]; formField?: string }) => void;
}

/**
 * Resolver input for one principal-list row: a field-key input for `form_field`,
 * the host picker for user/role/department, or nothing for the self/superior
 * kinds that need no extra input. Shared by assignee-list and cc-list.
 */
export const PrincipalKindPicker: FC<PrincipalKindPickerProps> = ({
  item,
  disabled,
  onPatch
}) => {
  if (item.kind === "form_field") {
    return (
      <FormField label="字段标识">
        <Input
          disabled={disabled}
          placeholder="请输入表单字段 key"
          value={item.formField ?? ""}
          onChange={event => onPatch({ formField: event.currentTarget.value })}
        />
      </FormField>
    );
  }

  if (!isPrincipalKind(item.kind)) {
    return null;
  }

  return (
    <PrincipalPicker
      disabled={disabled}
      kind={item.kind}
      value={item.ids ?? []}
      onChange={ids => onPatch({ ids })}
    />
  );
};
