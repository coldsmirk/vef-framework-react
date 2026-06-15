export type ColorEntry = [hex: string, name: string];

export type ColorNumber = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

export interface ColorSwatch {
  number: ColorNumber;
  hex: string;
}

export interface ColorPalette {
  name: string;
  swatches: ColorSwatch[];
}

export interface ColorSwatchWithDelta extends ColorSwatch {
  delta: number;
}

export interface NearestColorPalette extends ColorPalette {
  nearestSwatch: ColorSwatchWithDelta;
  nearestLightnessSwatch: ColorSwatchWithDelta;
}

export interface MatchedColorPalette extends ColorPalette {
  colorMap: Map<ColorNumber, string>;
  /**
   * The main color swatch with number 500
   */
  main: ColorSwatch;
  matched: ColorSwatch;
}
