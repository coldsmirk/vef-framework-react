import type { JSX } from "react";

import { css } from "@emotion/react";

interface ContourPatternProps {
  isSidebarCollapsed?: boolean;
}

const TAU = Math.PI * 2;

/**
 * Shared radial waviness for the contour family. Every ring scales the same
 * profile, so the family nests without crossing; the small per-ring phase
 * drift keeps the spacing organic instead of concentric.
 */
function waviness(theta: number, drift: number): number {
  return 1
    + 0.1 * Math.sin(2 * theta + 0.8 + drift)
    + 0.07 * Math.sin(3 * theta + 2.1 + drift * 1.7)
    + 0.05 * Math.sin(5 * theta + 4.4 - drift);
}

function point([x, y]: readonly [number, number]): string {
  return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
}

/**
 * One closed irregular contour as a smooth SVG path: a wavy polar loop
 * (vertically squashed, like a landform seen at an angle) run through a
 * Catmull-Rom to cubic-bezier conversion.
 */
function contourPath(
  center: readonly [number, number],
  radius: number,
  squash: number,
  drift: number
): string {
  const STEPS = 48;
  const points: Array<readonly [number, number]> = [];

  for (let index = 0; index < STEPS; index++) {
    const theta = (index / STEPS) * TAU;
    const r = radius * waviness(theta, drift);

    points.push([center[0] + r * Math.cos(theta), center[1] + r * Math.sin(theta) * squash]);
  }

  const at = (index: number): readonly [number, number] => points[(index + STEPS) % STEPS]!;
  let path = `M ${point(at(0))}`;

  for (let index = 0; index < STEPS; index++) {
    const previous = at(index - 1);
    const start = at(index);
    const end = at(index + 1);
    const next = at(index + 2);
    const control1: readonly [number, number] = [
      start[0] + (end[0] - previous[0]) / 6,
      start[1] + (end[1] - previous[1]) / 6
    ];
    const control2: readonly [number, number] = [
      end[0] - (next[0] - start[0]) / 6,
      end[1] - (next[1] - start[1]) / 6
    ];

    path += ` C ${point(control1)} ${point(control2)} ${point(end)}`;
  }

  return `${path} Z`;
}

interface Ring {
  path: string;
  opacity: number;
}

function buildRings(
  center: readonly [number, number],
  radii: readonly number[],
  squash: number,
  opacity: readonly [number, number]
): Ring[] {
  const [from, to] = opacity;

  return radii.map((radius, index) => {
    const t = radii.length > 1 ? index / (radii.length - 1) : 0;

    return {
      path: contourPath(center, radius, squash, index * 0.35),
      opacity: Math.round((from + (to - from) * t) * 100) / 100
    };
  });
}

// One large landform anchored bottom-left (cropped by the edges) and a small
// faint satellite drifting upper-right — asymmetry keeps it from reading as a
// logo or an emblem. Lines thin out toward the outside.
const RINGS: Ring[] = [
  ...buildRings([76, 148], [18, 26, 34, 43, 53, 64], 0.6, [0.15, 0.05]),
  ...buildRings([190, 86], [9, 15, 21], 0.66, [0.1, 0.06])
];

const containerStyle = css({
  position: "absolute",
  insetInline: 0,
  bottom: 0,
  height: "190px",
  zIndex: 0,
  pointerEvents: "none",
  overflow: "hidden",
  // Melt into the sidebar surface instead of ending on a hard edge.
  maskImage: "linear-gradient(to top, rgba(0, 0, 0, 0.85) 52%, transparent 100%)",
  transition: "opacity var(--vef-motion-duration-slow) ease"
});

const collapsedStyle = css({
  // The collapsed rail is too narrow for the artwork — fade it out instead of
  // letting it squash.
  opacity: 0
});

// Tints derive from the primary so the artwork tracks the theme color on the
// dark surface; pure thin linework at whisper alpha keeps it a texture, never
// an object competing for attention.
const LINE_COLOR = "color-mix(in srgb, var(--vef-color-primary) 55%, #a8c7ff)";
const GLOW_FILL = "color-mix(in srgb, var(--vef-color-primary) 8%, transparent)";

export function ContourPattern({ isSidebarCollapsed = false }: ContourPatternProps): JSX.Element {
  return (
    <div css={[containerStyle, isSidebarCollapsed && collapsedStyle]}>
      <svg
        height="100%"
        preserveAspectRatio="xMidYMax meet"
        viewBox="0 0 220 190"
        width="100%"
      >
        <defs>
          <radialGradient cx="50%" cy="50%" id="vef-contour-glow" r="50%">
            <stop offset="0%" stopColor={GLOW_FILL} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        {/* A soft breath of light under the main landform. */}
        <ellipse cx="76" cy="150" fill="url(#vef-contour-glow)" rx="85" ry="30" />

        <g fill="none" stroke={LINE_COLOR} strokeWidth="1">
          {RINGS.map(ring => <path key={ring.path} d={ring.path} strokeOpacity={ring.opacity} />)}
        </g>
      </svg>
    </div>
  );
}
