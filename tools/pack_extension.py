"""
Packer Script untuk B2B CRM Chrome Extension.
Membaca versi langsung dari manifest.json dan membuat arsip .zip siap instal/rilis.
Secara default MENGECUALIKAN seluruh data pribadi (seed_leads.json, *.csv, *.db).
"""
import argparse
import json
import sys
import zipfile
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
EXT_DIR = ROOT / "tools" / "hots-chrome-extension"
DIST_DIR = ROOT / "dist"

PRIVATE_FILES = {"seed_leads.json"}
PRIVATE_EXTS = {".csv", ".xlsx", ".db", ".sqlite", ".env"}

def pack_extension(include_local_data=False):
    manifest_path = EXT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    version = manifest.get("version", "1.0.0")

    DIST_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "local-private" if include_local_data else "public"
    zip_name = f"b2b-crm-extension-v{version}-{suffix}.zip"
    zip_path = DIST_DIR / zip_name

    added = []
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(EXT_DIR.rglob("*")):
            if not file_path.is_file():
                continue
            rel = file_path.relative_to(EXT_DIR)
            if not include_local_data:
                if file_path.name in PRIVATE_FILES or file_path.suffix.lower() in PRIVATE_EXTS:
                    continue
            zf.write(file_path, arcname=str(rel))
            added.append(str(rel))

    print(f"[PACK SELESAI] Versi: v{version} ({suffix})")
    print(f"  + Output : {zip_path}")
    print(f"  + Files  : {', '.join(added)}")
    return zip_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pack Chrome Extension ke file .zip rilis")
    parser.add_argument("--include-local-data", action="store_true", help="Sertakan seed_leads.json lokal (JANGAN di-upload ke publik!)")
    args = parser.parse_args()
    pack_extension(include_local_data=args.include_local_data)
