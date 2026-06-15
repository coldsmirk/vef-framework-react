import type { FC } from "react";

import type {
  AlertBlockField,
  ButtonField,
  CheckboxGroupField,
  DateField,
  DateRangeField,
  DatetimeField,
  DividerField,
  FieldComponentProps,
  FieldDefinition,
  FormField,
  NumberField,
  ParagraphField,
  RadioField,
  SelectField,
  SwitchField,
  TextareaField,
  TextfieldField
} from "../../types";

import { defineFieldDefinition } from "../../types";
import { buttonDefinition } from "../button";
import { checkboxGroupFieldDefinition } from "../checkbox-group-field";
import { flexDefinition, gridDefinition, sectionDefinition, subformDefinition, tabsDefinition } from "../containers";
import { dateFieldDefinition, dateRangeFieldDefinition, datetimeFieldDefinition } from "../date-field";
import { alertBlockDefinition, dividerDefinition, paragraphDefinition } from "../display";
import { numberFieldDefinition } from "../number-field";
import { radioFieldDefinition } from "../radio-field";
import { selectFieldDefinition } from "../select-field";
import { switchFieldDefinition } from "../switch-field";
import { textareaFieldDefinition } from "../textarea-field";
import { textfieldDefinition } from "../textfield";
import { MobileAlertBlock } from "./alert-block";
import { MobileButton } from "./button";
import { MobileCheckboxGroupInput } from "./checkbox-group";
import { MobileDateInput } from "./date";
import { MobileDateRangeInput } from "./daterange";
import { MobileDatetimeInput } from "./datetime";
import { MobileDivider } from "./divider";
import { MobileNumber } from "./number";
import { MobileParagraph } from "./paragraph";
import { MobileRadioInput } from "./radio";
import { MobileSelectInput } from "./select";
import { MobileSwitch } from "./switch";
import { MobileTextarea } from "./textarea";
import { MobileTextfield } from "./textfield";

/**
 * Build a mobile field definition from its PC counterpart: the `config`
 * (type / palette group / factory) and `properties` (property-panel descriptors)
 * are the shared, device-agnostic contract, so only the rendered `Component` is
 * swapped for the antd-mobile control.
 */
function mobileDefinition<TField extends FormField, TValue>(
  base: FieldDefinition,
  Component: FC<FieldComponentProps<TField, TValue>>
): FieldDefinition {
  return defineFieldDefinition<TField, TValue>({
    config: base.config,
    Component,
    properties: base.properties
  });
}

/**
 * The mobile field set: antd-mobile leaf renderers reusing each PC field's
 * config + properties, plus the structural containers reused as-is (their
 * per-device look comes from the container chrome, not here). `code-editor` is
 * intentionally absent — the PC→mobile converter maps it to a textarea, and a
 * code editor is not a mobile control.
 */
export const mobileFieldDefinitions: FieldDefinition[] = [
  mobileDefinition<TextfieldField, string>(textfieldDefinition, MobileTextfield),
  mobileDefinition<TextareaField, string>(textareaFieldDefinition, MobileTextarea),
  mobileDefinition<NumberField, number | undefined>(numberFieldDefinition, MobileNumber),
  mobileDefinition<SwitchField, boolean>(switchFieldDefinition, MobileSwitch),
  mobileDefinition<SelectField, string | number | undefined>(selectFieldDefinition, MobileSelectInput),
  mobileDefinition<RadioField, string | number | undefined>(radioFieldDefinition, MobileRadioInput),
  mobileDefinition<CheckboxGroupField, Array<string | number>>(checkboxGroupFieldDefinition, MobileCheckboxGroupInput),
  mobileDefinition<DateField, string>(dateFieldDefinition, MobileDateInput),
  mobileDefinition<DatetimeField, string>(datetimeFieldDefinition, MobileDatetimeInput),
  mobileDefinition<DateRangeField, string[]>(dateRangeFieldDefinition, MobileDateRangeInput),
  mobileDefinition<ButtonField, undefined>(buttonDefinition, MobileButton),
  mobileDefinition<DividerField, undefined>(dividerDefinition, MobileDivider),
  mobileDefinition<AlertBlockField, undefined>(alertBlockDefinition, MobileAlertBlock),
  mobileDefinition<ParagraphField, undefined>(paragraphDefinition, MobileParagraph),
  sectionDefinition,
  tabsDefinition,
  subformDefinition,
  flexDefinition,
  gridDefinition
];
