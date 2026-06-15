import type { ColorPalette, ColorSwatch, KebabCase } from "../types";

import { kebabCase } from "../utils";

/**
 * The color palettes
 */
export const colorPalettes = [
  {
    name: "Red",
    swatches: [
      { number: 50, hex: "#fef2f2" },
      { number: 100, hex: "#ffe2e2" },
      { number: 200, hex: "#ffc9c9" },
      { number: 300, hex: "#ffa2a2" },
      { number: 400, hex: "#ff6467" },
      { number: 500, hex: "#fb2c36" },
      { number: 600, hex: "#e7000b" },
      { number: 700, hex: "#c10007" },
      { number: 800, hex: "#9f0712" },
      { number: 900, hex: "#82181a" },
      { number: 950, hex: "#460809" }
    ]
  },
  {
    name: "Orange",
    swatches: [
      { number: 50, hex: "#fff7ed" },
      { number: 100, hex: "#ffedd4" },
      { number: 200, hex: "#ffd6a7" },
      { number: 300, hex: "#ffb86a" },
      { number: 400, hex: "#ff8904" },
      { number: 500, hex: "#ff6900" },
      { number: 600, hex: "#f54900" },
      { number: 700, hex: "#ca3500" },
      { number: 800, hex: "#9f2d00" },
      { number: 900, hex: "#7e2a0c" },
      { number: 950, hex: "#441306" }
    ]
  },
  {
    name: "Amber",
    swatches: [
      { number: 50, hex: "#fffbeb" },
      { number: 100, hex: "#fef3c6" },
      { number: 200, hex: "#fee685" },
      { number: 300, hex: "#ffd230" },
      { number: 400, hex: "#ffb900" },
      { number: 500, hex: "#fe9a00" },
      { number: 600, hex: "#e17100" },
      { number: 700, hex: "#bb4d00" },
      { number: 800, hex: "#973c00" },
      { number: 900, hex: "#7b3306" },
      { number: 950, hex: "#461901" }
    ]
  },
  {
    name: "Yellow",
    swatches: [
      { number: 50, hex: "#fefce8" },
      { number: 100, hex: "#fef9c2" },
      { number: 200, hex: "#fff085" },
      { number: 300, hex: "#ffdf20" },
      { number: 400, hex: "#fdc700" },
      { number: 500, hex: "#f0b100" },
      { number: 600, hex: "#d08700" },
      { number: 700, hex: "#a65f00" },
      { number: 800, hex: "#894b00" },
      { number: 900, hex: "#733e0a" },
      { number: 950, hex: "#432004" }
    ]
  },
  {
    name: "Lime",
    swatches: [
      { number: 50, hex: "#f7fee7" },
      { number: 100, hex: "#ecfcca" },
      { number: 200, hex: "#d8f999" },
      { number: 300, hex: "#bbf451" },
      { number: 400, hex: "#9ae600" },
      { number: 500, hex: "#7ccf00" },
      { number: 600, hex: "#5ea500" },
      { number: 700, hex: "#497d00" },
      { number: 800, hex: "#3c6300" },
      { number: 900, hex: "#35530e" },
      { number: 950, hex: "#192e03" }
    ]
  },
  {
    name: "Green",
    swatches: [
      { number: 50, hex: "#f0fdf4" },
      { number: 100, hex: "#dcfce7" },
      { number: 200, hex: "#b9f8cf" },
      { number: 300, hex: "#7bf1a8" },
      { number: 400, hex: "#05df72" },
      { number: 500, hex: "#00c950" },
      { number: 600, hex: "#00a63e" },
      { number: 700, hex: "#008236" },
      { number: 800, hex: "#016630" },
      { number: 900, hex: "#0d542b" },
      { number: 950, hex: "#032e15" }
    ]
  },
  {
    name: "Emerald",
    swatches: [
      { number: 50, hex: "#ecfdf5" },
      { number: 100, hex: "#d0fae5" },
      { number: 200, hex: "#a4f4cf" },
      { number: 300, hex: "#5ee9b5" },
      { number: 400, hex: "#00d492" },
      { number: 500, hex: "#00bc7d" },
      { number: 600, hex: "#009966" },
      { number: 700, hex: "#007a55" },
      { number: 800, hex: "#006045" },
      { number: 900, hex: "#004f3b" },
      { number: 950, hex: "#002c22" }
    ]
  },
  {
    name: "Teal",
    swatches: [
      { number: 50, hex: "#f0fdfa" },
      { number: 100, hex: "#cbfbf1" },
      { number: 200, hex: "#96f7e4" },
      { number: 300, hex: "#46ecd5" },
      { number: 400, hex: "#00d5be" },
      { number: 500, hex: "#00bba7" },
      { number: 600, hex: "#009689" },
      { number: 700, hex: "#00786f" },
      { number: 800, hex: "#005f5a" },
      { number: 900, hex: "#0b4f4a" },
      { number: 950, hex: "#022f2e" }
    ]
  },
  {
    name: "Cyan",
    swatches: [
      { number: 50, hex: "#ecfeff" },
      { number: 100, hex: "#cefafe" },
      { number: 200, hex: "#a2f4fd" },
      { number: 300, hex: "#53eafd" },
      { number: 400, hex: "#00d3f2" },
      { number: 500, hex: "#00b8db" },
      { number: 600, hex: "#0092b8" },
      { number: 700, hex: "#007595" },
      { number: 800, hex: "#005f78" },
      { number: 900, hex: "#104e64" },
      { number: 950, hex: "#053345" }
    ]
  },
  {
    name: "Sky",
    swatches: [
      { number: 50, hex: "#f0f9ff" },
      { number: 100, hex: "#dff2fe" },
      { number: 200, hex: "#b8e6fe" },
      { number: 300, hex: "#74d4ff" },
      { number: 400, hex: "#00bcff" },
      { number: 500, hex: "#00a6f4" },
      { number: 600, hex: "#0084d1" },
      { number: 700, hex: "#0069a8" },
      { number: 800, hex: "#00598a" },
      { number: 900, hex: "#024a70" },
      { number: 950, hex: "#052f4a" }
    ]
  },
  {
    name: "Blue",
    swatches: [
      { number: 50, hex: "#eff6ff" },
      { number: 100, hex: "#dbeafe" },
      { number: 200, hex: "#bedbff" },
      { number: 300, hex: "#8ec5ff" },
      { number: 400, hex: "#51a2ff" },
      { number: 500, hex: "#2b7fff" },
      { number: 600, hex: "#155dfc" },
      { number: 700, hex: "#1447e6" },
      { number: 800, hex: "#193cb8" },
      { number: 900, hex: "#1c398e" },
      { number: 950, hex: "#162456" }
    ]
  },
  {
    name: "Indigo",
    swatches: [
      { number: 50, hex: "#eef2ff" },
      { number: 100, hex: "#e0e7ff" },
      { number: 200, hex: "#c6d2ff" },
      { number: 300, hex: "#a3b3ff" },
      { number: 400, hex: "#7c86ff" },
      { number: 500, hex: "#615fff" },
      { number: 600, hex: "#4f39f6" },
      { number: 700, hex: "#432dd7" },
      { number: 800, hex: "#372aac" },
      { number: 900, hex: "#312c85" },
      { number: 950, hex: "#1e1a4d" }
    ]
  },
  {
    name: "Violet",
    swatches: [
      { number: 50, hex: "#f5f3ff" },
      { number: 100, hex: "#ede9fe" },
      { number: 200, hex: "#ddd6ff" },
      { number: 300, hex: "#c4b4ff" },
      { number: 400, hex: "#a684ff" },
      { number: 500, hex: "#8e51ff" },
      { number: 600, hex: "#7f22fe" },
      { number: 700, hex: "#7008e7" },
      { number: 800, hex: "#5d0ec0" },
      { number: 900, hex: "#4d179a" },
      { number: 950, hex: "#2f0d68" }
    ]
  },
  {
    name: "Purple",
    swatches: [
      { number: 50, hex: "#faf5ff" },
      { number: 100, hex: "#f3e8ff" },
      { number: 200, hex: "#e9d4ff" },
      { number: 300, hex: "#dab2ff" },
      { number: 400, hex: "#c27aff" },
      { number: 500, hex: "#ad46ff" },
      { number: 600, hex: "#9810fa" },
      { number: 700, hex: "#8200db" },
      { number: 800, hex: "#6e11b0" },
      { number: 900, hex: "#59168b" },
      { number: 950, hex: "#3c0366" }
    ]
  },
  {
    name: "Fuchsia",
    swatches: [
      { number: 50, hex: "#fdf4ff" },
      { number: 100, hex: "#fae8ff" },
      { number: 200, hex: "#f6cfff" },
      { number: 300, hex: "#f4a8ff" },
      { number: 400, hex: "#ed6aff" },
      { number: 500, hex: "#e12afb" },
      { number: 600, hex: "#c800de" },
      { number: 700, hex: "#a800b7" },
      { number: 800, hex: "#8a0194" },
      { number: 900, hex: "#721378" },
      { number: 950, hex: "#4b004f" }
    ]
  },
  {
    name: "Pink",
    swatches: [
      { number: 50, hex: "#fdf2f8" },
      { number: 100, hex: "#fce7f3" },
      { number: 200, hex: "#fccee8" },
      { number: 300, hex: "#fda5d5" },
      { number: 400, hex: "#fb64b6" },
      { number: 500, hex: "#f6339a" },
      { number: 600, hex: "#e60076" },
      { number: 700, hex: "#c6005c" },
      { number: 800, hex: "#a3004c" },
      { number: 900, hex: "#861043" },
      { number: 950, hex: "#510424" }
    ]
  },
  {
    name: "Rose",
    swatches: [
      { number: 50, hex: "#fff1f2" },
      { number: 100, hex: "#ffe4e6" },
      { number: 200, hex: "#ffccd3" },
      { number: 300, hex: "#ffa1ad" },
      { number: 400, hex: "#ff637e" },
      { number: 500, hex: "#ff2056" },
      { number: 600, hex: "#ec003f" },
      { number: 700, hex: "#c70036" },
      { number: 800, hex: "#a50036" },
      { number: 900, hex: "#8b0836" },
      { number: 950, hex: "#4d0218" }
    ]
  },
  {
    name: "Slate",
    swatches: [
      { number: 50, hex: "#f8fafc" },
      { number: 100, hex: "#f1f5f9" },
      { number: 200, hex: "#e2e8f0" },
      { number: 300, hex: "#cad5e2" },
      { number: 400, hex: "#90a1b9" },
      { number: 500, hex: "#62748e" },
      { number: 600, hex: "#45556c" },
      { number: 700, hex: "#314158" },
      { number: 800, hex: "#1d293d" },
      { number: 900, hex: "#0f172b" },
      { number: 950, hex: "#020618" }
    ]
  },
  {
    name: "Gray",
    swatches: [
      { number: 50, hex: "#f9fafb" },
      { number: 100, hex: "#f3f4f6" },
      { number: 200, hex: "#e5e7eb" },
      { number: 300, hex: "#d1d5dc" },
      { number: 400, hex: "#99a1af" },
      { number: 500, hex: "#6a7282" },
      { number: 600, hex: "#4a5565" },
      { number: 700, hex: "#364153" },
      { number: 800, hex: "#1e2939" },
      { number: 900, hex: "#101828" },
      { number: 950, hex: "#030712" }
    ]
  },
  {
    name: "Zinc",
    swatches: [
      { number: 50, hex: "#fafafa" },
      { number: 100, hex: "#f4f4f5" },
      { number: 200, hex: "#e4e4e7" },
      { number: 300, hex: "#d4d4d8" },
      { number: 400, hex: "#9f9fa9" },
      { number: 500, hex: "#71717b" },
      { number: 600, hex: "#52525c" },
      { number: 700, hex: "#3f3f46" },
      { number: 800, hex: "#27272a" },
      { number: 900, hex: "#18181b" },
      { number: 950, hex: "#09090b" }
    ]
  },
  {
    name: "Neutral",
    swatches: [
      { number: 50, hex: "#fafafa" },
      { number: 100, hex: "#f5f5f5" },
      { number: 200, hex: "#e5e5e5" },
      { number: 300, hex: "#d4d4d4" },
      { number: 400, hex: "#a1a1a1" },
      { number: 500, hex: "#737373" },
      { number: 600, hex: "#525252" },
      { number: 700, hex: "#404040" },
      { number: 800, hex: "#262626" },
      { number: 900, hex: "#171717" },
      { number: 950, hex: "#0a0a0a" }
    ]
  },
  {
    name: "Stone",
    swatches: [
      { number: 50, hex: "#fafaf9" },
      { number: 100, hex: "#f5f5f4" },
      { number: 200, hex: "#e7e5e4" },
      { number: 300, hex: "#d6d3d1" },
      { number: 400, hex: "#a6a09b" },
      { number: 500, hex: "#79716b" },
      { number: 600, hex: "#57534d" },
      { number: 700, hex: "#44403b" },
      { number: 800, hex: "#292524" },
      { number: 900, hex: "#1c1917" },
      { number: 950, hex: "#0c0a09" }
    ]
  }
] as const satisfies ColorPalette[];

/**
 * The color palettes mapped as an object type
 * Structure: { [kebab-case-name]: { [number]: hex } }
 */
export type ColorPaletteObject = ColorPalettesToObject<typeof colorPalettes>;

/**
 * The preset color
 */
export type PresetColor = KebabCase<(typeof colorPalettes)[number]["name"]>;

/**
 * Transform array of swatches to an object with number as key and hex as value
 */
type SwatchesToObject<T extends readonly ColorSwatch[]> = T extends any ? {
  [K in T[number] as K["number"]]: K["hex"];
} : never;

/**
 * Transform color palettes array to a mapped object type
 */
type ColorPalettesToObject<T extends readonly ColorPalette[]> = {
  [K in T[number] as KebabCase<K["name"]>]: SwatchesToObject<K["swatches"]>;
};

/**
 * The color palette map
 */
export const colorPaletteMap = new Map(
  colorPalettes.map(palette => [
    kebabCase(palette.name) as PresetColor,
    new Map(palette.swatches.map(swatch => [swatch.number, swatch.hex]))
  ])
);
