/**
 * HOTS Trading - Google Sheets Auto-Sync Webhook (Apps Script)
 * Cara Pasang:
 * 1. Buka Google Sheet tracker kamu (dengan akun Google/AI pilihanmu).
 * 2. Klik menu: Extensions > Apps Script.
 * 3. Hapus kode default, paste seluruh kode ini, lalu klik Save (Ctrl+S).
 * 4. Klik Deploy > New deployment > pilih type: Web app.
 *    - Execute as: Me (akun Google yang kamu pilih)
 *    - Who has access: Anyone
 * 5. Copy Web App URL (https://script.google.com/macros/s/.../exec)
 *    dan tempel ke Settings di Chrome Extension & Dashboard CRM!
 */

const SHEET_NAME = "HOTS_Leads_Sync";

const HEADERS = [
  "Tanggal Sync",
  "Batch / Hari",
  "Nama Perusahaan / Toko",
  "Segmen",
  "Nama PIC",
  "Jabatan PIC",
  "No WhatsApp (Valid)",
  "Link Buka WA (1-Klik T1)",
  "No Telp Kantor / Asal",
  "Email",
  "Kota / Lokasi",
  "Produk / Catatan",
  "Website / LinkedIn",
  "Status Hasil",
  "Peringatan / Guardrail"
];

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold")
      .setBackground("#1e293b")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buildWaHyperlinkFormula(phoneWa, companyName) {
  if (!phoneWa || !String(phoneWa).startsWith("628")) {
    return "";
  }
  const msg = "Selamat pagi Bapak/Ibu, saya Aufa dari HOTS Trading (PT Indo Sukses Semesta), distributor resmi AP Boots. Kami menyuplai boot PVC dan safety boot untuk toko dan supplier K3. Apakah saya boleh mengirimkan katalog dan skema harga untuk toko Bapak/Ibu?";
  const url = "https://wa.me/" + phoneWa + "?text=" + encodeURIComponent(msg);
  return '=HYPERLINK("' + url + '", "💬 Buka WA")';
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const leads = body.leads || [];
    const sheet = getOrCreateSheet();

    const existingData = sheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < existingData.length; i++) {
      const nameKey = String(existingData[i][2] || "").trim().toLowerCase();
      if (nameKey) existingMap[nameKey] = i + 1; // 1-based row index
    }

    let inserted = 0;
    let updated = 0;
    const nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm");

    leads.forEach((lead) => {
      const comp = String(lead.company_name || lead.title || "").trim();
      if (!comp) return;

      const phoneWa = String(lead.phone_wa || "").replace(/\D/g, "");
      const waFormula = buildWaHyperlinkFormula(phoneWa, comp);
      const rowValues = [
        nowStr,
        lead.batch_day || "Extension Scrape",
        comp,
        lead.segment || "Segmen A: Reseller & Toko K3",
        lead.contact_person || "",
        lead.job_title || "",
        phoneWa ? ("+" + phoneWa) : "",
        waFormula,
        lead.phone_number || "",
        lead.email || "",
        lead.location || lead.wilayah || "",
        lead.products || lead.follow_up_notes || "",
        lead.linkedin_url || lead.website || lead.source_url || "",
        lead.outreach_status || "Belum Dihubungi",
        lead.warning_note || ""
      ];

      const key = comp.toLowerCase();
      if (existingMap[key]) {
        const rowIdx = existingMap[key];
        // Update hanya kolom kontak/warning tanpa menimpa Status Hasil manual
        sheet.getRange(rowIdx, 1).setValue(nowStr);
        if (lead.contact_person) sheet.getRange(rowIdx, 5).setValue(lead.contact_person);
        if (lead.job_title) sheet.getRange(rowIdx, 6).setValue(lead.job_title);
        if (phoneWa) {
          sheet.getRange(rowIdx, 7).setValue("+" + phoneWa);
          sheet.getRange(rowIdx, 8).setFormula(waFormula);
        }
        if (lead.email) sheet.getRange(rowIdx, 10).setValue(lead.email);
        if (lead.warning_note) sheet.getRange(rowIdx, 15).setValue(lead.warning_note);
        updated++;
      } else {
        sheet.appendRow(rowValues);
        existingMap[key] = sheet.getLastRow();
        inserted++;
      }
    });

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok", inserted: inserted, updated: updated }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "HOTS Trading GSheet Webhook Aktif!" }))
    .setMimeType(ContentService.MimeType.JSON);
}
