# B2B CRM Scraper — Standalone Chrome Extension & Multi-Site Lead Hub (v1.1.1)

CRM B2B dan alat akuisisi lead profesional yang berjalan **100% langsung di Google Chrome** (Tab Fullscreen & Chrome Side Panel) tanpa perlu menyalakan server Python/CMD. Dirancang dengan identitas visual industrial B2B (HOTS Trading — Industrial Navy & Safety Amber, Light/Dark mode) namun **fleksibel untuk segala jenis bisnis B2B** melalui Onboarding Wizard & Custom Segments.

---

## 🎬 Video Tutorial Demo (v1.1.1)

Tonton panduan lengkap alur penggunaan (Onboarding Setup → Rekomendasi Keyword B2B → Hubungi via WA & Draft Gmail → Double Check Anti-Bentrok → Popup Scraper):
* **Video Demo (WebM 720p):** [`docs/media/tutorial-b2b-crm-v1.1.1.webm`](docs/media/tutorial-b2b-crm-v1.1.1.webm)

---

## 🔒 Privasi & Keamanan Data

Repository ini **hanya berisi source code, template, dan dokumentasi**. Seluruh data pribadi, data customer/leads, daftar target, dan kredensial API **tidak pernah di-commit** (dikunci di `.gitignore`):
- ❌ `.env`, `leads.db`, `output/` (seluruh CSV/Excel leads)
- ❌ `tools/hots-chrome-extension/seed_leads.json` (data seed lokal)
- ❌ `scraper/urls.csv`, `scraper/gmaps_queries.txt`, `plans/`

---

## ✨ Fitur Utama (v1.1.0)

1. **Deep Online Scraper (100% di Browser — Tanpa `start_crm.bat`)**
   - Otomatis membaca **`<footer>`**, `<a href="mailto:">`, `<a href="tel:">`, link `wa.me`, `JSON-LD` schema, dan teks bawah halaman (tidak terpotong).
   - Mengenali nomor telepon **Indonesia (`+62`, `08`, `021`) & Internasional/ASEAN (`+84`, `+66`, `+60`, `+65`, `+63`)**, **Email**, serta **Alamat lengkap**.
   - Dilengkapi tombol **Cek `/contact`** (dan fallback otomatis) untuk mengambil kontak dari halaman `/contact` atau `/contact-us` secara online.
2. **Google Maps Auto-Scroll & Batch Scraper**
   - Saat membuka Google Maps, popup otomatis memunculkan panel **Auto-Scroll & Scrape Maps** (pilih target 20 / 40 / 60 bisnis) yang menggulir daftar hasil secara otomatis dan mengekstrak Nama, Kategori, Alamat, Telepon, & Link.
3. **Onboarding Setup Wizard & Smart B2B Keyword Recommender**
   - Saat pertama kali dibuka, muncul **Setup Profil Bisnis & Segmen** (Nama Perusahaan, Nama Pengirim, Industri B2B, Target Daerah/Negara, & **Daftar Segmen Custom**).
   - Database keyword B2B bawaan otomatis merekomendasikan kata kunci pencarian **Google Maps** & **LinkedIn PIC** sesuai industri dan daerah pilihanmu.
4. **Outreach Composer: Hubungi via WhatsApp Web & Draft Gmail Terhubung**
   - Setiap lead memiliki tombol **Hubungi (WA / Gmail)** untuk memilih saluran, mengedit draft pesan/subjek, lalu 1-klik membuka **WhatsApp Web** atau **Draft Compose Gmail** langsung di akun Google yang terhubung (`?authuser=...`).
5. **Auto-Sync Google Sheet v1.1 (Bebas `#ERROR!`) & Badge Profil Akun**
   - Header dashboard menampilkan **avatar & email akun profil Chrome** beserta status koneksi Google Sheet.
   - Apps Script v1.1 memakai `RichTextValue` native Google Sheets sehingga tombol **Buka WA** tidak pernah `#ERROR!` di Google Sheet Bahasa Indonesia maupun Inggris.

---

## 📦 Tutorial Instalasi Versi Pertama

### Opsi A — Menggunakan File Packed (`.zip`) *(Paling Praktis)*
1. Download file rilis bersih: **`dist/b2b-crm-extension-v1.1.1-public.zip`**.
2. Ekstrak ke satu folder permanen di komputer kamu (misal `C:\Apps\b2b-crm-extension\`).
3. Buka Google Chrome → ketik `chrome://extensions` di address bar.
4. Aktifkan **Developer mode** (pojok kanan atas).
5. Klik **Load unpacked** → pilih folder `C:\Apps\b2b-crm-extension\`.
6. Klik ikon puzzle di kanan atas Chrome → **Pin** extension **B2B CRM Scraper**.

### Opsi B — Menggunakan `git clone` *(Paling Mudah untuk Update)*
```bash
git clone https://github.com/aufapai/b2b-crm-scraper.git
```
Lalu di `chrome://extensions` (Developer mode ON) → **Load unpacked** → pilih folder `b2b-crm-scraper/tools/hots-chrome-extension`.

---

## 🚀 Panduan Cepat Penggunaan Pertama Kali

1. **Setup Profil & Segmen (Onboarding):**
   - Klik ikon extension → klik **Dashboard** (atau **Side Panel**).
   - Isi **Nama Perusahaan**, **Nama Pengirim**, **Industri B2B**, **Target Daerah/Negara**, dan sesuaikan **Daftar Segmen** sesuai kebutuhan bisnismu → klik **Simpan Profil & Terapkan**.
2. **Hubungkan Google Sheet & Akun Google (1 Kali Saja):**
   - Klik **Badge Profil Akun** di pojok kanan atas Dashboard → klik **Pakai Akun Ini** (otomatis mendeteksi akun Chrome kamu, misal `aufahots@gmail.com`).
   - Masukkan **URL Google Sheet** kamu.
   - Klik **Copy Kode `.gs` v1.1** → di Google Sheet buka **Extensions → Apps Script** → Paste & Save → **Deploy → New deployment → Web app** (*Execute as: Me*, *Who has access: Anyone*) → salin Web App URL ke kolom Webhook → klik **Simpan Pengaturan**.
3. **Cari & Auto-Scrape Lead:**
   - Klik **Cari Lead (Maps/LI)** di Dashboard (atau tab **Rekomendasi B2B** di Popup) → klik salah satu rekomendasi keyword Google Maps.
   - Setelah daftar bisnis muncul di Google Maps, klik ikon extension → pilih target (20/40/60) → klik **Auto-Scroll & Scrape Maps** → klik **Simpan ke CRM & Sheet**.
   - Untuk website perusahaan (misal kontraktor/distributor di Indonesia, Vietnam, Thailand), cukup buka websitenya → klik ikon extension → **Deep Scan Halaman Ini** (atau **Cek /contact**) → **Simpan ke CRM & Sheet**.
4. **Follow-Up via WhatsApp atau Draft Gmail:**
   - Di Dashboard, klik **Hubungi (WA / Gmail)** pada kartu lead → pilih saluran (**WhatsApp Web** atau **Draft Gmail**), pilih template, edit bila perlu, lalu klik buka!

---

## 📝 Contoh Setup Nyata (Siap Ikuti)

Berikut contoh pengisian konfigurasi dari nol sampai siap jalan:

### 1. Contoh Pengisian Onboarding Wizard (Setup Profil)
| Kolom | Contoh Isian (HOTS Trading) | Contoh Isian (B2B Umum / Jasa) |
|---|---|---|
| **Nama Perusahaan / Brand** | `HOTS Trading (PT Indo Sukses Semesta)` | `PT Mitra Solusi Industri` |
| **Nama Pengirim** | `Aufa` | `Budi (Sales Manager)` |
| **Fokus Industri B2B** | `Safety Footwear, APD & K3 Industri` | `Konstruksi, Kontraktor & EPC` |
| **Target Daerah / Negara** | `Jakarta, Surabaya, Balikpapan, HCMC, Bangkok` | `Jakarta, Cikarang, Semarang, Makassar` |
| **Daftar Segmen Custom** | `Segmen A: Reseller & Toko K3`<br>`Segmen A: Partner Portal & BUMN`<br>`Riset Pasar SEA` | `Kontraktor EPC Tier-1`<br>`Subkontraktor Proyek`<br>`Vendor Material` |

### 2. Contoh Pengisian Koneksi Google Sheet & Gmail
* **URL Google Sheet Tracker:** `https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit`
* **Akun Google Terhubung (`authuser`):** `nama.anda@gmail.com` *(atau `0` untuk akun utama Chrome, `1` untuk akun kedua)*
* **Webhook URL (Apps Script v1.1):** `https://script.google.com/macros/s/AKfycb.../exec`
  * *Catatan:* Hasilnya saat klik **Buka GSheet** atau **Hubungi → Draft Gmail**, Chrome otomatis membuka Google Sheet & Draft Gmail di akun `nama.anda@gmail.com` tersebut!

### 3. Contoh Alur Scrape Website B2B + Double Check Anti-Bentrok
1. Buka website target (misal `https://newtecons.vn/` atau `https://www.centralcons.vn/`).
2. Klik ikon Extension → pilih segmen tujuan → klik **Deep Scan Halaman Ini** (atau **Cek `/contact`** jika kontak ada di halaman Contact Us).
3. Extension otomatis mengekstrak **Email**, **Nomor Telepon (ID & ASEAN)**, dan **Alamat**, lalu langsung menampilkan hasil **Double Check**:
   * **Aman (Baru)** → siap disimpan.
   * **Bentrok: [Nama PT]** → otomatis dilewati jika centang *"Otomatis lewati lead yang bentrok"* aktif.
4. Klik **Simpan ke CRM & Sheet** → data masuk ke Dashboard & Google Sheet sekaligus.

---

## 🔄 Cara Update Setiap Kali Ada Versi Baru

> **PENTING:** **Jangan klik "Remove"** pada extension di `chrome://extensions` agar data leads dan pengaturan di `chrome.storage.local` tetap aman!

- **Jika pakai Git:** jalankan `git pull origin main`, lalu buka `chrome://extensions` → klik tombol **Reload (↻)**.
- **Jika pakai file `.zip`:** ekstrak `.zip` versi terbaru dan **timpa (Replace all)** ke folder permanen yang sama → buka `chrome://extensions` → klik **Reload (↻)**.
- **Jika ada update Apps Script (misal dari v1.0 ke v1.1):** klik **Copy Kode `.gs` v1.1** → paste di Apps Script Google Sheet → **Deploy → Manage deployments → ikon pensil (Edit) → Version: New version → Deploy**.

---

## 🛠️ Cara Pack Rilis Baru (Untuk Developer)

```bash
python tools/pack_extension.py
```
Otomatis membaca `"version"` dari `manifest.json` dan menghasilkan `dist/b2b-crm-extension-v<version>-public.zip` yang 100% bebas data pribadi.
