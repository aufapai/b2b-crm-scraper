import httpx
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}

all_profiles = set()
for page in range(1, 15):
    url = f"https://ifn.kemenperin.go.id/direktori-mitra?page={page}"
    r = httpx.get(url, headers=headers, timeout=10.0, verify=False)
    soup = BeautifulSoup(r.text, "html.parser")
    found = 0
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/profil/" in href:
            full = href if href.startswith("http") else "https://ifn.kemenperin.go.id" + href
            if full not in all_profiles:
                all_profiles.add(full)
                found += 1
    print(f"Page {page}: found {found} new profiles (Total: {len(all_profiles)})")
    if found == 0:
        break

print(f"Grand total IFN profiles: {len(all_profiles)}")
