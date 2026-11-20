# Aturan proyek
- Next.js di repo ini BUKAN versi yang dikenal dari training data. Sebelum menulis kode Next.js,
  baca panduan terkait di node_modules/next/dist/docs/ (lihat AGENTS.md).
- next.config.ts memakai cacheComponents: halaman yang membaca SQLite harus memanggil
  `await connection()` di dalam <Suspense>, seperti app/jobs/page.tsx.
- Stack: TypeScript strict, Tailwind v4, node:sqlite (DatabaseSync, sinkron), tanpa ORM.
- Tanggal selalu string "YYYY-MM-DD". DILARANG memakai toISOString() untuk tanggal kalender
  (bug zona waktu di WIB). Pakai helper di lib/dates.ts.
- Jangan pakai dangerouslySetInnerHTML atau innerHTML.
- Query SQL selalu ber-parameter. Komentar dan teks UI berbahasa Indonesia.
- Setelah selesai tiap tugas jalankan: npx tsc --noEmit && npm run lint, dan laporkan hasilnya.
- Jangan ubah file di luar lingkup tugas. Jangan menambah dependensi tanpa menyebutkan alasannya.