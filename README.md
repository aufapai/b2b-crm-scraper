# B2B CRM Scraper — Standalone Chrome Extension & Multi-Site Lead Hub (v1.0.0)

Sistem B2B Lead Generation & Outreach CRM ringan yang berjalan **100% langsung di Google Chrome** (sebagai **Tab Fullscreen** maupun **Chrome Side Panel** di samping WhatsApp Web / LinkedIn / Google Maps), dilengkapi **Multi-Site Scraper**, **1-Klik WhatsApp Template**, **Export/Import CSV**, dan **Auto-Sync Google Sheet Multi-Akun**.

---

## 🔒 Privasi & Keamanan Data

Repository ini **hanya berisi source code, template, dan dokumentasi**. Seluruh data pribadi, data customer/leads, daftar input target, dan kredensial API **dikecualikan secara ketat melalui `.gitignore`**:
- ❌ `.env` (API keys) — **tidak di-commit**
- ❌ `leads.db` & `output/` (seluruh data leads CSV/Excel) — **tidak di-commit**
- ❌ `tools/hots-chrome-extension/seed_leads.json` (data seed lokal) — **tidak di-commit**
- ❌ `scraper/urls.csv`, `scraper/gmaps_queries.txt`, `plans/` — **tidak di-commit**

---

## ✨ Fitur Utama (v1.0.0)

1. **Standalone Chrome CRM Dashboard (Tab & Side Panel)**
   - Tidak butuh menjalankan server Python/CMD untuk operasional harian.
   - Bisa dibuka di **Chrome Side Panel** berdampingan langsung dengan **WhatsApp Web**, **LinkedIn**, atau **Google Maps**.
   - Dilengkapi filter batch/jadwal, pencarian cepat, update status outreach, dan tombol **1-Klik Buka WhatsApp**.
2. **Multi-Site Lead Scraper (Chrome Extension Popup)**
   - **Google Maps**: Ekstrak nama usaha, alamat, nomor telepon, website, link Maps.
   - **LinkedIn**: Ekstrak nama PIC (*Procurement / Purchasing / HSE*), jabatan, perusahaan, dan profil URL.
   - **Marketplace (Tokopedia / Shopee / Lazada)**: Ekstrak nama produk/toko dan harga untuk riset pasar.
   - **Website Umum (+ AI Smart Scan)**: Deteksi otomatis email, link WhatsApp, nomor HP vs nomor telepon kantor (`021/031` tidak pernah dipalsukan menjadi nomor WA).
3. **Google Sheet Multi-Akun (`authuser`) & Auto-Sync**
   - Pilih akun Google/AI spesifik (email atau index `0`, `1`, `2`) langsung di popup atau dashboard saat membuka Google Sheet.
   - Dilengkapi Google Apps Script ([`tools/google_apps_script_sync.gs`](tools/google_apps_script_sync.gs)) untuk mengisi sheet secara otomatis lengkap dengan formula tombol **1-Klik Buka WA**.
4. **Export / Import CSV & Konversi Database Lokal**
   - Import CSV leads pribadi langsung di Chrome Dashboard, atau konversi `leads.db` ke CSV menggunakan [`tools/export_db_to_csv.py`](tools/export_db_to_csv.py).

---

## 📦 Cara Instalasi Versi Pertama (v1.0.0)

### Opsi A — Menggunakan File Packed (`.zip`) *(Paling Praktis)*
1. Download file rilis bersih: **`dist/b2b-crm-extension-v1.0.0-public.zip`** (atau dari halaman GitHub Releases).
2. Ekstrak file `.zip` tersebut ke satu folder permanen di komputer kamu, misalnya:
   ```text
   C:\Apps\b2b-crm-extension\
   ```
   *(Simpan di folder permanen, jangan dihapus setelah dipasang.)*
3. Buka Google Chrome → ketik `chrome://extensions` di address bar.
4. Aktifkan **Developer mode** (pojok kanan atas).
5. Klik **Load unpacked** → pilih folder `C:\Apps\b2b-crm-extension\`.
6. Klik ikon puzzle (Extensions) di kanan atas Chrome → **Pin** extension **B2B CRM Scraper**.

### Opsi B — Menggunakan `git clone` *(Direkomendasikan agar Mudah Update)*
```bash
git clone https://github.com/aufapai/b2b-crm-scraper.git
```
Lalu di `chrome://extensions` (Developer mode ON) → klik **Load unpacked** → pilih folder:
```text
b2b-crm-scraper/tools/hots-chrome-extension
```

### Memasukkan Data Leads Pribadi (Lokal)
Karena versi publik tidak menyertakan data pribadi:
1. Klik ikon extension → klik **🖥️ Dashboard** (atau **📌 Side Panel**).
2. Klik tombol **⬆️ Import CSV** di pojok kanan atas → pilih file CSV leads pribadi kamu.
3. Data tersimpan lokal dan aman di storage browser Chrome kamu.

---

## 🔄 Cara Update Setiap Kali Ada Versi Baru

> **PENTING:** Saat melakukan update, **JANGAN klik "Remove"** pada extension di `chrome://extensions`, agar seluruh data leads, status follow-up, dan pengaturan Google Sheet di `chrome.storage.local` **tidak hilang**.

### Jika Instal Pakai Git (`Opsi B`):
1. Buka terminal di folder repository, lalu tarik versi terbaru:
   ```bash
   git pull origin main
   ```
2. Buka `chrome://extensions`.
3. Cari kartu **B2B CRM Scraper**, lalu klik tombol **Reload (↻)**. Selesai!

### Jika Instal Pakai File Packed `.zip` (`Opsi A`):
1. Download file `.zip` versi terbaru (misal `b2b-crm-extension-v1.1.0-public.zip`).
2. Ekstrak dan **timpa (Replace all)** seluruh file ke folder permanen yang sama (`C:\Apps\b2b-crm-extension\`).
3. Buka `chrome://extensions` → klik tombol **Reload (↻)** pada kartu extension. Selesai!

---

## 📊 Cara Menyambungkan Google Sheet (Auto-Sync & Multi-Akun)

1. Buka Google Sheet tracker kamu di browser menggunakan **akun Google/AI pilihanmu**.
2. Klik menu **Extensions → Apps Script**.
3. Copy-paste seluruh isi [`tools/google_apps_script_sync.gs`](tools/google_apps_script_sync.gs) → klik **Save**.
4. Klik **Deploy → New deployment → Web app**:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
5. Salin **Web App URL** (`https://script.google.com/macros/s/.../exec`).
6. Buka Extension → tab **⚙️ Pengaturan & Sync** (atau ikon ⚙️ di Dashboard):
   - Masukkan **URL Google Sheet**, **Akun Google (`authuser`: email atau `0`/`1`/`2`)**, dan **Webhook URL**.
   - Klik **💾 Simpan Settings**.

---

## 🛠️ Cara Membuat Package (`.zip`) Rilis Baru (Untuk Developer)

Setiap kali selesai mengupdate fitur extension:
1. Naikkan nomor `"version"` di `tools/hots-chrome-extension/manifest.json` (misal `"1.0.0"` → `"1.1.0"`).
2. Jalankan perintah pack:
   ```bash
   python tools/pack_extension.py
   ```
3. File bersih siap rilis akan otomatis terbuat di:
   ```text
   dist/b2b-crm-extension-v<version>-public.zip
   ```
   *(Script otomatis menyaring agar `seed_leads.json`, `.csv`, `.xlsx`, `.db`, dan `.env` tidak pernah ikut ter-pack).*

---

## 🖥️ Mode Opsional: Backend Python CRM Lokal & AI Smart Scan

Jika ingin menggunakan fitur **✨ AI Smart Scan** (ekstraksi halaman web bebas via Gemini API):
1. Buat file `scraper/.env` secara lokal (jangan di-commit):
   ```env
   GEMINI_API_KEY=masukkan_api_key_anda
   GEMINI_MODEL=gemini-2.5-flash
   ```
2. Jalankan `start_crm.bat` (Windows) atau `python app.py`.
3. Server lokal aktif di `http://localhost:5000` dan otomatis terhubung dengan tombol **✨ AI Smart Scan** di Chrome Extension.
