// Reads the color tokens app/globals.css declares so the WebGL scene paints
// with the same values as the rest of the page and never restates a literal.

export interface RgbaColor {
  /** 0 to 1, linear in the sRGB sense (no gamma applied). */
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorTokenName =
  | "--ground"
  | "--foreground"
  | "--foreground-muted"
  | "--accent"
  | "--glow";

export type ColorTokens = Record<ColorTokenName, RgbaColor>;

const tokenNames: ColorTokenName[] = [
  "--ground",
  "--foreground",
  "--foreground-muted",
  "--accent",
  "--glow",
];

export function readColorTokens(element: Element): ColorTokens {
  const style = getComputedStyle(element);
  const tokens = {} as ColorTokens;
  for (const name of tokenNames) {
    tokens[name] = parseCssColor(style.getPropertyValue(name));
  }
  return tokens;
}

/** Parses the two color syntaxes the token file uses: `#rrggbb` (with or
 * without alpha) and modern `hsl(h s% l% / a)`. Anything else falls back to
 * opaque white so a broken token is visible rather than invisible. */
export function parseCssColor(input: string): RgbaColor {
  const value = input.trim();
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex != null) return parseHex(hex[1]);
  const hsl = value.match(
    /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[/,]\s*([\d.]+%?))?\s*\)$/i,
  );
  if (hsl != null) {
    const [r, g, b] = hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
    return { r, g, b, a: parseAlpha(hsl[4]) };
  }
  return { r: 1, g: 1, b: 1, a: 1 };
}

function parseHex(digits: string): RgbaColor {
  const expanded =
    digits.length <= 4
      ? digits
          .split("")
          .map((char) => char + char)
          .join("")
      : digits;
  const channel = (offset: number): number =>
    parseInt(expanded.slice(offset, offset + 2), 16) / 255;
  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: expanded.length === 8 ? channel(6) : 1,
  };
}

function parseAlpha(raw: string | undefined): number {
  if (raw == null || raw === "") return 1;
  return raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
}

function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const match = lightness - chroma / 2;
  let rgb: [number, number, number];
  if (sector < 1) rgb = [chroma, secondary, 0];
  else if (sector < 2) rgb = [secondary, chroma, 0];
  else if (sector < 3) rgb = [0, chroma, secondary];
  else if (sector < 4) rgb = [0, secondary, chroma];
  else if (sector < 5) rgb = [secondary, 0, chroma];
  else rgb = [chroma, 0, secondary];
  return [rgb[0] + match, rgb[1] + match, rgb[2] + match];
}
