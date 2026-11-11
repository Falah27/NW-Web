const SAFE_ERROR_PATTERNS = [
  /wajib diisi/i,
  /tidak valid/i,
  /tidak ditemukan/i,
  /harus berupa/i,
  /maksimal/i,
  /tidak boleh/i,
  /belum ada/i,
  /tidak ada project/i,
];

export function toPublicError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (message && SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return message;
  if (error) console.error(error);
  return fallback;
}
