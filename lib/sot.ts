// Aturan SOT No. Jika format berubah, cukup ubah di file ini.
export const SOT_PATTERN = /^\d{6}$/;
export const SOT_HTML_PATTERN = "[0-9]{6}";
export const SOT_ERROR = "SOT No harus tepat 6 digit angka, contoh 203038.";

export function isValidSotNo(value: string): boolean {
  return SOT_PATTERN.test(value);
}
