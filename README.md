# NW-Web (Team Hub)

Dashboard team untuk monitoring job, member, dokumen, dan kalender kerja.
Dibangun dengan Next.js, Tailwind CSS, FullCalendar, dan SQLite (`node:sqlite`).

## Getting Started

```bash
npm install
npm run db:init
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Import workbook XLSM

Inisialisasi database lokal satu kali, lalu import sheet `Job_Follow_Up`:

```powershell
npm run db:init
npm run import:xlsm -- "C:\path\New_NW_Job_Follow_Up_Sheet_FY26.xlsm"
```

Importer memetakan tabel job berdasarkan header, mempertahankan tanggal dan progress,
mengambil employee ID dari kolom assignee, lalu mengganti data job lokal dalam satu transaksi.
Data member (`role`, `skills`, `email`) tidak dihapus saat import.
Berikan argumen kedua untuk mengimpor nama sheet yang berbeda.

> Catatan: `npm run db:init` menghapus dan membuat ulang `data/dev.db`.
> Jalankan hanya sekali di awal, bukan sebelum setiap import.

## Sinkronisasi project SOT

Tombol **Sinkron SOT** di halaman Monitoring Job membaca daftar project dan target model
dari `SOT_PROJECTS_URL`. Aplikasi harus berjalan pada jaringan kantor. Jika SOT memakai
login, isi `SOT_COOKIE` pada environment server dengan cookie sesi yang sudah login, lalu
restart aplikasi. Cookie jangan di-commit ke repository.