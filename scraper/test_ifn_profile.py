import httpx
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
sample_urls = [
    "https://ifn.kemenperin.go.id/profil/sepatumojo",
    "https://ifn.kemenperin.go.id/profil/putra-mandiri-manufacturing-indonesia",
    "https://ifn.kemenperin.go.id/profil/shelby",
    "https://ifn.kemenperin.go.id/profil/axel-shoe-co",
    "https://ifn.kemenperin.go.id/profil/pt-intiniri-utama"
]

for u in sample_urls:
    r = httpx.get(u, headers=headers, timeout=10.0, follow_redirects=True, verify=False)
    soup = BeautifulSoup(r.text, "html.parser")
    # remove script/style
    for s in soup(["script", "style"]):
        s.extract()
    text = "\n".join(line.strip() for line in soup.get_text().splitlines() if line.strip())
    print(f"\n=== URL: {u} (Status {r.status_code}) ===")
    print(text[:800])
