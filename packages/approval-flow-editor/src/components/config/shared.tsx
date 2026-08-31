import type { FC, ReactNode } from "react";

import type { KindDescriptor, SelectionMode } from "../../types";

import { css } from "@emotion/react";
import { Collapse, globalCssVars, Input } from "@vef-framework-react/components";

import { ChevronRightIcon } from "../../icons";
import { configSectionContentStyle, configSectionStyle, formFieldLabelStyle, formFieldStyle } from "../../styles";
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

const unknownKindStyle = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorErrorText,
  paddingBlock: globalCssVars.spacingXs
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
  /**
   * The registered descriptor for the row's kind, or undefined when the
   * definition names a kind this application no longer offers — a flow saved
   * before a host resolver was removed or renamed.
   */
  descriptor: KindDescriptor | undefined;
  disabled?: boolean;
  /**
   * The patch shape is the intersection of what assignee / cc rows accept, so a
   * single component drives both without per-list typing.
   */
  onPatch: (partial: { ids?: string[]; formField?: string }) => void;
}

/**
 * Resolver input for one principal-list row, decided by the kind's selection
 * mode rather than by its name: a field-key input for `form_field`, the host
 * picker for anything that selects ids, and nothing at all for a kind resolved
 * from the applicant at run time. Shared by assignee-list and cc-list.
 *
 * Reading the mode off the descriptor is what makes a host kind work here
 * unchanged — the editor never needs to learn the kind's name.
 */
export const PrincipalKindPicker: FC<PrincipalKindPickerProps> = ({
  item,
  descriptor,
  disabled,
  onPatch
}) => {
  if (!descriptor) {
    return <div css={unknownKindStyle}>{`当前应用未注册该类型：${item.kind}`}</div>;
  }

  if (descriptor.selection === "form_field") {
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

  if (descriptor.selection === "none") {
    return null;
  }

  return (
    <PrincipalPicker
      disabled={disabled}
      kind={descriptor.kind}
      label={descriptor.label}
      selection={descriptor.selection}
      value={item.ids ?? []}
      onChange={ids => onPatch({ ids })}
    />
  );
};

/**
 * The value fields a row must carry after its kind changes, derived from the
 * new kind's selection mode. Shared by assignee-list and cc-list so switching
 * kinds cannot leave one list holding a value the other would have cleared —
 * a stale `ids` under a `form_field` kind is exactly what save-time validation
 * has no way to notice.
 */
export function principalRowResetFor(selection: SelectionMode | undefined): { ids?: string[]; formField?: string } {
  if (selection === "form_field") {
    return { ids: undefined, formField: "" };
  }

  if (selection === undefined || selection === "none") {
    return { ids: undefined, formField: undefined };
  }

  return { ids: [], formField: undefined };
}

/**
 * Indexes a kind catalog for lookup by kind.
 */
export function indexKinds<K extends string>(descriptors: ReadonlyArray<KindDescriptor<K>>): Map<string, KindDescriptor<K>> {
  return new Map(descriptors.map(descriptor => [descriptor.kind, descriptor]));
}
