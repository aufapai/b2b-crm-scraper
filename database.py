"""
Database module for HOTs Trading - Shoe & Footwear Lead Management & WhatsApp CRM.
Uses SQLite for zero-config, portable, and reliable local data storage.
"""

import sqlite3
import pandas as pd
import re
import urllib.parse
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).resolve().parent
DB_PATH = ROOT_DIR / "leads.db"
OUTPUT_DIR = ROOT_DIR / "output"
MASTER_CSV = OUTPUT_DIR / "leads_produsen_sepatu_20261007.csv"
WA_CSV = OUTPUT_DIR / "leads_whatsapp_ready.csv"

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def extract_indonesia_mobile(text):
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
        if digits.startswith('628') and 10 <= len(digits) <= 15:
            valid_nums.append(digits)
    return valid_nums[0] if valid_nums else ""

def format_phone_display(phone_clean):
    if not phone_clean:
        return ""
    phone_clean = str(phone_clean).strip()
    if phone_clean.endswith('.0'):
        phone_clean = phone_clean[:-2]
    if phone_clean.startswith("628"):
        if len(phone_clean) >= 11:
            return f"+62 {phone_clean[2:5]}-{phone_clean[5:9]}-{phone_clean[9:]}"
        return f"+62 {phone_clean[2:]}"
    return phone_clean

DEFAULT_TEMPLATES = [
    {
        "id": 1,
        "title": "T1: Pesan Pertama Reseller / Toko (Izin Dulu, Tanpa Katalog)",
        "segment": "all",
        "channel": "whatsapp",
        "subject": "Penawaran Distribusi AP Boots - HOTS Trading",
        "message_text": (
            "Selamat pagi Bapak/Ibu, saya Aufa dari HOTS Trading (PT Indo Sukses Semesta), distributor resmi AP Boots. "
            "Kami menyuplai boot PVC dan safety boot untuk toko dan supplier K3. "
            "Apakah saya boleh mengirimkan katalog dan skema harga untuk toko Bapak/Ibu?"
        ),
        "is_default": 1
    },
    {
        "id": 2,
        "title": "T2: Follow Up Kontak Hangat (Pernah Ngobrol)",
        "segment": "all",
        "channel": "whatsapp",
        "subject": "Follow Up Kebutuhan AP Boots - {company_name}",
        "message_text": (
            "Selamat pagi Bapak/Ibu {contact_person}, saya Aufa dari HOTS Trading. "
            "Menindaklanjuti komunikasi kita sebelumnya soal AP Boots, apakah ada kebutuhan stok untuk Desember atau awal tahun depan? "
            "Jika ada, boleh saya tahu model dan perkiraan jumlahnya agar bisa saya siapkan penawarannya?"
        ),
        "is_default": 0
    },
    {
        "id": 3,
        "title": "T3: Khusus GiziNow (Evaluasi SPPG / AP Chef & Clog)",
        "segment": "all",
        "channel": "whatsapp",
        "subject": "Follow Up Penawaran AP Chef & Clog - GiziNow",
        "message_text": (
            "Selamat pagi Pak Denny, saya Aufa dari HOTS Trading. "
            "Menindaklanjuti penawaran AP Chef dan AP Clog bulan Juni, apakah evaluasi kebutuhan SPPG sudah berjalan? "
            "Kami siap mengirimkan penawaran yang diperbarui sesuai jumlah unit yang dikelola."
        ),
        "is_default": 0
    },
    {
        "id": 4,
        "title": "Email: Izin Penawaran Korporat / Partner Portal (BUMN & RS)",
        "segment": "Segmen A: Buyer Korporat",
        "channel": "email",
        "subject": "Penawaran Pengadaan Sepatu Safety & AP Boots untuk {company_name}",
        "message_text": (
            "Selamat pagi Bapak/Ibu {contact_person},\n\n"
            "Perkenalkan saya Aufa dari HOTS Trading (PT Indo Sukses Semesta), distributor resmi AP Boots.\n\n"
            "Kami menyuplai sepatu safety boot dan boot PVC (AP Safety, AP Medic, AP Clog, AP Terra) dengan harga resmi dari jalur distributor resmi untuk kebutuhan operasional & K3 di {company_name}.\n\n"
            "Apakah Bapak/Ibu berkenan jika kami kirimkan katalog resmi dan informasi skema pengadaan volume untuk tim Procurement & K3 {company_name}?\n\n"
            "Terima kasih atas waktu dan perhatiannya.\n\n"
            "Salam hormat,\n"
            "Aufa - Business Development\n"
            "PT Indo Sukses Semesta (HOTS Trading)"
        ),
        "is_default": 0
    },
    {
        "id": 5,
        "title": "WA: Manufaktur Sepatu (Kemitraan Ekspor B2B)",
        "segment": "Segmen B: Manufaktur Sepatu",
        "channel": "whatsapp",
        "subject": "Kolaborasi Ekspansi Pasar Ekspor B2B untuk {company_name}",
        "message_text": (
            "Selamat pagi Bapak/Ibu {contact_person} ({company_name}), salam kenal. "
            "Saya Aufa dari PT Indo Sukses Semesta (HOTS Trading). Kami mengapresiasi kapasitas produksi {products} dari {company_name} di {location}. "
            "Saat ini kami membuka peluang kerja sama distribusi B2B dan ekspor regional. "
            "Apakah saya boleh mengirimkan info singkat program kemitraannya?"
        ),
        "is_default": 0
    }
]

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Create leads table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        scale TEXT,
        location TEXT,
        wilayah TEXT,
        address TEXT,
        phone_number TEXT,
        phone_wa TEXT,
        phone_wa_display TEXT,
        is_wa_valid INTEGER DEFAULT 0,
        email TEXT,
        website TEXT,
        products TEXT,
        score INTEGER DEFAULT 50,
        kategori TEXT DEFAULT 'Warm',
        source_url TEXT,
        outreach_status TEXT DEFAULT 'Belum Dihubungi',
        follow_up_notes TEXT DEFAULT '',
        last_contacted_at TEXT,
        segment TEXT DEFAULT 'Segmen B: Manufaktur Sepatu',
        industry TEXT DEFAULT 'Manufaktur Alas Kaki',
        contact_person TEXT DEFAULT '',
        job_title TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create message templates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message_text TEXT NOT NULL,
        segment TEXT DEFAULT 'all',
        channel TEXT DEFAULT 'whatsapp',
        subject TEXT DEFAULT '',
        is_default INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create settings table for Google Sheet URL, AuthUser Account, & Webhook
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT DEFAULT ''
    );
    """)

    # Schema migration checks for existing leads table
    cursor.execute("PRAGMA table_info(leads)")
    existing_cols = [c[1] for c in cursor.fetchall()]

    new_lead_cols = [
        ("segment", "TEXT DEFAULT 'Segmen B: Manufaktur Sepatu'"),
        ("industry", "TEXT DEFAULT 'Manufaktur Alas Kaki'"),
        ("contact_person", "TEXT DEFAULT ''"),
        ("job_title", "TEXT DEFAULT ''"),
        ("linkedin_url", "TEXT DEFAULT ''"),
        ("batch_day", "TEXT DEFAULT ''"),
        ("warning_note", "TEXT DEFAULT ''")
    ]
    for col_name, col_def in new_lead_cols:
        if col_name not in existing_cols:
            try:
                cursor.execute(f"ALTER TABLE leads ADD COLUMN {col_name} {col_def}")
            except sqlite3.OperationalError:
                pass

    # Ensure backfilled defaults for existing leads
    cursor.execute("UPDATE leads SET segment = 'Segmen B: Manufaktur Sepatu' WHERE segment IS NULL OR segment = ''")
    cursor.execute("UPDATE leads SET industry = 'Manufaktur Alas Kaki' WHERE industry IS NULL OR industry = ''")
    cursor.execute("UPDATE leads SET job_title = 'Owner / Export Director' WHERE (job_title IS NULL OR job_title = '') AND segment = 'Segmen B: Manufaktur Sepatu'")
    cursor.execute("UPDATE leads SET contact_person = 'Pimpinan ' || company_name WHERE (contact_person IS NULL OR contact_person = '') AND segment = 'Segmen B: Manufaktur Sepatu'")

    # Schema migration checks for templates table
    cursor.execute("PRAGMA table_info(templates)")
    existing_tpl_cols = [c[1] for c in cursor.fetchall()]
    new_tpl_cols = [
        ("segment", "TEXT DEFAULT 'all'"),
        ("channel", "TEXT DEFAULT 'whatsapp'"),
        ("subject", "TEXT DEFAULT ''")
    ]
    for col_name, col_def in new_tpl_cols:
        if col_name not in existing_tpl_cols:
            try:
                cursor.execute(f"ALTER TABLE templates ADD COLUMN {col_name} {col_def}")
            except sqlite3.OperationalError:
                pass

    # Seed or upgrade templates
    for t in DEFAULT_TEMPLATES:
        cursor.execute("SELECT id FROM templates WHERE id = ?", (t["id"],))
        existing_tpl = cursor.fetchone()
        if existing_tpl:
            cursor.execute("""
            UPDATE templates 
            SET title = ?, message_text = ?, segment = ?, channel = ?, subject = ?, is_default = ? 
            WHERE id = ?
            """, (t["title"], t["message_text"], t.get("segment", "all"), t.get("channel", "whatsapp"), t.get("subject", ""), t["is_default"], t["id"]))
        else:
            cursor.execute("""
            INSERT INTO templates (id, title, message_text, segment, channel, subject, is_default) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (t["id"], t["title"], t["message_text"], t.get("segment", "all"), t.get("channel", "whatsapp"), t.get("subject", ""), t["is_default"]))

    # Check if leads table is empty
    cursor.execute("SELECT COUNT(*) FROM leads")
    lead_count = cursor.fetchone()[0]

    if lead_count == 0 and MASTER_CSV.exists():
        print(f"Mengimpor leads dari {MASTER_CSV}...")
        df = pd.read_csv(MASTER_CSV)

        # Mapping WA ready leads for exact phone_wa match
        wa_map = {}
        if WA_CSV.exists():
            df_wa = pd.read_csv(WA_CSV)
            for _, r in df_wa.iterrows():
                comp = str(r.get('company_name', '')).strip()
                p_wa = str(r.get('phone_wa', '')).strip()
                if p_wa.endswith('.0'):
                    p_wa = p_wa[:-2]
                if comp and p_wa:
                    wa_map[comp] = p_wa

        for _, row in df.iterrows():
            comp = str(row.get('company_name', '')).strip()
            if not comp or comp.lower() == 'nan':
                continue

            scale = str(row.get('scale', '')).strip() if pd.notna(row.get('scale')) else ''
            loc = str(row.get('location', '')).strip() if pd.notna(row.get('location')) else ''
            wil = str(row.get('wilayah', '')).strip() if pd.notna(row.get('wilayah')) else ''
            addr = str(row.get('address', '')).strip() if pd.notna(row.get('address')) else ''
            phone_raw = str(row.get('phone_number', '')).strip() if pd.notna(row.get('phone_number')) else ''
            email = str(row.get('email', '')).strip() if pd.notna(row.get('email')) else ''
            website = str(row.get('website', '')).strip() if pd.notna(row.get('website')) else ''
            products = str(row.get('products', '')).strip() if pd.notna(row.get('products')) else ''
            source_url = str(row.get('source_url', '')).strip() if pd.notna(row.get('source_url')) else ''
            
            score_val = row.get('score', 50)
            try:
                score = int(score_val) if pd.notna(score_val) else 50
            except:
                score = 50

            kat = str(row.get('kategori', 'Warm')).strip() if pd.notna(row.get('kategori')) else 'Warm'

            # WhatsApp resolution
            phone_wa = wa_map.get(comp, "")
            if not phone_wa and pd.notna(row.get('phone_wa')):
                p_candidate = str(row.get('phone_wa')).strip()
                if p_candidate.endswith('.0'):
                    p_candidate = p_candidate[:-2]
                if p_candidate.startswith('628'):
                    phone_wa = p_candidate

            if not phone_wa and phone_raw:
                extracted = extract_indonesia_mobile(phone_raw)
                if extracted:
                    phone_wa = extracted

            is_wa_valid = 1 if (phone_wa and phone_wa.startswith('628')) else 0
            phone_display = format_phone_display(phone_wa) if is_wa_valid else phone_raw

            cursor.execute("""
            INSERT INTO leads (
                company_name, scale, location, wilayah, address, phone_number,
                phone_wa, phone_wa_display, is_wa_valid, email, website, products,
                score, kategori, source_url, outreach_status, follow_up_notes,
                segment, industry, contact_person, job_title
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dihubungi', '', 'Segmen B: Manufaktur Sepatu', 'Manufaktur Alas Kaki', ?, 'Owner / Export Director')
            """, (
                comp, scale, loc, wil, addr, phone_raw,
                phone_wa, phone_display, is_wa_valid, email, website, products,
                score, kat, source_url, f"Pimpinan {comp}"
            ))

        print(f"Berhasil mengimpor baris ke tabel leads.")

    conn.commit()
    conn.close()

def build_wa_message(template_text, lead):
    comp = lead.get('company_name', 'Bapak/Ibu').strip()
    loc = lead.get('location') or lead.get('wilayah') or 'Indonesia'
    prod = lead.get('products') or 'produk safety footwear'
    if len(prod) > 120:
        prod = prod[:117] + "..."
    contact = lead.get('contact_person') or 'Bapak/Ibu Tim Procurement & K3'
    job = lead.get('job_title') or 'Procurement / HSE Manager'
    industry = lead.get('industry') or 'Industri'

    msg = template_text.replace("{company_name}", comp)
    msg = msg.replace("{location}", str(loc).strip())
    msg = msg.replace("{wilayah}", str(lead.get('wilayah', loc)).strip())
    msg = msg.replace("{products}", str(prod).strip())
    msg = msg.replace("{contact_person}", str(contact).strip())
    msg = msg.replace("{job_title}", str(job).strip())
    msg = msg.replace("{industry}", str(industry).strip())
    return msg

def get_leads(search="", wilayah="", scale="", kategori="", status="", segment="", industry="", batch_day="", wa_only=False, sort_by="score_desc", limit=50, offset=0):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM leads WHERE 1=1"
    params = []

    if search:
        query += " AND (company_name LIKE ? OR products LIKE ? OR location LIKE ? OR address LIKE ? OR email LIKE ? OR contact_person LIKE ? OR job_title LIKE ? OR batch_day LIKE ?)"
        s = f"%{search}%"
        params.extend([s, s, s, s, s, s, s, s])

    if batch_day:
        query += " AND batch_day = ?"
        params.append(batch_day)

    if segment:
        query += " AND segment = ?"
        params.append(segment)

    if industry:
        query += " AND industry = ?"
        params.append(industry)

    if wilayah:
        query += " AND wilayah = ?"
        params.append(wilayah)

    if scale:
        query += " AND scale = ?"
        params.append(scale)

    if kategori:
        query += " AND kategori = ?"
        params.append(kategori)

    if status:
        query += " AND outreach_status = ?"
        params.append(status)

    if wa_only:
        query += " AND is_wa_valid = 1"

    # Count total matching
    count_query = "SELECT COUNT(*) FROM (" + query + ")"
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    # Sorting
    if sort_by == "score_desc":
        query += " ORDER BY score DESC, company_name ASC"
    elif sort_by == "name_asc":
        query += " ORDER BY company_name ASC"
    elif sort_by == "last_contacted":
        query += " ORDER BY last_contacted_at DESC NULLS LAST, score DESC"
    elif sort_by == "status":
        query += " ORDER BY outreach_status ASC, score DESC"
    else:
        query += " ORDER BY score DESC, company_name ASC"

    query += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()

    return {"total": total_count, "items": rows, "limit": limit, "offset": offset}

def get_lead_by_id(lead_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM leads WHERE id = ?", (lead_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_lead(lead_id, data):
    conn = get_db_connection()
    cursor = conn.cursor()

    fields = []
    values = []

    allowed_fields = [
        'company_name', 'scale', 'location', 'wilayah', 'address',
        'phone_number', 'phone_wa', 'email', 'website', 'products',
        'score', 'kategori', 'outreach_status', 'follow_up_notes',
        'last_contacted_at', 'segment', 'industry', 'contact_person',
        'job_title', 'linkedin_url'
    ]

    for key in allowed_fields:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(data[key])

    if 'phone_wa' in data:
        p_clean = extract_indonesia_mobile(str(data['phone_wa']))
        if not p_clean and str(data['phone_wa']).startswith('628'):
            p_clean = re.sub(r'\D', '', str(data['phone_wa']))
        fields.append("is_wa_valid = ?")
        values.append(1 if p_clean else 0)
        fields.append("phone_wa_display = ?")
        values.append(format_phone_display(p_clean) if p_clean else data['phone_wa'])

    fields.append("updated_at = CURRENT_TIMESTAMP")
    values.append(lead_id)

    sql = f"UPDATE leads SET {', '.join(fields)} WHERE id = ?"
    cursor.execute(sql, values)
    conn.commit()
    conn.close()
    return get_lead_by_id(lead_id)

def add_lead(data):
    conn = get_db_connection()
    cursor = conn.cursor()

    comp = data.get('company_name', '').strip()
    if not comp:
        raise ValueError("Nama perusahaan wajib diisi")

    phone_wa_raw = data.get('phone_wa', '') or data.get('phone_number', '')
    p_clean = extract_indonesia_mobile(str(phone_wa_raw))
    if not p_clean and str(phone_wa_raw).startswith('628'):
        p_clean = re.sub(r'\D', '', str(phone_wa_raw))

    is_wa_valid = 1 if p_clean else 0
    phone_display = format_phone_display(p_clean) if p_clean else str(phone_wa_raw)

    segment = data.get('segment', 'Segmen A: Buyer Korporat')
    industry = data.get('industry', 'Konstruksi & EPC')
    contact_person = data.get('contact_person', '')
    job_title = data.get('job_title', 'Head of Procurement')
    linkedin_url = data.get('linkedin_url', '')

    cursor.execute("""
    INSERT INTO leads (
        company_name, scale, location, wilayah, address, phone_number,
        phone_wa, phone_wa_display, is_wa_valid, email, website, products,
        score, kategori, source_url, outreach_status, follow_up_notes,
        segment, industry, contact_person, job_title, linkedin_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        comp,
        data.get('scale', 'Besar'),
        data.get('location', ''),
        data.get('wilayah', ''),
        data.get('address', ''),
        data.get('phone_number', phone_wa_raw),
        p_clean or data.get('phone_wa', ''),
        phone_display,
        is_wa_valid,
        data.get('email', ''),
        data.get('website', ''),
        data.get('products', 'Sepatu Safety K3 SNI/EN ISO'),
        data.get('score', 85),
        data.get('kategori', 'Hot'),
        data.get('source_url', 'Manual Input / Pipeline'),
        data.get('outreach_status', 'Belum Dihubungi'),
        data.get('follow_up_notes', ''),
        segment,
        industry,
        contact_person,
        job_title,
        linkedin_url
    ))

    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return get_lead_by_id(new_id)

def mark_lead_contacted(lead_id, status="Sudah Dihubungi", notes=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if notes is not None:
        cursor.execute("""
        UPDATE leads 
        SET outreach_status = ?, follow_up_notes = ?, last_contacted_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        """, (status, notes, now_str, lead_id))
    else:
        cursor.execute("""
        UPDATE leads 
        SET outreach_status = ?, last_contacted_at = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        """, (status, now_str, lead_id))

    conn.commit()
    conn.close()
    return get_lead_by_id(lead_id)

def get_stats():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM leads")
    total_leads = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE is_wa_valid = 1")
    total_wa = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE outreach_status != 'Belum Dihubungi'")
    total_contacted = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM leads WHERE outreach_status = 'Tertarik Ekspor' OR outreach_status = 'Tertarik Demo/Katalog'")
    total_interested = cursor.fetchone()[0]

    # By Segment
    cursor.execute("SELECT segment, COUNT(*) as cnt FROM leads GROUP BY segment")
    by_segment = {row['segment']: row['cnt'] for row in cursor.fetchall()}

    # By Industry
    cursor.execute("SELECT industry, COUNT(*) as cnt FROM leads WHERE industry != '' GROUP BY industry ORDER BY cnt DESC LIMIT 10")
    by_industry = {row['industry']: row['cnt'] for row in cursor.fetchall()}

    # By Status
    cursor.execute("SELECT outreach_status, COUNT(*) as cnt FROM leads GROUP BY outreach_status")
    by_status = {row['outreach_status']: row['cnt'] for row in cursor.fetchall()}

    # By Wilayah
    cursor.execute("SELECT wilayah, COUNT(*) as cnt FROM leads WHERE wilayah != '' GROUP BY wilayah ORDER BY cnt DESC LIMIT 10")
    by_wilayah = {row['wilayah']: row['cnt'] for row in cursor.fetchall()}

    # By Kategori
    cursor.execute("SELECT kategori, COUNT(*) as cnt FROM leads GROUP BY kategori")
    by_kategori = {row['kategori']: row['cnt'] for row in cursor.fetchall()}

    conn.close()
    return {
        "total_leads": total_leads,
        "total_wa": total_wa,
        "total_contacted": total_contacted,
        "total_interested": total_interested,
        "by_segment": by_segment,
        "by_industry": by_industry,
        "by_status": by_status,
        "by_wilayah": by_wilayah,
        "by_kategori": by_kategori
    }

def get_templates(segment="", channel=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM templates WHERE 1=1"
    params = []

    if segment and segment != 'all':
        query += " AND (segment = ? OR segment = 'all')"
        params.append(segment)

    if channel and channel != 'all':
        query += " AND (channel = ? OR channel = 'all')"
        params.append(channel)

    query += " ORDER BY is_default DESC, id ASC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows

def save_template(title, message_text, is_default=0, segment="all", channel="whatsapp", subject="", template_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()

    if is_default:
        cursor.execute("UPDATE templates SET is_default = 0")

    if template_id:
        cursor.execute("""
        UPDATE templates 
        SET title = ?, message_text = ?, is_default = ?, segment = ?, channel = ?, subject = ? 
        WHERE id = ?
        """, (title, message_text, is_default, segment, channel, subject, template_id))
    else:
        cursor.execute("""
        INSERT INTO templates (title, message_text, is_default, segment, channel, subject) 
        VALUES (?, ?, ?, ?, ?, ?)
        """, (title, message_text, is_default, segment, channel, subject))

    conn.commit()
    conn.close()
    return get_templates()

def export_leads_df(status="", wa_only=False, wilayah="", segment="", industry=""):
    conn = get_db_connection()
    query = """
    SELECT 
        company_name AS 'Nama Perusahaan',
        segment AS 'Segmen Target',
        industry AS 'Sektor Industri',
        scale AS 'Skala',
        contact_person AS 'Nama PIC / Decision Maker',
        job_title AS 'Jabatan PIC',
        phone_wa_display AS 'Nomor WhatsApp',
        phone_number AS 'No Telepon Asal',
        email AS 'Email',
        website AS 'Website',
        products AS 'Kebutuhan / Produk',
        location AS 'Lokasi',
        wilayah AS 'Wilayah',
        address AS 'Alamat Lengkap',
        score AS 'Skor Lead',
        kategori AS 'Kategori',
        outreach_status AS 'Status Outreach',
        follow_up_notes AS 'Catatan Follow-Up',
        last_contacted_at AS 'Waktu Terakhir Kontak',
        linkedin_url AS 'LinkedIn',
        source_url AS 'Sumber Data'
    FROM leads WHERE 1=1
    """
    params = []
    if segment:
        query += " AND segment = ?"
        params.append(segment)
    if industry:
        query += " AND industry = ?"
        params.append(industry)
    if status:
        query += " AND outreach_status = ?"
        params.append(status)
    if wa_only:
        query += " AND is_wa_valid = 1"
    if wilayah:
        query += " AND wilayah = ?"
        params.append(wilayah)

    query += " ORDER BY score DESC, company_name ASC"

    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def get_settings():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings")
    rows = {r['key']: r['value'] for r in cursor.fetchall()}
    conn.close()
    return {
        "gsheet_url": rows.get("gsheet_url", ""),
        "gsheet_authuser": rows.get("gsheet_authuser", "0"),
        "gsheet_webhook_url": rows.get("gsheet_webhook_url", ""),
        "ai_account_note": rows.get("ai_account_note", "")
    }

def save_settings(data):
    conn = get_db_connection()
    cursor = conn.cursor()
    allowed = ["gsheet_url", "gsheet_authuser", "gsheet_webhook_url", "ai_account_note"]
    for k in allowed:
        if k in data:
            cursor.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (k, str(data[k] or "").strip())
            )
    conn.commit()
    conn.close()
    return get_settings()

def clean_fake_corporate_wa():
    """Hapus nomor WA palsu pada Segmen A (Buyer Korporat) yang dibuat dari nomor telepon kantor 021/031."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE leads
        SET phone_wa = '',
            phone_wa_display = phone_number,
            is_wa_valid = 0,
            warning_note = CASE
                WHEN warning_note = '' OR warning_note IS NULL
                THEN 'Korporat BUMN/Tbk: Hubungi via Email / e-Procurement (bukan WA)'
                ELSE warning_note
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE segment = 'Segmen A: Buyer Korporat'
          AND (batch_day IS NULL OR batch_day = '')
          AND (phone_number LIKE '(0%' OR phone_number LIKE '021%' OR phone_number LIKE '031%' OR phone_number LIKE '+62 21%' OR phone_number LIKE '+6221%' OR phone_wa LIKE '628128%')
    """)
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected

def ingest_extension_leads(items):
    """Terima list lead dari HOTS Chrome Extension, bersihkan nomor WA vs Kantor, cek duplikat, simpan ke SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    inserted = 0
    updated = 0
    duplicates_flagged = 0
    saved_records = []

    for item in items:
        comp = str(item.get("company_name") or item.get("title") or "").strip()
        if not comp:
            continue

        raw_phone = str(item.get("phone_number") or item.get("phone") or "").strip()
        # STRICT GUARDRAIL: Hanya ekstrak nomor HP Indonesia (08xx / +628xx), BUKAN telepon kantor 021/031
        phone_wa = extract_indonesia_mobile(raw_phone)
        is_wa_valid = 1 if (phone_wa and phone_wa.startswith("628")) else 0
        phone_display = format_phone_display(phone_wa) if is_wa_valid else raw_phone

        email = str(item.get("email") or "").strip()
        website = str(item.get("website") or "").strip()
        address = str(item.get("address") or "").strip()
        location = str(item.get("location") or item.get("city") or "").strip()
        wilayah = str(item.get("wilayah") or location or "Lainnya").strip()
        contact_person = str(item.get("contact_person") or "").strip()
        job_title = str(item.get("job_title") or "").strip()
        linkedin_url = str(item.get("linkedin_url") or "").strip()
        source_url = str(item.get("source_url") or "").strip()
        products = str(item.get("products") or item.get("category") or "").strip()
        segment = str(item.get("segment") or "Segmen A: Reseller & Toko K3").strip()
        industry = str(item.get("industry") or "Safety & Alat K3").strip()
        batch_day = str(item.get("batch_day") or "Extension Scrape").strip()
        warning_note = str(item.get("warning_note") or "").strip()

        # Cek duplikasi nomor WA di perusahaan berbeda
        if is_wa_valid:
            cursor.execute("SELECT company_name FROM leads WHERE phone_wa = ? AND LOWER(company_name) != LOWER(?)", (phone_wa, comp))
            dup_phone = cursor.fetchone()
            if dup_phone:
                duplicates_flagged += 1
                note = f"Nomor WA sama dengan {dup_phone['company_name']}. Verifikasi manual!"
                warning_note = f"{warning_note} | {note}".strip(" |")

        score = 40
        if is_wa_valid: score += 30
        if email: score += 15
        if website or linkedin_url: score += 10
        if contact_person: score += 5
        score = min(100, score)
        kategori = "Hot" if score >= 70 else ("Warm" if score >= 40 else "Cold")

        cursor.execute("SELECT id FROM leads WHERE LOWER(company_name) = LOWER(?)", (comp,))
        existing = cursor.fetchone()

        if existing:
            lead_id = existing["id"]
            cursor.execute("""
                UPDATE leads
                SET address = COALESCE(NULLIF(address, ''), ?),
                    location = COALESCE(NULLIF(location, ''), ?),
                    phone_number = COALESCE(NULLIF(phone_number, ''), ?),
                    phone_wa = CASE WHEN phone_wa IS NULL OR phone_wa = '' THEN ? ELSE phone_wa END,
                    phone_wa_display = CASE WHEN phone_wa_display IS NULL OR phone_wa_display = '' THEN ? ELSE phone_wa_display END,
                    is_wa_valid = MAX(is_wa_valid, ?),
                    email = COALESCE(NULLIF(email, ''), ?),
                    website = COALESCE(NULLIF(website, ''), ?),
                    contact_person = COALESCE(NULLIF(contact_person, ''), ?),
                    job_title = COALESCE(NULLIF(job_title, ''), ?),
                    linkedin_url = COALESCE(NULLIF(linkedin_url, ''), ?),
                    source_url = COALESCE(NULLIF(source_url, ''), ?),
                    warning_note = CASE WHEN ? != '' THEN ? ELSE warning_note END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (address, location, raw_phone, phone_wa, phone_display, is_wa_valid, email, website, contact_person, job_title, linkedin_url, source_url, warning_note, warning_note, lead_id))
            updated += 1
        else:
            cursor.execute("""
                INSERT INTO leads (
                    company_name, scale, location, wilayah, address, phone_number,
                    phone_wa, phone_wa_display, is_wa_valid, email, website, products,
                    score, kategori, source_url, outreach_status, follow_up_notes,
                    segment, industry, contact_person, job_title, linkedin_url, batch_day, warning_note
                ) VALUES (?, 'Menengah', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dihubungi', '', ?, ?, ?, ?, ?, ?, ?)
            """, (
                comp, location, wilayah, address, raw_phone,
                phone_wa, phone_display, is_wa_valid, email, website, products,
                score, kategori, source_url,
                segment, industry, contact_person, job_title, linkedin_url, batch_day, warning_note
            ))
            lead_id = cursor.lastrowid
            inserted += 1

        saved_records.append({
            "id": lead_id,
            "company_name": comp,
            "contact_person": contact_person,
            "job_title": job_title,
            "phone_wa": phone_wa,
            "phone_number": raw_phone,
            "is_wa_valid": is_wa_valid,
            "email": email,
            "location": location,
            "website": website,
            "linkedin_url": linkedin_url,
            "segment": segment,
            "batch_day": batch_day,
            "warning_note": warning_note
        })

    conn.commit()
    conn.close()
    return {
        "inserted": inserted,
        "updated": updated,
        "duplicates_flagged": duplicates_flagged,
        "records": saved_records
    }

if __name__ == "__main__":
    init_db()
    stats = get_stats()
    print("Database Initialized Successfully!")
    print(stats)
