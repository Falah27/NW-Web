// Aturan mengubah nama model dari SOT menjadi "model name prefix".
// Diport dari CleanPrefixes pada macro VBA GetModelNamePrefix.
// Jika aturan berubah, cukup ubah di file ini. Tidak ada akses database atau browser di sini.

// Prefix yang panjangnya kurang dari ini dibuang (di VBA: hasil 1 karakter dilewati).
export const MIN_PREFIX_LENGTH = 2;

/**
 * Membersihkan SATU item model menjadi 0, 1, atau 2 prefix (2 jika ada "/").
 *   1. pecah dengan "-", ambil bagian pertama
 *   2. potong sebelum angka pertama
 *   3. potong sebelum "_"
 *   4. potong sebelum "("
 *   5. pecah dengan "/" (maksimal jadi beberapa prefix)
 *   6. buang hasil yang lebih pendek dari MIN_PREFIX_LENGTH
 */
export function cleanPrefixes(item: string): string[] {
  let s = item.trim();
  if (!s) return [];

  s = s.split("-")[0].trim();

  const digitAt = s.search(/[0-9]/);
  if (digitAt >= 0) s = s.slice(0, digitAt).trim();

  const underscoreAt = s.indexOf("_");
  if (underscoreAt >= 0) s = s.slice(0, underscoreAt).trim();

  const parenAt = s.indexOf("(");
  if (parenAt >= 0) s = s.slice(0, parenAt).trim();

  return s
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length >= MIN_PREFIX_LENGTH);
}

/**
 * Satu sumber teks (isi Project Member atau Project Name) dipecah dengan koma,
 * tiap item dibersihkan. `skipped` = jumlah item yang tidak menghasilkan prefix.
 */
export function extractPrefixes(source: string): { prefixes: string[]; skipped: number } {
  const prefixes: string[] = [];
  let skipped = 0;
  for (const raw of source.split(",")) {
    const item = raw.trim();
    if (!item) continue;
    const cleaned = cleanPrefixes(item);
    if (cleaned.length === 0) skipped += 1;
    else prefixes.push(...cleaned);
  }
  return { prefixes, skipped };
}

/**
 * Gabungan banyak sumber, tanpa duplikat (huruf besar-kecil diabaikan,
 * penulisan yang pertama muncul yang dipakai). Urutan kemunculan dipertahankan.
 */
export function collectPrefixes(sources: string[]): { prefixes: string[]; skipped: number } {
  const seen = new Map<string, string>();
  let skipped = 0;
  for (const source of sources) {
    const result = extractPrefixes(source);
    skipped += result.skipped;
    for (const prefix of result.prefixes) {
      const key = prefix.toLowerCase();
      if (!seen.has(key)) seen.set(key, prefix);
    }
  }
  return { prefixes: [...seen.values()], skipped };
}

// ---------------------------------------------------------------------------
// Pencocokan nama model SOT dengan grup model di Monitoring Job (model_groups).
// Mapping manual (tabel sot_model_mappings) selalu didahulukan. Setelah itu dicoba dari
// yang paling ketat ke yang paling longgar, dan hanya dipakai kalau hasilnya TEPAT SATU
// grup. Kalau ragu (0 atau lebih dari 1) hasilnya null dan model tetap "needs_mapping".
//   manual : dipilih pengguna        (dari sot_model_mappings, kunci huruf kecil)
//   exact  : nama sama persis        SOT "Linus2-FAL"  -> grup "Linus2-FAL"
//   base   : sama sebelum tanda "-"  SOT "Linus2"      -> grup "Linus2-FAL"
//   prefix : prefix sama             SOT "Linus3"      -> grup "Linus2-FAL"  (paling longgar, perlu dicek)
// ---------------------------------------------------------------------------

export interface NamedGroup {
  id: number;
  name: string;
}

export type MatchMethod = "manual" | "exact" | "base" | "prefix";

/** Kunci = source_name huruf kecil tanpa spasi tepi, nilai = id model_groups. */
export type ManualMappings = ReadonlyMap<string, number>;

function baseName(name: string): string {
  return name.split("-")[0].trim().toLowerCase();
}

export function matchModelGroup(
  sourceName: string,
  groups: NamedGroup[],
  manualMappings?: ManualMappings
): { id: number; method: MatchMethod } | null {
  const source = sourceName.trim().toLowerCase();
  if (!source) return null;

  // Mapping manual menang atas aturan otomatis, selama grupnya masih ada.
  const manualId = manualMappings?.get(source);
  if (manualId !== undefined && groups.some((g) => g.id === manualId)) {
    return { id: manualId, method: "manual" };
  }

  const exact = groups.filter((g) => g.name.trim().toLowerCase() === source);
  if (exact.length === 1) return { id: exact[0].id, method: "exact" };
  if (exact.length > 1) return null;

  const base = baseName(sourceName);
  if (base) {
    const sameBase = groups.filter((g) => baseName(g.name) === base);
    if (sameBase.length === 1) return { id: sameBase[0].id, method: "base" };
    if (sameBase.length > 1) return null;
  }

  const wanted = new Set(cleanPrefixes(sourceName).map((p) => p.toLowerCase()));
  if (wanted.size === 0) return null;
  const samePrefix = groups.filter((g) => cleanPrefixes(g.name).some((p) => wanted.has(p.toLowerCase())));
  return samePrefix.length === 1 ? { id: samePrefix[0].id, method: "prefix" } : null;
}
