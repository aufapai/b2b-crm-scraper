import httpx, re
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
r = httpx.get("https://ifn.kemenperin.go.id", headers=headers, timeout=15.0, follow_redirects=True, verify=False)
soup = BeautifulSoup(r.text, "html.parser")

links = set()
for a in soup.find_all("a", href=True):
    href = a["href"]
    links.add(href)

print(f"Total links found: {len(links)}")
for l in sorted(links):
    if any(k in l.lower() for k in ["mitra", "direktori", "member", "perusahaan", "profil", "katalog", "tenant", "ikm", "peserta", "industri"]):
        print(l)
