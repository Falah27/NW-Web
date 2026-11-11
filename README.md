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
Pada impor pertama setelah pembaruan ID, job lama dengan ID `excel-<baris>` dianggap belum diedit lokal
dan akan diganti dengan ID stabil berbasis isi baris.

> Catatan: `npm run db:init` menghapus dan membuat ulang `data/dev.db`.
> Jalankan hanya sekali di awal, bukan sebelum setiap import.

## Sinkronisasi project SOT

Tombol **Sinkron SOT** di halaman Monitoring Job membaca SOT lewat browser Microsoft Edge
(Playwright). Aplikasi harus berjalan di komputer yang bisa membuka SOT (jaringan kantor) dan
memiliki Microsoft Edge. Isi `SOT_PROJECTS_URL` di `.env.local` (lihat `.env.example`); aplikasi
menolak sinkronisasi jika URL tersebut kosong.

Langkah di dialog:

1. **Daftar project**: membaca semua FY dan project. Project baru ditambah, yang sudah ada diperbarui,
   yang hilang dari SOT ditandai tidak aktif.
   Jika `SOT_TEAM_LEADER_ID` diisi, daftar dipersempit ke project yang punya issue dengan Team Leader tersebut
   (semua status, semua FY). Project tim lain ikut ditandai tidak aktif. Kalau ada FY yang gagal dibaca atau hasilnya
   kosong (mis. ID salah), proses berhenti dan data lama tidak diubah. Restart `npm run dev` setelah mengubah `.env.local`.
2. **Target model**: pilih FY, lalu target model tiap project dibaca. Hanya project yang berhasil
   dibaca yang ditimpa. Project tanpa field atau yang gagal dibaca tetap memakai data lama.
3. **Cocokkan model**: membangun daftar prefix dan mencocokkan nama model SOT dengan grup model
   di Monitoring Job (persis sama, sama sebelum tanda `-`, atau prefix sama).
   Hanya dicocokkan jika hasilnya tepat satu grup. Pencocokan lewat prefix perlu dicek manual.

Jendela Edge terbuka di komputer server. Login CompanyAccount disimpan di profil
`data/edge_sot_profile`, jadi tidak ada password atau cookie yang disimpan di aplikasi.
Jika login butuh input manual, biarkan `SOT_HEADLESS` kosong dan selesaikan login di jendela Edge.
Proses berjalan di latar belakang dan bisa dibatalkan dari dialog.

## Batasan deployment

Aplikasi ini dirancang untuk satu proses server. Status proses sinkronisasi SOT disimpan di memori
(`g.__sotRun`), sehingga tidak cocok untuk serverless atau beberapa instance tanpa mekanisme koordinasi
tambahan. Microsoft Edge juga harus tersedia di mesin server yang menjalankan sinkronisasi.

## Prefix nama model SOT

`lib/sot-prefix.ts` berisi aturan mengubah nama model SOT menjadi prefix (mis. `Linus2-FAL` menjadi `Linus`).
`lib/sot-prefix-repo.ts` membangun tabel `model_prefixes` dari data project SOT di database (hanya menambah).
Jalankan tes aturannya dengan `npm run test:sot`.
Tabel mapping dan prefix dibuat otomatis saat aplikasi mengakses database.