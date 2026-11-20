export function readableTextColor(hex: string): "#ffffff" | "#0f172a" {
  const normalized = hex.replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(normalized)) return "#0f172a";

  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

  return luminance < 0.179 ? "#ffffff" : "#0f172a";
}
