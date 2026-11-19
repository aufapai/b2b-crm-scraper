import pandas as pd
import re
import urllib.parse
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
CSV_SOURCE = OUTPUT_DIR / "leads_produsen_sepatu_20261007.csv"

def extract_indonesia_mobile(text):
    """
    Ekstrak nomor seluler/WhatsApp Indonesia yang valid (08xx / 628xx).
    Mengabaikan nomor telepon kabel kantor (021, 022, 031, dll).
    """
    if not isinstance(text, str) or not text.strip():
        return ""
    
    matches = re.finditer(r'(?:(?:\+?62)|0)8[1-9][0-9\-\.\s\(\)]{6,16}', text)
    valid_nums = []
    for m in matches:
        raw = m.group(0)
        digits = re.sub(r'\D', '', raw)
        if digits.startswith('08'):
            digits = '62' + digits[1:]
        elif digits.startswith('8'):
            digits = '62' + digits
        
        # Nomor seluler Indonesia biasanya 10-14 digit (termasuk kode 62)
        if digits.startswith('628') and 10 <= len(digits) <= 15:
            valid_nums.append(digits)
            
    return valid_nums[0] if valid_nums else ""

def format_phone_display(phone_clean):
    """Format angka 628123456789 menjadi +62 812-3456-789"""
    if not phone_clean.startswith("628"):
        return phone_clean
    local = "0" + phone_clean[2:]
    # e.g. 0812-3456-7890
    if len(local) >= 10:
        return f"+62 {phone_clean[2:5]}-{phone_clean[5:9]}-{phone_clean[9:]}"
    return f"+{phone_clean}"

def generate_wa_message(row):
    comp = str(row.get('company_name') or 'Bapak/Ibu').strip()
    loc = str(row.get('location') or row.get('wilayah') or 'Indonesia').strip()
    prod = str(row.get('products') or 'produk alas kaki/sepatu').strip()
    if len(prod) > 100:
        prod = prod[:97] + "..."
        
    msg = (
        f"Halo {comp}, salam kenal.\n\n"
        f"Saya dari PT Indo Sukses Semesta (HOTs Trading). Kami melihat {comp} di {loc} "
        f"memproduksi {prod}.\n\n"
        f"Kami sedang membuka kerja sama untuk produsen alas kaki Indonesia agar bisa go global: "
        f"membantu pemasaran dan penjualan ke pasar ekspor bersama kami.\n\n"
        f"Apakah Bapak/Ibu berkenan kami kirimkan info detail programnya? Terima kasih.\n"
    )
    return msg

def make_wa_link(phone_clean, msg):
    if not phone_clean:
        return ""
    return f"https://wa.me/{phone_clean}?text={urllib.parse.quote(msg)}"

def main():
    if not CSV_SOURCE.exists():
        print(f"File tidak ditemukan: {CSV_SOURCE}")
        return

    df = pd.read_csv(CSV_SOURCE)
    print(f"Total baris di leads master: {len(df)}")

    # 1. Update kolom phone_wa di master agar hanya nomor WA valid (HP seluler)
    df['phone_wa_valid'] = df['phone_number'].apply(extract_indonesia_mobile)
    
    # Perbaiki phone_wa dan wa_link di dataset master (leads_produsen_sepatu_20261007.csv)
    # Jika bukan nomor WA seluler, kosongkan phone_wa dan wa_link agar tidak menyesatkan
    df['is_wa_valid'] = df['phone_wa_valid'] != ""
    df['phone_wa'] = df['phone_wa_valid']
    
    # Recalculate message & wa_link
    df['wa_message'] = df.apply(generate_wa_message, axis=1)
    df['wa_link'] = df.apply(lambda r: make_wa_link(r['phone_wa'], r['wa_message']) if r['phone_wa'] else "", axis=1)

    # 2. Buat subset KHUSUS leads yang memiliki nomor WhatsApp (Leads WhatsApp Ready)
    df_wa = df[df['is_wa_valid']].copy()
    df_wa['phone_wa_display'] = df_wa['phone_wa'].apply(format_phone_display)
    
    # Atur urutan kolom yang nyaman dibaca untuk outreach tim sales/partnership
    cols_order = [
        'company_name',
        'phone_wa',
        'phone_wa_display',
        'wa_link',
        'scale',
        'location',
        'wilayah',
        'products',
        'email',
        'website',
        'address',
        'score',
        'kategori',
        'wa_message'
    ]
    df_wa_export = df_wa[cols_order].sort_values(by=['score', 'company_name'], ascending=[False, True])

    # Simpan dataset khusus WhatsApp
    wa_csv_path = OUTPUT_DIR / "leads_whatsapp_ready.csv"
    wa_xlsx_path = OUTPUT_DIR / "leads_whatsapp_ready.xlsx"

    df_wa_export.to_csv(wa_csv_path, index=False, encoding='utf-8-sig')
    try:
        df_wa_export.to_excel(wa_xlsx_path, index=False)
        print(f"[OK] Excel tersimpan: {wa_xlsx_path}")
    except Exception as e:
        print(f"[Warn] Gagal export Excel: {e}")

    print(f"[OK] CSV WhatsApp Leads tersimpan: {wa_csv_path}")
    print(f"Total Leads dengan Nomor WhatsApp Valid: {len(df_wa_export)}")

    # Simpan kembali master leads yang sudah diperbaiki (tidak ada lagi nomor kantor kabel di phone_wa)
    master_clean_cols = [
        'company_name', 'scale', 'location', 'address', 'phone_number', 
        'email', 'website', 'products', 'wilayah', 'source_url', 'llm_used', 
        'phone_wa', 'score', 'kategori', 'wa_link'
    ]
    df[master_clean_cols].to_csv(CSV_SOURCE, index=False, encoding='utf-8-sig')
    print(f"[OK] Master CSV diperbarui (telepon kantor 021/022 tidak lagi dianggap WA): {CSV_SOURCE}")

    # Tampilkan preview ringkasan
    print("\n--- RINGKASAN LEADS WHATSAPP BERDASARKAN WILAYAH ---")
    print(df_wa_export['wilayah'].value_counts())

    print("\n--- SAMPLE 10 LEADS WHATSAPP SIAP HUBUNGI ---")
    for _, r in df_wa_export.head(10).iterrows():
        print(f"• {r['company_name']} ({r['location']}) - {r['phone_wa_display']}")
        print(f"  Produk: {str(r['products'])[:60]}")
        print(f"  Link WA: {r['wa_link'][:60]}...")
        print()

if __name__ == "__main__":
    main()
