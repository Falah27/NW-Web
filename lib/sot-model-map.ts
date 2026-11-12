import fs from "node:fs";
import path from "node:path";

export type SotModelMap = Record<string, string>;

const DEFAULT_PATH = path.join("data", "sot-model-map.json");

export function mapSotModelValue(value: string, mapping: SotModelMap): string {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => mapping[part] ?? part)
    .join(", ");
}

export function readSotModelMap(): SotModelMap {
  const filePath = path.resolve(process.cwd(), process.env.SOT_MODEL_MAP_PATH?.trim() || DEFAULT_PATH);
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string" && value.trim())
    );
  } catch {
    return {};
  }
}
