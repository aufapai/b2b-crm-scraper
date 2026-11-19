"""Demo penggunaan ScrapeGraphAI resmi (https://github.com/ScrapeGraphAI/Scrapegraph-ai)
Menggunakan SmartScraperGraph dengan model Gemini terbaru.

Cara menjalankan:
  .\\.venv\\Scripts\\python scrapegraph_demo.py
"""
import os, json
from pathlib import Path
from dotenv import load_dotenv

BASE = Path(__file__).parent
ROOT = BASE.parent
load_dotenv(BASE / ".env")

# Set lokasi browser Playwright di Drive D
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(ROOT / "tools" / "ms-playwright")

from scrapegraphai.graphs import SmartScraperGraph

# Konfigurasi LLM menggunakan Gemini API key
graph_config = {
    "llm": {
        "api_key": os.getenv("GEMINI_API_KEY"),
        "model": "google_genai/gemini-flash-lite-latest",
        "model_tokens": 32000,
    },
    "verbose": True,
    "headless": True
}

# Contoh URL target
target_url = "https://pabriksepatucibaduyut.id"

prompt = """
Ekstrak profil produsen/pabrik sepatu yang ada di halaman ini.
Berikan format JSON:
- company_name
- location
- phone_number
- email
- products
"""

smart_scraper = SmartScraperGraph(
    prompt=prompt,
    source=target_url,
    config=graph_config
)

print(f"Menjalankan ScrapeGraphAI ke {target_url}...")
result = smart_scraper.run()
print("\nHasil Ekstraksi ScrapeGraphAI:")
print(json.dumps(result, indent=2))
