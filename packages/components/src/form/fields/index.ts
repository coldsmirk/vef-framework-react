import { AutoCompleteField } from "./auto-complete";
import { BoolField } from "./bool";
import { CascaderField } from "./cascader";
import { CheckboxField, CheckboxGroupField } from "./checkbox";
import { CodeEditorField } from "./code-editor";
import { ColorPickerField } from "./color-picker";
import { DatePickerField } from "./date-picker";
import { DateRangePickerField } from "./date-range-picker";
import { IconPickerField } from "./icon-picker";
import { InputField } from "./input";
import { InputNumberField } from "./input-number";
import { MentionsField } from "./mentions";
import { PasswordField } from "./password";
import { RadioField } from "./radio";
import { RateField } from "./rate";
import { SelectField } from "./select";
import { SliderField } from "./slider";
import { TextAreaField } from "./textarea";
import { TimePickerField } from "./time-picker";
import { TimeRangePickerField } from "./time-range-picker";
import { TransferField } from "./transfer";
import { TreeSelectField } from "./tree-select";
import { UploadField } from "./upload";

export type { AutoCompleteFieldProps } from "./auto-complete";
export type { BoolFieldProps } from "./bool";
export type { CascaderFieldProps } from "./cascader";
export type { CheckboxFieldProps, CheckboxGroupFieldProps } from "./checkbox";
export type { CodeEditorFieldProps } from "./code-editor";
export type { ColorPickerFieldProps } from "./color-picker";
export type { DatePickerFieldProps } from "./date-picker";
export type { DateRangePickerFieldProps } from "./date-range-picker";
export type { IconPickerFieldProps } from "./icon-picker";
export type { InputFieldProps } from "./input";
export type { InputNumberFieldProps } from "./input-number";
export type { MentionsFieldProps } from "./mentions";
export type { RadioFieldProps } from "./radio";
export type { RateFieldProps } from "./rate";
export type { SelectFieldProps } from "./select";
export type { SliderFieldProps } from "./slider";
export type { TextAreaFieldProps } from "./textarea";
export type { TimePickerFieldProps } from "./time-picker";
export type { TimeRangePickerFieldProps } from "./time-range-picker";
export type { TransferFieldProps } from "./transfer";
export type { TreeSelectFieldProps } from "./tree-select";
export type { UploadFieldProps } from "./upload";

export const fieldComponents = {
  AutoComplete: AutoCompleteField,
  Bool: BoolField,
  Cascader: CascaderField,
  Checkbox: CheckboxField,
  CheckboxGroup: CheckboxGroupField,
  CodeEditor: CodeEditorField,
  ColorPicker: ColorPickerField,
  DatePicker: DatePickerField,
  DateRangePicker: DateRangePickerField,
  IconPicker: IconPickerField,
  Input: InputField,
  InputNumber: InputNumberField,
  Mentions: MentionsField,
  Password: PasswordField,
  Radio: RadioField,
  Rate: RateField,
  Select: SelectField,
  Slider: SliderField,
  TextArea: TextAreaField,
  TimePicker: TimePickerField,
  TimeRangePicker: TimeRangePickerField,
  Transfer: TransferField,
  TreeSelect: TreeSelectField,
  Upload: UploadField
} as const;
