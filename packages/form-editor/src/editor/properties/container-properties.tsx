import type { DynamicIconName } from "@vef-framework-react/components";
import type { ReactElement } from "react";

import type {
  Block,
  ContainerNode,
  DynamicSubformRows,
  FixedSubformRows,
  FlexAlign,
  FlexJustify,
  FlexNode,
  FormDataSource,
  GapScale,
  GridNode,
  SectionNode,
  SubformNode,
  SubformRows,
  TableSubform,
  TabsNode
} from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input, InputNumber, Popconfirm, ScrollArea, Segmented, Select, Switch } from "@vef-framework-react/components";
import { useState } from "react";

import { createId } from "../../engine/ids";
import { isKeyedNode, nextUniqueKey, sanitizeKey } from "../../engine/keys";
import {
  createDefaultFixedSubformRows,
  DEFAULT_DYNAMIC_ADD_LABEL,
  DEFAULT_FIXED_HEADER_LABEL,
  DEFAULT_FIXED_ITEM_KEY,
  getDynamicSubformRows,
  isFixedSubform
} from "../../engine/schema/subform";
import { walkNodes } from "../../engine/schema/walk";
import { EditorIcon } from "../../icons";
import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { ROW_COLS } from "../../types";
import { removeTabWithConfirm } from "../remove-node-confirm";
import { panelBodyCss } from "../styles";
import { BlockLayoutSection } from "./block-layout-section";
import { ContainerLinkageSection } from "./entries/linkage/container-linkage-section";
import { OptionSourceEditor } from "./entries/options-source";
import { optionSourceHasPayload } from "./entries/options-source/source-mutators";
import { PanelHeader } from "./panel-header";
import { useConfirmableKindSwitch } from "./use-confirmable-kind-switch";

const bodyCss = css({
  display: "flex",
  flexDirection: "column",
  // Matches the field properties body gap (properties-panel) so both panels
  // share one vertical rhythm in the same panel slot.
  gap: 22,
  padding: "22px 20px 24px",
  // Cap the body at the panel width so an intrinsically wide descendant (a code
  // editor, a non-shrinking control row) lays out within the panel instead of
  // widening the scroll viewport's content track — mirrors the field properties
  // body (`bodyInnerCss` in properties-panel).
  contain: "inline-size"
});

const fieldCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 6
});
const labelCss = css({
  fontSize: globalCssVars.fontSize,
  fontWeight: 500,
  color: globalCssVars.colorTextSecondary
});
const hintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});
const tabRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8
});
const linkageDividerCss = css({
  paddingTop: 18,
  borderTop: `1px solid ${globalCssVars.colorBorderSecondary}`
});

const SECTION_VARIANT_OPTIONS: Array<{ label: string; value: SectionNode["variant"] }> = [
  { label: "卡片", value: "card" },
  { label: "折叠面板", value: "collapse" }
];

const GAP_OPTIONS: Array<{ label: string; value: GapScale }> = [
  { label: "小", value: "small" },
  { label: "中", value: "medium" },
  { label: "大", value: "large" }
];

/**
 * Vertical-gap control shared by the stacking containers (section / tabs /
 * subform). Cleared means "inherit the form-level gap" — the body then stacks
 * with whatever the form sets, so only containers that want to differ pin a gap.
 */
function ContainerGapField({ onChange, value }: { onChange: (gap?: GapScale) => void; value: GapScale | undefined }): ReactElement {
  return (
    <div css={fieldCss}>
      <span css={labelCss}>子元素间距</span>

      <Select<GapScale>
        allowClear
        options={GAP_OPTIONS}
        placeholder="跟随表单默认"
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

const CONTAINER_META: Record<ContainerNode["type"], { icon: DynamicIconName; name: string }> = {
  section: { icon: "square", name: "卡片 / 区块" },
  tabs: { icon: "layout-panel-top", name: "标签页" },
  subform: { icon: "table", name: "子表单" },
  flex: { icon: "stretch-horizontal", name: "弹性布局" },
  grid: { icon: "layout-grid", name: "栅格布局" }
};

export interface ContainerPropertiesProps {
  node: ContainerNode;
  /**
   * The container directly owning `node`, resolved by the properties panel's
   * fused tree walk and threaded down so the layout section does not re-walk
   * the tree per keystroke.
   */
  parent: ContainerNode | undefined;
  onClose: () => void;
}

/**
 * Update lens handed to each container editor. `coalesceKey` names the entry
 * being edited so a run of keystrokes in one input folds into a single undo
 * step; discrete actions (selects, switches, add/remove) omit it and get a
 * fresh undo entry each.
 */
type Update = (updater: (node: Block) => Block, coalesceKey?: string) => void;

/**
 * Properties editor for a selected container node. Sections expose title and
 * variant; tabs expose per-tab labels with add/remove; subforms expose label,
 * appearance, and row bounds; every container exposes its linkage rules.
 * Updates flow through the store's `updateBlock`.
 */
export function ContainerProperties({
  node,
  parent,
  onClose
}: ContainerPropertiesProps): ReactElement {
  const storeApi = useFormEditorStoreApi();
  const meta = CONTAINER_META[node.type];

  const update: Update = (updater, coalesceKey) => {
    storeApi.getState().updateBlock(
      { nodeId: node.id, updater },
      coalesceKey === undefined ? undefined : { coalesceKey: `block:${node.id}:${coalesceKey}` }
    );
  };

  return (
    <>
      <PanelHeader icon={<EditorIcon name={meta.icon} />} subtitle={node.id} title={meta.name} onClose={onClose} />

      <ScrollArea css={panelBodyCss} scrollbars="vertical">
        <div css={bodyCss}>
          <BlockLayoutSection node={node} parent={parent} />
          {node.type === "section" ? <SectionEditor section={node} update={update} /> : null}
          {node.type === "tabs" ? <TabsEditor tabs={node} update={update} /> : null}
          {node.type === "subform" ? <SubformEditor subform={node} update={update} /> : null}
          {node.type === "flex" ? <FlexEditor flex={node} update={update} /> : null}
          {node.type === "grid" ? <GridEditor grid={node} update={update} /> : null}

          <div css={linkageDividerCss}>
            <ContainerLinkageSection node={node} />
          </div>
        </div>
      </ScrollArea>
    </>
  );
}

function SectionEditor({ section, update }: { section: SectionNode; update: Update }): ReactElement {
  const patch = (next: Partial<SectionNode>, coalesceKey?: string): void => {
    update(node => node.type === "section" ? { ...node, ...next } : node, coalesceKey);
  };

  return (
    <>
      <div css={fieldCss}>
        <span css={labelCss}>标题</span>

        <Input
          placeholder="区块标题…"
          value={section.title ?? ""}
          onChange={event => patch({ title: event.target.value }, "title")}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>样式</span>

        <Select<SectionNode["variant"]>
          options={SECTION_VARIANT_OPTIONS}
          value={section.variant}
          onChange={variant => patch({ variant })}
        />
      </div>

      <ContainerGapField value={section.gap} onChange={gap => patch({ gap })} />
    </>
  );
}

function TabsEditor({ tabs, update }: { tabs: TabsNode; update: Update }): ReactElement {
  const storeApi = useFormEditorStoreApi();

  const setLabel = (tabId: string, label: string): void => {
    update(node => node.type === "tabs"
      ? { ...node, tabs: node.tabs.map(tab => tab.id === tabId ? { ...tab, label } : tab) }
      : node, `tab:${tabId}:label`);
  };

  // Deleting a tab deletes its whole body, so it goes through the store's
  // removal pipeline (reference prune + selection cleanup) behind the same
  // impact confirmation a control deletion gets — never through `update`, which
  // is a plain tree mutator with no notion of what the subtree referenced.
  const removeTab = (tabId: string): void => {
    removeTabWithConfirm(storeApi, tabs.id, tabId);
  };

  const addTab = (): void => {
    update(node => node.type === "tabs"
      ? {
          ...node,
          tabs: [
            ...node.tabs,
            {
              id: createId("Tab"),
              label: `标签 ${node.tabs.length + 1}`,
              children: []
            }
          ]
        }
      : node);
  };

  const setGap = (gap?: GapScale): void => {
    update(node => node.type === "tabs" ? { ...node, gap } : node);
  };

  return (
    <>
      <div css={fieldCss}>
        <span css={labelCss}>标签</span>

        {tabs.tabs.map(tab => (
          <div key={tab.id} css={tabRowCss}>
            <Input value={tab.label} onChange={event => setLabel(tab.id, event.target.value)} />

            <Button
              aria-label="删除标签"
              disabled={tabs.tabs.length <= 1}
              icon={<EditorIcon name="trash-2" />}
              type="text"
              onClick={() => removeTab(tab.id)}
            />
          </div>
        ))}

        <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={addTab}>
          新增标签
        </Button>
      </div>

      <ContainerGapField value={tabs.gap} onChange={setGap} />
    </>
  );
}

const numberInputStyle = { width: "100%" } as const;

const SUBFORM_VARIANT_OPTIONS: Array<{ label: string; value: SubformNode["variant"] }> = [
  { label: "自由布局", value: "stack" },
  { label: "表格", value: "table" }
];

const SUBFORM_TABLE_SIZE_OPTIONS: Array<{ label: string; value: NonNullable<TableSubform["size"]> }> = [
  { label: "默认", value: "middle" },
  { label: "紧凑", value: "small" },
  { label: "宽松", value: "large" }
];

const SUBFORM_ROW_MODE_OPTIONS: Array<{ label: string; value: SubformRows["mode"] }> = [
  { label: "动态行", value: "dynamic" },
  { label: "固定行", value: "fixed" }
];

const EMPTY_DATA_SOURCES: FormDataSource[] = [];

const switchRowCss = css({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between"
});

function collectSubformTemplateKeys(template: Block[]): Set<string> {
  const used = new Set<string>();

  walkNodes({ children: template }, (node, scope) => {
    if (scope.length === 0 && isKeyedNode(node)) {
      used.add(node.key);
    }
  });

  return used;
}

function SubformEditor({ subform, update }: { subform: SubformNode; update: Update }): ReactElement {
  // The `table` layout is a PC-only concept — mobile renders every subform as a
  // free-layout stack (the runtime degrades `table` to stack there). So mobile
  // design mode hides the layout control and its table-only density / width
  // fields, and shows the stack gap instead: what you configure is what mobile renders.
  const showLayout = useFormEditorStore(state => state.device) === "pc";
  const dataSources = useFormEditorStore(state => state.schema.dataSources ?? EMPTY_DATA_SOURCES);
  const fixed = isFixedSubform(subform) ? subform.rows : undefined;
  const dynamic = getDynamicSubformRows(subform);
  const rowMode: SubformRows["mode"] = fixed ? "fixed" : "dynamic";
  const [itemKeyDraft, setItemKeyDraft] = useState<string | null>(null);

  const patchLabel = (label: string): void => {
    update(node => node.type === "subform" ? { ...node, label } : node, "label");
  };

  const patchDynamic = (next: Partial<Omit<DynamicSubformRows, "mode">>, coalesceKey?: string): void => {
    update(node => {
      if (node.type !== "subform") {
        return node;
      }

      const current = getDynamicSubformRows(node);

      return {
        ...node,
        rows: {
          ...current,
          ...next,
          mode: "dynamic"
        }
      };
    }, coalesceKey);
  };

  const patchFixed = (next: Partial<Omit<FixedSubformRows, "mode">>, coalesceKey?: string): void => {
    update(node => {
      if (node.type !== "subform" || !isFixedSubform(node)) {
        return node;
      }

      return {
        ...node,
        rows: {
          ...node.rows,
          ...next,
          mode: "fixed"
        }
      };
    }, coalesceKey);
  };

  const modeSwitch = useConfirmableKindSwitch<SubformRows["mode"]>({
    current: rowMode,
    needsConfirm: fixed !== undefined && optionSourceHasPayload(fixed.source),
    commit: nextMode => {
      update(node => {
        if (node.type !== "subform") {
          return node;
        }

        if (nextMode === "dynamic") {
          return {
            ...node,
            rows: {
              mode: "dynamic",
              addLabel: DEFAULT_DYNAMIC_ADD_LABEL
            }
          };
        }

        const templateKeys = collectSubformTemplateKeys(node.template);
        const itemKey = nextUniqueKey(templateKeys, DEFAULT_FIXED_ITEM_KEY);

        return {
          ...node,
          rows: createDefaultFixedSubformRows(itemKey)
        };
      });
    }
  });

  const commitItemKey = (): void => {
    if (itemKeyDraft === null || !fixed) {
      return;
    }

    const sanitized = sanitizeKey(itemKeyDraft);
    const templateKeys = collectSubformTemplateKeys(subform.template);
    const nextKey = sanitized.length > 0
      ? templateKeys.has(sanitized) ? nextUniqueKey(templateKeys, sanitized) : sanitized
      : fixed.itemKey;

    if (nextKey !== fixed.itemKey) {
      patchFixed({ itemKey: nextKey });
    }

    setItemKeyDraft(null);
  };

  const setVariant = (variant: SubformNode["variant"]): void => {
    update(node => {
      if (node.type !== "subform" || node.variant === variant) {
        return node;
      }

      // Preserve the other variant's presentation prop (stack `gap` / table
      // `size`) so toggling back restores it; the active variant's renderer
      // ignores the inactive one. The literal `variant` per branch narrows the
      // spread to a concrete union member.
      if (node.variant === "stack") {
        return { ...node, variant: "table" };
      }

      return { ...node, variant: "stack" };
    });
  };

  // No coalesceKey on these: picking a preset / variant is a discrete click —
  // one undo step per pick, matching the Section / Tabs gap selects.
  const setGap = (gap?: GapScale): void => {
    update(node => node.type === "subform" && node.variant === "stack" ? { ...node, gap } : node);
  };

  const setSize = (size: NonNullable<TableSubform["size"]>): void => {
    update(node => node.type === "subform" && node.variant === "table" ? { ...node, size } : node);
  };

  return (
    <>
      <div css={fieldCss}>
        <span css={labelCss}>字段 Key</span>
        <Input disabled value={subform.key} />
        <span css={hintCss}>子表单数据以该 key 绑定为一组记录；暂不支持在此修改</span>
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>标题</span>

        <Input
          placeholder="子表单标题…"
          value={subform.label ?? ""}
          onChange={event => patchLabel(event.target.value)}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>行模式</span>

        <Popconfirm
          cancelText="取消"
          okText="切换"
          open={modeSwitch.pendingKind !== null}
          title="切换为动态行将丢弃当前固定行项目配置"
          onCancel={modeSwitch.cancel}
          onConfirm={modeSwitch.confirm}
        >
          <Segmented
            block
            options={SUBFORM_ROW_MODE_OPTIONS}
            value={rowMode}
            onChange={value => {
              if (value === "dynamic" || value === "fixed") {
                modeSwitch.requestKind(value);
              }
            }}
          />
        </Popconfirm>

        <span css={hintCss}>
          {fixed
            ? "固定行：行项目来自预设/字典/接口，填表人仅填写各列，不可增删行"
            : "动态行：填表人可自由新增或删除行"}
        </span>
      </div>

      {showLayout
        ? (
            <div css={fieldCss}>
              <span css={labelCss}>布局</span>

              <Select<SubformNode["variant"]>
                options={SUBFORM_VARIANT_OPTIONS}
                value={subform.variant}
                onChange={setVariant}
              />

              <span css={hintCss}>
                {subform.variant === "table"
                  ? "表格：每行内联编辑，模板字段即为列（适合规整的多行录入）"
                  : "自由布局：每行铺开全部字段，支持嵌套与按行联动"}
              </span>
            </div>
          )
        : null}

      {fixed
        ? (
            <>
              <div css={fieldCss}>
                <span css={labelCss}>行头列标题</span>

                <Input
                  placeholder={DEFAULT_FIXED_HEADER_LABEL}
                  value={fixed.headerLabel ?? ""}
                  onChange={event => patchFixed({ headerLabel: event.target.value }, "headerLabel")}
                />
              </div>

              {showLayout && subform.variant === "table"
                ? (
                    <div css={fieldCss}>
                      <span css={labelCss}>行头列宽 (px)</span>

                      <InputNumber
                        min={60}
                        placeholder="自动"
                        style={numberInputStyle}
                        value={fixed.headerWidth}
                        onChange={value => {
                          const nextWidth = typeof value === "number" && Number.isFinite(value) && value > 0
                            ? Math.floor(value)
                            : undefined;

                          patchFixed({ headerWidth: nextWidth }, "headerWidth");
                        }}
                      />
                    </div>
                  )
                : null}

              <div css={fieldCss}>
                <span css={labelCss}>行项目 Key (itemKey)</span>

                <Input
                  placeholder={DEFAULT_FIXED_ITEM_KEY}
                  value={itemKeyDraft ?? fixed.itemKey}
                  onBlur={commitItemKey}
                  onChange={event => setItemKeyDraft(event.target.value)}
                  onFocus={() => setItemKeyDraft(fixed.itemKey)}
                  onPressEnter={commitItemKey}
                />

                <span css={hintCss}>每行存储 &#123; value, label &#125; 快照的键名，不能与模板列键名重复</span>
              </div>

              <div css={[fieldCss, switchRowCss]}>
                <span css={labelCss}>必填</span>
                <Switch checked={fixed.required ?? false} onChange={required => patchFixed({ required })} />
              </div>

              <OptionSourceEditor
                allowBulkPaste
                confirmTitle="切换行项目来源将丢弃当前配置"
                dataSources={dataSources}
                label="行项目来源"
                source={fixed.source}
                onChange={source => patchFixed({ source })}
              />
            </>
          )
        : (
            <>
              <div css={fieldCss}>
                <span css={labelCss}>"新增" 按钮文案</span>

                <Input
                  placeholder={DEFAULT_DYNAMIC_ADD_LABEL}
                  value={dynamic.addLabel ?? ""}
                  onChange={event => patchDynamic({ addLabel: event.target.value }, "addLabel")}
                />
              </div>

              <div css={fieldCss}>
                <span css={labelCss}>最少行数</span>

                <InputNumber
                  max={dynamic.max}
                  min={0}
                  style={numberInputStyle}
                  value={dynamic.min}
                  onChange={value => {
                    // No mid-typing clamp: antd fires onChange with out-of-range
                    // values while the user types ("15" fires at "1" then "15") and
                    // clamps against min/max itself on blur — clamping here would
                    // snap the input to a different number under the user's cursor.
                    // The validator flags a transiently inverted min/max until then.
                    patchDynamic({ min: typeof value === "number" ? value : undefined }, "minRows");
                  }}
                />
              </div>

              <div css={fieldCss}>
                <span css={labelCss}>最多行数</span>

                <InputNumber
                  min={Math.max(1, dynamic.min ?? 1)}
                  style={numberInputStyle}
                  value={dynamic.max}
                  onChange={value => {
                    // Mirror of min: rely on the native bounds' blur clamp
                    // instead of snapping the value mid-typing.
                    patchDynamic({ max: typeof value === "number" ? value : undefined }, "maxRows");
                  }}
                />
              </div>
            </>
          )}

      {showLayout && subform.variant === "table"
        ? (
            <div css={fieldCss}>
              <span css={labelCss}>表格密度</span>

              <Select<NonNullable<TableSubform["size"]>>
                options={SUBFORM_TABLE_SIZE_OPTIONS}
                value={subform.size ?? "middle"}
                onChange={setSize}
              />
            </div>
          )
        : subform.variant === "stack"
          ? <ContainerGapField value={subform.gap} onChange={setGap} />
          : null}
    </>
  );
}

const FLEX_DIRECTION_OPTIONS: Array<{ label: string; value: NonNullable<FlexNode["direction"]> }> = [
  { label: "横向排列", value: "row" },
  { label: "纵向排列", value: "column" }
];

const FLEX_JUSTIFY_OPTIONS: Array<{ label: string; value: FlexJustify }> = [
  { label: "起始对齐", value: "start" },
  { label: "居中", value: "center" },
  { label: "末尾对齐", value: "end" },
  { label: "两端对齐", value: "between" },
  { label: "等距分布", value: "around" }
];

const FLEX_ALIGN_OPTIONS: Array<{ label: string; value: FlexAlign }> = [
  { label: "起始", value: "start" },
  { label: "居中", value: "center" },
  { label: "末尾", value: "end" },
  { label: "拉伸填充", value: "stretch" }
];

function FlexEditor({ flex, update }: { flex: FlexNode; update: Update }): ReactElement {
  const patch = (next: Partial<FlexNode>, coalesceKey?: string): void => {
    update(node => node.type === "flex" ? { ...node, ...next } : node, coalesceKey);
  };

  return (
    <>
      <div css={fieldCss}>
        <span css={labelCss}>排列方向</span>

        <Select<NonNullable<FlexNode["direction"]>>
          options={FLEX_DIRECTION_OPTIONS}
          value={flex.direction ?? "row"}
          onChange={direction => patch({ direction })}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>主轴对齐</span>

        <Select<FlexJustify>
          options={FLEX_JUSTIFY_OPTIONS}
          value={flex.justify ?? "start"}
          onChange={justify => patch({ justify })}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>交叉轴对齐</span>

        <Select<FlexAlign>
          options={FLEX_ALIGN_OPTIONS}
          value={flex.align ?? "start"}
          onChange={align => patch({ align })}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>间距 (px)</span>

        <InputNumber
          min={0}
          style={numberInputStyle}
          value={flex.gap}
          onChange={value => patch({ gap: typeof value === "number" ? value : undefined }, "gap")}
        />
      </div>

      <div css={[fieldCss, switchRowCss]}>
        <span css={labelCss}>自动换行</span>
        <Switch checked={flex.wrap ?? false} onChange={wrap => patch({ wrap })} />
      </div>
    </>
  );
}

function GridEditor({ grid, update }: { grid: GridNode; update: Update }): ReactElement {
  const patch = (next: Partial<GridNode>, coalesceKey?: string): void => {
    update(node => node.type === "grid" ? { ...node, ...next } : node, coalesceKey);
  };

  return (
    <>
      <div css={fieldCss}>
        <span css={labelCss}>列数</span>

        <InputNumber
          max={ROW_COLS}
          min={1}
          placeholder="2"
          style={numberInputStyle}
          value={grid.columns}
          onChange={value => patch({ columns: typeof value === "number" ? value : undefined }, "columns")}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>列间距 (px)</span>

        <InputNumber
          min={0}
          style={numberInputStyle}
          value={grid.gap}
          onChange={value => patch({ gap: typeof value === "number" ? value : undefined }, "gap")}
        />
      </div>

      <div css={fieldCss}>
        <span css={labelCss}>行间距 (px)</span>

        <InputNumber
          min={0}
          style={numberInputStyle}
          value={grid.rowGap}
          onChange={value => patch({ rowGap: typeof value === "number" ? value : undefined }, "rowGap")}
        />
      </div>
    </>
  );
}
