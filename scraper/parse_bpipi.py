import httpx
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
r = httpx.get("https://bpipi.kemenperin.go.id", headers=headers, timeout=15.0, verify=False)
soup = BeautifulSoup(r.text, "html.parser")

links = set()
for a in soup.find_all("a", href=True):
    href = a["href"]
    links.add(href)

print(f"Total links on BPIPI: {len(links)}")
for l in sorted(links):
    if any(k in l.lower() for k in ["ikm", "katalog", "tenant", "peserta", "berita", "artikel"]):
        print(l)
