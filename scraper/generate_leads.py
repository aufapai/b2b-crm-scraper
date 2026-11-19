"""Scrape leads produsen sepatu di Indonesia: Ekstraksi cerdas via Gemini API online,
deduplikasi, scoring leads, pembuatan direct WhatsApp outreach link, dan export ke CSV & Excel.
"""
import argparse, csv, json, os, re, sys, time, urllib.parse
from datetime import date
from pathlib import Path

# Safe encoding on Windows PowerShell/CMD
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

import httpx
import pandas as pd
from bs4 import BeautifulSoup
from dotenv import load_dotenv

BASE = Path(__file__).parent
ROOT = BASE.parent
load_dotenv(BASE / ".env")

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}

FIELDS = ["company_name", "scale", "location", "address", "phone_number", "email", "website", "products"]
PROMPT = f"""Kamu adalah asisten analisis data B2B alas kaki Indonesia.
Ekstrak profil produsen/pabrik/pengrajin/UMKM sepatu, sandal, atau alas kaki dari teks halaman web berikut.
Balas HANYA JSON valid: {{"leads": [{{...}}]}} dengan field: {", ".join(FIELDS)}.

Panduan ekstraksi:
- company_name: Nama resmi PT / CV / Bengkel / Brand produsen.
- scale: "UMKM", "Menengah", "Besar", atau "" jika tidak ada informasi.
- location: Kota atau Kabupaten (misal: "Bandung", "Tangerang", "Sidoarjo", "Mojokerto", "Garut", "Medan").
- address: Alamat lengkap pabrik atau workshop.
- phone_number: Nomor telepon atau WhatsApp kontak bisnis.
- email: Alamat email perusahaan jika ada.
- website: URL situs perusahaan jika ada.
- products: Spesialisasi produksi (contoh: "Sepatu Olahraga, Sneakers, Safety Shoes, Sandal Kulit").
- JANGAN mengarang data. Biarkan "" jika field tidak ada di teks sumber.
- Abaikan toko retailer murni jika jelas bukan produsen/pembuat.

Teks halaman sumber:
"""

SENTRA_MAP = {
    "tangerang": "Tangerang",
    "banten": "Tangerang",
    "sidoarjo": "Sidoarjo",
    "surabaya": "Surabaya",
    "cibaduyut": "Cibaduyut",
    "bandung": "Bandung",
    "mojokerto": "Mojokerto",
    "garut": "Garut",
    "medan": "Medan",
    "jakarta": "Jakarta",
    "bogor": "Bogor",
    "bekasi": "Bekasi",
    "semarang": "Jawa Tengah",
    "brebes": "Jawa Tengah",
    "jepara": "Jawa Tengah",
    "magetan": "Jawa Timur",
}
PRODUK_KW = ["sepatu", "sandal", "alas kaki", "footwear", "shoe", "shoes", "boots", "sneaker", "pantofel", "sol", "outsole"]


# ---------- fetch ----------
def page_text(url: str) -> str:
    html = ""
    try:
        r = httpx.get(url, headers=UA, timeout=12, follow_redirects=True)
        if r.status_code == 200:
            html = r.text
    except Exception as e:
        print(f"  [fetch note]: {e}")
    return html_to_text(html)[:30000]


def html_to_text(html: str) -> str:
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "noscript", "svg", "iframe"]):
        t.decompose()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("tel:", "mailto:", "https://wa.me", "https://api.whatsapp")):
            a.append(f" [{href}]")
    text = soup.get_text("\n")
    return re.sub(r"\n\s*\n+", "\n", text).strip()


# ---------- LLM ----------
def clean_json_str(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n", "", s)
        s = re.sub(r"\n```$", "", s)
    return s.strip()


def ask_gemini(text: str, max_retries: int = 4) -> list[dict]:
    from google import genai
    from google.genai import errors
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    for attempt in range(max_retries):
        try:
            r = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=PROMPT + text,
                config={"response_mime_type": "application/json", "temperature": 0},
            )
            raw_resp = clean_json_str(r.text or "")
            if not raw_resp:
                return []
            parsed = json.loads(raw_resp)
            if isinstance(parsed, list):
                return parsed
            return parsed.get("leads", [])
        except errors.APIError as e:
            err_str = str(e).lower()
            if e.code == 429 or "quota" in err_str or "resource_exhausted" in err_str:
                wait_sec = 15 * (attempt + 1)
                print(f"  [RPM rate limit] tunggu {wait_sec}s...")
                time.sleep(wait_sec)
                continue
            print(f"  [Gemini error]: {e}")
            return []
        except Exception as ex:
            print(f"  [Parse error]: {ex}")
            return []
    return []


# ---------- post-process ----------
def norm_phone(p: str) -> str:
    if not p:
        return ""
    matches = re.finditer(r'(?:(?:\+?62)|0)8[1-9][0-9\-\.\s\(\)]{6,16}', str(p))
    for m in matches:
        raw = m.group(0)
        digits = re.sub(r'\D', '', raw)
        if digits.startswith('08'):
            digits = '62' + digits[1:]
        elif digits.startswith('8'):
            digits = '62' + digits
        if digits.startswith('628') and 10 <= len(digits) <= 15:
            return digits
    return ""


def infer_wilayah(row, default_wil: str) -> str:
    combined = f"{row.get('location', '')} {row.get('address', '')}".lower()
    for kw, label in SENTRA_MAP.items():
        if kw in combined:
            return label
    return default_wil if default_wil and default_wil != "Nasional" else "Indonesia"


def score(row) -> int:
    s = 0
    if row.get("phone_wa"):
        s += 30
    if "@" in str(row.get("email", "")):
        s += 15
    if row.get("scale") in ("UMKM", "Menengah", "Besar"):
        s += 10
    prod_comb = f"{row.get('products', '')} {row.get('company_name', '')}".lower()
    if any(k in prod_comb for k in PRODUK_KW):
        s += 20
    loc_comb = f"{row.get('location', '')} {row.get('address', '')} {row.get('wilayah', '')}".lower()
    if any(k in loc_comb for k in SENTRA_MAP.keys()):
        s += 15
    if row.get("website") or len(str(row.get("address", ""))) > 15:
        s += 10
    return min(s, 100)


def wa_link(row) -> str:
    phone = row.get("phone_wa", "")
    if not phone:
        return ""
    tpl_file = BASE / "wa_template.txt"
    if tpl_file.exists():
        tpl = tpl_file.read_text(encoding="utf-8")
    else:
        tpl = "Halo {nama}, salam kenal dari PT Indo Sukses Semesta (HOTs Trading). Kami ingin mengajak kerja sama produsen {produk} di {kota} untuk peluang ekspor global."

    company = row.get("company_name") or "Bapak/Ibu"
    products = row.get("products") or "produk alas kaki"
    city = row.get("location") or row.get("wilayah") or "Indonesia"

    msg = tpl.format(nama=company, produk=products, kota=city)
    return f"https://wa.me/{phone}?text={urllib.parse.quote(msg)}"


def build_output(raw_dir: Path):
    rows = []
    files = list(raw_dir.glob("*.json"))
    for f in sorted(files):
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
            for lead in d.get("leads", []):
                company = str(lead.get("company_name") or "").strip()
                if not company or len(company) < 2:
                    continue
                row_item = {k: str(lead.get(k) or "").strip() for k in FIELDS}
                row_item["wilayah"] = infer_wilayah(row_item, d.get("wilayah", ""))
                row_item["source_url"] = d.get("url", "")
                row_item["llm_used"] = d.get("llm", "")
                rows.append(row_item)
        except Exception as e:
            print(f"Error reading {f.name}: {e}")

    if not rows:
        print("Belum ada leads yang berhasil diekstrak.")
        return None

    df = pd.DataFrame(rows)
    df["phone_wa"] = df["phone_number"].map(norm_phone)
    # Deduplikasi berdasarkan nama perusahaan
    df["_key"] = df["company_name"].str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
    df = df.sort_values("phone_wa", ascending=False).drop_duplicates("_key").drop(columns=["_key"])

    df["score"] = df.apply(score, axis=1)
    df["kategori"] = pd.cut(df["score"], bins=[-1, 39, 69, 100], labels=["Cold", "Warm", "Hot"])
    df["wa_link"] = df.apply(wa_link, axis=1)
    df = df.sort_values("score", ascending=False)

    out = ROOT / "output"
    out.mkdir(parents=True, exist_ok=True)
    today_str = date.today().strftime("%Y%m%d")
    csv_path = out / f"leads_produsen_sepatu_{today_str}.csv"
    xlsx_path = out / f"leads_produsen_sepatu_{today_str}.xlsx"

    # Export CSV
    try:
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    except Exception:
        alt_csv = out / f"leads_produsen_sepatu_{today_str}_{int(time.time())}.csv"
        df.to_csv(alt_csv, index=False, encoding="utf-8-sig")
        csv_path = alt_csv

    # Export Excel (safe against locked file)
    try:
        df.to_excel(xlsx_path, index=False)
    except Exception:
        alt_xlsx = out / f"leads_produsen_sepatu_{today_str}_{int(time.time())}.xlsx"
        df.to_excel(alt_xlsx, index=False)
        xlsx_path = alt_xlsx

    print(f"\n==========================================")
    print(f"BERHASIL! Total {len(df)} leads unik telah diekspor:")
    print(f"1. CSV  : {csv_path}")
    print(f"2. Excel: {xlsx_path}")
    print(f"==========================================")
    print("\nDistribusi Leads per Wilayah & Kategori:")
    dist = df.groupby(["wilayah", "kategori"], observed=True).size().unstack(fill_value=0)
    print(dist)
    return df


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="Batasi jumlah URL")
    ap.add_argument("--rebuild", action="store_true", help="Hanya bangun ulang CSV/XLSX dari raw")
    a = ap.parse_args()

    today_str = date.today().strftime("%Y%m%d")
    raw_dir = ROOT / "output" / "raw" / today_str
    raw_dir.mkdir(parents=True, exist_ok=True)

    if a.rebuild:
        return build_output(raw_dir)

    with open(BASE / "urls.csv", encoding="utf-8") as f:
        targets = list(csv.DictReader(f))

    if a.limit:
        targets = targets[: a.limit]

    print(f"Mulai scraping {len(targets)} URL target via Gemini 2.5 Flash online...")

    for i, t in enumerate(targets, 1):
        dest = raw_dir / f"{i:03d}.json"
        if dest.exists():
            continue

        print(f"\n[{i}/{len(targets)}] [{t['wilayah']}] {t['url']}")
        try:
            text = page_text(t["url"])
            if len(text) < 100:
                print("  (Halaman sangat pendek atau tidak dapat diakses)")
                dest.write_text(json.dumps({**t, "llm": "skip", "leads": []}, ensure_ascii=False, indent=2), encoding="utf-8")
                continue

            leads = ask_gemini(text)
            dest.write_text(json.dumps({**t, "llm": "gemini", "leads": leads}, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  -> {len(leads)} leads ditemukan (gemini)")
        except Exception as e:
            print(f"  GAGAL URL: {e}", file=sys.stderr)
            dest.write_text(json.dumps({**t, "llm": "failed", "leads": []}, ensure_ascii=False, indent=2), encoding="utf-8")

        time.sleep(3)  # Jeda 3 detik

    build_output(raw_dir)


if __name__ == "__main__":
    main()
