# SalesFlow2 — Handoff Sesi

## Perubahan yang sudah dilakukan

- Kolom input manual data pembanding tahun sebelumnya (Year-over-Year / YoY) ditambahkan pada bagian laporan (`public/report.js`).
  - Menyediakan input kolom: **SPD Tahun Lalu**, **STD Tahun Lalu**, dan **APC Tahun Lalu** (otomatis terhitung dari SPD/STD jika dikosongkan, atau dapat diisi manual).
  - Terintegrasi dengan tanggal laporan yang dipilih dan menampilkan label tanggal pembanding tahun lalu secara dinamis (misal `14 November 2025` untuk laporan `14 November 2026`).
  - Hasil input langsung diperhitungkan ke dalam laporan pada poin **M (Spd_std_apc tahun lalu)** dan menghitung persentase pertumbuhan pada poin **N (growth Spd_std_apc vs thun lalu)** secara real-time.
  - Tersimpan secara persisten per tanggal laporan di `localStorage` (`salesflow2-yoy-data-v1`).
  - Jika input manual kosong, sistem tetap dapat menggunakan data rekaman tahun lalu yang tersimpan di server/database jika ada.
  - Tampilan box input responsif dan kompatibel dengan semua tema (Klasik, Monochrome, dan Luxe Royale).
- JavaScript utama yang sebelumnya inline di `public/index.html` dipindahkan ke `public/app.js`.
- `public/index.html` sekarang hanya memuat:
  - `/app.js`
  - `/report.js`
- Tes `tests/reliability.cjs` diperbarui agar memeriksa `public/app.js` serta memvalidasi ketersediaan kolom input YoY.
- Tema 3 baru dibuat: **Luxe Royale** (`public/luxe.css`), sebuah tema ultra-luxury obsidian & champagne gold dengan haptik interaktif spring physics, kartu konsentris bento, ambient glow, dan masthead liquid glass.
- Prioritas `authType()` di `src/index.js` diperbaiki agar `adminSession` dicek lebih dahulu daripada `APP_PASSWORD`.
- `public/app.js` diperbarui agar memanggil `refreshAdminAuth()` saat membuka menu Pengaturan.
- Tes `tests/reliability.cjs` diperiksa dan lulus 100%.

## Verifikasi

Perintah berikut berhasil:

```sh
node tests/reliability.cjs
```

Hasil:

```text
PASS: syntax, exact template, date rollover, offline queue, edits during save.
```

## Git

Commit dan push berhasil ke GitHub:

```text
9b779bb Remove Theme 3 (Command Ledger) completely
```

Push ke `origin/main` selesai (`https://github.com/huyinayena-commits/SalesFlow2`).

## Deploy

Deploy Cloudflare belum berhasil karena Wrangler tidak mendukung Android Termux:

```text
Error: Unsupported platform: android arm64 LE
```

Lanjutkan push dan deploy dari environment Linux/macOS/Windows yang memiliki:

1. Kredensial GitHub untuk repository `origin`.
2. Wrangler yang kompatibel.
3. Login Cloudflare melalui `npx wrangler login` jika diperlukan.

Perintah lanjutan:

```sh
git push origin HEAD
npx wrangler deploy
```

## Catatan file

`Sales_Harian-3.html` adalah file untracked yang sudah ada sebelumnya. File tersebut tidak diubah dan tidak ikut dalam commit.
