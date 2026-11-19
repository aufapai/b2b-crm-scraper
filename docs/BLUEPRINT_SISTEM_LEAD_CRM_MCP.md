# Blueprint Sistem Terpadu: Chrome Extension Scraper, Dashboard WA CRM, Google Drive Sync, dan MCP (Gmail & Claude)

**Untuk:** PT Indo Sukses Semesta (HOTS Trading)  
**Tanggal:** 18 November 2026  
**Status:** Dokumen Arsitektur & Rencana Implementasi  

Dokumen ini merangkum desain sistem *end-to-end* untuk menjembatani kebutuhan operasional **outreach & sales HOTS Trading**—mulai dari pengumpulan data leads yang bersih dari berbagai website, sinkronisasi ke Google Drive/Sheets & Dashboard 1-klik WhatsApp, hingga integrasi dinamis dengan Gmail dan AI (Claude) melalui **MCP (Model Context Protocol)**.

---

## 1. Masalah Data Saat Ini & Tujuan Sistem

Berdasarkan audit data di [`HOTS_Rencana_Outreach_dan_Requirement_Nov2026.md`](file:///d:/Download/HOTS_Rencana_Outreach_dan_Requirement_Nov2026.md) dan [`Outreach 3 Hari HOTS Trading (19-23 Nov 2026) - Perlu Diperbaiki.csv`](file:///d:/Download/Outreach%203%20Hari%20HOTS%20Trading%20(19-23%20Nov%202026)%20-%20Perlu%20Diperbaiki.csv):

1. **Nomor WA Palsu:** 31 buyer korporat BUMN/Tbk memiliki nomor WA buatan dari nomor telepon kantor (`021-xxxx` diubah jadi `+62 812-xxxx`).
2. **Nomor Ganda / Duplikat:** Beberapa nomor dipakai oleh 2–3 perusahaan berbeda (misal `0811-6265-898`, `0821-6789-7183`) dan data `Master_Leads` sempat dobel.
3. **Keterbatasan Scraper Lama:** *Instant Data Scraper* hanya menarik tabel mentah tanpa validasi, dan scraper lama belum mencari **PIC asli (Procurement / Purchasing / HSE)** di LinkedIn maupun riset harga di marketplace SEA.
4. **Kebutuhan Eksekusi Cepat:** Tim BD membutuhkan alur di mana data dari Spreadsheet/Google Drive bisa langsung di-follow up via **1-klik WhatsApp**, dipantau di **Dashboard**, dan diotomatisasi tindak lanjutnya lewat **Gmail + Claude MCP**.

---

## 2. Arsitektur Sistem Terpadu

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. DATA ACQUISITION (Custom Chrome Extension Multi-Site - Manifest V3)  │
│  • Google Maps (Toko safety, gudang)   • LinkedIn (PIC Procurement/HSE) │
│  • Marketplace (Shopee/Tokped/Lazada)  • Web PT / e-Proc (AI Extractor) │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ Auto-Clean & Validasi (Fixed-line ≠ WA)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. DATA LAYER & SYNC (Single Source of Truth)                           │
│  • Local CRM SQLite (`leads.db`)  ◄──2-Way Sync──►  Google Sheets/Drive │
└──────────────────┬───────────────────────────────────┬──────────────────┘
                   │                                   │
                   ▼                                   ▼
┌────────────────────────────────────┐  ┌─────────────────────────────────┐
│ 3. OUTREACH & DASHBOARD (`app.py`) │  │ 4. AI & EMAIL (MCP Server)      │
│  • Filter H1/H2/H3 & Partner       │  │  • Gmail MCP (Cek/Draft Email)  │
│  • 1-Klik Buka WhatsApp Web        │  │  • Sheets/Drive MCP (Live Read) │
│  • Guardrail Template T1 / T2 / T3 │  │  • HOTS CRM MCP (`leads.db`)    │
└────────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 3. Detail 4 Komponen Utama

### Komponen 1: Custom Chrome Extension Scraper (Multi-Website & Auto-Clean)

Berbeda dengan *Instant Data Scraper* yang pasif, extension khusus (`tools/hots-chrome-extension/`) akan dibangun dengan **Manifest V3** dan berjalan langsung di sesi browser login Anda (aman dari blokir IP/login wall):

1. **Multi-Site Recognizer (Adapter per Platform):**
   * **Google Maps Adapter:** Ekstrak Nama Toko/PT, Alamat, Kota, No Telepon, Website, Rating, Link Maps.
   * **LinkedIn Adapter:** Saat membuka pencarian/profil perusahaan target (misal 12 Partner Portal: *Semen Indonesia, Adhi Karya, Jasa Marga, Siloam, Mayapada*), otomatis ambil Nama PIC, Jabatan (*Procurement / Purchasing / HSE*), Perusahaan, dan URL Profil.
   * **Marketplace Adapter (Tokopedia / Shopee / Lazada TH-VN):** Ekstrak Nama Produk, Harga, Nama Toko, Lokasi, Jumlah Terjual (untuk riset harga boot PVC di Thailand/Vietnam dan mencari reseller lokal).
   * **Universal Web Recognizer (AI-Assisted):** Untuk website perusahaan atau portal e-procurement apa pun, tombol *"Smart Scan Page"* mengirim teks halaman yang bersih ke **Gemini API** (atau backend lokal `app.py`) untuk mengenali Nama PT, Email Procurement, Alamat, dan Nomor Kontak secara dinamis.

2. **Built-in Cleaning & Guardrails (Sebelum Data Masuk):**
   * **Pemisahan Telepon Kantor vs WhatsApp:** Nomor berawalan kode area (`021`, `031`, `061`, dll.) otomatis masuk ke kolom `phone_office`, **tidak pernah** dikonversi menjadi `phone_wa`. Hanya nomor seluler (`08xx` / `+628xx`) yang valid masuk ke kolom WhatsApp.
   * **Cek Duplikasi Real-Time:** Memperingatkan jika nama PT atau nomor HP sudah ada di database/spreadsheet (mencegah kasus 1 nomor dipakai 3 PT).
   * **Direct Export / Push:** Sekali klik bisa **Download CSV bersih** atau langsung **Push ke Dashboard Lokal (`app.py`) & Google Sheets**.

---

### Komponen 2: Dashboard CRM & 1-Klik WhatsApp Follow-Up

Fondasi dashboard lokal sudah tersedia di workspace ini ([`app.py`](file:///d:/Work/Hots/Customer/Lead%20scrap/app.py), [`database.py`](file:///d:/Work/Hots/Customer/Lead%20scrap/database.py), [`web/index.html`](file:///d:/Work/Hots/Customer/Lead%20scrap/web/index.html)), dan akan ditingkatkan dengan:

1. **Import Data Bersih Nov 2026:**
   * Sinkronisasi daftar **42 kontak Jadwal 3 Hari** (`H1 Kam 19 Nov`, `H2 Jum 20 Nov`, `H3 Sen 23 Nov`) dan **12 Partner Portal** dari [`Outreach 3 Hari HOTS Trading (19-23 Nov 2026).xlsx`](file:///d:/Download/Outreach%203%20Hari%20HOTS%20Trading%20(19-23%20Nov%202026).xlsx).
   * Menandai/mengunci tombol WA pada **31 buyer korporat BUMN/Tbk** agar hanya diarahkan ke jalur **Email / e-Procurement**.
   * Menandai **4 toko yang sudah jual AP Boots** (*Lestari Safety, Kurnia Safety, SCI Jogja, Graha Multisarana*) dengan status *Hold - Konfirmasi WGI*.
2. **1-Klik Buka WhatsApp (`wa.me`) Sesuai Template Resmi:**
   * Memasang template **T1** (Izin dulu tanpa katalog), **T2** (Follow-up kontak hangat), dan **T3** (Khusus GiziNow).
   * Menghapus template lama yang mengandung *"Jaminan Harga Termurah"*, *"MOQ bisa nego"*, atau emoji berlebih.
   * Menambahkan tombol cepat update kolom **Hasil**: `Terkirim`, `Dibalas`, `Butuh jelas`, `SPH dikirim`, `Tidak tertarik`.

---

### Komponen 3: Sinkronisasi Google Drive & Google Sheets

Agar data tidak terpecah antara spreadsheet di Google Drive dan dashboard lokal:

1. **Pola Sinkronisasi (2 Opsi Teknis):**
   * **Opsi A — Google Sheets API (Python `gspread` / `google-api-python-client`):** Dashboard `app.py` membaca dan menulis langsung ke Google Sheet Master di Google Drive menggunakan kredensial OAuth/Service Account.
   * **Opsi B — Google Apps Script Webhook (Lebih Ringan):** Pasang script kecil di Google Sheets untuk membuka endpoint Webhook JSON. Chrome Extension dan Dashboard `app.py` cukup mengirim/mengambil data JSON via HTTPS tanpa konfigurasi OAuth yang rumit.
2. **Alur Kerja Harian:**
   * Scrape dari Chrome Extension → masuk ke tab `Staging_Clean` di Google Sheet & `leads.db`.
   * Tim follow-up dari **Spreadsheet** atau **Dashboard** → update status `Hasil` otomatis sinkron di keduanya.
   * File PDF Katalog / SPH di Google Drive bisa ditautkan link-nya di kolom tracker setelah lead menjawab *"Boleh"* pada pesan T1.

---

### Komponen 4: Integrasi Gmail & MCP Server untuk Claude

**Model Context Protocol (MCP)** memungkinkan Claude (Claude Desktop atau client AI kompatibel MCP lainnya) berinteraksi langsung dengan data live Anda:

1. **Daftar MCP Server yang Digabungkan:**
   * **Gmail MCP:** Membaca email masuk/balasan dari buyer atau partner, mencari thread berdasarkan nama PT, dan membuat *Draft Email* penawaran resmi (tanpa langsung mengirim sebelum Anda review).
   * **Google Drive / Sheets MCP:** Membaca langsung tracker `Outreach 3 Hari` / `Master_Leads`, memfilter baris yang belum dihubungi, dan mengupdate kolom `Hasil` / `PIC` / `Catatan`.
   * **HOTS CRM MCP Server (Custom Python MCP):** Server MCP lokal yang membungkus `leads.db`, validasi nomor WA, cek duplikasi, dan generator template **T1/T2/T3** serta format nomor **SPH** (`SQ/[KODE]/[KATEGORI]/[MM]/[YY]/[SEQ]`).

2. **Contoh Penggunaan Dinamis di Claude Setelah Terhubung:**
   * *"Claude, cek di Gmail apakah ada balasan dari PT Aegisindo atau email tender dari Adhi Karya minggu ini. Jika ada, rangkum dan update kolom Hasil di Google Sheet."*
   * *"Claude, ambil daftar kontak H2 hari ini dari Google Sheet yang statusnya masih kosong, cek apakah ada nomor duplikat di `leads.db`, lalu siapkan teks pesan T1-nya."*
   * *"Claude, saya baru dapat data PIC Purchasing Siloam Hospitals dari LinkedIn. Simpan ke tab Partner Portal dan buatkan draft email izin di Gmail untuk penawaran AP Medic & Clog."*

---

## 4. Roadmap Implementasi Bertahap

Agar sistem cepat bisa dipakai tanpa mengganggu target outreach **19–23 November 2026**, pengerjaan dibagi menjadi **3 Fase**:

### Fase 1: Operasional Segera (Outreach & Sync Tracker)
* [ ] Impor 42 target **Jadwal 3 Hari** & **12 Partner Portal** ke Dashboard lokal (`leads.db` / `app.py`).
* [ ] Update template WA di [`database.py`](file:///d:/Work/Hots/Customer/Lead%20scrap/database.py) menjadi **T1, T2, T3** sesuai aturan baru.
* [ ] Tambahkan fitur proteksi tombol WA (blokir nomor kantor 31 korporat & peringatan 4 toko berisiko bentrok WGI).
* [ ] Setup sinkronisasi Google Sheets (Apps Script Webhook atau Google Sheets API) agar status tracker selalu sinkron dengan Google Drive.

### Fase 2: Custom Chrome Extension Scraper (Multi-Site)
* [ ] Buat kerangka Chrome Extension Manifest V3 di `tools/hots-chrome-extension/`.
* [ ] Implementasikan adapter **Google Maps** dan **LinkedIn PIC Finder** (untuk mengisi tab Partner Portal).
* [ ] Implementasikan **Universal Web Recognizer** (ekstrak kontak/email dari website perusahaan manapun via Gemini API) + **Marketplace Price Scraper** (untuk riset boot PVC di Lazada/Shopee TH-VN).
* [ ] Hubungkan tombol *"Push to HOTS CRM / GSheet"* langsung dari popup extension.

### Fase 3: MCP Ecosystem (Gmail + GDrive + HOTS CRM ke Claude)
* [ ] Siapkan kredensial Google Cloud OAuth untuk **Gmail & Google Drive/Sheets MCP**.
* [ ] Bangun **Custom HOTS CRM MCP Server** (`tools/hots_mcp_server.py`) menggunakan Python `mcp` SDK.
* [ ] Konfigurasikan `claude_desktop_config.json` dan uji skenario dinamis (baca Gmail → update Sheet → buat draft email/SPH).

---

## 5. Persiapan yang Dibutuhkan Sebelum Mulai Coding

Untuk mempercepat eksekusi saat kita masuk ke masing-masing fase, hal-hal berikut perlu disiapkan:
1. **Link / ID Google Sheet** tracker utama di Google Drive yang akan dijadikan pusat sinkronisasi.
2. **Google Cloud Console Project** (gratis) dengan **Gmail API**, **Google Sheets API**, dan **Google Drive API** diaktifkan (untuk Fase 1 akhir & Fase 3 MCP).
3. **Gemini API Key aktif** di `scraper/.env` (untuk fitur *Universal Web Recognizer* pada Chrome Extension).
4. **Aplikasi Claude Desktop** (atau AI client lain yang mendukung konfigurasi `mcpServers`).
