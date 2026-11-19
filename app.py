"""
Web Server and REST API for HOTs Trading Leads Manager & WhatsApp CRM.
Provides dashboard, lead management, WhatsApp Web integration, and Excel/CSV export.
Zero external server dependencies (uses Python standard library http.server).
"""

import http.server
import socketserver
import json
import urllib.parse
import urllib.request
import io
import os
import re
import sys
import webbrowser
from pathlib import Path
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Import database & scraper modules
import database
from scraper import scrape_corporate_buyers

ROOT_DIR = Path(__file__).resolve().parent
WEB_DIR = ROOT_DIR / "web"
HOST = "127.0.0.1"
DEFAULT_PORT = 5000

class LeadCRMHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def _send_json(self, data, status_code=200):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            raw_body = self.rfile.read(content_length).decode('utf-8')
            try:
                return json.loads(raw_body)
            except Exception:
                return {}
        return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        # API: Settings (Google Sheet URL, AuthUser Account, Webhook)
        if path == "/api/settings":
            self._send_json(database.get_settings())
            return

        # API: Stats
        if path == "/api/stats":
            stats = database.get_stats()
            self._send_json(stats)
            return

        # API: List Leads with filtering and pagination
        if path == "/api/leads":
            search = query.get('search', [''])[0]
            wilayah = query.get('wilayah', [''])[0]
            scale = query.get('scale', [''])[0]
            kategori = query.get('kategori', [''])[0]
            status = query.get('status', [''])[0]
            segment = query.get('segment', [''])[0]
            industry = query.get('industry', [''])[0]
            batch_day = query.get('batch_day', [''])[0]
            wa_only = query.get('wa_only', ['0'])[0] in ('1', 'true', 'True')
            sort_by = query.get('sort_by', ['score_desc'])[0]
            limit = int(query.get('limit', [50])[0])
            offset = int(query.get('offset', [0])[0])

            result = database.get_leads(
                search=search,
                wilayah=wilayah,
                scale=scale,
                kategori=kategori,
                status=status,
                segment=segment,
                industry=industry,
                batch_day=batch_day,
                wa_only=wa_only,
                sort_by=sort_by,
                limit=limit,
                offset=offset
            )
            self._send_json(result)
            return

        # API: Single Lead Detail
        if path.startswith("/api/leads/") and not path.endswith("/contact"):
            try:
                lead_id = int(path.split("/")[-1])
                lead = database.get_lead_by_id(lead_id)
                if lead:
                    self._send_json(lead)
                else:
                    self._send_json({"error": "Lead not found"}, 404)
            except ValueError:
                self._send_json({"error": "Invalid lead ID"}, 400)
            return

        # API: Templates
        if path == "/api/templates":
            segment = query.get('segment', [''])[0]
            channel = query.get('channel', [''])[0]
            templates = database.get_templates(segment=segment, channel=channel)
            self._send_json(templates)
            return

        # API: Generate Personalized Message, Subject, WA & Email Links
        if path == "/api/generate-message":
            lead_id = int(query.get('lead_id', [0])[0])
            template_id = int(query.get('template_id', [0])[0])

            lead = database.get_lead_by_id(lead_id)
            if not lead:
                self._send_json({"error": "Lead not found"}, 404)
                return

            templates = database.get_templates()
            selected_template = None
            if template_id:
                for t in templates:
                    if t['id'] == template_id:
                        selected_template = t
                        break
            if not selected_template:
                selected_template = templates[0] if templates else {
                    "title": "Default",
                    "message_text": "Halo {company_name}, salam kenal dari PT Indo Sukses Semesta (HOTs Trading).",
                    "segment": "all",
                    "channel": "whatsapp",
                    "subject": "Pengadaan Sepatu Industri"
                }

            msg = database.build_wa_message(selected_template['message_text'], lead)
            phone_wa = lead.get('phone_wa', '')
            encoded_msg = urllib.parse.quote(msg)

            subject_template = selected_template.get('subject') or "Kerja Sama Pengadaan & Efisiensi Operasional"
            subject = database.build_wa_message(subject_template, lead)
            encoded_subject = urllib.parse.quote(subject)

            email = lead.get('email', '')
            mailto_url = f"mailto:{email}?subject={encoded_subject}&body={encoded_msg}" if email else ""

            wa_web_url = f"https://web.whatsapp.com/send?phone={phone_wa}&text={encoded_msg}" if phone_wa else ""
            wa_me_url = f"https://wa.me/{phone_wa}?text={encoded_msg}" if phone_wa else ""

            self._send_json({
                "lead_id": lead_id,
                "template_id": selected_template.get('id'),
                "template_title": selected_template.get('title'),
                "template_segment": selected_template.get('segment', 'all'),
                "template_channel": selected_template.get('channel', 'whatsapp'),
                "subject": subject,
                "message": msg,
                "phone_wa": phone_wa,
                "phone_display": lead.get('phone_wa_display', ''),
                "email": email,
                "contact_person": lead.get('contact_person', ''),
                "job_title": lead.get('job_title', ''),
                "wa_web_url": wa_web_url,
                "wa_me_url": wa_me_url,
                "mailto_url": mailto_url,
                "is_wa_valid": lead.get('is_wa_valid', 0)
            })
            return

        # API: Export Leads (Excel or CSV)
        if path == "/api/export":
            fmt = query.get('format', ['xlsx'])[0].lower()
            status = query.get('status', [''])[0]
            wa_only = query.get('wa_only', ['0'])[0] in ('1', 'true', 'True')
            wilayah = query.get('wilayah', [''])[0]
            segment = query.get('segment', [''])[0]
            industry = query.get('industry', [''])[0]

            df = database.export_leads_df(
                status=status,
                wa_only=wa_only,
                wilayah=wilayah,
                segment=segment,
                industry=industry
            )
            date_str = datetime.now().strftime("%Y%m%d_%H%M")

            if fmt == 'csv':
                buffer = io.BytesIO()
                df.to_csv(buffer, index=False, encoding='utf-8-sig')
                content = buffer.getvalue()
                filename = f"leads_export_{date_str}.csv"
                content_type = "text/csv; charset=utf-8"
            else:
                buffer = io.BytesIO()
                with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
                    df.to_excel(writer, index=False, sheet_name="Leads")
                content = buffer.getvalue()
                filename = f"leads_export_{date_str}.xlsx"
                content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        # Static file fallback
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        # API: Save Settings
        if path == "/api/settings":
            saved = database.save_settings(body)
            self._send_json({"success": True, "settings": saved})
            return

        # API: Extension Ingest (Multi-Site Clean Import + Optional GSheet Push)
        if path == "/api/extension/ingest":
            leads_payload = body.get("leads", [])
            push_gsheet = body.get("push_gsheet", True)
            if not isinstance(leads_payload, list) or not leads_payload:
                self._send_json({"error": "Payload 'leads' kosong atau tidak valid"}, 400)
                return
            try:
                res = database.ingest_extension_leads(leads_payload)
                gsheet_status = "skipped"
                if push_gsheet:
                    settings = database.get_settings()
                    webhook_url = body.get("webhook_url") or settings.get("gsheet_webhook_url", "")
                    if webhook_url:
                        gsheet_status = push_to_gsheet_webhook(webhook_url, res["records"])
                self._send_json({
                    "success": True,
                    "inserted": res["inserted"],
                    "updated": res["updated"],
                    "duplicates_flagged": res["duplicates_flagged"],
                    "gsheet_sync": gsheet_status,
                    "message": f"Berhasil simpan {res['inserted']} baru, {res['updated']} update ke CRM!"
                })
            except Exception as e:
                self._send_json({"error": f"Gagal ingest leads: {str(e)}"}, 500)
            return

        # API: Extension Smart Extract (Universal Web Recognizer using Gemini AI / Regex Fallback)
        if path == "/api/extension/smart-extract":
            page_url = str(body.get("url", "")).strip()
            page_title = str(body.get("title", "")).strip()
            page_text = str(body.get("text", ""))[:12000]
            try:
                extracted = smart_extract_webpage(page_url, page_title, page_text)
                self._send_json({"success": True, "leads": extracted})
            except Exception as e:
                self._send_json({"error": f"Smart extract gagal: {str(e)}"}, 500)
            return

        # API: Manual Push Leads to Google Sheet Webhook
        if path == "/api/sync-gsheet":
            settings = database.get_settings()
            webhook_url = body.get("webhook_url") or settings.get("gsheet_webhook_url", "")
            batch_day = body.get("batch_day", "")
            if not webhook_url:
                self._send_json({"error": "Webhook URL Google Apps Script belum diisi di Settings!"}, 400)
                return
            data = database.get_leads(batch_day=batch_day, limit=200, offset=0)
            items = data.get("items", [])
            status_msg = push_to_gsheet_webhook(webhook_url, items)
            self._send_json({"success": True, "count": len(items), "gsheet_sync": status_msg})
            return

        # API: Add Lead
        if path == "/api/leads":
            try:
                new_lead = database.add_lead(body)
                self._send_json(new_lead, 201)
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
            return

        # API: Mark Lead as Contacted / Log Outreach
        if path.startswith("/api/leads/") and path.endswith("/contact"):
            try:
                lead_id = int(path.split("/")[3])
                status = body.get('status', 'Sudah Dihubungi')
                notes = body.get('notes', None)
                updated = database.mark_lead_contacted(lead_id, status=status, notes=notes)
                self._send_json(updated)
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
            return

        # API: Add or Update Template
        if path == "/api/templates":
            title = body.get('title', '').strip()
            message_text = body.get('message_text', '').strip()
            is_default = int(body.get('is_default', 0))
            segment = body.get('segment', 'all')
            channel = body.get('channel', 'whatsapp')
            subject = body.get('subject', '')
            template_id = body.get('id')

            if not title or not message_text:
                self._send_json({"error": "Title dan message_text wajib diisi"}, 400)
                return

            templates = database.save_template(
                title=title,
                message_text=message_text,
                is_default=is_default,
                segment=segment,
                channel=channel,
                subject=subject,
                template_id=template_id
            )
            self._send_json(templates)
            return

        # API: Web Scraping & AI Lead Extraction
        if path == "/api/scrape":
            action = body.get('action', 'scrape_url')

            if action == 'seed_corporate':
                try:
                    scrape_corporate_buyers.seed_all_corporate_buyers()
                    stats = database.get_stats()
                    self._send_json({
                        "success": True,
                        "message": "Berhasil menyinkronkan 31 Buyer Korporat Tier-1 ke database!",
                        "stats": stats
                    })
                except Exception as e:
                    self._send_json({"error": f"Gagal sinkronisasi data: {str(e)}"}, 500)
                return

            if action == 'scrape_url':
                url = body.get('url', '').strip()
                industry = body.get('industry', 'Konstruksi & EPC').strip()

                if not url:
                    self._send_json({"error": "URL target wajib diisi"}, 400)
                    return

                try:
                    extracted_leads = scrape_corporate_buyers.scrape_url_for_buyers(url, default_industry=industry)
                    saved_count = 0
                    saved_items = []

                    for lead in extracted_leads:
                        if scrape_corporate_buyers.insert_or_update_lead(lead):
                            saved_count += 1
                            saved_items.append(lead)

                    stats = database.get_stats()
                    self._send_json({
                        "success": True,
                        "url": url,
                        "industry": industry,
                        "leads_found": len(extracted_leads),
                        "leads_saved": saved_count,
                        "leads": saved_items,
                        "stats": stats,
                        "message": f"Berhasil mengekstrak {saved_count} leads baru dari {url}!" if saved_count > 0 else f"Tidak ditemukan profil perusahaan pada {url}."
                    })
                except Exception as e:
                    self._send_json({"error": f"Gagal scraping URL: {str(e)}"}, 500)
                return

            self._send_json({"error": f"Aksi '{action}' tidak dikenal"}, 400)
            return

        self._send_json({"error": "Endpoint not found"}, 404)

    def do_PUT(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path.startswith("/api/leads/"):
            try:
                lead_id = int(path.split("/")[-1])
                updated = database.update_lead(lead_id, body)
                self._send_json(updated)
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
            return

        self._send_json({"error": "Endpoint not found"}, 404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/leads/"):
            try:
                lead_id = int(path.split("/")[-1])
                conn = database.get_db_connection()
                cursor = conn.cursor()
                cursor.execute("DELETE FROM leads WHERE id = ?", (lead_id,))
                conn.commit()
                conn.close()
                self._send_json({"success": True, "deleted_id": lead_id})
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
            return

        self._send_json({"error": "Endpoint not found"}, 404)

    def log_message(self, format, *args):
        # Clean logging format
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")

def push_to_gsheet_webhook(webhook_url, records):
    """Kirim array leads bersih ke Google Apps Script Webhook (Code.gs)."""
    try:
        payload = json.dumps({"action": "upsert_leads", "leads": records}, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            webhook_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp_text = resp.read().decode("utf-8", errors="replace")
            return f"ok ({resp.status}): {resp_text[:120]}"
    except Exception as e:
        return f"error: {str(e)}"

def smart_extract_webpage(url, title, text):
    """Universal Web Recognizer: gunakan Gemini API jika key tersedia, atau regex fallback."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        env_file = ROOT_DIR / "scraper" / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"').strip("'")

    if api_key:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            prompt = (
                "Ekstrak profil perusahaan/toko/PIC B2B dari teks halaman web berikut untuk kebutuhan sales HOTS Trading (distributor AP Boots & safety footwear).\n"
                "Balas HANYA JSON valid: {\"leads\": [{\"company_name\":\"\",\"contact_person\":\"\",\"job_title\":\"\",\"phone_number\":\"\",\"email\":\"\",\"location\":\"\",\"address\":\"\",\"products\":\"\",\"website\":\"\",\"segment\":\"Segmen A: Reseller & Toko K3\"}]}\n"
                "Aturan: JANGAN mengarang nomor WA dari telepon kantor. Biarkan kosong jika tidak ditemukan.\n"
                f"URL: {url}\nJudul: {title}\nTeks:\n{text[:9000]}"
            )
            resp = client.models.generate_content(
                model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
                contents=prompt
            )
            raw = resp.text or ""
            m = re.search(r"\{.*\}", raw, re.DOTALL)
            if m:
                parsed = json.loads(m.group(0))
                leads = parsed.get("leads", [])
                for l in leads:
                    l["source_url"] = url
                    if not l.get("website"):
                        l["website"] = url
                if leads:
                    return leads
        except Exception as e:
            print(f"[SmartExtract AI fallback] {e}")

    # Regex Fallback (zero-dependency)
    emails = sorted(set(re.findall(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text)))
    emails = [e for e in emails if not any(x in e.lower() for x in ["example.com", "sentry", "wixpress", ".png", ".jpg"])]
    wa_num = database.extract_indonesia_mobile(text)
    office_match = re.search(r"(?:\+62|0)[2-7][0-9]{1,2}[\-\s]?\d{3,4}[\-\s]?\d{3,4}", text)
    phone_val = wa_num if wa_num else (office_match.group(0) if office_match else "")

    return [{
        "company_name": title.split("|")[0].split("-")[0].strip() or url,
        "contact_person": "",
        "job_title": "",
        "phone_number": phone_val,
        "email": emails[0] if emails else "",
        "location": "",
        "address": "",
        "products": "Hasil Smart Scan Web",
        "website": url,
        "source_url": url,
        "segment": "Segmen A: Reseller & Toko K3"
    }]

def find_available_port(start_port=5000, max_attempts=20):
    import socket
    for p in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST, p)) != 0:
                return p
    return start_port

def run_server(port=None, auto_open=True):
    # Ensure database is initialized
    database.init_db()

    actual_port = port or find_available_port(DEFAULT_PORT)
    server_address = (HOST, actual_port)

    # Allow port reuse
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(server_address, LeadCRMHandler) as httpd:
        url = f"http://localhost:{actual_port}"
        print("=" * 65)
        print(" [SERVER] HOTs Trading - Shoe Leads Manager & WhatsApp CRM")
        print("=" * 65)
        print(f" * Server Aktif di : {url}")
        print(f" * Folder Web     : {WEB_DIR}")
        print(f" * Database       : {database.DB_PATH}")
        print("=" * 65)
        print("Tekan Ctrl+C untuk menghentikan server.")
        print("=" * 65)

        if auto_open:
            try:
                webbrowser.open(url)
            except Exception as e:
                print(f"Tidak dapat membuka browser otomatis: {e}")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer dihentikan oleh pengguna.")
            httpd.server_close()

if __name__ == "__main__":
    import pandas as pd
    p = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None
    run_server(port=p, auto_open=True)
