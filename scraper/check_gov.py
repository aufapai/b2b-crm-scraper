import httpx

headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36"}
urls = [
    "https://ifn.kemenperin.go.id",
    "https://bpipi.kemenperin.go.id",
    "https://inaexport.id"
]

for u in urls:
    try:
        r = httpx.get(u, headers=headers, timeout=10.0, follow_redirects=True, verify=False)
        print(f"[{r.status_code}] {u} -> length {len(r.text)}")
    except Exception as e:
        print(f"[ERR] {u}: {e}")
