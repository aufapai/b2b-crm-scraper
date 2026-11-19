import httpx, json, re
from bs4 import BeautifulSoup
from pathlib import Path

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
base = "https://ifn.kemenperin.go.id"

# 1. Ambil semua link profil di halaman utama IFN
r = httpx.get(base, headers=headers, timeout=15.0, verify=False)
soup = BeautifulSoup(r.text, "html.parser")
profile_urls = []
for a in soup.find_all("a", href=True):
    href = a["href"]
    if "/profil/" in href:
        full = href if href.startswith("http") else base + href
        if full not in profile_urls:
            profile_urls.append(full)

print(f"Total profil IFN yang ditemukan: {len(profile_urls)}")

extracted_leads = []
for idx, u in enumerate(profile_urls, 1):
    try:
        res = httpx.get(u, headers=headers, timeout=10.0, verify=False)
        if res.status_code != 200:
            continue
        psoup = BeautifulSoup(res.text, "html.parser")
        
        # Cek apakah profil publik atau ditutup login
        text = psoup.get_text()
        if "Profil bisnis ini tidak tersedia untuk publik" in text:
            continue
            
        # Ekstrak data spesifik
        # Judul / Nama Perusahaan
        h1 = psoup.find("h1") or psoup.find("h2") or psoup.find("h3")
        name = ""
        # Cari di div profil
        title_el = psoup.select_one("div.profile-title, div.title, h2, h3, h1")
        if title_el:
            name = title_el.get_text().strip()
            
        # WhatsApp / Telp
        wa_match = re.search(r"WhatsApp\s*:\s*([0-9\+\-\s]+)", text, re.I)
        phone = wa_match.group(1).strip() if wa_match else ""
        if not phone:
            tel_match = re.search(r"(?:Telepon|Telp|Phone|Kontak|Call)\s*:\s*([0-9\+\-\s\(\)]{8,20})", text, re.I)
            phone = tel_match.group(1).strip() if tel_match else ""
            
        # Email
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
        email = email_match.group(0).strip() if email_match else ""
        # abaikan email umum kemenperin jika ada
        if "kemenperin.go.id" in email:
            email = ""
            
        # Lokasi / Wilayah
        loc_match = re.search(r"(KABUPATEN\s+[A-Z\s]+|KOTA\s+[A-Z\s]+)", text)
        location = loc_match.group(1).strip() if loc_match else ""
        
        # Produk / Deskripsi
        desc_match = re.findall(r"(?:Tentang Perusahaan|Deskripsi|Lini produk|memproduksi)[^.]+?\.", text, re.I)
        products = " ".join(desc_match[:2]).strip()
        
        print(f"[{idx}/{len(profile_urls)}] {u}")
        print(f"  Nama    : {name}")
        print(f"  Lokasi  : {location}")
        print(f"  WA/Telp : {phone}")
        print(f"  Email   : {email}")
        
        extracted_leads.append({
            "url": u,
            "name": name,
            "location": location,
            "phone": phone,
            "email": email,
            "raw_text": text[:1500]
        })
    except Exception as e:
        print(f"Err {u}: {e}")

print(f"\nBerhasil mengekstrak {len(extracted_leads)} profil publik dari IFN Kemenperin!")
