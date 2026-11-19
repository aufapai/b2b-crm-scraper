const TEMPLATES = {
  T1: (lead) =>
    "Selamat pagi Bapak/Ibu, saya Aufa dari HOTS Trading (PT Indo Sukses Semesta), distributor resmi AP Boots. Kami menyuplai boot PVC dan safety boot untuk toko dan supplier K3. Apakah saya boleh mengirimkan katalog dan skema harga untuk toko Bapak/Ibu?",
  T2: (lead) => {
    const pic = lead.contact_person && lead.contact_person !== "Bapak/Ibu" ? lead.contact_person : lead.company_name;
    return `Selamat pagi Bapak/Ibu ${pic}, saya Aufa dari HOTS Trading. Menindaklanjuti komunikasi kita sebelumnya soal AP Boots, apakah ada kebutuhan stok untuk Desember atau awal tahun depan? Jika ada, boleh saya tahu model dan perkiraan jumlahnya agar bisa saya siapkan penawarannya?`;
  },
  T3: () =>
    "Selamat pagi Pak Denny, saya Aufa dari HOTS Trading. Menindaklanjuti penawaran AP Chef dan AP Clog bulan Juni, apakah evaluasi kebutuhan SPPG sudah berjalan? Kami siap mengirimkan penawaran yang diperbarui sesuai jumlah unit yang dikelola.",
  MFG: (lead) =>
    `Selamat pagi Bapak/Ibu (${lead.company_name}), salam kenal. Saya Aufa dari PT Indo Sukses Semesta (HOTS Trading). Kami mengapresiasi kapasitas produksi ${lead.products || "alas kaki"} di ${lead.location || "Indonesia"}. Apakah saya boleh mengirimkan info singkat program kemitraan distribusi B2B kami?`
};

let allLeads = [];
let filteredLeads = [];
let settings = { gsheetUrl: "", authUser: "0", webhookUrl: "" };
let filterState = {
  batch: "",
  search: "",
  segment: "",
  status: "",
  waOnly: false,
  page: 1,
  pageSize: 30
};

function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.borderColor = isError ? "#ef4444" : "#10b981";
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
    if (authUser && authUser.trim() !== "") {
      u.searchParams.set("authuser", authUser.trim());
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
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

async function loadSeedData() {
  try {
    const url = chrome.runtime.getURL("seed_leads.json");
    const resp = await fetch(url);
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

let detectedEmail = "";

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

function updateProfileBadge() {
  const emailLabel = document.getElementById("profileEmailLabel");
  const statusLabel = document.getElementById("profileConnStatus");
  const initialEl = document.getElementById("profileInitial");
  const dotEl = document.getElementById("profileDot");
  if (!emailLabel) return;

  const activeAccount = (settings.authUser && settings.authUser !== "0")
    ? settings.authUser
    : (detectedEmail || "Akun Utama (Index 0)");

  emailLabel.textContent = activeAccount;
  initialEl.textContent = (activeAccount.replace(/^Akun\s*/i, "")[0] || "G").toUpperCase();

  if (settings.webhookUrl && settings.gsheetUrl) {
    statusLabel.textContent = "GSheet & Auto-Sync Terhubung ✅";
    statusLabel.style.color = "#34d399";
    dotEl.className = "status-dot dot-ok";
  } else if (settings.gsheetUrl) {
    statusLabel.textContent = "GSheet Aktif • Webhook belum diisi";
    statusLabel.style.color = "#fbbf24";
    dotEl.className = "status-dot dot-warn";
  } else {
    statusLabel.textContent = "Klik untuk hubungkan Google Sheet";
    statusLabel.style.color = "#94a3b8";
    dotEl.className = "status-dot dot-warn";
  }
}

async function initData() {
  await detectChromeAccount();
  const stored = await chrome.storage.local.get(["hots_leads", "gsheetUrl", "authUser", "webhookUrl"]);
  settings = {
    gsheetUrl: stored.gsheetUrl || "",
    authUser: stored.authUser || detectedEmail || "0",
    webhookUrl: stored.webhookUrl || ""
  };
  document.getElementById("setGSheetUrl").value = settings.gsheetUrl;
  document.getElementById("setAuthUser").value = settings.authUser;
  document.getElementById("setWebhookUrl").value = settings.webhookUrl;
  updateProfileBadge();

  if (Array.isArray(stored.hots_leads) && stored.hots_leads.length > 0) {
    allLeads = stored.hots_leads;
  } else {
    allLeads = await loadSeedData();
    if (allLeads.length > 0) {
      showToast(`Berhasil muat ${allLeads.length} leads awal!`);
    } else {
      showToast("Data masih kosong. Klik '⬆️ Import CSV' atau mulai scrape!");
    }
  }
  applyFilters();
}

function updateKPIs() {
  document.getElementById("kpiTotal").textContent = allLeads.length;
  document.getElementById("kpiWa").textContent = allLeads.filter((l) => l.is_wa_valid == 1 || (l.phone_wa && String(l.phone_wa).startsWith("628"))).length;
  document.getElementById("kpiOutreach").textContent = allLeads.filter((l) => /^H[123]\s/i.test(l.batch_day || "")).length;
  document.getElementById("kpiContacted").textContent = allLeads.filter((l) => l.outreach_status && l.outreach_status !== "Belum Dihubungi").length;
}

function applyFilters() {
  const q = filterState.search.toLowerCase();
  filteredLeads = allLeads.filter((l) => {
    if (filterState.batch && (l.batch_day || "") !== filterState.batch) return false;
    if (filterState.segment && (l.segment || "") !== filterState.segment) return false;
    if (filterState.status && (l.outreach_status || "Belum Dihubungi") !== filterState.status) return false;
    if (filterState.waOnly && !(l.is_wa_valid == 1 || (l.phone_wa && String(l.phone_wa).startsWith("628")))) return false;
    if (q) {
      const hay = `${l.company_name} ${l.contact_person} ${l.location} ${l.wilayah} ${l.phone_wa} ${l.phone_number} ${l.email} ${l.products} ${l.follow_up_notes} ${l.batch_day}`.toLowerCase();
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
    container.innerHTML = `<div class="lead-card"><div class="company-name">Tidak ada data yang cocok dengan filter.</div></div>`;
    return;
  }

  container.innerHTML = "";
  slice.forEach((lead) => {
    const waNum = String(lead.phone_wa || "").replace(/\D/g, "");
    const hasWa = waNum.startsWith("628");
    const card = document.createElement("div");
    card.className = `lead-card ${lead.warning_note ? "has-warning" : ""}`;

    const badgeText = lead.batch_day || lead.segment || "Lead";
    const statusVal = lead.outreach_status || "Belum Dihubungi";
    const statusOpts = ["Belum Dihubungi", "Terkirim", "Dibalas", "Butuh jelas", "SPH dikirim", "Tidak tertarik", "Sudah Dihubungi"];

    card.innerHTML = `
      <div class="card-head">
        <div>
          <div class="company-name">${escapeHtml(lead.company_name)}</div>
          <div class="meta-muted">${escapeHtml(lead.location || lead.wilayah || "-")} • ${escapeHtml(lead.industry || lead.segment || "")}</div>
        </div>
        <span class="batch-tag">${escapeHtml(badgeText)}</span>
      </div>
      <div class="meta-line">
        ${lead.contact_person ? `👤 <strong>${escapeHtml(lead.contact_person)}</strong> ${lead.job_title ? `(${escapeHtml(lead.job_title)})` : ""}<br>` : ""}
        ${hasWa ? `📱 WA: <strong>+${escapeHtml(waNum)}</strong>` : (lead.phone_number ? `☎️ Telp Kantor: ${escapeHtml(lead.phone_number)}` : "📱 WA: -")}
        ${lead.email ? `<br>✉️ ${escapeHtml(lead.email)}` : ""}
      </div>
      ${lead.warning_note ? `<div class="warning-box">⚠️ ${escapeHtml(lead.warning_note)}</div>` : ""}
      ${lead.follow_up_notes ? `<div class="notes-box">${escapeHtml(lead.follow_up_notes)}</div>` : ""}
      <div class="card-actions">
        ${hasWa ? `<button class="btn btn-wa btn-sm btn-open-wa">💬 Buka WA</button>` : ""}
        ${lead.email ? `<a class="btn btn-email btn-sm" href="mailto:${escapeHtml(lead.email)}?subject=${encodeURIComponent("Penawaran AP Boots - HOTS Trading")}" target="_blank">✉️ Email</a>` : ""}
        ${lead.linkedin_url ? `<a class="btn btn-secondary btn-sm" href="${escapeHtml(lead.linkedin_url)}" target="_blank">💼 LinkedIn</a>` : ""}
        <select class="status-select">
          ${statusOpts.map((st) => `<option value="${st}" ${st === statusVal ? "selected" : ""}>${st}</option>`).join("")}
        </select>
      </div>
    `;

    // 1-Klik Buka WhatsApp
    const btnWa = card.querySelector(".btn-open-wa");
    if (btnWa) {
      btnWa.addEventListener("click", async () => {
        const tplKey = document.getElementById("activeTemplate").value || "T1";
        const msg = (TEMPLATES[tplKey] || TEMPLATES.T1)(lead);
        const waUrl = `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`;
        window.open(waUrl, "_blank");

        if ((lead.outreach_status || "Belum Dihubungi") === "Belum Dihubungi") {
          lead.outreach_status = "Terkirim";
          lead.last_contacted_at = new Date().toISOString();
          await chrome.storage.local.set({ hots_leads: allLeads });
          updateKPIs();
          card.querySelector(".status-select").value = "Terkirim";
        }
      });
    }

    // Status update
    const sel = card.querySelector(".status-select");
    sel.addEventListener("change", async (e) => {
      lead.outreach_status = e.target.value;
      lead.last_contacted_at = new Date().toISOString();
      await chrome.storage.local.set({ hots_leads: allLeads });
      updateKPIs();
      showToast(`Status ${lead.company_name} -> ${lead.outreach_status}`);
    });

    container.appendChild(card);
  });
}

// --- CSV Export & Import ---
function exportCsv() {
  const cols = [
    "batch_day", "company_name", "segment", "industry", "contact_person", "job_title",
    "phone_wa", "phone_number", "email", "location", "wilayah", "products",
    "website", "linkedin_url", "outreach_status", "follow_up_notes", "warning_note", "source_url"
  ];
  const rows = filteredLeads.map((l) =>
    cols.map((c) => `"${String(l[c] || "").replace(/"/g, '""')}"`).join(",")
  );
  const csv = "\uFEFF" + [cols.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hots_crm_leads_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Berhasil export ${filteredLeads.length} leads ke CSV!`);
}

function parseCsvLine(line) {
  const res = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      res.push(cur); cur = "";
    } else {
      cur += ch;
    }
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
      segment: obj.segment || "Segmen A: Reseller & Toko K3",
      industry: obj.industry || obj.tipe || "",
      contact_person: obj.contact_person || "",
      job_title: obj.job_title || "",
      phone_wa: wa,
      is_wa_valid: wa ? 1 : 0,
      phone_number: rawPhone,
      email: obj.email || "",
      location: obj.location || obj.kota || "",
      wilayah: obj.wilayah || obj.kota || "",
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
  applyFilters();
  showToast(`Import CSV selesai: +${added} leads baru masuk!`);
}

// --- Google Sheet Sync ---
async function syncToGoogleSheet() {
  if (!settings.webhookUrl) {
    showToast("Isi Google Apps Script Webhook URL di Pengaturan (⚙️) dulu!", true);
    document.getElementById("modalSettings").classList.remove("hidden");
    return;
  }
  const toSend = filteredLeads.slice(0, 150);
  document.getElementById("syncStatusText").textContent = `⏳ Mengirim ${toSend.length} leads ke Google Sheet...`;
  try {
    await fetch(settings.webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert_leads", leads: toSend })
    });
    document.getElementById("syncStatusText").textContent = `✅ ${toSend.length} leads terkirim ke Google Sheet!`;
    showToast(`Sync ${toSend.length} leads ke Google Sheet selesai!`);
  } catch (e) {
    document.getElementById("syncStatusText").textContent = `❌ Gagal sync: ${e.message}`;
    showToast("Gagal sync ke Google Sheet", true);
  }
}

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
  initData();

  // Live update jika Chrome Extension Popup menambah lead baru!
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.hots_leads && Array.isArray(changes.hots_leads.newValue)) {
      allLeads = changes.hots_leads.newValue;
      applyFilters();
    }
  });

  // Batch Pills
  document.querySelectorAll("#batchPills .filter-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#batchPills .filter-pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterState.batch = btn.dataset.batch || "";
      applyFilters();
    });
  });

  document.getElementById("searchInput").addEventListener("input", (e) => {
    filterState.search = e.target.value.trim();
    applyFilters();
  });
  document.getElementById("filterSegment").addEventListener("change", (e) => {
    filterState.segment = e.target.value;
    applyFilters();
  });
  document.getElementById("filterStatus").addEventListener("change", (e) => {
    filterState.status = e.target.value;
    applyFilters();
  });
  document.getElementById("chkWaOnly").addEventListener("change", (e) => {
    filterState.waOnly = e.target.checked;
    applyFilters();
  });

  document.getElementById("btnPrev").addEventListener("click", () => {
    if (filterState.page > 1) { filterState.page--; renderLeads(); window.scrollTo(0, 0); }
  });
  document.getElementById("btnNext").addEventListener("click", () => {
    filterState.page++; renderLeads(); window.scrollTo(0, 0);
  });

  // Profile Badge -> buka modal pengaturan akun & Google Sheet
  const elProfileBadge = document.getElementById("profileBadge");
  if (elProfileBadge) {
    elProfileBadge.addEventListener("click", () => {
      document.getElementById("modalSettings").classList.remove("hidden");
    });
  }

  document.getElementById("btnUseDetectedAccount").addEventListener("click", () => {
    if (!detectedEmail) {
      showToast("Email Chrome tidak terdeteksi. Ketik manual email/index akunmu.", true);
      return;
    }
    document.getElementById("setAuthUser").value = detectedEmail;
    showToast(`Akun diisi: ${detectedEmail}`);
  });

  // 1-Klik Copy Kode Apps Script (.gs)
  document.getElementById("btnCopyGsScript").addEventListener("click", async () => {
    try {
      const resp = await fetch(chrome.runtime.getURL("apps_script_template.gs"));
      const code = await resp.text();
      await navigator.clipboard.writeText(code);
      showToast("📋 Kode Apps Script (.gs) tersalin! Tinggal Paste di Extensions > Apps Script.");
    } catch (e) {
      showToast("Gagal menyalin kode .gs: " + e.message, true);
    }
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

  // Modal Settings
  document.getElementById("btnOpenSettings").addEventListener("click", () => {
    document.getElementById("modalSettings").classList.remove("hidden");
  });
  document.getElementById("btnCloseSettings").addEventListener("click", () => {
    document.getElementById("modalSettings").classList.add("hidden");
  });
  document.getElementById("btnSaveSettings").addEventListener("click", async () => {
    settings = {
      gsheetUrl: document.getElementById("setGSheetUrl").value.trim(),
      authUser: document.getElementById("setAuthUser").value.trim() || detectedEmail || "0",
      webhookUrl: document.getElementById("setWebhookUrl").value.trim()
    };
    await chrome.storage.local.set(settings);
    updateProfileBadge();
    document.getElementById("modalSettings").classList.add("hidden");
    showToast("Pengaturan Google Sheet & Akun tersimpan!");
  });

  document.getElementById("btnResetSeed").addEventListener("click", async () => {
    if (!confirm("Muat ulang 277 data awal dari leads.db? Perubahan status lokal akan diganti.")) return;
    allLeads = await loadSeedData();
    applyFilters();
    document.getElementById("modalSettings").classList.add("hidden");
    showToast("Data CRM berhasil di-reset ke 277 leads awal!");
  });
});
