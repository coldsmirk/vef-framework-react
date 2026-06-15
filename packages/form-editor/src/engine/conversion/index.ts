import type { Block, PresentationLayer, TextareaField } from "../../types";
import type { FormFieldRegistry } from "../registry/form-field-registry";

import { cloneBlock } from "../schema/edit-ops";
import { containerBodies, withContainerBodies } from "../schema/nodes";
import { isContainerNode, nodeLabel } from "../schema/walk";

/**
 * Best-effort conversion of a PC design into a mobile one. The rule set is the
 * single extension point: a rule decides, per source block type, whether the
 * block converts (kept, layout stripped), unwraps (its body blocks splice
 * inline — for layout-only containers a phone cannot honour), or is dropped (no
 * mobile equivalent). The walker reflows everything into a single column and
 * reports what it could not carry over.
 */

/**
 * Outcome of converting one source block toward the mobile registry.
 */
export type BlockConversion
  = | { status: "converted"; block: Block }
    | { status: "unwrapped"; blocks: Block[] }
    | { status: "dropped"; sourceType: string; reason: string };

export interface ConversionContext {
  /**
   * The target (mobile) registry — rules consult it to decide whether a type
   * exists on mobile.
   */
  target: FormFieldRegistry;
  /**
   * Recursively convert a block-list (a container's body). Reflows it to a
   * single column, the same as the top level.
   */
  convertBlocks: (blocks: Block[]) => Block[];
}

/**
 * Converts one source block type into a mobile block. Registered by `type` on a
 * {@link ConversionRegistry}; an unregistered type falls back to identity (kept
 * if the mobile registry has it, dropped otherwise).
 */
export interface BlockConversionRule {
  type: Block["type"];
  convert: (source: Block, ctx: ConversionContext) => BlockConversion;
}

/**
 * What a conversion carried over and what it dropped, surfaced to the user after
 * a one-click convert.
 */
export interface ConversionReport {
  convertedCount: number;
  dropped: Array<{ sourceType: string; reason: string; label?: string }>;
}

/**
 * Strip a block's layout sizing (`span` / `flex`) so it fills its own slot in
 * the single-column mobile reflow. The cast restores the concrete kind a
 * discriminated-union spread widens away — the same necessary pattern as
 * edit-ops' `patchBlock`, kept local here because the layout-strip is generic
 * over `T` (callers rely on the narrowed return), which `patchBlock`'s
 * `Partial<T>` patch cannot express without a second cast.
 */
function withoutLayout<T extends Block>(block: T): T {
  return {
    ...block,
    span: undefined,
    flex: undefined
  } as T;
}

/**
 * Whether the block carries linkage behavior (rules or defaults) that would
 * be lost if the block itself does not survive the conversion.
 */
function carriesLinkage(block: Block): boolean {
  return block.linkage !== undefined
    && ((block.linkage.rules?.length ?? 0) > 0 || block.linkage.defaults !== undefined);
}

/**
 * Default rule: keep the block's type when the mobile registry has it (layout
 * stripped), drop it otherwise. A kept container still recurses its bodies
 * through the conversion pipeline, so a rule set without container rules can
 * never smuggle an unconverted (still multi-column) body across. Used for any
 * type without a registered rule.
 */
function identityConvert(block: Block, ctx: ConversionContext): BlockConversion {
  if (!ctx.target.has(block.type)) {
    return {
      status: "dropped",
      sourceType: block.type,
      reason: "移动端无对应组件"
    };
  }

  const kept = withoutLayout(block);

  return {
    status: "converted",
    block: isContainerNode(kept)
      ? withContainerBodies(kept, containerBodies(kept).map(body => ctx.convertBlocks(body)))
      : kept
  };
}

/**
 * A registry of {@link BlockConversionRule}s keyed by source type. Injectable so
 * custom field authors can register conversions alongside their fields.
 */
export class ConversionRegistry {
  private readonly rules = new Map<string, BlockConversionRule>();

  register(rule: BlockConversionRule): this {
    this.rules.set(rule.type, rule);

    return this;
  }

  convert(block: Block, ctx: ConversionContext): BlockConversion {
    const rule = this.rules.get(block.type);

    return rule ? rule.convert(block, ctx) : identityConvert(block, ctx);
  }
}

/**
 * Convert a PC presentation into a mobile one. Reflows to a single column (each
 * kept block stacked full-width), recurses container bodies, and regenerates
 * every node id (keys preserved) so the mobile tree owns an independent id
 * space. Returns the new layer plus a {@link ConversionReport}.
 */
export function convertPresentation(
  pc: PresentationLayer,
  rules: ConversionRegistry,
  target: FormFieldRegistry
): { layer: PresentationLayer; report: ConversionReport } {
  const report: ConversionReport = { convertedCount: 0, dropped: [] };

  // `convertBlocks` is hoisted, so the forward reference here is legal; the
  // context IS the recursion seam, named directly rather than wrapped in a
  // forwarding arrow.
  const ctx: ConversionContext = { target, convertBlocks };

  function convertBlocks(blocks: Block[]): Block[] {
    const out: Block[] = [];

    for (const block of blocks) {
      const result = rules.convert(block, ctx);

      if (result.status === "converted") {
        out.push(result.block);
        report.convertedCount += 1;
      } else if (result.status === "unwrapped") {
        out.push(...result.blocks);

        // The unwrapped container's body survives, but the container's own
        // linkage (visibility rules / defaults) has no node left to live on —
        // report the loss instead of pretending a clean conversion.
        if (carriesLinkage(block)) {
          report.dropped.push({
            sourceType: block.type,
            reason: "布局容器被展开，容器自身的联动规则与默认值未迁移",
            label: nodeLabel(block)
          });
        }
      } else {
        report.dropped.push({
          sourceType: result.sourceType,
          reason: result.reason,
          label: nodeLabel(block)
        });
      }
    }

    return out;
  }

  const converted = convertBlocks(pc.children);

  return {
    // Regenerate ids on the final tree (keys preserved) so the mobile and pc
    // presentations never share node ids. The form-level rhythm preset (`gap`)
    // carries over: the reflow restructures blocks, not the document rhythm.
    layer: {
      ...pc.gap === undefined ? {} : { gap: pc.gap },
      children: converted.map(block => freshenBlock(block))
    },
    report
  };
}

function freshenBlock(block: Block): Block {
  return cloneBlock(block, null);
}

/**
 * Recurse a container's bodies through the converter and keep the container
 * shell (its chrome — title / variant / tabs / key). Used for the structural
 * containers (section / tabs / subform) that remain meaningful on mobile.
 */
function convertStructuralContainer(source: Block, ctx: ConversionContext): BlockConversion {
  if (!isContainerNode(source)) {
    return identityConvert(source, ctx);
  }

  const bodies = containerBodies(source).map(blocks => ctx.convertBlocks(blocks));

  return { status: "converted", block: withContainerBodies(withoutLayout(source), bodies) };
}

/**
 * The built-in conversion rules covering the framework's container and
 * desktop-only field types. Everything else falls back to identity.
 *
 * - `section` / `subform` / `tabs` keep their shell and convert their bodies.
 * - `flex` / `grid` are pure desktop layout, so they unwrap — their (converted)
 * body blocks splice inline and the container itself is dropped.
 * - `code-editor` has no mobile control, so it degrades to a `textarea`,
 * preserving the keyed binding rather than dropping the field.
 */
export function createDefaultConversionRules(): ConversionRegistry {
  return new ConversionRegistry()
    .register({ type: "section", convert: convertStructuralContainer })
    .register({ type: "subform", convert: convertStructuralContainer })
    .register({ type: "tabs", convert: convertStructuralContainer })
    .register({ type: "flex", convert: unwrapContainer })
    .register({ type: "grid", convert: unwrapContainer })
    .register({ type: "code-editor", convert: convertCodeEditor });
}

function unwrapContainer(source: Block, ctx: ConversionContext): BlockConversion {
  const bodies = isContainerNode(source) ? containerBodies(source) : [];

  return { status: "unwrapped", blocks: ctx.convertBlocks(bodies.flat()) };
}

function convertCodeEditor(source: Block, ctx: ConversionContext): BlockConversion {
  if (source.type !== "code-editor") {
    return identityConvert(source, ctx);
  }

  if (!ctx.target.has("textarea")) {
    return {
      status: "dropped",
      sourceType: "code-editor",
      reason: "移动端无对应组件"
    };
  }

  // Carry the whole shared shape (base + keyed + validatable + placeholder /
  // helperText / linkage) by spreading, dropping only the three code-editor-only
  // fields TextareaField lacks; withoutLayout strips span/flex for the reflow.
  // Listing the kept fields by hand silently dropped any field later added to
  // the shared base — the spread keeps them in lockstep.
  const textarea: TextareaField = withoutLayout({
    ...source,
    type: "textarea",
    language: undefined,
    minHeight: undefined,
    showLineNumbers: undefined
  } as TextareaField);

  return { status: "converted", block: textarea };
}
