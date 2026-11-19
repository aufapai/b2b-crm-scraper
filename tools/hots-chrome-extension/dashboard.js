const DEFAULT_PROFILE = {
  companyBrand: "HOTS Trading (PT Indo Sukses Semesta)",
  senderName: "Aufa",
  industryId: "safety_apd",
  regions: "Jakarta, Surabaya, Balikpapan, Bangkok, HCMC",
  segments: [
    "Segmen A: Reseller & Toko K3",
    "Segmen A: Partner Portal & BUMN",
    "Segmen A: Buyer Korporat",
    "Segmen B: Manufaktur Sepatu",
    "Riset Pasar SEA"
  ],
  onboarded: false
};

let allLeads = [];
let filteredLeads = [];
let profile = { ...DEFAULT_PROFILE };
let settings = { gsheetUrl: "", authUser: "", webhookUrl: "", theme: "light" };
let detectedEmail = "";
let activeOutreachLead = null;
let activeOutreachChannel = "wa";

let filterState = {
  batch: "",
  search: "",
  segment: "",
  status: "",
  waOnly: false,
  emailOnly: false,
  page: 1,
  pageSize: 30
};

// --- Helpers ---
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.borderLeftColor = isError ? "#dc2626" : "#d97706";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3200);
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAuthUserUrl(rawUrl, authUser) {
  if (!rawUrl) return "";
  try {
    const u = new URL(rawUrl);
    if (authUser && authUser.trim() !== "") u.searchParams.set("authuser", authUser.trim());
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function buildGmailComposeUrl(to, subject, body, authUser) {
  const u = new URL("https://mail.google.com/mail/");
  u.searchParams.set("view", "cm");
  u.searchParams.set("fs", "1");
  if (to) u.searchParams.set("to", to);
  if (subject) u.searchParams.set("su", subject);
  if (body) u.searchParams.set("body", body);
  if (authUser && authUser.trim() !== "") u.searchParams.set("authuser", authUser.trim());
  return u.toString();
}

function extractMobileWA(raw) {
  if (!raw) return "";
  const matches = String(raw).match(/(?:(?:\+?62)|0)8[1-9][0-9\-\.\s\(\)]{6,15}/g);
  if (!matches) return "";
  for (const m of matches) {
    let d = m.replace(/\D/g, "");
    if (d.startsWith("08")) d = "62" + d.slice(1);
    else if (d.startsWith("8")) d = "62" + d;
    if (d.startsWith("628") && d.length >= 10 && d.length <= 15) return d;
  }
  return "";
}

function buildTemplate(key, lead) {
  const sender = profile.senderName || "Tim BD";
  const brand = profile.companyBrand || "HOTS Trading";
  const comp = lead.company_name || "Bapak/Ibu";
  const pic = lead.contact_person && lead.contact_person !== "Bapak/Ibu" ? lead.contact_person : comp;
  const loc = lead.location || lead.wilayah || "Indonesia";
  const prod = lead.products || "produk safety footwear / kebutuhan industri";

  const map = {
    T1: {
      subject: `Penawaran Kemitraan & Katalog Produk — ${brand}`,
      body: `Selamat pagi Bapak/Ibu, saya ${sender} dari ${brand}. Kami menyuplai kebutuhan B2B & safety footwear untuk toko, distributor, dan proyek industri. Apakah saya boleh mengirimkan katalog resmi dan skema harga untuk ${comp}?`
    },
    T2: {
      subject: `Follow Up Kebutuhan Pengadaan — ${comp}`,
      body: `Selamat pagi Bapak/Ibu ${pic}, saya ${sender} dari ${brand}. Menindaklanjuti komunikasi kita sebelumnya, apakah ada rencana kebutuhan stok untuk bulan depan atau kuartal mendatang? Jika ada, boleh saya tahu model dan perkiraan jumlahnya agar bisa saya siapkan penawarannya?`
    },
    T3: {
      subject: `Pembaruan Penawaran Pengadaan — ${comp}`,
      body: `Selamat pagi Bapak/Ibu ${pic}, saya ${sender} dari ${brand}. Menindaklanjuti penawaran kami sebelumnya, apakah evaluasi kebutuhan di ${comp} sudah berjalan? Kami siap mengirimkan penawaran yang diperbarui sesuai jumlah unit yang dibutuhkan.`
    },
    EMAIL_B2B: {
      subject: `Penawaran Pengadaan B2B & Katalog Resmi untuk ${comp}`,
      body: `Selamat pagi Bapak/Ibu ${pic},\n\nPerkenalkan saya ${sender} dari ${brand}.\n\nKami mendukung pengadaan perusahaan dan distributor dengan pasokan langsung dari jalur resmi serta skema harga volume yang transparan untuk kebutuhan operasional di ${comp}.\n\nApakah Bapak/Ibu berkenan jika kami kirimkan katalog resmi atau menjadwalkan diskusi singkat 10 menit minggu ini?\n\nTerima kasih atas waktu dan perhatiannya.\n\nSalam hormat,\n${sender}\n${brand}`
    },
    MFG: {
      subject: `Peluang Kemitraan Distribusi B2B & Ekspor — ${comp}`,
      body: `Selamat pagi Bapak/Ibu ${pic} (${comp}), salam kenal. Saya ${sender} dari ${brand}. Kami mengapresiasi kapasitas produksi ${prod} di ${loc}. Saat ini kami membuka kerja sama distribusi B2B dan perluasan pasar regional. Apakah saya boleh mengirimkan info singkat program kemitraannya?`
    }
  };
  return map[key] || map.T1;
}

// --- Chrome Account & Profile ---
function detectChromeAccount() {
  return new Promise((resolve) => {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
      chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (info) => {
        detectedEmail = (info && info.email) ? info.email : "";
        const el = document.getElementById("detectedChromeEmail");
        if (el) el.textContent = detectedEmail || "Tidak terdeteksi (isi manual di bawah)";
        resolve(detectedEmail);
      });
    } else {
      resolve("");
    }
  });
}

function applyProfileToUI() {
  const brandShort = (profile.companyBrand || "B2B CRM").split("(")[0].trim();
  document.getElementById("dashBrandTitle").textContent = `${brandShort} CRM`;
  document.getElementById("dashBrandMark").textContent = brandShort.slice(0, 2).toUpperCase();

  // Populate segment filter dropdown dynamically
  const segSel = document.getElementById("filterSegment");
  const curVal = segSel.value;
  const customSegs = Array.isArray(profile.segments) && profile.segments.length ? profile.segments : DEFAULT_PROFILE.segments;
  const dataSegs = Array.from(new Set(allLeads.map((l) => l.segment).filter(Boolean)));
  const merged = Array.from(new Set([...customSegs, ...dataSegs]));
  segSel.innerHTML = `<option value="">Semua Segmen</option>` + merged.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  segSel.value = curVal;
}

function updateProfileBadge() {
  const emailLabel = document.getElementById("profileEmailLabel");
  const statusLabel = document.getElementById("profileConnStatus");
  const initialEl = document.getElementById("profileInitial");
  const dotEl = document.getElementById("profileDot");
  if (!emailLabel) return;

  const activeAccount = (settings.authUser && settings.authUser !== "0")
    ? settings.authUser
    : (detectedEmail || "Akun Utama (0)");

  emailLabel.textContent = activeAccount;
  initialEl.textContent = (activeAccount.replace(/^Akun\s*/i, "")[0] || "A").toUpperCase();

  if (settings.webhookUrl && settings.gsheetUrl) {
    statusLabel.textContent = "GSheet & Gmail Terhubung";
    statusLabel.style.color = "var(--green)";
    dotEl.className = "status-dot dot-ok";
  } else if (settings.gsheetUrl) {
    statusLabel.textContent = "GSheet Aktif • Webhook belum diisi";
    statusLabel.style.color = "var(--accent)";
    dotEl.className = "status-dot dot-warn";
  } else {
    statusLabel.textContent = "Klik untuk hubungkan Google Sheet";
    statusLabel.style.color = "var(--muted)";
    dotEl.className = "status-dot dot-warn";
  }
}

async function loadSeedData() {
  try {
    const resp = await fetch(chrome.runtime.getURL("seed_leads.json"));
    if (!resp.ok) return [];
    const data = await resp.json();
    if (Array.isArray(data) && data.length > 0) {
      await chrome.storage.local.set({ hots_leads: data });
      return data;
    }
    return [];
  } catch {
    return [];
  }
}

function populateIndustrySelects() {
  const list = (window.B2B_DATABASE && window.B2B_DATABASE.industries) || [];
  const html = list.map((i) => `<option value="${i.id}">${escapeHtml(i.label)}</option>`).join("");
  document.getElementById("obIndustry").innerHTML = html;
  document.getElementById("dashKwIndustry").innerHTML = html;
}

function openOnboardingModal() {
  document.getElementById("obCompanyBrand").value = profile.companyBrand || "";
  document.getElementById("obSenderName").value = profile.senderName || "";
  document.getElementById("obIndustry").value = profile.industryId || "safety_apd";
  document.getElementById("obRegions").value = profile.regions || "";
  document.getElementById("obSegments").value = (profile.segments || DEFAULT_PROFILE.segments).join("\n");
  document.getElementById("modalOnboarding").classList.remove("hidden");
}

function renderDashboardKeywords() {
  if (!window.B2B_DATABASE) return;
  const indId = document.getElementById("dashKwIndustry").value;
  const regions = document.getElementById("dashKwRegions").value;
  const topic = document.getElementById("dashKwTopic").value;
  const rec = window.B2B_DATABASE.generateRecommendations(indId, regions, topic);
  const grid = document.getElementById("dashKeywordGrid");
  grid.innerHTML = "";

  [...rec.maps.map((m) => ({ ...m, tag: "Maps" })), ...rec.linkedin.map((l) => ({ ...l, tag: "LinkedIn" }))].forEach((it) => {
    const div = document.createElement("div");
    div.className = "kw-item";
    div.innerHTML = `<span>[${it.tag}] ${escapeHtml(it.query)}</span><button class="btn btn-navy btn-sm">Buka</button>`;
    div.querySelector("button").addEventListener("click", () => window.open(it.url, "_blank"));
    grid.appendChild(div);
  });
}

// --- Outreach Composer ("Hubungi Via" WA & Draft Gmail) ---
function openOutreachModal(lead) {
  activeOutreachLead = lead;
  const waNum = String(lead.phone_wa || "").replace(/\D/g, "");
  const hasWa = waNum.startsWith("628");
  const hasEmail = Boolean(lead.email);

  document.getElementById("outreachCompanyTitle").textContent = lead.company_name;
  document.getElementById("outreachContactMeta").textContent =
    `${lead.contact_person || "PIC"} • ${hasWa ? "WA: +" + waNum : (lead.phone_number ? "Telp: " + lead.phone_number : "Tanpa WA")} • ${lead.email || "Tanpa Email"}`;

  const warnBox = document.getElementById("outreachWarningBox");
  if (lead.warning_note) {
    warnBox.textContent = `Perhatian: ${lead.warning_note}`;
    warnBox.classList.remove("hidden");
  } else {
    warnBox.classList.add("hidden");
  }

  // Auto-select best channel (if no WA but has Email, default to Gmail!)
  setOutreachChannel(hasWa ? "wa" : (hasEmail ? "gmail" : "wa"));

  // Auto-pick template
  const tplSel = document.getElementById("outreachTemplateSel");
  if (!hasWa && hasEmail) tplSel.value = "EMAIL_B2B";
  else if ((lead.follow_up_notes || "").includes("[T2]")) tplSel.value = "T2";
  else if ((lead.follow_up_notes || "").includes("[T3]")) tplSel.value = "T3";
  else tplSel.value = "T1";

  refreshOutreachDraft();
  document.getElementById("modalOutreach").classList.remove("hidden");
}

function setOutreachChannel(ch) {
  activeOutreachChannel = ch;
  document.getElementById("chBtnWa").classList.toggle("active", ch === "wa");
  document.getElementById("chBtnGmail").classList.toggle("active", ch === "gmail");
  document.getElementById("outreachSubjectRow").classList.toggle("hidden", ch !== "gmail");
}

function refreshOutreachDraft() {
  if (!activeOutreachLead) return;
  const key = document.getElementById("outreachTemplateSel").value;
  const tpl = buildTemplate(key, activeOutreachLead);
  document.getElementById("outreachSubject").value = tpl.subject;
  document.getElementById("outreachMessage").value = tpl.body;
}

// --- KPI & Render Leads ---
function updateKPIs() {
  document.getElementById("kpiTotal").textContent = allLeads.length;
  document.getElementById("kpiWa").textContent = allLeads.filter((l) => l.is_wa_valid == 1 || (l.phone_wa && String(l.phone_wa).startsWith("628"))).length;
  document.getElementById("kpiEmail").textContent = allLeads.filter((l) => l.email && l.email.includes("@")).length;
  document.getElementById("kpiContacted").textContent = allLeads.filter((l) => l.outreach_status && l.outreach_status !== "Belum Dihubungi").length;
}

function applyFilters() {
  const q = filterState.search.toLowerCase();
  filteredLeads = allLeads.filter((l) => {
    if (filterState.batch && (l.batch_day || "") !== filterState.batch) return false;
    if (filterState.segment && (l.segment || "") !== filterState.segment) return false;
    if (filterState.status && (l.outreach_status || "Belum Dihubungi") !== filterState.status) return false;
    if (filterState.waOnly && !(l.is_wa_valid == 1 || (l.phone_wa && String(l.phone_wa).startsWith("628")))) return false;
    if (filterState.emailOnly && !(l.email && l.email.includes("@"))) return false;
    if (q) {
      const hay = `${l.company_name} ${l.contact_person} ${l.location} ${l.wilayah} ${l.address} ${l.phone_wa} ${l.phone_number} ${l.email} ${l.products} ${l.follow_up_notes} ${l.batch_day}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  filterState.page = 1;
  updateKPIs();
  renderLeads();
}

function renderLeads() {
  const container = document.getElementById("leadsContainer");
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / filterState.pageSize));
  if (filterState.page > totalPages) filterState.page = totalPages;

  const start = (filterState.page - 1) * filterState.pageSize;
  const slice = filteredLeads.slice(start, start + filterState.pageSize);

  document.getElementById("resultSummary").textContent = `Menampilkan ${slice.length} dari ${filteredLeads.length} leads cocok`;
  document.getElementById("pageInfo").textContent = `Halaman ${filterState.page} / ${totalPages}`;
  document.getElementById("btnPrev").disabled = filterState.page <= 1;
  document.getElementById("btnNext").disabled = filterState.page >= totalPages;

  if (!slice.length) {
    container.innerHTML = `<div class="lead-card"><div class="company-name">Belum ada data yang cocok.</div><div class="company-loc">Gunakan tombol Import CSV atau buka Google Maps / Website lalu klik Deep Scan di ikon Extension.</div></div>`;
    return;
  }

  container.innerHTML = "";
  const statusOpts = ["Belum Dihubungi", "Terkirim", "Dibalas", "Butuh jelas", "SPH dikirim", "Tidak tertarik"];

  slice.forEach((lead) => {
    const waNum = String(lead.phone_wa || "").replace(/\D/g, "");
    const hasWa = waNum.startsWith("628");
    const statusVal = lead.outreach_status || "Belum Dihubungi";

    const card = document.createElement("article");
    card.className = `lead-card ${lead.warning_note ? "has-warning" : ""}`;
    card.innerHTML = `
      <div class="card-head">
        <div>
          <div class="company-name">${escapeHtml(lead.company_name)}</div>
          <div class="company-loc">${escapeHtml(lead.location || lead.wilayah || "-")} · ${escapeHtml(lead.segment || lead.industry || "")}</div>
        </div>
        <span class="batch-label">${escapeHtml(lead.batch_day || "CRM")}</span>
      </div>

      <div class="contact-lines">
        ${lead.contact_person ? `<span><strong>PIC:</strong> ${escapeHtml(lead.contact_person)} ${lead.job_title ? `(${escapeHtml(lead.job_title)})` : ""}</span>` : ""}
        <span><strong>Kontak:</strong> ${hasWa ? `WA +${escapeHtml(waNum)}` : (lead.phone_number ? escapeHtml(lead.phone_number) : "-")}</span>
        ${lead.email ? `<span><strong>Email:</strong> ${escapeHtml(lead.email)}</span>` : ""}
        ${lead.address ? `<span class="addr-line"><strong>Alamat:</strong> ${escapeHtml(lead.address)}</span>` : ""}
      </div>

      ${lead.warning_note ? `<div class="warning-banner">${escapeHtml(lead.warning_note)}</div>` : ""}
      ${lead.follow_up_notes ? `<div class="notes-line">${escapeHtml(lead.follow_up_notes)}</div>` : ""}

      <div class="card-footer">
        <button class="btn btn-accent btn-sm btn-contact-lead">Hubungi (WA / Gmail)</button>
        ${lead.website && lead.website.startsWith("http") ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(lead.website)}" target="_blank">Web</a>` : ""}
        ${lead.linkedin_url ? `<a class="btn btn-outline btn-sm" href="${escapeHtml(lead.linkedin_url)}" target="_blank">LinkedIn</a>` : ""}
        <select class="status-select">
          ${statusOpts.map((st) => `<option value="${st}" ${st === statusVal ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
    `;

    card.querySelector(".btn-contact-lead").addEventListener("click", () => openOutreachModal(lead));
    card.querySelector(".status-select").addEventListener("change", async (e) => {
      lead.outreach_status = e.target.value;
      lead.last_contacted_at = new Date().toISOString();
      await chrome.storage.local.set({ hots_leads: allLeads });
      updateKPIs();
      showToast(`Status ${lead.company_name} -> ${lead.outreach_status}`);
    });

    container.appendChild(card);
  });
}

// --- CSV Export / Import ---
function exportCsv() {
  const cols = [
    "batch_day", "company_name", "segment", "industry", "contact_person", "job_title",
    "phone_wa", "phone_number", "email", "location", "wilayah", "address", "products",
    "website", "linkedin_url", "outreach_status", "follow_up_notes", "warning_note", "source_url"
  ];
  const rows = filteredLeads.map((l) => cols.map((c) => `"${String(l[c] || "").replace(/"/g, '""')}"`).join(","));
  const csv = "\uFEFF" + [cols.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `b2b_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Export ${filteredLeads.length} leads ke CSV selesai.`);
}

function parseCsvLine(line) {
  const res = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) { res.push(cur); cur = ""; }
    else cur += ch;
  }
  res.push(cur);
  return res;
}

async function importCsvFile(file) {
  const text = await file.text();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return;
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const existingMap = new Map(allLeads.map((l) => [String(l.company_name || "").toLowerCase(), l]));
  let added = 0;

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (vals[idx] || "").trim()));
    const comp = obj.company_name || obj.nama || obj.title || "";
    if (!comp) continue;
    const rawPhone = obj.phone_wa || obj.phone_number || obj.phone || obj["whatsapp / kontak"] || "";
    const wa = extractMobileWA(rawPhone);

    const record = {
      id: Date.now() + i,
      batch_day: obj.batch_day || obj.hari || "CSV Import",
      company_name: comp,
      segment: obj.segment || (profile.segments && profile.segments[0]) || "B2B Lead",
      industry: obj.industry || obj.tipe || "",
      contact_person: obj.contact_person || "",
      job_title: obj.job_title || "",
      phone_wa: wa,
      is_wa_valid: wa ? 1 : 0,
      phone_number: rawPhone,
      email: obj.email || "",
      location: obj.location || obj.kota || "",
      wilayah: obj.wilayah || obj.kota || "",
      address: obj.address || obj.alamat || "",
      products: obj.products || "",
      website: obj.website || "",
      linkedin_url: obj.linkedin_url || "",
      outreach_status: obj.outreach_status || obj.hasil || "Belum Dihubungi",
      follow_up_notes: obj.follow_up_notes || obj.catatan || "",
      warning_note: obj.warning_note || "",
      source_url: obj.source_url || file.name
    };

    if (!existingMap.has(comp.toLowerCase())) {
      allLeads.unshift(record);
      existingMap.set(comp.toLowerCase(), record);
      added++;
    }
  }
  await chrome.storage.local.set({ hots_leads: allLeads });
  applyProfileToUI();
  applyFilters();
  showToast(`Import CSV selesai: +${added} leads baru.`);
}

async function syncToGoogleSheet() {
  if (!settings.webhookUrl) {
    showToast("Isi Google Apps Script Webhook URL di Pengaturan dulu!", true);
    document.getElementById("modalSettings").classList.remove("hidden");
    return;
  }
  const toSend = filteredLeads.slice(0, 150);
  document.getElementById("syncStatusText").textContent = `Mengirim ${toSend.length} leads ke Google Sheet...`;
  try {
    await fetch(settings.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_leads",
        sender_name: profile.senderName,
        company_brand: profile.companyBrand,
        leads: toSend
      })
    });
    document.getElementById("syncStatusText").textContent = `${toSend.length} leads terkirim ke Google Sheet.`;
    showToast(`Sync ${toSend.length} leads ke Google Sheet selesai!`);
  } catch (e) {
    document.getElementById("syncStatusText").textContent = `Gagal sync: ${e.message}`;
    showToast("Gagal sync ke Google Sheet", true);
  }
}

// --- Init ---
async function initApp() {
  populateIndustrySelects();
  await detectChromeAccount();

  const stored = await chrome.storage.local.get(["hots_leads", "gsheetUrl", "authUser", "webhookUrl", "crm_profile", "theme"]);
  if (stored.crm_profile) profile = { ...DEFAULT_PROFILE, ...stored.crm_profile };
  settings = {
    gsheetUrl: stored.gsheetUrl || "",
    authUser: stored.authUser || detectedEmail || "0",
    webhookUrl: stored.webhookUrl || "",
    theme: stored.theme || "light"
  };

  document.documentElement.setAttribute("data-theme", settings.theme);
  document.getElementById("setGSheetUrl").value = settings.gsheetUrl;
  document.getElementById("setAuthUser").value = settings.authUser;
  document.getElementById("setWebhookUrl").value = settings.webhookUrl;

  if (Array.isArray(stored.hots_leads) && stored.hots_leads.length > 0) {
    allLeads = stored.hots_leads;
  } else {
    allLeads = await loadSeedData();
  }

  applyProfileToUI();
  updateProfileBadge();
  applyFilters();

  // Tampilkan Onboarding Wizard saat pertama kali instal atau jika dibuka via #onboarding
  if (!profile.onboarded || window.location.hash === "#onboarding") {
    openOnboardingModal();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();

  // Live sync dari Popup Scraper
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.hots_leads && Array.isArray(changes.hots_leads.newValue)) {
      allLeads = changes.hots_leads.newValue;
      applyProfileToUI();
      applyFilters();
    }
  });

  // Close buttons for all modals
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById(btn.dataset.close).classList.add("hidden");
    });
  });

  // Theme toggle
  document.getElementById("btnToggleTheme").addEventListener("click", async () => {
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", settings.theme);
    await chrome.storage.local.set({ theme: settings.theme });
  });

  // Batch tabs
  document.querySelectorAll("#batchPills .batch-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#batchPills .batch-tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterState.batch = btn.dataset.batch || "";
      applyFilters();
    });
  });

  document.getElementById("searchInput").addEventListener("input", (e) => { filterState.search = e.target.value.trim(); applyFilters(); });
  document.getElementById("filterSegment").addEventListener("change", (e) => { filterState.segment = e.target.value; applyFilters(); });
  document.getElementById("filterStatus").addEventListener("change", (e) => { filterState.status = e.target.value; applyFilters(); });
  document.getElementById("chkWaOnly").addEventListener("change", (e) => { filterState.waOnly = e.target.checked; applyFilters(); });
  document.getElementById("chkEmailOnly").addEventListener("change", (e) => { filterState.emailOnly = e.target.checked; applyFilters(); });
  document.getElementById("btnPrev").addEventListener("click", () => { if (filterState.page > 1) { filterState.page--; renderLeads(); window.scrollTo(0, 0); } });
  document.getElementById("btnNext").addEventListener("click", () => { filterState.page++; renderLeads(); window.scrollTo(0, 0); });

  // Outreach Modal Controls
  document.getElementById("chBtnWa").addEventListener("click", () => setOutreachChannel("wa"));
  document.getElementById("chBtnGmail").addEventListener("click", () => setOutreachChannel("gmail"));
  document.getElementById("outreachTemplateSel").addEventListener("change", refreshOutreachDraft);

  async function markActiveLeadSent() {
    if (!activeOutreachLead) return;
    if ((activeOutreachLead.outreach_status || "Belum Dihubungi") === "Belum Dihubungi") {
      activeOutreachLead.outreach_status = "Terkirim";
      activeOutreachLead.last_contacted_at = new Date().toISOString();
      await chrome.storage.local.set({ hots_leads: allLeads });
      applyFilters();
    }
  }

  document.getElementById("btnSendViaWa").addEventListener("click", async () => {
    if (!activeOutreachLead) return;
    const waNum = String(activeOutreachLead.phone_wa || "").replace(/\D/g, "");
    if (!waNum) {
      showToast("Lead ini tidak memiliki nomor WA valid. Gunakan Draft Gmail!", true);
      return;
    }
    const msg = document.getElementById("outreachMessage").value;
    window.open(`https://web.whatsapp.com/send?phone=${waNum}&text=${encodeURIComponent(msg)}`, "_blank");
    await markActiveLeadSent();
    document.getElementById("modalOutreach").classList.add("hidden");
  });

  document.getElementById("btnSendViaGmail").addEventListener("click", async () => {
    if (!activeOutreachLead) return;
    const to = activeOutreachLead.email || "";
    const subject = document.getElementById("outreachSubject").value;
    const body = document.getElementById("outreachMessage").value;
    const auth = settings.authUser || detectedEmail || "0";
    window.open(buildGmailComposeUrl(to, subject, body, auth), "_blank");
    await markActiveLeadSent();
    document.getElementById("modalOutreach").classList.add("hidden");
  });

  document.getElementById("btnCopyDraft").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("outreachMessage").value);
    showToast("Draft pesan disalin ke clipboard.");
  });

  // Onboarding Modal
  document.getElementById("btnOpenOnboarding").addEventListener("click", openOnboardingModal);
  document.getElementById("btnLoadDefaultSegments").addEventListener("click", () => {
    const indId = document.getElementById("obIndustry").value;
    const ind = (window.B2B_DATABASE?.industries || []).find((i) => i.id === indId);
    if (ind) document.getElementById("obSegments").value = ind.defaultSegments.join("\n");
  });
  document.getElementById("btnSaveOnboarding").addEventListener("click", async () => {
    const segLines = document.getElementById("obSegments").value.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    profile = {
      companyBrand: document.getElementById("obCompanyBrand").value.trim() || "HOTS Trading",
      senderName: document.getElementById("obSenderName").value.trim() || "Tim BD",
      industryId: document.getElementById("obIndustry").value || "safety_apd",
      regions: document.getElementById("obRegions").value.trim() || "Jakarta",
      segments: segLines.length ? segLines : DEFAULT_PROFILE.segments,
      onboarded: true
    };
    await chrome.storage.local.set({ crm_profile: profile });
    applyProfileToUI();
    document.getElementById("modalOnboarding").classList.add("hidden");
    showToast("Profil bisnis & segmen kustom berhasil diterapkan!");
  });

  // Smart Keywords Modal
  document.getElementById("btnOpenKeywords").addEventListener("click", () => {
    document.getElementById("dashKwIndustry").value = profile.industryId || "safety_apd";
    document.getElementById("dashKwRegions").value = profile.regions || "Jakarta, Surabaya";
    renderDashboardKeywords();
    document.getElementById("modalKeywords").classList.remove("hidden");
  });
  document.getElementById("dashKwIndustry").addEventListener("change", renderDashboardKeywords);
  document.getElementById("dashKwRegions").addEventListener("input", renderDashboardKeywords);
  document.getElementById("dashKwTopic").addEventListener("input", renderDashboardKeywords);

  // Settings & GSheet
  document.getElementById("profileBadge").addEventListener("click", () => {
    document.getElementById("modalSettings").classList.remove("hidden");
  });
  document.getElementById("btnUseDetectedAccount").addEventListener("click", () => {
    if (!detectedEmail) { showToast("Email Chrome tidak terdeteksi.", true); return; }
    document.getElementById("setAuthUser").value = detectedEmail;
  });
  document.getElementById("btnCopyGsScript").addEventListener("click", async () => {
    try {
      const resp = await fetch(chrome.runtime.getURL("apps_script_template.gs"));
      await navigator.clipboard.writeText(await resp.text());
      showToast("Kode Apps Script v1.1 tersalin! Paste di Extensions > Apps Script lalu Deploy ulang.");
    } catch (e) {
      showToast("Gagal copy kode .gs: " + e.message, true);
    }
  });
  document.getElementById("btnSaveSettings").addEventListener("click", async () => {
    settings.gsheetUrl = document.getElementById("setGSheetUrl").value.trim();
    settings.authUser = document.getElementById("setAuthUser").value.trim() || detectedEmail || "0";
    settings.webhookUrl = document.getElementById("setWebhookUrl").value.trim();
    await chrome.storage.local.set({
      gsheetUrl: settings.gsheetUrl,
      authUser: settings.authUser,
      webhookUrl: settings.webhookUrl
    });
    updateProfileBadge();
    document.getElementById("modalSettings").classList.add("hidden");
    showToast("Pengaturan Akun & Google Sheet tersimpan.");
  });
  document.getElementById("btnResetSeed").addEventListener("click", async () => {
    if (!confirm("Reset data ke data awal lokal?")) return;
    allLeads = await loadSeedData();
    applyProfileToUI();
    applyFilters();
    document.getElementById("modalSettings").classList.add("hidden");
    showToast("Data di-reset.");
  });

  document.getElementById("btnOpenGSheet").addEventListener("click", () => {
    if (!settings.gsheetUrl) {
      showToast("Masukkan URL Google Sheet di Pengaturan dulu!", true);
      document.getElementById("modalSettings").classList.remove("hidden");
      return;
    }
    window.open(buildAuthUserUrl(settings.gsheetUrl, settings.authUser), "_blank");
  });
  document.getElementById("btnSyncGSheet").addEventListener("click", syncToGoogleSheet);
  document.getElementById("btnExportCsv").addEventListener("click", exportCsv);
  document.getElementById("inputImportCsv").addEventListener("change", (e) => {
    if (e.target.files[0]) importCsvFile(e.target.files[0]);
    e.target.value = "";
  });

  // Double Check Bentrok & Duplikat Modal
  function normalizeName(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\b(pt|cv|ud|pd|tbk|jsc|corp|corporation|co\.?,?\s*ltd|ltd|inc|llc|group|indonesia|vietnam)\b/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scanCrmConflicts() {
    const conflicts = [];
    const byNormName = new Map();
    const byWa = new Map();
    const byEmail = new Map();

    allLeads.forEach((l, idx) => {
      const nKey = normalizeName(l.company_name);
      if (nKey && nKey.length >= 3) {
        if (!byNormName.has(nKey)) byNormName.set(nKey, []);
        byNormName.get(nKey).push({ idx, lead: l });
      }
      const wa = String(l.phone_wa || "").replace(/\D/g, "");
      if (wa && wa.length >= 9) {
        if (!byWa.has(wa)) byWa.set(wa, []);
        byWa.get(wa).push({ idx, lead: l });
      }
      const em = String(l.email || "").trim().toLowerCase();
      if (em && em.includes("@")) {
        if (!byEmail.has(em)) byEmail.set(em, []);
        byEmail.get(em).push({ idx, lead: l });
      }
    });

    byNormName.forEach((arr, k) => {
      if (arr.length > 1) conflicts.push({ type: "Nama Perusahaan Mirip", key: k, items: arr });
    });
    byWa.forEach((arr, k) => {
      if (arr.length > 1) conflicts.push({ type: "Nomor WA Dipakai Banyak PT", key: "+" + k, items: arr });
    });
    byEmail.forEach((arr, k) => {
      if (arr.length > 1) conflicts.push({ type: "Email Sama", key: k, items: arr });
    });

    return conflicts;
  }

  function renderConflictAudit() {
    const listEl = document.getElementById("conflictAuditList");
    const sumEl = document.getElementById("conflictAuditSummary");
    const conflicts = scanCrmConflicts();

    sumEl.textContent = conflicts.length
      ? `Ditemukan ${conflicts.length} kelompok potensi bentrok / duplikat dari total ${allLeads.length} leads.`
      : `Semua ${allLeads.length} leads bersih! Tidak ada duplikat atau nomor/email bentrok.`;

    listEl.innerHTML = "";
    conflicts.forEach((c) => {
      const box = document.createElement("div");
      box.className = "warning-banner";
      const names = c.items.map((x) => `${x.lead.company_name} (${x.lead.batch_day || "CRM"} / ${x.lead.outreach_status || "Belum Dihubungi"})`).join("  vs  ");
      box.innerHTML = `<strong>${escapeHtml(c.type)}: ${escapeHtml(c.key)}</strong><br><span>${escapeHtml(names)}</span>`;
      listEl.appendChild(box);
    });
  }

  document.getElementById("btnDoubleCheck").addEventListener("click", () => {
    renderConflictAudit();
    document.getElementById("modalConflicts").classList.remove("hidden");
  });

  document.getElementById("btnAutoDedupeExact").addEventListener("click", async () => {
    const seen = new Map();
    const cleaned = [];
    let removed = 0;

    for (const l of allLeads) {
      const key = String(l.company_name || "").trim().toLowerCase();
      if (!key) continue;
      if (seen.has(key)) {
        const prev = seen.get(key);
        if (!prev.phone_wa && l.phone_wa) { prev.phone_wa = l.phone_wa; prev.is_wa_valid = 1; }
        if (!prev.email && l.email) prev.email = l.email;
        if (!prev.address && l.address) prev.address = l.address;
        removed++;
      } else {
        seen.set(key, l);
        cleaned.push(l);
      }
    }

    allLeads = cleaned;
    await chrome.storage.local.set({ hots_leads: allLeads });
    applyProfileToUI();
    applyFilters();
    renderConflictAudit();
    showToast(`Selesai! ${removed} duplikat nama persis digabungkan.`);
  });
});
