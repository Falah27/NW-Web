export function assertCanEdit(): void {
  // TODO: Proyek belum memiliki autentikasi; ganti pemeriksaan ini sebelum dipakai di jaringan umum.
  if (process.env.ROADMAP_EDIT_ENABLED !== "true") {
    throw new Error("Edit roadmap dinonaktifkan");
  }
}
