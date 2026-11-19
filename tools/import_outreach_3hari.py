"""
Importer Resmi: Outreach 3 Hari HOTS Trading (19-23 Nov 2026).xlsx ke leads.db
Sekaligus membersihkan 31 nomor WA palsu buyer korporat dan menandai 4 toko bentrok WGI.
"""
import sys
from pathlib import Path
import openpyxl

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import database

WGI_CONFLICT_NAMES = ["lestari safety", "kurnia safety", "sci alat safety", "graha multisarana"]

def import_outreach_excel(xlsx_path):
    database.init_db()
    cleaned = database.clean_fake_corporate_wa()
    print(f"[*] Dibersihkan {cleaned} nomor WA palsu pada Buyer Korporat BUMN/Tbk.")

    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    items = []

    # 1. Sheet: Jadwal 3 Hari
    if "Jadwal 3 Hari" in wb.sheetnames:
        ws = wb["Jadwal 3 Hari"]
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i == 0 or not row or not row[2]:
                continue
            hari = str(row[1] or "").strip()
            nama = str(row[2] or "").strip()
            kontak = str(row[3] or "").strip()
            kota = str(row[4] or "").strip()
            tipe = str(row[5] or "Reseller").strip()
            status_terakhir = str(row[6] or "").strip()
            aksi = str(row[7] or "").strip()
            tpl = str(row[8] or "T1").strip()
            catatan = str(row[10] or "").strip()

            email = kontak if "@" in kontak else ""
            phone = "" if "@" in kontak else kontak

            warning = ""
            if any(k in nama.lower() for k in WGI_CONFLICT_NAMES):
                warning = "HOLD: Sudah jual AP Boots. Konfirmasi ke WGI dulu sebelum WA (hindari bentrok channel)!"

            full_notes = f"[{tpl}] Aksi: {aksi}"
            if status_terakhir:
                full_notes += f" | Status lama: {status_terakhir}"
            if catatan:
                full_notes += f" | Catatan: {catatan}"

            items.append({
                "company_name": nama,
                "phone_number": phone,
                "email": email,
                "location": kota,
                "wilayah": kota,
                "segment": "Segmen A: Reseller & Toko K3",
                "industry": tipe,
                "products": f"AP Boots / Safety Footwear ({tipe})",
                "batch_day": hari,
                "warning_note": warning,
                "contact_person": "Bapak/Ibu",
                "job_title": tipe,
                "source_url": "Outreach 3 Hari HOTS Trading (19-23 Nov 2026).xlsx",
                "follow_up_notes": full_notes
            })

    # 2. Sheet: Partner Portal
    if "Partner Portal" in wb.sheetnames:
        ws2 = wb["Partner Portal"]
        for i, row in enumerate(ws2.iter_rows(values_only=True)):
            if i == 0 or not row or not row[0]:
                continue
            partner = str(row[0] or "").strip()
            status_folder = str(row[1] or "").strip()
            langkah = str(row[2] or "").strip()
            pic = str(row[3] or "").strip()

            items.append({
                "company_name": partner,
                "phone_number": "",
                "email": "",
                "location": "Indonesia",
                "wilayah": "Partner Portal",
                "segment": "Segmen A: Partner Portal & BUMN",
                "industry": "BUMN / Korporat / RS",
                "products": "AP Boots / Safety Footwear / AP Medic",
                "batch_day": "Partner Portal",
                "warning_note": "Jalur e-Proc / LinkedIn PIC Procurement (Jangan WA nomor kantor)",
                "contact_person": pic or "Cari PIC Procurement di LinkedIn",
                "job_title": "Procurement / Purchasing",
                "source_url": "Partner Portal HOTS Nov 2026",
                "follow_up_notes": f"Status: {status_folder} | Langkah: {langkah}"
            })

    res = database.ingest_extension_leads(items)
    # Also persist follow_up_notes for newly imported records
    conn = database.get_db_connection()
    cur = conn.cursor()
    for it in items:
        cur.execute(
            "UPDATE leads SET follow_up_notes = CASE WHEN follow_up_notes = '' OR follow_up_notes IS NULL THEN ? ELSE follow_up_notes END, batch_day = ? WHERE LOWER(company_name) = LOWER(?)",
            (it["follow_up_notes"], it["batch_day"], it["company_name"])
        )
    conn.commit()
    conn.close()

    print(f"[SELESAI] Import Outreach 3 Hari & Partner Portal:")
    print(f"  + Baru Masuk      : {res['inserted']}")
    print(f"  + Di-update       : {res['updated']}")
    print(f"  + Nomor Duplikat  : {res['duplicates_flagged']} (ditandai di warning_note)")

if __name__ == "__main__":
    default_xlsx = r"d:\Download\Outreach 3 Hari HOTS Trading (19-23 Nov 2026).xlsx"
    path = sys.argv[1] if len(sys.argv) > 1 else default_xlsx
    import_outreach_excel(path)
