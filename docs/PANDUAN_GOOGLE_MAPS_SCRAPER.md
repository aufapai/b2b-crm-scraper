# Panduan Penggunaan Google Maps Scraper (gosom/google-maps-scraper)

Dokumen ini disusun sebagai catatan persiapan teknis dan panduan operasional penggunaan **Google Maps Scraper** ([gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper)) untuk memperluas akuisisi leads B2B bagi **PT Indo Sukses Semesta (HOTs Trading)**.

---

## 1. Ikhtisar & Relevansi untuk Bisnis

### Apa itu `gosom/google-maps-scraper`?
Tool otomatisasi open-source berbasis bahasa Go (Golang) berkecepatan tinggi yang dirancang khusus untuk mengekstrak data entitas bisnis publik langsung dari Google Maps tanpa perlu berlangganan Google Maps Places API berbayar.

### Mengapa Tool Ini Sangat Berguna untuk HOTs Trading?
1. **Segmen A (Buyer Korporat & Pengadaan Safety Shoes / K3):**
   * Menemukan kantor cabang, site lapangan, dan workshop dari kontraktor EPC, gudang logistik, pabrik pengolahan, dan distributor perlengkapan safety di seluruh kota industri Indonesia.
2. **Segmen B (Pabrik & Pengrajin Sepatu / Mitra Ekspor):**
   * Menemukan produsen lokal, UMKM, dan pabrik sepatu/sandal yang terdaftar di Google Maps di sentra-sentra produksi utama (Cibaduyut Bandung, Sidoarjo, Mojokerto, Magetan, Pasuruan, Tangerang).
3. **Fitur Ekstraksi Kontak Komprehensif:**
   * Otomatis mengumpulkan: Nama Usaha, Alamat Lengkap, Koordinat GPS, Kategori Bisnis, Nomor Telepon/WhatsApp, Website, Rating, serta jumlah ulasan.
   * Dilengkapi fitur crawling otomatis ke website resmi bisnis tersebut untuk mengekstrak alamat email kontak & akun media sosial.

---

## 2. Pilihan Instalasi & Persiapan (Windows)

Ada 2 cara paling praktis untuk menjalankannya di Windows:

### Opsi A: Menggunakan Binary File Langsung (.exe) - *Paling Direkomendasikan*
1. Kunjungi halaman rilis resmi: [GitHub Releases gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper/releases).
2. Download file arsip zip untuk Windows (contoh: `google-maps-scraper_Windows_x86_64.zip`).
3. Ekstrak file executable `google-maps-scraper.exe` ke dalam folder:
   ```text
   tools/google-maps-scraper/google-maps-scraper.exe
   ```

### Opsi B: Menggunakan Docker (Jika Docker Desktop terpasang)
```bash
docker pull gosom/google-maps-scraper
```

---

## 3. Daftar Kata Kunci Pencarian Rekomendasi (Search Keywords)

Buat file teks berisi daftar kata kunci (misal: `scraper/gmaps_queries.txt`):

### Target Segmen A (Calon Buyer Sepatu Safety & K3)
```text
kontraktor tambang Samarinda
kontraktor EPC Balikpapan
pabrik kelapa sawit Pekanbaru
pergudangan logistik Cikarang
distributor alat safety Surabaya
kontraktor konstruksi Cilegon
```

### Target Segmen B (Pabrik & Sentra Produsen Sepatu)
```text
pabrik sepatu Cibaduyut Bandung
pengrajin sepatu Cibaduyut
pabrik sepatu Sidoarjo
produsen sandal sepatu Mojokerto
pabrik alas kaki Tangerang
sentra kulit Sukaregang Garut
pabrik sepatu safety Mojokerto
```

---

## 4. Cara Menjalankan Scraping (CLI)

Jalankan perintah berikut di PowerShell / CMD:

```powershell
# Contoh menjalankan scraping dengan input file query dan output CSV
.\tools\google-maps-scraper\google-maps-scraper.exe `
  -input scraper/gmaps_queries.txt `
  -results output/raw_gmaps_leads.csv `
  -depth 10 `
  -email `
  -c 4
```

### Parameter Penting:
* `-input`: File teks berisi daftar query pencarian (1 query per baris).
* `-results`: Path file hasil (CSV atau JSON).
* `-depth`: Jumlah maksimal hasil per kata kunci (misal: 10 atau 20 bisnis teratas).
* `-email`: Mengaktifkan crawler otomatis untuk mencari email bisnis dari situs resmi mereka.
* `-c`: Tingkat konkurensi / jumlah thread (disarankan 2–4 agar aman dari limit).

---

## 5. Integrasi Otomatis ke CRM Lokal (`leads.db`)

Untuk mempermudah tim, sudah disediakan script importir otomatis:
[`tools/import_gmaps_leads.py`](file:///d:/Work/Hots/Customer/Lead%20scrap/tools/import_gmaps_leads.py).

Script ini melakukan otomatisasi:
1. Normalisasi nomor telepon ke standar WhatsApp Indonesia (`+628xxx` / `628xxx`).
2. Deteksi otomatis wilayah/sentra bisnis (Bandung, Sidoarjo, Tangerang, Kalimantan, dll.).
3. Perhitungan *Lead Scoring* (0–100) dan klasifikasi kategori (*Hot*, *Warm*, *Cold*).
4. Deduplikasi nama perusahaan (mencegah duplikat lead).
5. Memasukkan data langsung ke tabel `leads` di database SQLite `leads.db`.

### Cara Menjalankan Impor:
```powershell
# Untuk data calon mitra pabrik sepatu (Segmen B):
python tools/import_gmaps_leads.py output/raw_gmaps_leads.csv --segment "Segmen B: Manufaktur Sepatu"

# Untuk data calon buyer korporat safety (Segmen A):
python tools/import_gmaps_leads.py output/raw_gmaps_leads.csv --segment "Segmen A: Buyer Korporat" --industry "Konstruksi & Industri"
```

Setelah diimpor, seluruh data baru akan langsung muncul di **Dashboard CRM Web** ([`start_crm.bat`](file:///d:/Work/Hots/Customer/Lead%20scrap/start_crm.bat)) dan siap di-follow up via template WhatsApp 1-klik.

---

## 6. Tips Keamanan & Anti-Blocking (Best Practices)

1. **Jaga Kecepatan Scraping:** Jangan gunakan konkurensi terlalu tinggi (`-c > 8`) jika tidak menggunakan proxy, karena Google dapat membatasi IP untuk sementara.
2. **Gunakan Proxy (Untuk Skala Besar):** Jika menargetkan ribuan leads sekaligus, gunakan opsi flag `-proxy` dengan proxy rotating.
3. **Filter Hasil:** Hasil Google Maps terkadang mencakup toko eceran kecil/reparasi sol sepatu. Filter kolom `category` dan `products` di CRM untuk memisahkan toko retail vs pabrik/workshop grosir.

