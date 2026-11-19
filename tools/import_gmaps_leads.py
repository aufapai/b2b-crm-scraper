"""
Import & Normalizer Tool: Google Maps Scraper (gosom/google-maps-scraper) ke CRM leads.db
Membaca file output CSV/JSON dari gosom/google-maps-scraper, menormalisasi data (Telepon, WA, Skor, Wilayah, Kategori),
dan memasukkannya secara otomatis ke database SQLite CRM (leads.db).
"""

import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

# Safe encoding on Windows PowerShell/CMD
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import database

SENTRA_MAP = {
    "tangerang": "Tangerang & Banten",
    "banten": "Tangerang & Banten",
    "serang": "Tangerang & Banten",
    "cilegon": "Tangerang & Banten",
    "sidoarjo": "Sidoarjo",
    "surabaya": "Surabaya",
    "bandung": "Bandung & Cibaduyut",
    "cibaduyut": "Bandung & Cibaduyut",
    "cimahi": "Bandung & Cibaduyut",
    "mojokerto": "Mojokerto",
    "garut": "Garut",
    "medan": "Medan & Sumatera",
    "deli serdang": "Medan & Sumatera",
    "klaten": "Jawa Tengah",
    "semarang": "Jawa Tengah",
    "kudus": "Jawa Tengah",
    "solo": "Jawa Tengah",
    "surakarta": "Jawa Tengah",
    "brebes": "Jawa Tengah",
    "magetan": "Jawa Timur",
    "pasuruan": "Jawa Timur",
    "tuban": "Jawa Timur",
    "bogor": "Bogor & Jawa Barat",
    "bekasi": "Bekasi & Jawa Barat",
    "jakarta": "DKI Jakarta",
    "balikpapan": "Kalimantan",
    "samarinda": "Kalimantan",
    "makassar": "Sulawesi"
}

def detect_wilayah(address, city):
    text = f"{city} {address}".lower()
    for kw, target_wilayah in SENTRA_MAP.items():
        if kw in text:
            return target_wilayah
    return "Lainnya"

def calculate_score(phone_clean, email, website, reviews_count):
    score = 40  # base score
    if phone_clean:
        score += 25
    if email:
        score += 15
    if website:
        score += 10
    if reviews_count and reviews_count > 5:
        score += 10
    score = min(100, score)
    kategori = "Hot" if score >= 70 else ("Warm" if score >= 40 else "Cold")
    return score, kategori

def import_gmaps_csv(csv_path, segment="Segmen B: Manufaktur Sepatu", industry="Manufaktur Alas Kaki"):
    file_path = Path(csv_path)
    if not file_path.exists():
        print(f"[ERROR] File tidak ditemukan: {file_path}")
        return

    print(f"[*] Membaca file output Google Maps Scraper: {file_path.name}")
    
    with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[*] Terdeteksi {len(rows)} baris data.")

    conn = database.get_db_connection()
    cursor = conn.cursor()

    imported = 0
    updated = 0
    skipped = 0

    for r in rows:
        # Menangani berbagai variasi nama kolom dari gosom/google-maps-scraper
        title = r.get("title") or r.get("name") or r.get("Title") or r.get("Name") or ""
        title = title.strip()
        if not title:
            skipped += 1
            continue

        raw_phone = r.get("phone") or r.get("phone_number") or r.get("Phone") or ""
        address = r.get("address") or r.get("Address") or ""
        city = r.get("city") or r.get("City") or ""
        website = r.get("website") or r.get("Website") or ""
        email = r.get("email") or r.get("Email") or ""
        category = r.get("category") or r.get("categories") or r.get("Category") or ""
        gmaps_url = r.get("link") or r.get("url") or r.get("google_id") or ""
        
        # Ekstrak review count jika ada
        reviews_raw = r.get("review_count") or r.get("reviews") or r.get("reviews_count") or "0"
        try:
            reviews_count = int(re.sub(r'\D', '', str(reviews_raw)) or 0)
        except Exception:
            reviews_count = 0

        # Normalisasi nomor telepon & WhatsApp
        phone_clean = database.extract_indonesia_mobile(raw_phone)
        phone_display = database.format_phone_display(phone_clean) if phone_clean else raw_phone
        is_wa_valid = 1 if phone_clean else 0

        wilayah = detect_wilayah(address, city)
        score, kategori = calculate_score(phone_clean, email, website, reviews_count)

        # Cek apakah sudah ada di database berdasarkan nama perusahaan
        cursor.execute("SELECT id FROM leads WHERE LOWER(company_name) = LOWER(?)", (title,))
        existing = cursor.fetchone()

        if existing:
            lead_id = existing["id"]
            cursor.execute("""
            UPDATE leads
            SET address = COALESCE(NULLIF(address, ''), ?),
                phone_number = COALESCE(NULLIF(phone_number, ''), ?),
                phone_wa = CASE WHEN phone_wa IS NULL OR phone_wa = '' THEN ? ELSE phone_wa END,
                phone_wa_display = CASE WHEN phone_wa_display IS NULL OR phone_wa_display = '' THEN ? ELSE phone_wa_display END,
                is_wa_valid = MAX(is_wa_valid, ?),
                email = COALESCE(NULLIF(email, ''), ?),
                website = COALESCE(NULLIF(website, ''), ?),
                source_url = COALESCE(NULLIF(source_url, ''), ?),
                score = MAX(score, ?),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, (address, raw_phone, phone_clean, phone_display, is_wa_valid, email, website, gmaps_url, score, lead_id))
            updated += 1
        else:
            cursor.execute("""
            INSERT INTO leads (
                company_name, scale, location, wilayah, address, phone_number,
                phone_wa, phone_wa_display, is_wa_valid, email, website, products,
                score, kategori, source_url, outreach_status, segment, industry, contact_person, job_title
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                title,
                "Menengah",
                city or wilayah,
                wilayah,
                address,
                raw_phone,
                phone_clean,
                phone_display,
                is_wa_valid,
                email,
                website,
                f"Google Maps Category: {category}" if category else "Alas Kaki / Pengadaan",
                score,
                kategori,
                gmaps_url,
                "Belum Dihubungi",
                segment,
                industry,
                "Manajemen Operasional",
                "Owner / PIC Lapangan"
            ))
            imported += 1

    conn.commit()
    conn.close()

    print(f"\n[SELESAI] Hasil Import:")
    print(f"  + Leads Baru Berhasil Masuk : {imported}")
    print(f"  + Leads Lama Di-update      : {updated}")
    print(f"  + Baris Dilewati (Kosong)   : {skipped}")
    print(f"Semua lead dapat langsung dicek di Web CRM lokal (run `start_crm.bat`).")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import data CSV hasil gosom/google-maps-scraper ke CRM SQLite")
    parser.add_argument("csv_file", help="Path ke file CSV output scraper")
    parser.add_argument("--segment", default="Segmen B: Manufaktur Sepatu", 
                        choices=["Segmen A: Buyer Korporat", "Segmen B: Manufaktur Sepatu"],
                        help="Target segmen lead (default: Segmen B)")
    parser.add_argument("--industry", default="Manufaktur Alas Kaki", help="Nama industri target")
    args = parser.parse_args()

    import_gmaps_csv(args.csv_file, args.segment, args.industry)

