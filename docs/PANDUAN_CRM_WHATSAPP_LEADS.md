m# Panduan Sistem CRM Leads & Multi-Channel Pitching (HOTs Trading)

Sistem ini dirancang khusus untuk mengelola database **Dual-Segment B2B Leads** bagi **PT Indo Sukses Semesta (HOTs Trading)**:
1. **Segmen A: Buyer Korporat & Industri** (Kontraktor EPC, Pertambangan, Perkebunan Kelapa Sawit, Manufaktur Berat, Logistik, dan Rumah Sakit) yang membutuhkan pasokan alas kaki keselamatan (*safety footwear* AP Boots / standar SNI & EN ISO) dan platform **SaaS e-Procurement**.
2. **Segmen B: Manufaktur Alas Kaki / Sepatu Lokal** yang bermitra untuk standardisasi katalog B2B dan ekspansi ekspor global (*Export Enablement*).

---

## 1. Cara Menjalankan Aplikasi Web CRM

### Opsi A: Cara Paling Mudah (1-Klik di Windows)
Cukup **klik ganda (double-click)** file:
👉 `start_crm.bat`

Browser default Anda akan otomatis terbuka ke alamat:
`http://localhost:5000`

### Opsi B: Lewat Terminal / Command Prompt
```bash
# Jalankan dengan Python virtual environment bawaan project:
scraper\.venv\Scripts\python.exe app.py

# Atau jika Python utama sudah terpasang:
python app.py
```

---

## 2. Struktur Database SQLite (`leads.db`)

Database tersimpan secara lokal dan persisten di file: `leads.db`.

### Kolom & Data yang Dikelola:
- **`company_name`**: Nama resmi PT / BUMN / Tbk / CV / Workshop
- **`segment`**: 
  - `Segmen A: Buyer Korporat`
  - `Segmen B: Manufaktur Sepatu`
- **`industry`**: Sektor industri (`Konstruksi & EPC`, `Pertambangan & Energi`, `Perkebunan & Sawit`, `Logistik & Manufaktur Berat`, `Rumah Sakit & Fasilitas`, `Manufaktur Alas Kaki`)
- **`contact_person`**: Nama PIC / Tim Pengadaan (misal: "Bpk. Bambang", "Divisi Pengadaan & SCM")
- **`job_title`**: Jabatan target (*Head of Procurement*, *HSE Manager*, *Supply Chain Manager*, *Owner / Export Director*)
- **`phone_wa`**: Nomor HP seluler valid format internasional (`628...`)
- **`phone_wa_display`**: Format tampilan rapi (`+62 822-6767-6660`)
- **`is_wa_valid`**: Penanda nomor seluler valid (`1`) vs telepon kabel (`0`)
- **`scale`**: Skala (`Besar`, `Menengah`, `UMKM`)
- **`wilayah` & `location`**: Wilayah & Kota kantor pusat/site operasional
- **`products`**: Kebutuhan APD / jenis produk alas kaki
- **`email` & `website`**: Email procurement/perusahaan & portal web
- **`score`**: Skor kualitas lead (0–100)
- **`kategori`**: `Hot` (Skor 70–100), `Warm` (40–69), `Cold` (0–39)
- **`outreach_status`**:
  - `Belum Dihubungi` (Default)
  - `Sudah Dihubungi` (Otomatis saat tombol WhatsApp / Email ditekan)
  - `Tertarik Demo/Katalog ⭐` (Hot Opportunity Buyer Korporat)
  - `Tertarik Ekspor ⭐` (Hot Opportunity Mitra Manufaktur)
  - `Follow-up Lagi`
  - `Belum Tertarik`
- **`follow_up_notes`**: Catatan riwayat diskusi, negosiasi, atau hasil call
- **`last_contacted_at`**: Waktu terakhir dihubungi

---

## 3. Template Pitching yang Tersedia di Sistem

Sistem dilengkapi generator pesan dinamis yang otomatis menyisipkan `{company_name}`, `{contact_person}`, `{job_title}`, `{location}`, `{industry}`, dan `{products}`:

1. **WA: Buyer Korporat (Safety Footwear & SaaS e-Procurement)**
   - Fokus: Pasokan safety shoes harga tangan pertama pabrik + platform SaaS pemangkas waktu administrasi PO dan kontrol budget proyek.
2. **Email: Pitching Resmi Buyer Korporat (Safety Footwear + SaaS Platform)**
   - Subjek: `Efisiensi Pengadaan APD & Sepatu Safety di {company_name}`
   - Format proposal formal dengan opsi jadwal diskusi 10–15 menit.
3. **WA: Manufaktur Sepatu (Kemitraan Ekspor & Integrasi Katalog B2B)**
   - Fokus: Kurasi kapasitas produksi pabrik lokal untuk akses jaringan buyer korporat ekspor.
4. **Email: Pitching Resmi Manufaktur Sepatu (Kemitraan Ekspor via SaaS)**
   - Subjek: `Kolaborasi Ekspansi Pasar Ekspor B2B untuk {company_name}`
5. **WA: Super Singkat & To-The-Point**
   - Pesan cepat untuk perkenalan singkat via chat.

---

## 4. Cara Menjalankan Scraper Buyer Korporat Baru (Segmen A)

File harvester: `scraper/scrape_corporate_buyers.py`.

### A. Seeding & Update Data Korporat Tier-1
```bash
scraper\.venv\Scripts\python.exe scraper\scrape_corporate_buyers.py --seed
```
Akan memproses data perusahaan kontraktor BUMN/Swasta, tambang batubara/nikel/migas, perkebunan kelapa sawit, dan manufaktur berat langsung ke database dan mengekspor file Excel/CSV.

### B. Scraping Otomatis dari URL Tertentu via Gemini AI
```bash
scraper\.venv\Scripts\python.exe scraper\scrape_corporate_buyers.py --scrape "https://alamat-web-direktori-atau-kontraktor.com" --industry "Konstruksi & EPC"
```

### C. Ekspor Data Khusus Segmen A
```bash
scraper\.venv\Scripts\python.exe scraper\scrape_corporate_buyers.py --export
```
Output tersimpan di:
- `output/leads_buyer_korporat_safety_YYYYMMDD.csv`
- `output/leads_buyer_korporat_safety_YYYYMMDD.xlsx`

---

## 5. Fitur di Dashboard Web

1. **Filter Tab Segmen Sekali Klik**:
   - Tab "Semua Target" (221 Leads)
   - Tab "🏢 Segmen A: Buyer Korporat" (31 Perusahaan Besar)
   - Tab "🏭 Segmen B: Manufaktur Sepatu" (190 Pabrik Sentra Lokal)
2. **Filter Multi-Kriteria**:
   - Sektor Industri (Konstruksi & EPC, Tambang, Sawit, Logistik, RS, Pabrik Sepatu)
   - Wilayah (Jakarta, Bandung, Sidoarjo, Tangerang, Kalimantan, Sumatera, dll.)
   - Skala Industri (Besar / Tbk, Menengah, UMKM)
   - Status Outreach
   - Tombol Toggle "Hanya WA Ready"
3. **Modal Outreach Cerdas (WhatsApp & Email)**:
   - Pilih kanal: **WhatsApp Web** atau **Email Pitching**
   - Template otomatis menyesuaikan segmen target
   - 1-Klik membuka chat WhatsApp Web dengan pesan yang sudah terformat
   - 1-Klik membuka draft email (`mailto:`) lengkap dengan Subjek dan Body pesan
   - Otomatis mengubah status lead menjadi *"Sudah Dihubungi"*
4. **Export Fleksibel**:
   - Unduh Excel (.xlsx) atau CSV (.csv) untuk seluruh leads atau per segmen.
