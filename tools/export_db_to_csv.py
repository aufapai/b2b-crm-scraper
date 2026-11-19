"""
Konversi database SQLite (leads.db) menjadi:
1. File CSV bersih siap buka di Excel / Google Sheets (output/leads_master_all_clean.csv)
2. File seed JSON untuk Chrome Extension Standalone Dashboard (tools/hots-chrome-extension/seed_leads.json)
"""
import csv
import json
import sqlite3
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "leads.db"
OUT_CSV = ROOT / "output" / "leads_master_all_clean.csv"
OUT_SEED_JSON = ROOT / "tools" / "hots-chrome-extension" / "seed_leads.json"

CSV_COLUMNS = [
    "id", "batch_day", "company_name", "segment", "industry", "scale",
    "contact_person", "job_title", "phone_wa", "phone_wa_display", "is_wa_valid",
    "phone_number", "email", "location", "wilayah", "address", "products",
    "website", "linkedin_url", "score", "kategori", "outreach_status",
    "follow_up_notes", "warning_note", "source_url", "last_contacted_at"
]

def export_all():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM leads
        ORDER BY
            CASE
                WHEN batch_day LIKE 'H1%' THEN 1
                WHEN batch_day LIKE 'H2%' THEN 2
                WHEN batch_day LIKE 'H3%' THEN 3
                WHEN batch_day = 'Partner Portal' THEN 4
                WHEN batch_day = 'Extension Scrape' THEN 5
                ELSE 6
            END,
            score DESC,
            company_name ASC
    """)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    # 1. Export CSV (UTF-8 BOM untuk Excel & Google Sheets)
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            writer.writerow(r)

    # 2. Export Seed JSON untuk Chrome Extension Standalone
    OUT_SEED_JSON.parent.mkdir(parents=True, exist_ok=True)
    compact_rows = []
    for r in rows:
        compact_rows.append({k: (r.get(k) if r.get(k) is not None else "") for k in CSV_COLUMNS})

    with open(OUT_SEED_JSON, "w", encoding="utf-8") as f:
        json.dump(compact_rows, f, ensure_ascii=False)

    print(f"[SELESAI] Total {len(rows)} leads dari leads.db berhasil dikonversi:")
    print(f"  + CSV Bersih : {OUT_CSV}")
    print(f"  + Seed JSON  : {OUT_SEED_JSON}")

if __name__ == "__main__":
    export_all()
