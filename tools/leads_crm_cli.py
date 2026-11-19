"""
CLI Tool for HOTs Trading Leads Database Management & WhatsApp Outreach
Allows quick management, status updates, WhatsApp Web opening, and exports from terminal.
"""

import argparse
import sys
import webbrowser
import urllib.parse
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import database

def cmd_stats(args):
    stats = database.get_stats()
    print("\n" + "=" * 55)
    print(" [STATISTIK] DATABASE LEADS PRODUSEN SEPATU HOTS")
    print("=" * 55)
    print(f" • Total Leads Terdata    : {stats['total_leads']} pabrik")
    print(f" • WhatsApp Ready (Valid) : {stats['total_wa']} nomor HP seluler")
    print(f" • Sudah Dihubungi        : {stats['total_contacted']}")
    print(f" • Tertarik Ekspor        : {stats['total_interested']}")
    print("\n[Status Outreach]:")
    for st, count in stats['by_status'].items():
        print(f"   - {st:<22}: {count}")

    print("\n[Distribusi Sentra Wilayah Terbanyak]:")
    for reg, count in list(stats['by_wilayah'].items())[:8]:
        print(f"   - {reg:<22}: {count}")
    print("=" * 55 + "\n")

def cmd_list(args):
    res = database.get_leads(
        search=args.search,
        wilayah=args.wilayah,
        scale=args.scale,
        status=args.status,
        wa_only=args.wa_only,
        limit=args.limit,
        offset=0
    )
    print(f"\nDitemukan {res['total']} leads (menampilkan {len(res['items'])}):")
    print("-" * 80)
    for l in res['items']:
        wa_flag = "[WA]  " if l['is_wa_valid'] else "[TELP]"
        phone = l['phone_wa_display'] or l['phone_number'] or '-'
        status = l['outreach_status']
        print(f"[{l['id']:3d}] {wa_flag} | {l['company_name'][:30]:<30} | {phone:<18} | {l['wilayah']:<12} | {status}")
    print("-" * 80 + "\n")

def cmd_open_wa(args):
    lead = database.get_lead_by_id(args.id)
    if not lead:
        print(f"[Error] Lead ID {args.id} tidak ditemukan.")
        return

    if not lead['phone_wa']:
        print(f"[Peringatan] Lead '{lead['company_name']}' belum memiliki nomor WhatsApp HP valid.")
        return

    templates = database.get_templates()
    tpl = templates[0] if templates else {"message_text": "Halo {company_name}, salam kenal dari PT Indo Sukses Semesta (HOTs Trading)."}
    
    msg = database.build_wa_message(tpl['message_text'], lead)
    url = f"https://web.whatsapp.com/send?phone={lead['phone_wa']}&text={urllib.parse.quote(msg)}"

    print(f"\n[Membuka WhatsApp Web]")
    print(f"Target   : {lead['company_name']} ({lead['phone_wa_display']})")
    print(f"Pesan    :\n{msg}")
    print(f"URL      : {url}")

    webbrowser.open(url)

    if not args.no_update:
        database.mark_lead_contacted(lead['id'], status="Sudah Dihubungi", notes="Dihubungi via CLI")
        print(f"[OK] Status lead #{lead['id']} otomatis diupdate menjadi 'Sudah Dihubungi'.\n")

def cmd_export(args):
    df = database.export_leads_df(status=args.status, wa_only=args.wa_only, wilayah=args.wilayah)
    out_path = Path(args.output)
    if out_path.suffix.lower() == '.csv':
        df.to_csv(out_path, index=False, encoding='utf-8-sig')
    else:
        df.to_excel(out_path, index=False)
    print(f"\n[OK] Berhasil export {len(df)} leads ke: {out_path.resolve()}\n")

def main():
    database.init_db()

    parser = argparse.ArgumentParser(description="HOTs Trading Leads & WhatsApp CLI")
    subparsers = parser.add_subparsers(dest="command")

    # stats
    subparsers.add_parser("stats", help="Tampilkan statistik database leads")

    # list
    p_list = subparsers.add_parser("list", help="Tampilkan daftar leads")
    p_list.add_argument("--search", default="", help="Kata kunci pencarian")
    p_list.add_argument("--wilayah", default="", help="Filter wilayah")
    p_list.add_argument("--scale", default="", help="Filter skala")
    p_list.add_argument("--status", default="", help="Filter status outreach")
    p_list.add_argument("--wa-only", action="store_true", help="Hanya leads dengan WhatsApp valid")
    p_list.add_argument("--limit", type=int, default=20, help="Jumlah per halaman")

    # open-wa
    p_wa = subparsers.add_parser("open-wa", help="Buka WhatsApp Web untuk lead tertentu")
    p_wa.add_argument("--id", type=int, required=True, help="ID lead yang ingin dihubungi")
    p_wa.add_argument("--no-update", action="store_true", help="Jangan update status jadi Sudah Dihubungi")

    # export
    p_exp = subparsers.add_parser("export", help="Export database ke Excel atau CSV")
    p_exp.add_argument("--output", default="output/leads_export_crm.xlsx", help="File tujuan (.xlsx atau .csv)")
    p_exp.add_argument("--status", default="", help="Filter status")
    p_exp.add_argument("--wilayah", default="", help="Filter wilayah")
    p_exp.add_argument("--wa-only", action="store_true", help="Hanya WhatsApp valid")

    args = parser.parse_args()

    if args.command == "stats":
        cmd_stats(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "open-wa":
        cmd_open_wa(args)
    elif args.command == "export":
        cmd_export(args)
    else:
        cmd_stats(args)

if __name__ == "__main__":
    main()
