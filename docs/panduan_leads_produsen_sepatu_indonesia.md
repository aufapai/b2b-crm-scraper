# Playbook Pencarian Leads Produsen Sepatu di Indonesia

Dokumen ini memuat pemetaan sentra produksi alas kaki (dari UMKM hingga manufaktur skala besar) di seluruh Indonesia, beserta panduan otomatisasi ekstraksi *leads* menggunakan ScrapeGraphAI dan Gemini API.

---

## BAGIAN 1: Peta Sentra Produsen Sepatu di Indonesia

Untuk memaksimalkan pencarian *leads*, targetkan proses *scraping* pada direktori bisnis, *marketplace* B2B, atau berita lokal yang mencakup wilayah-wilayah utama berikut:

### 1. Tangerang & Banten (Skala Menengah - Besar / OEM Global)
Tangerang adalah pusatnya manufaktur besar. Banyak pabrik di sini merupakan produsen maklon (OEM) untuk merek global maupun merek lokal berskala raksasa (seperti sepatu olahraga, *sneakers* vulkanisir, dan sepatu utilitas).
*   **Kapasitas:** Menengah hingga Massal/Pabrik Besar.
*   **Fokus Produk:** Sneakers kanvas, sepatu lari, sepatu sekolah, *safety shoes*.

### 2. Sidoarjo & Surabaya, Jawa Timur (Skala Menengah - Besar)
Gudangnya pabrik sepatu berkapasitas masif dan menengah. Sangat cocok jika Anda mencari vendor untuk pengadaan proyek besar atau ekspor.
*   **Kapasitas:** Pabrik Menengah hingga Besar.
*   **Fokus Produk:** Sepatu pantofel produksi massal, *safety footwear*, sepatu militer, dan alas kaki kasual/sandal injeksi.

### 3. Cibaduyut, Bandung, Jawa Barat (Skala UMKM - Menengah)
Sentra legendaris yang sangat fleksibel. Produsen di sini sangat terbuka untuk sistem maklon B2B, *white-label*, hingga pesanan *custom* dengan MOQ (Minimum Order Quantity) yang lebih bersahabat.
*   **Kapasitas:** UMKM Rumahan hingga Menengah.
*   **Fokus Produk:** Sepatu kasual, pantofel, sepatu kulit sintetis, dan *sneakers* buatan tangan.

### 4. Mojokerto, Jawa Timur (Skala UMKM - Menengah)
Dikenal dengan julukan "Kampung Sepatu". Produsen di kawasan Kelurahan Miji dan Sooko menawarkan harga produksi yang sangat kompetitif dengan kualitas yang siap bersaing, bahkan beberapa sudah rutin ekspor.
*   **Kapasitas:** UMKM hingga Menengah.
*   **Fokus Produk:** Sepatu sekolah, sepatu kasual lokal, dan sandal kulit.

### 5. Garut, Jawa Barat (Skala UMKM - Menengah Spesialis Kulit)
Kawasan Sukaregang adalah pusat penyamakan kulit terkemuka. Jika membutuhkan produksi sepatu berbahan 100% *genuine leather*.
*   **Kapasitas:** UMKM hingga Menengah.
*   **Fokus Produk:** *Boots* kulit asli, *loafers*, pantofel premium, jaket/aksesoris kulit.

### 6. Medan, Sumatera Utara (Skala Menengah - Besar)
Di luar Pulau Jawa, Medan (terutama kawasan industri seperti KIM) memiliki beberapa pabrik sepatu berskala menengah hingga besar yang melayani pasar Sumatera dan ekspor ke wilayah sekitar (Malaysia/Singapura).
*   **Kapasitas:** Menengah hingga Besar.
*   **Fokus Produk:** Sepatu karet (boots perkebunan), sandal jepit, dan sepatu sekolah.

---

## BAGIAN 2: Otomatisasi Scraping Leads dengan ScrapeGraphAI

Untuk mengumpulkan data *leads* dari wilayah-wilayah di atas secara otomatis tanpa harus mencatat manual, kita menggunakan `ScrapeGraphAI`.

### A. Persiapan Lingkungan
Buka terminal/CMD dan jalankan perintah ini untuk menginstal dependensi:
```bash
pip install scrapegraphai playwright
playwright install
```

### B. Script Ekstraksi (Python)
Simpan kode di bawah ini sebagai `generate_leads.py`. Script ini memanfaatkan kecerdasan Gemini untuk mencari kontak di halaman website (misalnya halaman yellow pages lokal, direktori Kemenperin, atau *marketplace*).

```python
import json
from scrapegraphai.graphs import SmartScraperGraph

# 1. Konfigurasi API (Gunakan Gemini API untuk kecepatan & akurasi)
graph_config = {
    "llm": {
        "api_key": "MASUKKAN_GEMINI_API_KEY_ANDA_DI_SINI",
        "model": "gemini-1.5-flash",
    },
    "verbose": True,
    "headless": True
}

# 2. Target URL (Ganti dengan URL halaman direktori bisnis/marketplace yang dituju)
# Contoh: Mencari pabrik sepatu di Tangerang atau UMKM di Cibaduyut
target_url = "https://www.contoh-direktori-bisnis-indonesia.com/kategori/pabrik-sepatu"

# 3. Prompt (Instruksi NLP)
prompt = """
Ekstrak semua informasi profil perusahaan atau produsen sepatu yang ada di halaman ini.
Untuk setiap entitas, berikan struktur data berikut:
1. company_name (Nama Perusahaan / Pabrik / UMKM)
2. scale (Skala Bisnis: UMKM / Pabrik Besar / Menengah - tebak berdasarkan deskripsi jika ada)
3. location (Kota atau Provinsi)
4. phone_number (Nomor Telepon / WhatsApp)
5. email (Alamat Email kontak bisnis)
6. products (Jenis sepatu atau spesialisasi produksi)
"""

# 4. Inisialisasi Graph
scraper = SmartScraperGraph(
    prompt=prompt,
    source=target_url,
    config=graph_config
)

# 5. Eksekusi Scraping
hasil_leads = scraper.run()

# 6. Simpan hasil ke file JSON
with open("leads_produsen_sepatu.json", "w") as outfile:
    json.dump(hasil_leads, outfile, indent=4)

print("Proses scraping selesai! Data tersimpan di leads_produsen_sepatu.json")
```

### C. Langkah Selanjutnya
1. Kumpulkan daftar URL (Kemenperin, direktori B2B, Indotrading, dll).
2. Lakukan perulangan (*loop*) pada script di atas untuk membaca banyak URL sekaligus.
3. Konversi file `JSON` yang dihasilkan ke dalam file `CSV` atau `Excel` untuk diimpor ke dalam *software* CRM Anda.