import type { ConversionReport } from "../engine/conversion";
import type { DeviceRegistries } from "../engine/registry/form-field-registry";
import type { FormEditorStoreApi } from "../store/form-store";
import type { KeyedNodeUnion } from "../types";

import { collectLostBindings, convertPresentation, createDefaultConversionRules } from "../engine/conversion";
import { nodeLabel } from "../engine/schema/walk";
import { DialogLines, UNDOABLE_FOOTNOTE } from "./dialog-lines";
import { confirmDialog, infoDialog, notify } from "./toolbar/notify";

// The PC → mobile conversion rules are stateless, so one shared instance serves
// every sync.
const CONVERSION_RULES = createDefaultConversionRules();

/**
 * Rebuild the mobile presentation from the PC design. Seeds an undesigned or
 * blank mobile outright; a mobile that already holds content is replaced only
 * after a confirmation naming what the replacement loses. Unmappable components
 * are skipped and reported either way.
 */
export function syncMobileFromPc(storeApi: FormEditorStoreApi, registries: DeviceRegistries): void {
  const { pc, mobile } = storeApi.getState().schema.presentations;

  if (pc.children.length === 0) {
    notify("warning", "PC 端还没有内容可同步");
    return;
  }

  const { layer, report } = convertPresentation(pc, CONVERSION_RULES, registries.mobile);
  const commit = (): void => storeApi.getState().replaceMobile(layer);

  if (mobile === undefined || mobile.children.length === 0) {
    commit();
    announceSeed(report);
    return;
  }

  const lines = replacementLines(collectLostBindings(mobile, layer), report);

  confirmDialog("用 PC 端覆盖移动端？", <DialogLines footnote={UNDOABLE_FOOTNOTE} lines={lines} />, {
    onOk: () => {
      commit();
      notify("success", `已从 PC 同步 ${report.convertedCount} 个组件`);
    },
    detail: [...lines, UNDOABLE_FOOTNOTE].join("\n")
  });
}

/**
 * A lossy seed owes the designer the actual casualty list, not just a count —
 * which component, and why it could not come along.
 */
function announceSeed(report: ConversionReport): void {
  if (report.dropped.length === 0) {
    notify("success", `已从 PC 同步 ${report.convertedCount} 个组件`);
    return;
  }

  const lines = droppedLines(report);

  infoDialog(
    `已从 PC 同步 ${report.convertedCount} 个组件，${report.dropped.length} 个无法转换`,
    <DialogLines lines={lines} />,
    lines.join("\n")
  );
}

function replacementLines(lost: KeyedNodeUnion[], report: ConversionReport): string[] {
  const lines = ["移动端现有的布局、控件属性和联动将全部替换为 PC 端的内容"];

  if (lost.length > 0) {
    const names = lost.map(node => `「${nodeLabel(node) ?? node.key}」`).join("、");

    lines.push(`${names}在 PC 端没有可同步的对应字段，将从移动端删除`);
  }

  return [...lines, ...droppedLines(report)];
}

function droppedLines(report: ConversionReport): string[] {
  return report.dropped.map(item => `「${item.label ?? item.sourceType}」：${item.reason}`);
}
