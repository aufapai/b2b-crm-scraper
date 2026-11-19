"""Mengintegrasikan leads baru dari:
1. BPIPI Kemenperin (Indonesia Footwear Network - IFN)
2. Kemendag InaExport (Direktori Eksportir Alas Kaki)
3. Sentra Mojokerto, Sukaregang Garut, Magetan, Klaten & Brand Manufaktur Besar
Ke dalam database leads utama dengan scoring & WhatsApp link otomatis.
"""
import json, re, time, urllib.parse
from datetime import date
from pathlib import Path
import httpx
from bs4 import BeautifulSoup
import pandas as pd

ROOT = Path(__file__).parent.parent
RAW_DIR = ROOT / "output" / "raw" / "20261007"
RAW_DIR.mkdir(parents=True, exist_ok=True)

# 1. Scraping profil BPIPI IFN
headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
base_ifn = "https://ifn.kemenperin.go.id"

print("[1/3] Mengambil data dari BPIPI Kemenperin (Indonesia Footwear Network)...")
r = httpx.get(base_ifn, headers=headers, timeout=15.0, verify=False)
soup = BeautifulSoup(r.text, "html.parser")
profile_urls = []
for a in soup.find_all("a", href=True):
    href = a["href"]
    if "/profil/" in href:
        full = href if href.startswith("http") else base_ifn + href
        if full not in profile_urls:
            profile_urls.append(full)

print(f"Total URL profil IFN: {len(profile_urls)}")

new_leads = []

for idx, u in enumerate(profile_urls, 1):
    try:
        res = httpx.get(u, headers=headers, timeout=10.0, verify=False)
        if res.status_code != 200:
            continue
        psoup = BeautifulSoup(res.text, "html.parser")
        text = psoup.get_text()
        if "Profil bisnis ini tidak tersedia untuk publik" in text:
            continue

        title_el = psoup.select_one("div.profile-title, div.title, h2, h3, h1")
        name = title_el.get_text().strip() if title_el else ""
        if not name or "APRISINDO" in name:
            continue

        wa_match = re.search(r"WhatsApp\s*:\s*([0-9\+\-\s]+)", text, re.I)
        phone = wa_match.group(1).strip() if wa_match else ""
        if not phone:
            tel_match = re.search(r"(?:Telepon|Telp|Phone|Kontak|Call)\s*:\s*([0-9\+\-\s\(\)]{8,20})", text, re.I)
            phone = tel_match.group(1).strip() if tel_match else ""

        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        email = email_match.group(0).strip() if email_match else ""
        if "kemenperin.go.id" in email or "gmail.com" in email and "ifn.kemenperin" in email:
            email = ""  # abaikan email portal kemenperin

        loc_match = re.search(r"(?:KABUPATEN|KOTA)\s+([A-Z\s]+)", text)
        location = loc_match.group(1).strip().title() if loc_match else ""

        # Deteksi wilayah sentra
        loc_lower = location.lower()
        if "mojokerto" in loc_lower or "mojokerto" in text.lower():
            wilayah = "Mojokerto"
        elif "sidoarjo" in loc_lower or "sidoarjo" in text.lower():
            wilayah = "Sidoarjo"
        elif "bandung" in loc_lower or "cibaduyut" in text.lower():
            wilayah = "Bandung"
        elif "tangerang" in loc_lower:
            wilayah = "Tangerang"
        elif "surabaya" in loc_lower:
            wilayah = "Surabaya"
        elif "garut" in loc_lower:
            wilayah = "Garut"
        elif "magelang" in loc_lower or "semarang" in loc_lower or "kebumen" in loc_lower or "ponorogo" in loc_lower:
            wilayah = "Jawa Tengah"
        elif "jakarta" in loc_lower:
            wilayah = "Jakarta"
        else:
            wilayah = location if location else "Nasional"

        # Deskripsi produk
        desc = ""
        p_tags = psoup.find_all("p")
        for p in p_tags:
            p_txt = p.get_text().strip()
            if len(p_txt) > 30 and any(w in p_txt.lower() for w in ["sepatu", "sandal", "alas kaki", "kulit", "footwear", "sol", "outsole"]):
                desc = p_txt[:200]
                break
        if not desc:
            desc = "Alas Kaki, Sepatu, Sandal"

        new_leads.append({
            "company_name": name,
            "scale": "UMKM" if any(w in name.lower() for w in ["shoes", "sandal", "craft", "collection"]) else "Menengah",
            "location": location if location else wilayah,
            "address": f"{location}, Indonesia" if location else "Indonesia",
            "phone_number": phone,
            "email": email,
            "website": u,
            "products": desc,
            "wilayah": wilayah,
            "source_url": u,
            "llm_used": "bpipi_ifn"
        })
    except Exception as e:
        pass

print(f"[+] Berhasil mengumpulkan {len(new_leads)} leads dari BPIPI IFN Kemenperin!")

# 2. Data Terverifikasi dari Kemendag InaExport & Sentra Terkurasi Tambahan
print("\n[2/3] Menambahkan data terverifikasi Kemendag InaExport & Sentra...")
curated_leads = [
    {
        "company_name": "PT. Miumosa Artha Mandiri",
        "scale": "Menengah",
        "location": "Jakarta",
        "address": "Jakarta, Indonesia",
        "phone_number": "+62811727111",
        "email": "anin@miumosa.com",
        "website": "https://inaexport.id",
        "products": "Footwear & Accessories, Leather Shoes",
        "wilayah": "Jakarta",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Mutri Naga Lintang",
        "scale": "Menengah",
        "location": "Surabaya",
        "address": "Surabaya, Jawa Timur",
        "phone_number": "+6288235967348",
        "email": "merrytrisson22@gmail.com",
        "website": "https://inaexport.id",
        "products": "Alas Kaki, Sepatu, Sandal Kasual",
        "wilayah": "Surabaya",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Citra Sejati",
        "scale": "Menengah",
        "location": "Jawa Timur",
        "address": "Jawa Timur, Indonesia",
        "phone_number": "+6282338020117",
        "email": "andytantyo@gmail.com",
        "website": "https://inaexport.id",
        "products": "Footwear, Sandal, Sepatu",
        "wilayah": "Sidoarjo",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Kupu Sutera",
        "scale": "Menengah",
        "location": "Pasuruan",
        "address": "Pasuruan, Jawa Timur",
        "phone_number": "+6282245383814",
        "email": "Silkerindo@gmail.com",
        "website": "https://inaexport.id",
        "products": "Sepatu Serat Sutera, Alas Kaki Etnik",
        "wilayah": "Pasuruan",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "PT. Felistianova Kreatif Nusantara",
        "scale": "Menengah",
        "location": "Jakarta",
        "address": "Jakarta, Indonesia",
        "phone_number": "",
        "email": "stevitri.sarasti@gmail.com",
        "website": "https://inaexport.id",
        "products": "Bags and Shoes Batik / Tenun",
        "wilayah": "Jakarta",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "PT. Aesthetica Moda Naturalis",
        "scale": "Menengah",
        "location": "Bandung",
        "address": "Bandung, Jawa Barat",
        "phone_number": "",
        "email": "aestheticamodanaturalis@gmail.com",
        "website": "https://inaexport.id",
        "products": "Alas Kaki Ramah Lingkungan, Sepatu Fashion",
        "wilayah": "Bandung",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "Citra Digdaya Lestari",
        "scale": "UMKM",
        "location": "Bandung",
        "address": "Bandung, Jawa Barat",
        "phone_number": "+6285659666650",
        "email": "priliscya@smelltheperfume.com",
        "website": "https://inaexport.id",
        "products": "Hand-crochet Slippers, Sandal Rumah",
        "wilayah": "Bandung",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "PT. Zain Industri Indonesia",
        "scale": "Menengah",
        "location": "Jawa Barat",
        "address": "Jawa Barat, Indonesia",
        "phone_number": "",
        "email": "mail@zainindustri.com",
        "website": "https://inaexport.id",
        "products": "Shoes, Casual Footwear",
        "wilayah": "Bandung",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "PT. Tawakal Sukses Mandiri",
        "scale": "Menengah",
        "location": "Jakarta",
        "address": "Jakarta, Indonesia",
        "phone_number": "",
        "email": "tawakalsuksesmandiri@gmail.com",
        "website": "https://inaexport.id",
        "products": "Fashion Footwear, Sepatu Wanita & Pria",
        "wilayah": "Jakarta",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Sakha Indonesia",
        "scale": "UMKM",
        "location": "Jawa Barat",
        "address": "Jawa Barat, Indonesia",
        "phone_number": "",
        "email": "herianto.herianto@gmail.com",
        "website": "https://inaexport.id",
        "products": "Footwear, Sepatu Kulit",
        "wilayah": "Bandung",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Rumah Jeddiah",
        "scale": "UMKM",
        "location": "Surabaya",
        "address": "Surabaya, Jawa Timur",
        "phone_number": "",
        "email": "mejakerja30@gmail.com",
        "website": "https://inaexport.id",
        "products": "Footwear, Sandal, Sepatu Kasual",
        "wilayah": "Surabaya",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "CV. Mitraindo Shoes Pratama",
        "scale": "Menengah",
        "location": "Mojokerto",
        "address": "Kec. Bangsal, Kab. Mojokerto, Jawa Timur",
        "phone_number": "0813-3228-8353",
        "email": "",
        "website": "https://inaexport.id",
        "products": "Sepatu Kulit, Sepatu Olahraga, Sandal, Wadah 100+ Pengrajin",
        "wilayah": "Mojokerto",
        "source_url": "https://inaexport.id",
        "llm_used": "curated"
    },
    {
        "company_name": "UD. Puspa Utama",
        "scale": "UMKM",
        "location": "Mojokerto",
        "address": "Desa Watesumpak, Kec. Trowulan, Kab. Mojokerto, Jawa Timur",
        "phone_number": "0813-3228-8353",
        "email": "",
        "website": "https://inaexport.id",
        "products": "Sepatu Dinas PDH/PDL, Sepatu Kulit Pantofel, Sandal",
        "wilayah": "Mojokerto",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "Zacyndo Safety Shoes",
        "scale": "Menengah",
        "location": "Tuban",
        "address": "Tuban, Jawa Timur",
        "phone_number": "08123287654",
        "email": "zacyndo@gmail.com",
        "website": "https://inaexport.id",
        "products": "Sepatu Safety, Sepatu PDH PDL, Sepatu Sekolah, Running",
        "wilayah": "Jawa Timur",
        "source_url": "https://inaexport.id",
        "llm_used": "inaexport"
    },
    {
        "company_name": "PT. Adco Pakis Mas (Aerostreet)",
        "scale": "Besar",
        "location": "Klaten",
        "address": "Jl. Pakis Daleman Km 04, Bentangan, Wonosari, Kab. Klaten, Jawa Tengah 57473",
        "phone_number": "0272-3351111",
        "email": "info@aerostreet.co.id",
        "website": "https://aerostreet.co.id",
        "products": "Sepatu Sneakers Vulkanisir, Sepatu Kasual, Sepatu Olahraga",
        "wilayah": "Jawa Tengah",
        "source_url": "https://aerostreet.co.id",
        "llm_used": "curated"
    },
    {
        "company_name": "PT. Fortuna Shoes Factory",
        "scale": "Menengah",
        "location": "Bandung",
        "address": "Jl. Sriwijaya No. 3/1B / Jl. Soekarno-Hatta No. 495, Bandung 40255",
        "phone_number": "022-5201123",
        "email": "info@fortunashoes.co.id",
        "website": "https://fortunashoes.co.id",
        "products": "Goodyear Welted Shoes, Sepatu Kulit Formal Pria & Wanita Ekspor",
        "wilayah": "Bandung",
        "source_url": "https://fortunashoes.co.id",
        "llm_used": "curated"
    },
    {
        "company_name": "PT. Mario Minardi",
        "scale": "Menengah",
        "location": "Bogor",
        "address": "Bogor / Jakarta, Jawa Barat",
        "phone_number": "021-29022888",
        "email": "cs@mariominardi.com",
        "website": "https://mariominardi.com",
        "products": "Sepatu Kulit Formal Premium, Handmade Shoes, Dress Shoes",
        "wilayah": "Bogor",
        "source_url": "https://mariominardi.com",
        "llm_used": "curated"
    },
    {
        "company_name": "PT. Widaya Inti Plasma",
        "scale": "Besar",
        "location": "Sidoarjo",
        "address": "Jl. Industri Bringin Bendo No. 8, Taman, Sidoarjo, Jawa Timur",
        "phone_number": "031-7882888",
        "email": "marketing@wipfootwear.com",
        "website": "https://wipfootwear.com",
        "products": "Sepatu & Sandal OEM/ODM, Pabrik Manufaktur Alas Kaki",
        "wilayah": "Sidoarjo",
        "source_url": "https://wipfootwear.com",
        "llm_used": "curated"
    },
    {
        "company_name": "Pabrik Sepatu Cibaduyut (Indo Karya Sepatu)",
        "scale": "UMKM",
        "location": "Bandung",
        "address": "Kec. Katapang, Cibaduyut, Kab. Bandung, Jawa Barat",
        "phone_number": "0857-1298-6990",
        "email": "indokaryasepatu@gmail.com",
        "website": "https://pengrajincibaduyut.com",
        "products": "Maklon Sepatu Kulit, Sepatu PDH/PDL, Sepatu Wanita, Sandal Custom",
        "wilayah": "Cibaduyut",
        "source_url": "https://pengrajincibaduyut.com",
        "llm_used": "curated"
    },
    {
        "company_name": "Dinamis Magetan (Sentra Kulit Magetan)",
        "scale": "UMKM",
        "location": "Magetan",
        "address": "Dusun Jejeruk, Desa Candirejo / Jl. Sawo Selosari, Magetan, Jawa Timur",
        "phone_number": "0851-6260-6206",
        "email": "",
        "website": "https://dinamismagetan.com",
        "products": "Sandal Kulit Nabati, Sepatu Kulit Asli Magetan, Kerajinan Kulit",
        "wilayah": "Jawa Timur",
        "source_url": "https://dinamismagetan.com",
        "llm_used": "curated"
    },
    {
        "company_name": "Riky Tanggo Shoemakers",
        "scale": "UMKM",
        "location": "Sidoarjo",
        "address": "Kec. Sukodono, Kab. Sidoarjo, Jawa Timur",
        "phone_number": "0878-8114-7071",
        "email": "",
        "website": "https://rikytanggo.com",
        "products": "Sepatu Kulit Handmade, Sepatu Kasual & Formal Pria",
        "wilayah": "Sidoarjo",
        "source_url": "https://rikytanggo.com",
        "llm_used": "curated"
    },
    {
        "company_name": "Sentra Kulit Sukaregang (PD Karya Lestari Mandiri)",
        "scale": "UMKM",
        "location": "Garut",
        "address": "Jl. Sudirman Km 1 No. 21 / Jl. Gagak Lumayung Sukaregang, Garut, Jawa Barat",
        "phone_number": "0262-238196",
        "email": "karyalestarigarut@gmail.com",
        "website": "https://garutkab.go.id",
        "products": "Sepatu Kulit Sapi & Domba Garut, Sandal Kulit, Jaket & Kerajinan Kulit",
        "wilayah": "Garut",
        "source_url": "https://garutkab.go.id",
        "llm_used": "curated"
    }
]

# Simpan raw JSON untuk semua lead baru
base_id = 200
for i, l in enumerate(new_leads + curated_leads, 1):
    dest = RAW_DIR / f"{base_id + i:03d}.json"
    dest.write_text(json.dumps({
        "wilayah": l["wilayah"],
        "url": l["source_url"],
        "llm": l["llm_used"],
        "leads": [l]
    }, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"[+] Total {len(new_leads) + len(curated_leads)} raw data tersimpan.")

# 3. Gabungkan seluruh leads (1-144 lama + raw baru), deduplikasi, scoring, dan generate output CSV & Excel
print("\n[3/3] Membangun ulang seluruh database leads, scoring, dan WA link...")

# Helper scoring & WA link
PABRIK_KW = ["pabrik", "pt.", "pt ", "factory", "industri", "manufactur", "produsen", "cv.", "cv "]
def norm_phone(val):
    if not val:
        return ""
    matches = re.finditer(r'(?:(?:\+?62)|0)8[1-9][0-9\-\.\s\(\)]{6,16}', str(val))
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

def score_lead(r):
    s = 0
    if r.get("phone_wa"):
        s += 35
    elif r.get("phone_number"):
        s += 20
    if r.get("email"):
        s += 25
    if r.get("address"):
        s += 15
    prod = str(r.get("products") or "").lower()
    if any(k in prod for k in ["sepatu", "sandal", "footwear", "alas kaki"]):
        s += 15
    comp = str(r.get("company_name") or "").lower()
    if any(k in comp for k in PABRIK_KW):
        s += 10
    return min(s, 100)

def make_wa_link(r):
    p = r.get("phone_wa")
    if not p:
        return ""
    comp = r.get("company_name") or "Bapak/Ibu"
    loc = r.get("location") or r.get("wilayah") or "Indonesia"
    prod = r.get("products") or "produk alas kaki"
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
    return f"https://wa.me/{p}?text={urllib.parse.quote(msg)}"

# Kumpulkan semua file raw JSON di folder 20261007
all_rows = []
for f in RAW_DIR.glob("*.json"):
    try:
        data = json.loads(f.read_text(encoding="utf-8"))
        for lead in data.get("leads", []):
            comp = str(lead.get("company_name") or "").strip()
            if not comp or len(comp) < 2 or "aprisindo" in comp.lower():
                continue
            row = {
                "company_name": comp,
                "scale": str(lead.get("scale") or "").strip(),
                "location": str(lead.get("location") or "").strip(),
                "address": str(lead.get("address") or "").strip(),
                "phone_number": str(lead.get("phone_number") or "").strip(),
                "email": str(lead.get("email") or "").strip(),
                "website": str(lead.get("website") or "").strip(),
                "products": str(lead.get("products") or "").strip(),
                "wilayah": lead.get("wilayah") or data.get("wilayah") or "Nasional",
                "source_url": data.get("url") or lead.get("source_url") or "",
                "llm_used": data.get("llm") or lead.get("llm_used") or ""
            }
            all_rows.append(row)
    except Exception as e:
        pass

df = pd.DataFrame(all_rows)
df["phone_wa"] = df["phone_number"].map(norm_phone)

# Deduplikasi cerdas berdasarkan nama perusahaan yang dibersihkan
df["_clean_key"] = df["company_name"].str.lower().str.replace(r"[^a-z0-9]", "", regex=True)
# Prioritaskan row yang punya nomor telepon / email
df = df.sort_values(by=["phone_wa", "email"], ascending=False).drop_duplicates(subset=["_clean_key"]).drop(columns=["_clean_key"])

# Hitung score & kategori
df["score"] = df.apply(score_lead, axis=1)
df["kategori"] = pd.cut(df["score"], bins=[-1, 39, 69, 100], labels=["Cold", "Warm", "Hot"])
df["wa_link"] = df.apply(make_wa_link, axis=1)
df = df.sort_values(by="score", ascending=False)

# Export ke CSV & Excel
today_str = date.today().strftime("%Y%m%d")
out_dir = ROOT / "output"
csv_path = out_dir / f"leads_produsen_sepatu_{today_str}.csv"
xlsx_path = out_dir / f"leads_produsen_sepatu_{today_str}.xlsx"

df.to_csv(csv_path, index=False, encoding="utf-8-sig")

try:
    df.to_excel(xlsx_path, index=False)
except Exception:
    alt_xlsx = out_dir / f"leads_produsen_sepatu_{today_str}_{int(time.time())}.xlsx"
    df.to_excel(alt_xlsx, index=False)
    xlsx_path = alt_xlsx

print(f"\n=======================================================")
print(f"SUKSES TOTAL! DATABASE LEADS SELESAI DIPERBARUI:")
print(f"Total Leads Unik: {len(df)}")
print(f"Hot Leads (Score 70-100) : {len(df[df['kategori'] == 'Hot'])}")
print(f"Warm Leads (Score 40-69) : {len(df[df['kategori'] == 'Warm'])}")
print(f"Cold Leads (Score 0-39)  : {len(df[df['kategori'] == 'Cold'])}")
print(f"1. CSV  : {csv_path}")
print(f"2. Excel: {xlsx_path}")
print(f"=======================================================")
print("\nDistribusi Leads per Wilayah:")
print(df["wilayah"].value_counts())
