# Aplikasi Pertanggungjawaban Laporan BOS 2026

Aplikasi web sederhana (HTML/CSS/JS murni, tanpa build tool) untuk mencatat dan mencetak laporan pertanggungjawaban dana Bantuan Operasional Sekolah (BOS) tahun anggaran 2026.

## Fitur

- **Dasbor** — ringkasan total penerimaan, realisasi, sisa saldo, dan persentase serapan, lengkap dengan grafik realisasi per komponen.
- **Profil Sekolah** — data identitas sekolah, kepala sekolah, dan bendahara BOS (dipakai otomatis di laporan cetak).
- **Penerimaan Dana** — catatan penyaluran dana BOS per tahap beserta nomor SP2D/referensi.
- **Buku Kas Umum (BKU)** — pencatatan seluruh transaksi dengan saldo berjalan otomatis.
- **RKAS & Komponen** — daftar komponen kegiatan beserta anggaran dan realisasi (10 komponen umum sudah tersedia sebagai contoh, dapat diedit/ditambah/dihapus).
- **Laporan & Cetak** — rekap per triwulan (I–IV) atau setahun penuh, siap cetak/PDF (`Ctrl/Cmd + P`) dengan kop, ringkasan, rincian BKU, dan kolom tanda tangan kepala sekolah & bendahara. Bisa juga diunduh sebagai CSV.
- **Cadangkan Data** — ekspor/impor seluruh data sebagai berkas `.json`.

## Cara pakai (lokal)

Karena aplikasi ini tanpa build tool, cukup buka `index.html` langsung di peramban, atau jalankan server statis sederhana:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Penyimpanan data

Data disimpan di **localStorage** peramban perangkat yang digunakan — tidak terkirim ke server mana pun. Karena itu:

- Data hanya tersimpan di perangkat/peramban yang sama.
- Gunakan menu **Cadangkan Data** secara rutin untuk mengunduh cadangan `.json`, terutama sebelum membersihkan cache peramban atau berpindah perangkat.

## Deploy ke GitHub Pages

1. Buat repository baru di GitHub, lalu unggah seluruh isi folder ini (`index.html`, `css/`, `js/`, `README.md`).

   ```bash
   git init
   git add .
   git commit -m "Aplikasi pertanggungjawaban BOS 2026"
   git branch -M main
   git remote add origin https://github.com/<username>/<nama-repo>.git
   git push -u origin main
   ```

2. Di GitHub, buka **Settings → Pages**.
3. Pada **Source**, pilih branch `main` dan folder `/ (root)`, lalu **Save**.
4. Tunggu beberapa menit, situs akan tersedia di `https://<username>.github.io/<nama-repo>/`.

## Struktur proyek

```
.
├── index.html      # struktur halaman & navigasi antar menu
├── css/style.css   # tampilan (tema dokumen resmi: navy, emas, kertas)
├── js/app.js       # logika data, perhitungan, dan render
└── README.md
```

## Catatan

- Komponen kegiatan pada RKAS mengikuti pola umum Juknis BOS Reguler — sesuaikan nama dan anggaran komponen dengan Juknis BOS 2026 yang berlaku di sekolah Anda.
- Aplikasi ini adalah alat bantu pencatatan internal, bukan sistem pelaporan resmi ke Kemendikbudristek/ARKAS-SIPLah. Gunakan sebagai pendamping, dan tetap laporkan melalui kanal resmi yang ditentukan pemerintah.
