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
