"""Script serbaguna untuk scraping link baru menggunakan ScrapeGraphAI resmi.
Bisa dijalankan untuk link manapun yang ingin di-scrap secara spesifik:
Contoh:
  .\\.venv\\Scripts\\python run_scrapegraph.py --url https://fortunashoes.co.id
  .\\.venv\\Scripts\\python run_scrapegraph.py --url https://aerostreet.co.id
"""
import argparse, json, os, sys
from pathlib import Path
from dotenv import load_dotenv

BASE = Path(__file__).parent
ROOT = BASE.parent
load_dotenv(BASE / ".env")

# Set browser Playwright di Drive D
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / "tools" / "ms-playwright")

from scrapegraphai.graphs import SmartScraperGraph

def main():
    parser = argparse.ArgumentParser(description="ScrapeGraphAI URL Scraper")
    parser.add_argument("--url", type=str, required=True, help="URL target yang ingin di-scrap")
    parser.add_argument("--save", action="store_true", help="Simpan hasil ke output raw JSON")
    args = parser.parse_args()

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY belum terpasang di scraper/.env", file=sys.stderr)
        sys.exit(1)

    graph_config = {
        "llm": {
            "api_key": api_key,
            "model": "google_genai/gemini-flash-lite-latest",
            "model_tokens": 32000,
        },
        "verbose": False,
        "headless": True
    }

    prompt = """Ekstrak profil produsen, pabrik, atau pengrajin alas kaki/sepatu/sandal dari halaman web ini.
Berikan format JSON dengan field berikut:
- company_name: Nama PT, CV, atau bengkel produsen
- scale: Skala (UMKM, Menengah, Besar)
- location: Kota/Kabupaten
- address: Alamat lengkap
- phone_number: Nomor telepon atau WhatsApp kontak bisnis
- email: Email bisnis
- website: Website resmi
- products: Spesialisasi jenis sepatu atau produk alas kaki
"""

    print(f"[*] Menjalankan ScrapeGraphAI untuk URL: {args.url}")
    try:
        scraper = SmartScraperGraph(prompt=prompt, source=args.url, config=graph_config)
        result = scraper.run()
        print("\n[+] Hasil Ekstraksi ScrapeGraphAI:")
        print(json.dumps(result, indent=2, ensure_ascii=False))

        if args.save:
            out_file = ROOT / "output" / f"scrapegraph_{abs(hash(args.url))}.json"
            out_file.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[+] Hasil tersimpan di: {out_file}")
    except Exception as e:
        print(f"[-] Gagal menjalankan ScrapeGraphAI: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
