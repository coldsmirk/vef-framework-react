import type { ColumnDataType, DateGranularity, DynamicValue, RemoteDataSourceRequest, RemoteOptionMapping } from "@vef-framework-react/form-editor";

import type {
  ApprovalFieldKind,
  ApprovalFieldOption,
  ApprovalFieldOptionSource,
  ApprovalFormField,
  ApprovalTableFixedRows
} from "./contract";
import type { ProjectionIssue } from "./issues";

import {
  issueCrossDeviceKindMismatch,
  issueCrossDeviceOptionsMismatch,
  issueCrossDeviceStorageMismatch,
  issueCrossDeviceTableMismatch,
  issueCrossDeviceTableRowsMismatch,
  issueCrossDeviceValidationMismatch
} from "./issues";

/**
 * Projected field without `sortOrder` — the shape `projectLeaf` and
 * `projectSubform` emit before final list assembly.
 */
export type ProjectedApprovalField = Omit<ApprovalFormField, "sortOrder">;

/**
 * Compare two projected field definitions (PC vs mobile) for data-contract
 * equality, ignoring purely presentational attributes (`label`, `placeholder`,
 * `sortOrder`, `validation.message`, `fixedRows.headerLabel`, and detail-table
 * column order). Appends every detected contract conflict to `issues`.
 *
 * Mirrors `compareFieldContracts` in Go
 * `internal/approval/formeditor/contract_compare.go`.
 */
export function compareFieldContracts(
  path: string,
  pc: ProjectedApprovalField,
  mobile: ProjectedApprovalField,
  issues: ProjectionIssue[]
): void {
  const pcGranularity = effectiveFieldGranularity(pc);
  const mobileGranularity = effectiveFieldGranularity(mobile);
  const pcMultiple = pc.isMultiple === true;
  const mobileMultiple = mobile.isMultiple === true;

  if (pc.kind !== mobile.kind || pcMultiple !== mobileMultiple || pcGranularity !== mobileGranularity) {
    issues.push(
      issueCrossDeviceKindMismatch(
        path,
        describeFieldShape(pc.kind, pcMultiple, pcGranularity),
        describeFieldShape(mobile.kind, mobileMultiple, mobileGranularity)
      )
    );

    return;
  }

  if (pc.kind === "table") {
    compareTableContracts(path, pc, mobile, issues);

    return;
  }

  if (!optionsContractEqual(pc, mobile)) {
    issues.push(issueCrossDeviceOptionsMismatch(path));
  }

  const validationEqual = validationContractEqual(pc, mobile);

  if (!validationEqual) {
    issues.push(issueCrossDeviceValidationMismatch(path));
  }

  if (!storageContractEqual(pc, mobile) && !isMaxLengthDerivedColumnTypeDiff(validationEqual, pc, mobile)) {
    issues.push(
      issueCrossDeviceStorageMismatch(
        path,
        describeStorageShape(pc.columnType, pc.scale),
        describeStorageShape(mobile.columnType, mobile.scale)
      )
    );
  }
}

function compareTableContracts(
  path: string,
  pc: ProjectedApprovalField,
  mobile: ProjectedApprovalField,
  issues: ProjectionIssue[]
): void {
  if (!fixedRowsContractEqual(pc.fixedRows, mobile.fixedRows)) {
    issues.push(issueCrossDeviceTableRowsMismatch(path));

    return;
  }

  if (!validationContractEqual(pc, mobile)) {
    issues.push(issueCrossDeviceValidationMismatch(path));
  }

  const pcColumns = pc.columns ?? [];
  const mobileColumns = mobile.columns ?? [];
  const mobileByKey = new Map(mobileColumns.map(column => [column.key, column]));

  if (pcColumns.length !== mobileColumns.length || pcColumns.some(column => !mobileByKey.has(column.key))) {
    issues.push(issueCrossDeviceTableMismatch(path));

    return;
  }

  for (const pcColumn of pcColumns) {
    const mobileColumn = mobileByKey.get(pcColumn.key);

    if (mobileColumn !== undefined) {
      compareFieldContracts(`${path}.${pcColumn.key}`, pcColumn, mobileColumn, issues);
    }
  }
}

function effectiveFieldGranularity(field: ProjectedApprovalField): DateGranularity | undefined {
  if (field.kind === "date" || field.kind === "daterange") {
    return field.granularity ?? "day";
  }

  return undefined;
}

/**
 * Format a projected kind + multiplicity / granularity for cross-device
 * diagnostics, mirroring `describeFieldShape` in Go
 * `internal/approval/formeditor/contract_compare.go`.
 */
function describeFieldShape(
  kind: ApprovalFieldKind,
  isMultiple: boolean,
  granularity: DateGranularity | undefined
): string {
  if (kind === "select" && isMultiple) {
    return `${kind} (multiple)`;
  }

  if ((kind === "date" || kind === "daterange") && granularity !== undefined && granularity !== "day") {
    return `${kind} (${granularity})`;
  }

  return kind;
}

function describeStorageShape(columnType: ColumnDataType | undefined, scale: number | undefined): string {
  if (columnType === undefined) {
    return "default";
  }

  if (columnType === "decimal" && scale !== undefined && scale > 0) {
    return `${columnType}(${scale})`;
  }

  return columnType;
}

function fixedRowsContractEqual(
  a: ApprovalTableFixedRows | undefined,
  b: ApprovalTableFixedRows | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }

  // `headerLabel` is purely presentational and deliberately excluded.
  return a.itemKey === b.itemKey
    && optionListEqual(a.items, b.items)
    && optionSourceEqual(a.source, b.source);
}

function optionsContractEqual(a: ProjectedApprovalField, b: ProjectedApprovalField): boolean {
  return optionListEqual(a.options, b.options) && optionSourceEqual(a.optionSource, b.optionSource);
}

function optionListEqual(
  a: ApprovalFieldOption[] | undefined,
  b: ApprovalFieldOption[] | undefined
): boolean {
  const left = a ?? [];
  const right = b ?? [];

  if (left.length !== right.length) {
    return false;
  }

  for (const [index, leftItem] of left.entries()) {
    const rightItem = right[index]!;

    if (leftItem.label !== rightItem.label || !equalJSONValue(leftItem.value, rightItem.value)) {
      return false;
    }
  }

  return true;
}

function optionSourceEqual(
  a: ApprovalFieldOptionSource | undefined,
  b: ApprovalFieldOptionSource | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }

  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === "codeSet") {
    return (a.codeSet ?? "") === (b.codeSet ?? "");
  }

  if (a.kind === "remote") {
    return remoteRequestEqual(a.request, b.request) && remoteMappingEqual(a.mapping, b.mapping);
  }

  return (a.codeSet ?? "") === (b.codeSet ?? "")
    && remoteRequestEqual(a.request, b.request)
    && remoteMappingEqual(a.mapping, b.mapping);
}

function remoteRequestEqual(
  a: RemoteDataSourceRequest | undefined,
  b: RemoteDataSourceRequest | undefined
): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }

  if (a.resource !== b.resource || a.action !== b.action || (a.version ?? "") !== (b.version ?? "")) {
    return false;
  }

  const leftEntries = Object.entries(a.params ?? {});
  const rightParams = b.params ?? {};

  if (leftEntries.length !== Object.keys(rightParams).length) {
    return false;
  }

  for (const [key, leftParam] of leftEntries) {
    if (!Object.hasOwn(rightParams, key)) {
      return false;
    }

    if (!dynamicParamEqual(leftParam, rightParams[key]!)) {
      return false;
    }
  }

  return true;
}

function dynamicParamEqual(a: DynamicValue, b: DynamicValue): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === "literal" && b.kind === "literal") {
    return equalJSONValue(a.value, b.value);
  }

  if (a.kind === "reference" && b.kind === "reference") {
    return a.path === b.path;
  }

  if (a.kind === "expression" && b.kind === "expression") {
    return a.source === b.source;
  }

  return false;
}

function remoteMappingEqual(
  a: RemoteOptionMapping | undefined,
  b: RemoteOptionMapping | undefined
): boolean {
  return (a?.labelKey ?? "") === (b?.labelKey ?? "")
    && (a?.valueKey ?? "") === (b?.valueKey ?? "")
    && (a?.disabledKey ?? "") === (b?.disabledKey ?? "")
    && (a?.descriptionKey ?? "") === (b?.descriptionKey ?? "")
    && (a?.childrenKey ?? "") === (b?.childrenKey ?? "")
    && (a?.parentKey ?? "") === (b?.parentKey ?? "");
}

function validationContractEqual(a: ProjectedApprovalField, b: ProjectedApprovalField): boolean {
  if ((a.isRequired === true) !== (b.isRequired === true)) {
    return false;
  }

  // `message` is presentation copy and deliberately excluded.
  return a.validation?.minLength === b.validation?.minLength
    && a.validation?.maxLength === b.validation?.maxLength
    && a.validation?.min === b.validation?.min
    && a.validation?.max === b.validation?.max
    && (a.validation?.pattern ?? "") === (b.validation?.pattern ?? "");
}

function storageContractEqual(a: ProjectedApprovalField, b: ProjectedApprovalField): boolean {
  return a.columnType === b.columnType && a.scale === b.scale;
}

/**
 * When `validate.maxLength` diverges on a string-family field, `inferColumnType`
 * derives `"string"` vs `"text"` from that length alone. Suppress the redundant
 * secondary storage error so the diagnostic points strictly at the validation
 * conflict that caused it.
 */
function isMaxLengthDerivedColumnTypeDiff(
  validationEqual: boolean,
  pc: ProjectedApprovalField,
  mobile: ProjectedApprovalField
): boolean {
  if (validationEqual || pc.scale !== mobile.scale) {
    return false;
  }

  if (pc.validation?.maxLength === mobile.validation?.maxLength) {
    return false;
  }

  return (pc.columnType === "string" || pc.columnType === "text")
    && (mobile.columnType === "string" || mobile.columnType === "text");
}

function equalJSONValue(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  const aIsArray = Array.isArray(a);
  const bIsArray = Array.isArray(b);

  if (aIsArray || bIsArray) {
    if (!aIsArray || !bIsArray || a.length !== b.length) {
      return false;
    }

    for (const [index, element] of a.entries()) {
      if (!equalJSONValue(element, b[index])) {
        return false;
      }
    }

    return true;
  }

  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord).filter(key => aRecord[key] !== undefined);
  const bKeys = Object.keys(bRecord).filter(key => bRecord[key] !== undefined);

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  for (const key of aKeys) {
    if (!Object.hasOwn(bRecord, key) || !equalJSONValue(aRecord[key], bRecord[key])) {
      return false;
    }
  }

  return true;
}
