import httpx, re
from bs4 import BeautifulSoup

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
base = "https://ifn.kemenperin.go.id"

# Let's inspect directory pages:
# e.g. /direktori-mitra, /mitra, /sebaran-mitra
pages_to_check = [
    "https://ifn.kemenperin.go.id",
    "https://ifn.kemenperin.go.id/direktori-mitra",
    "https://ifn.kemenperin.go.id/mitra-pilihan",
    "https://ifn.kemenperin.go.id/sebaran-mitra"
]

all_profiles = set()
for p in pages_to_check:
    try:
        r = httpx.get(p, headers=headers, timeout=15.0, verify=False)
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/profil/" in href:
                full = href if href.startswith("http") else base + href
                all_profiles.add(full)
    except Exception as e:
        print(f"Error {p}: {e}")

print(f"Found {len(all_profiles)} profile links on IFN:")
for pr in sorted(all_profiles):
    print(pr)
