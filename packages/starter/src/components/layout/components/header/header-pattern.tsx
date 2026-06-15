import { css } from "@emotion/react";

// Scattered shallow circular segments: each is a true circle pushed mostly past the bar edge so only
// a low cap (cut well inside the radius, not through the center) shows — a calm sliver rather than a
// bold half-dome. Toward the center a deliberate big + small pair overlaps, and where they cross the
// translucent fills stack into a deeper crescent. Sizes, caps and gaps are otherwise uneven. The
// fill is a faint tint of the header's own foreground via currentColor, so it adapts to light/dark
// and any theme primary on its own. Behind the content (z-index: -1; the header is a stacking
// context), so it never touches the logo / menu / actions.
const patternStyle = css({
  position: "absolute",
  inset: 0,
  zIndex: -1,
  overflow: "hidden",
  pointerEvents: "none",
  "html.dark &": {
    // Ease the whole accent back on the deep surface so it stays a whisper.
    opacity: 0.8
  }
});

const shapeStyle = css({
  position: "absolute",
  borderRadius: "50%",
  backgroundColor: "color-mix(in srgb, currentColor 6%, transparent)"
});

// size = circle diameter; offset pushes most of the circle past the edge so only a shallow cap
// (size + offset px tall) is left on the bar. The 52% / 56% pair overlaps on purpose; the rest are
// spread with uneven sizes and gaps.
const SHAPES = [
  {
    left: "29%",
    place: "top",
    size: 80,
    offset: -60
  },
  {
    left: "52%",
    place: "bottom",
    size: 224,
    offset: -192
  },
  {
    left: "56%",
    place: "bottom",
    size: 92,
    offset: -68
  },
  {
    left: "79%",
    place: "top",
    size: 156,
    offset: -130
  }
] as const;

export function HeaderPattern(): React.JSX.Element {
  return (
    <div css={patternStyle}>
      {SHAPES.map(shape => (
        <div
          key={`${shape.left}-${shape.place}`}
          css={shapeStyle}
          style={{
            left: shape.left,
            width: shape.size,
            height: shape.size,
            transform: "translateX(-50%)",
            ...shape.place === "bottom" ? { bottom: shape.offset } : { top: shape.offset }
          }}
        />
      ))}
    </div>
  );
}
