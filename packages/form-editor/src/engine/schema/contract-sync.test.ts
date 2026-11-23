import type {
  CheckboxGroupField,
  CodeEditorField,
  DateField,
  MultiSelectField,
  NumberField,
  RadioField,
  SelectField,
  SubformNode,
  TextareaField,
  TextfieldField,
  UploadField
} from "../../types";

import { hasNodeContractChange, syncNodeContractToTwin } from "./contract-sync";

describe("contract-sync", () => {
  describe("leaf fields", () => {
    it("ignores purely presentational edits and preserves twin identity", () => {
      const before: TextfieldField = {
        id: "P1",
        type: "textfield",
        key: "name",
        label: "PC 姓名",
        placeholder: "请输入"
      };
      const after: TextfieldField = {
        ...before,
        label: "真实姓名",
        placeholder: "填写姓名",
        helperText: "帮助",
        size: "large",
        allowClear: true
      };
      const twin: TextfieldField = {
        id: "M1",
        type: "textfield",
        key: "name",
        label: "姓名"
      };

      expect(hasNodeContractChange(before, after)).toBe(false);
      expect(syncNodeContractToTwin(before, after, twin)).toBe(twin);
    });

    it("syncs validation rules and drops cleared undefined entries", () => {
      const before: TextfieldField = {
        id: "P1",
        type: "textfield",
        key: "code",
        label: "编码",
        validate: { required: true, minLength: 4 }
      };
      const after: TextfieldField = {
        ...before,
        validate: {
          required: true,
          minLength: undefined,
          maxLength: 12,
          pattern: "^[A-Z0-9]+$"
        }
      };
      const twin: TextfieldField = {
        id: "M1",
        type: "textfield",
        key: "code",
        label: "手机编码",
        validate: { required: true, minLength: 4 }
      };

      const synced = syncNodeContractToTwin(before, after, twin) as TextfieldField;

      expect(synced.label).toBe("手机编码");
      expect(synced.validate).toEqual({
        required: true,
        maxLength: 12,
        pattern: "^[A-Z0-9]+$"
      });
      expect("minLength" in (synced.validate ?? {})).toBe(false);
    });

    it("syncs validation rules between code-editor and textarea twins", () => {
      const before: CodeEditorField = {
        id: "P1",
        type: "code-editor",
        key: "script",
        label: "脚本"
      };
      const after: CodeEditorField = {
        ...before,
        validate: { required: true, maxLength: 2000 }
      };
      const twin: TextareaField = {
        id: "M1",
        type: "textarea",
        key: "script",
        label: "脚本内容"
      };

      const synced = syncNodeContractToTwin(before, after, twin) as TextareaField;

      expect(synced.type).toBe("textarea");
      expect(synced.label).toBe("脚本内容");
      expect(synced.validate).toEqual({ required: true, maxLength: 2000 });
    });

    it("syncs option sources (static, ref, remote, codeSet) across compatible single/multi choice twins", () => {
      const beforeSelect: SelectField = {
        id: "P1",
        type: "select",
        key: "grade",
        dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
      };
      const afterSelect: SelectField = {
        ...beforeSelect,
        dataSource: {
          kind: "static",
          options: [
            { label: "甲", value: "a" },
            { label: "乙", value: "b" }
          ]
        },
        columnType: "string"
      };
      const radioTwin: RadioField = {
        id: "M1",
        type: "radio",
        key: "grade",
        label: "移动端等级",
        direction: "horizontal",
        dataSource: { kind: "static", options: [{ label: "A", value: "a" }] }
      };

      const syncedRadio = syncNodeContractToTwin(beforeSelect, afterSelect, radioTwin) as RadioField;

      expect(syncedRadio.type).toBe("radio");
      expect(syncedRadio.label).toBe("移动端等级");
      expect(syncedRadio.direction).toBe("horizontal");
      expect(syncedRadio.dataSource).toEqual(afterSelect.dataSource);
      expect(syncedRadio.columnType).toBe("string");

      const beforeMulti: MultiSelectField = {
        id: "P2",
        type: "multi-select",
        key: "tags",
        dataSource: { kind: "codeSet", codeSet: "old.tags" }
      };
      const afterMulti: MultiSelectField = {
        ...beforeMulti,
        dataSource: { kind: "codeSet", codeSet: "new.tags" }
      };
      const checkboxTwin: CheckboxGroupField = {
        id: "M2",
        type: "checkbox-group",
        key: "tags",
        dataSource: { kind: "codeSet", codeSet: "old.tags" }
      };

      const syncedCheckbox = syncNodeContractToTwin(beforeMulti, afterMulti, checkboxTwin) as CheckboxGroupField;

      expect(syncedCheckbox.dataSource).toEqual({ kind: "codeSet", codeSet: "new.tags" });
    });

    it("syncs number precision, columnType, date granularity, and upload maxCount", () => {
      const beforeNum: NumberField = {
        id: "P1",
        type: "number",
        key: "amount"
      };
      const afterNum: NumberField = {
        ...beforeNum,
        precision: 2,
        columnType: "decimal"
      };
      const twinNum: NumberField = {
        id: "M1",
        type: "number",
        key: "amount",
        prefix: "¥"
      };

      const syncedNum = syncNodeContractToTwin(beforeNum, afterNum, twinNum) as NumberField;

      expect(syncedNum.prefix).toBe("¥");
      expect(syncedNum.precision).toBe(2);
      expect(syncedNum.columnType).toBe("decimal");

      const beforeDate: DateField = {
        id: "P2",
        type: "date",
        key: "period"
      };
      const afterDate: DateField = { ...beforeDate, granularity: "month" };
      const twinDate: DateField = {
        id: "M2",
        type: "date",
        key: "period"
      };

      expect((syncNodeContractToTwin(beforeDate, afterDate, twinDate) as DateField).granularity).toBe("month");

      const beforeUpload: UploadField = {
        id: "P3",
        type: "upload",
        key: "files",
        maxCount: 1
      };
      const afterUpload: UploadField = { ...beforeUpload, maxCount: 5 };
      const twinUpload: UploadField = {
        id: "M3",
        type: "upload",
        key: "files",
        maxCount: 1,
        dragger: true
      };

      const syncedUpload = syncNodeContractToTwin(beforeUpload, afterUpload, twinUpload) as UploadField;

      expect(syncedUpload.maxCount).toBe(5);
      expect(syncedUpload.dragger).toBe(true);
    });

    it("leaves incompatible field types untouched", () => {
      const before: TextfieldField = {
        id: "P1",
        type: "textfield",
        key: "value"
      };
      const after: TextfieldField = { ...before, validate: { required: true } };
      const twin: NumberField = {
        id: "M1",
        type: "number",
        key: "value"
      };

      expect(syncNodeContractToTwin(before, after, twin)).toBe(twin);
    });
  });

  describe("subform rows", () => {
    it("syncs fixed-row contract properties while preserving twin headerLabel, headerWidth, label, and variant", () => {
      const before: SubformNode = {
        id: "P-Sub",
        type: "subform",
        variant: "table",
        key: "checks",
        label: "PC 自查表",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "PC 行头",
          headerWidth: 240,
          required: true,
          source: { kind: "static", options: [{ label: "项1", value: "1" }] }
        },
        template: []
      };
      const after: SubformNode = {
        ...before,
        rows: {
          mode: "fixed",
          itemKey: "clause",
          headerLabel: "PC 行头",
          headerWidth: 240,
          required: false,
          source: {
            kind: "static",
            options: [
              { label: "项1-更新", value: "1" },
              { label: "项2", value: "2" }
            ]
          }
        }
      };
      const twin: SubformNode = {
        id: "M-Sub",
        type: "subform",
        variant: "stack",
        key: "checks",
        label: "移动端自查",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "移动端行头",
          headerWidth: 160,
          required: true,
          source: { kind: "static", options: [{ label: "项1", value: "1" }] }
        },
        template: []
      };

      const synced = syncNodeContractToTwin(before, after, twin) as SubformNode;

      expect(synced.label).toBe("移动端自查");
      expect(synced.variant).toBe("stack");
      expect(synced.rows).toEqual({
        mode: "fixed",
        itemKey: "clause",
        headerLabel: "移动端行头",
        headerWidth: 160,
        required: false,
        source: {
          kind: "static",
          options: [
            { label: "项1-更新", value: "1" },
            { label: "项2", value: "2" }
          ]
        }
      });
    });

    it("ignores presentation-only subform edits (headerLabel, headerWidth, addLabel, label, variant)", () => {
      const beforeFixed: SubformNode = {
        id: "P-Sub",
        type: "subform",
        variant: "table",
        key: "checks",
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "旧行头",
          source: { kind: "static", options: [{ label: "项1", value: "1" }] }
        },
        template: []
      };
      const afterFixed: SubformNode = {
        ...beforeFixed,
        label: "新标题",
        rows: {
          ...beforeFixed.rows!,
          mode: "fixed",
          itemKey: "item",
          headerLabel: "新行头",
          headerWidth: 300,
          source: { kind: "static", options: [{ label: "项1", value: "1" }] }
        }
      };
      const twinFixed: SubformNode = {
        ...beforeFixed,
        id: "M-Sub",
        variant: "stack"
      };

      expect(hasNodeContractChange(beforeFixed, afterFixed)).toBe(false);
      expect(syncNodeContractToTwin(beforeFixed, afterFixed, twinFixed)).toBe(twinFixed);

      const beforeDynamic: SubformNode = {
        id: "P-Dyn",
        type: "subform",
        variant: "stack",
        key: "lines",
        rows: {
          mode: "dynamic",
          min: 1,
          addLabel: "新增"
        },
        template: []
      };
      const afterDynamic: SubformNode = {
        ...beforeDynamic,
        rows: {
          mode: "dynamic",
          min: 1,
          addLabel: "添加一行"
        }
      };
      const twinDynamic: SubformNode = { ...beforeDynamic, id: "M-Dyn" };

      expect(hasNodeContractChange(beforeDynamic, afterDynamic)).toBe(false);
      expect(syncNodeContractToTwin(beforeDynamic, afterDynamic, twinDynamic)).toBe(twinDynamic);
    });

    it("syncs dynamic min/max and dynamic <-> fixed mode switches without leaking display copy", () => {
      const before: SubformNode = {
        id: "P-Sub",
        type: "subform",
        variant: "table",
        key: "lines",
        rows: {
          mode: "dynamic",
          min: 1,
          addLabel: "PC新增"
        },
        template: []
      };
      const afterBounds: SubformNode = {
        ...before,
        rows: {
          mode: "dynamic",
          min: 2,
          max: 5,
          addLabel: "PC新增"
        }
      };
      const twin: SubformNode = {
        id: "M-Sub",
        type: "subform",
        variant: "stack",
        key: "lines",
        rows: {
          mode: "dynamic",
          min: 1,
          addLabel: "移动端新增"
        },
        template: []
      };

      const syncedBounds = syncNodeContractToTwin(before, afterBounds, twin) as SubformNode;

      expect(syncedBounds.rows).toEqual({
        mode: "dynamic",
        min: 2,
        max: 5,
        addLabel: "移动端新增"
      });

      const afterFixed: SubformNode = {
        ...before,
        rows: {
          mode: "fixed",
          itemKey: "item",
          headerLabel: "PC专属行头",
          headerWidth: 200,
          required: true,
          source: { kind: "codeSet", codeSet: "hosp.check" }
        }
      };

      const syncedFixed = syncNodeContractToTwin(before, afterFixed, twin) as SubformNode;

      expect(syncedFixed.rows).toEqual({
        mode: "fixed",
        itemKey: "item",
        required: true,
        source: { kind: "codeSet", codeSet: "hosp.check" }
      });

      const afterBackToDynamic: SubformNode = {
        ...afterFixed,
        rows: { mode: "dynamic", addLabel: "新增一行" }
      };

      const syncedBackToDynamic = syncNodeContractToTwin(afterFixed, afterBackToDynamic, syncedFixed) as SubformNode;

      expect(syncedBackToDynamic.rows).toEqual({ mode: "dynamic" });
    });
  });
});
