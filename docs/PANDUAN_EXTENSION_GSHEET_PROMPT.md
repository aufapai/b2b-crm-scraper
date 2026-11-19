# Panduan Eksekusi: Chrome Extension, Dashboard WA, Google Sheet Multi-Akun & Prompt AI/MCP

Dokumen ini adalah panduan operasional cepat untuk menjalankan **Dashboard CRM + Chrome Extension Multi-Site + Sinkronisasi Google Sheet** yang baru dibangun, lengkap dengan **Prompt Pack** siap pakai untuk Claude / AI (MCP).

---

## 1. Cara Pasang Chrome Extension (HOTS Lead Hub)

1. Buka Google Chrome, ketik di address bar: `chrome://extensions`
2. Aktifkan **Developer mode** (pojok kanan atas).
3. Klik **Load unpacked** → pilih folder:
   ```text
   d:\Work\Hots\Customer\Lead scrap\tools\hots-chrome-extension
   ```
4. Klik ikon puzzle (Extensions) di pojok kanan atas Chrome dan **Pin** extension **HOTS Lead Hub**.

### Fitur Popup Extension:
* **🖥️ Buka Dashboard**: Membuka langsung Dashboard CRM lokal (`http://localhost:5000`).
* **📊 Buka GSheet + Pilihan Akun Google/AI**: Masukkan email akun Google/AI pilihan (misal `aufa@hots.co.id` atau index `0`, `1`, `2`) pada kolom `Akun Google / AI`, lalu klik **Buka GSheet** → otomatis membuka Google Sheet menggunakan akun tersebut (`?authuser=...`).
* **🔍 Scan Halaman Ini**: Otomatis mendeteksi apakah kamu sedang membuka **Google Maps**, **LinkedIn** (cari PIC Procurement/HSE), **Marketplace** (Tokopedia/Shopee/Lazada), atau **Website PT**, lalu mengekstrak data bersih (memisahkan `WA Valid` vs `Telp Kantor`).
* **✨ AI Smart Scan**: Untuk website perusahaan yang strukturnya bebas, kirim teks halaman ke backend CRM lokal (`Gemini AI`) untuk mengekstrak profil PT, PIC, email, dan nomor kontak secara cerdas.
* **🚀 Simpan ke CRM & Sheet**: 1 klik langsung masuk ke `leads.db` (Dashboard) sekaligus terisi otomatis ke Google Sheet!

---

## 2. Cara Hubungkan Google Sheet agar Otomatis Terisi (`Code.gs`)

1. Buka Google Sheet tracker kamu menggunakan **akun Google/AI yang kamu pilih**.
2. Klik menu **Extensions → Apps Script**.
3. Copy seluruh isi file [`tools/google_apps_script_sync.gs`](file:///d:/Work/Hots/Customer/Lead%20scrap/tools/google_apps_script_sync.gs) dan paste ke editor Apps Script.
4. Klik **Deploy → New deployment → Web app**:
   * **Execute as:** `Me` (akun Google pilihanmu)
   * **Who has access:** `Anyone`
5. Salin **Web app URL** (`https://script.google.com/macros/s/.../exec`).
6. Tempelkan **URL Google Sheet**, **Akun Google (`authuser`)**, dan **Webhook URL** ke tab **⚙️ Pengaturan & Sync** di Chrome Extension (lalu klik **Simpan Settings**).
7. Sekarang setiap hasil scrape atau tombol **🔄 Sync Leads ke Sheet** di Dashboard akan otomatis mengisi tab `HOTS_Leads_Sync` lengkap dengan tombol **💬 Buka WA** 1-klik langsung di dalam spreadsheet!

---

## 3. Cara Menjalankan Dashboard CRM Lokal

Jalankan [`start_crm.bat`](file:///d:/Work/Hots/Customer/Lead%20scrap/start_crm.bat) (atau `python app.py`).
* Database `leads.db` sudah diperbarui dengan:
  * **42 kontak Jadwal Outreach 3 Hari** (`H1 Kam 19 Nov`, `H2 Jum 20 Nov`, `H3 Sen 23 Nov`)
  * **12 Partner Portal BUMN & RS** (`Partner Portal`)
  * **27 nomor WA palsu buyer korporat sudah dibersihkan** (diarahkan ke Email/e-Proc)
  * **Template resmi T1, T2, T3** sesuai aturan Nov 2026 (izin dulu tanpa katalog, tanpa klaim "termurah").

---

## 4. Prompt Pack Siap Pakai (Untuk Claude + MCP Gmail & Google Sheets)

Setelah Gmail & Google Sheets terhubung di Claude (MCP), kamu bisa langsung copy-paste prompt berikut untuk kerja harian yang dinamis:

### Prompt 1 — Cek Balasan Gmail & Update Google Sheet Otomatis
```text
Kamu adalah asisten BD untuk HOTS Trading (PT Indo Sukses Semesta), distributor resmi AP Boots.
1. Cek inbox Gmail saya selama 7 hari terakhir untuk email balasan atau RFQ dari daftar perusahaan di tab "HOTS_Leads_Sync" atau "Partner Portal" di Google Sheet tracker saya.
2. Rangkum siapa saja yang membalas, apa kebutuhan produk/qty/size-nya, dan apakah sudah ada nama PIC Procurement/Purchasing.
3. Update kolom "Status Hasil" dan "Catatan" di Google Sheet berdasarkan temuan Gmail.
4. Jangan kirim email otomatis—cukup buatkan Draft balasan di Gmail dengan aturan HOTS: tanpa klaim "harga termurah", MOQ tidak fleksibel, dan kirim katalog hanya jika mereka sudah mengizinkan.
```

### Prompt 2 — Siapkan Daftar Follow-Up Harian & Pesan Personalisasi (T1/T2)
```text
Baca Google Sheet tracker HOTS Trading tab "HOTS_Leads_Sync" (atau "Jadwal 3 Hari").
Filter baris untuk batch hari ini yang kolom "Status Hasil"-nya masih kosong atau "Belum Dihubungi".
Peringatkan saya jika ada:
- Toko yang sudah jual AP Boots (Lestari, Kurnia, SCI Jogja, Graha Multisarana) → tandai HOLD tunggu konfirmasi WGI.
- Nomor WA duplikat yang dipakai lebih dari 1 perusahaan.
Untuk sisanya yang aman, siapkan daftar singkat: Nama Toko, Nomor WA, Link Buka WA, dan draft pesan T1/T2 yang sopan (maksimal 1 emoji, tanpa katalog di pesan pertama).
```

### Prompt 3 — Olah Hasil Scrape LinkedIn PIC Partner Portal → Draft Email Gmail
```text
Lihat baris baru hasil Chrome Extension di tab "HOTS_Leads_Sync" dengan segmen "Segmen A: Partner Portal & BUMN" yang baru saja saya scrape dari LinkedIn.
Untuk setiap PIC Procurement/Purchasing baru yang ditemukan (misal dari Adhi Karya, Semen Indonesia, Siloam, atau Mayapada):
1. Buatkan Draft email izin di Gmail menggunakan bahasa formal B2B Indonesia untuk menawarkan pengadaan AP Safety / AP Medic / AP Clog dari jalur distributor resmi AP Boots.
2. Jangan lampirkan price list internal (Disc. PT). Tanyakan apakah berkenan menerima katalog resmi dan menjadwalkan diskusi singkat 10 menit.
```
