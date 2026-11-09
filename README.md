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
dari `SOT_PROJECTS_URL`. Aplikasi harus berjalan pada jaringan kantor. Saat halaman login
muncul, Playwright mengeklik **Login with CompanyAccount** secara otomatis. Untuk melihat
alur tersebut saat pengujian lokal, gunakan `SOT_BROWSER_HEADLESS=false`; jangan commit
cookie atau kredensial ke repository.

## Prefix nama model SOT

`lib/sot-prefix.ts` berisi aturan mengubah nama model SOT menjadi prefix (mis. `Linus2-FAL` menjadi `Linus`).
`lib/sot-prefix-repo.ts` membangun tabel `model_prefixes` dari data project SOT di database (hanya menambah).
Jalankan tes aturannya dengan `npm run test:sot`.
Untuk database yang sudah ada, siapkan tabel mapping manual tanpa menghapus data dengan `npm run db:migrate:sot`.

Sinkronisasi SOT memakai Playwright agar halaman yang membutuhkan JavaScript dan cookie sesi dapat dibaca.
Setelah instalasi dependency, siapkan browser dengan `npm run playwright:install`.
Secara default browser yang dipakai adalah Microsoft Edge (`SOT_BROWSER_CHANNEL=msedge`).
Sesi login disimpan pada profile persistent `.playwright/edge-sot-profile` dan folder tersebut
diabaikan Git karena dapat berisi cookie dan local storage autentikasi.
Saat menyimpan target model, mapping exact ke `model_groups` diprioritaskan; jika tidak cocok,
prefix dipakai sebagai fallback (mis. `Linus2-FAL` ke model group `Linus`). Jika tetap tidak cocok,
statusnya tetap `needs_mapping`.