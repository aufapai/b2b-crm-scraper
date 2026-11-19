/**
 * B2B CRM Scraper (HOTS Trading) - Google Sheets Auto-Sync Webhook (v1.1)
 * Fix #ERROR!: Menggunakan RichTextValue native Google Sheets (bukan rumus =HYPERLINK),
 * sehingga tombol "Buka WA" 100% bebas error di Google Sheet Bahasa Indonesia maupun Inggris.
 *
 * Cara Pasang (1x saja):
 * 1. Buka Google Sheet kamu -> menu Extensions > Apps Script.
 * 2. Hapus kode lama, paste seluruh kode ini, lalu Save (Ctrl+S).
 * 3. Klik Deploy > Manage deployments (atau New deployment) -> Web app:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Copy Web app URL (https://script.google.com/macros/s/.../exec) ke Settings Extension.
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
  "Link Buka WA",
  "No Telp Kantor / Asal",
  "Email",
  "Kota / Lokasi",
  "Alamat Lengkap",
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
      .setBackground("#0F2942")
      .setFontColor("#FFFFFF");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function setWaRichLink(cell, phoneWa, senderName, companyBrand) {
  const clean = String(phoneWa || "").replace(/\D/g, "");
  if (!clean || clean.length < 10) {
    cell.setValue("");
    return;
  }
  const sender = senderName || "Tim BD";
  const brand = companyBrand || "HOTS Trading";
  const msg = "Selamat pagi Bapak/Ibu, saya " + sender + " dari " + brand + ". Apakah saya boleh mengirimkan katalog dan informasi penawaran untuk kebutuhan perusahaan Bapak/Ibu?";
  const url = "https://wa.me/" + clean + "?text=" + encodeURIComponent(msg);
  const rich = SpreadsheetApp.newRichTextValue()
    .setText("Buka WA")
    .setLinkUrl(url)
    .build();
  cell.setRichTextValue(rich);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    const leads = body.leads || [];
    const senderName = body.sender_name || "Aufa";
    const companyBrand = body.company_brand || "HOTS Trading";
    const sheet = getOrCreateSheet();

    const existingData = sheet.getDataRange().getValues();
    const existingMap = {};
    for (let i = 1; i < existingData.length; i++) {
      const nameKey = String(existingData[i][2] || "").trim().toLowerCase();
      if (nameKey) existingMap[nameKey] = i + 1;
    }

    let inserted = 0;
    let updated = 0;
    const nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm");

    leads.forEach((lead) => {
      const comp = String(lead.company_name || lead.title || "").trim();
      if (!comp) return;

      const phoneWa = String(lead.phone_wa || "").replace(/\D/g, "");
      const key = comp.toLowerCase();

      if (existingMap[key]) {
        const rowIdx = existingMap[key];
        sheet.getRange(rowIdx, 1).setValue(nowStr);
        if (lead.contact_person) sheet.getRange(rowIdx, 5).setValue(lead.contact_person);
        if (lead.job_title) sheet.getRange(rowIdx, 6).setValue(lead.job_title);
        if (phoneWa) {
          sheet.getRange(rowIdx, 7).setValue("+" + phoneWa);
          setWaRichLink(sheet.getRange(rowIdx, 8), phoneWa, senderName, companyBrand);
        }
        if (lead.phone_number) sheet.getRange(rowIdx, 9).setValue(lead.phone_number);
        if (lead.email) sheet.getRange(rowIdx, 10).setValue(lead.email);
        if (lead.location || lead.wilayah) sheet.getRange(rowIdx, 11).setValue(lead.location || lead.wilayah);
        if (lead.address) sheet.getRange(rowIdx, 12).setValue(lead.address);
        if (lead.warning_note) sheet.getRange(rowIdx, 16).setValue(lead.warning_note);
        updated++;
      } else {
        const rowValues = [
          nowStr,
          lead.batch_day || "Extension Scrape",
          comp,
          lead.segment || "B2B Lead",
          lead.contact_person || "",
          lead.job_title || "",
          phoneWa ? ("+" + phoneWa) : "",
          "",
          lead.phone_number || "",
          lead.email || "",
          lead.location || lead.wilayah || "",
          lead.address || "",
          lead.products || lead.follow_up_notes || "",
          lead.linkedin_url || lead.website || lead.source_url || "",
          lead.outreach_status || "Belum Dihubungi",
          lead.warning_note || ""
        ];
        sheet.appendRow(rowValues);
        const newRowIdx = sheet.getLastRow();
        if (phoneWa) {
          setWaRichLink(sheet.getRange(newRowIdx, 8), phoneWa, senderName, companyBrand);
        }
        existingMap[key] = newRowIdx;
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
    .createTextOutput(JSON.stringify({ status: "ok", message: "B2B CRM GSheet Webhook v1.1 Aktif!" }))
    .setMimeType(ContentService.MimeType.JSON);
}
