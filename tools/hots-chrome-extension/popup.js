const DEFAULT_SETTINGS = {
  dashboardUrl: "http://localhost:5000",
  gsheetUrl: "",
  authUser: "0",
  webhookUrl: ""
};

let currentSettings = { ...DEFAULT_SETTINGS };
let scrapedLeads = [];
let activeTabInfo = { id: null, url: "", title: "", siteType: "web" };

// --- Helpers ---
function detectSiteType(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("google.com/maps") || u.includes("maps.google.")) return "maps";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("tokopedia.com") || u.includes("shopee.") || u.includes("lazada.")) return "market";
  return "web";
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
    let digits = m.replace(/\D/g, "");
    if (digits.startsWith("08")) digits = "62" + digits.slice(1);
    else if (digits.startsWith("8")) digits = "62" + digits;
    if (digits.startsWith("628") && digits.length >= 10 && digits.length <= 15) {
      return digits;
    }
  }
  return "";
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg;
  el.style.borderLeftColor = isError ? "#f87171" : "#38bdf8";
}

// --- Settings Storage ---
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(DEFAULT_SETTINGS, (items) => {
      currentSettings = { ...DEFAULT_SETTINGS, ...items };
      document.getElementById("quickAuthUser").value = currentSettings.authUser || "0";
      document.getElementById("setDashboardUrl").value = currentSettings.dashboardUrl || "http://localhost:5000";
      document.getElementById("setGSheetUrl").value = currentSettings.gsheetUrl || "";
      document.getElementById("setAuthUser").value = currentSettings.authUser || "0";
      document.getElementById("setWebhookUrl").value = currentSettings.webhookUrl || "";
      resolve(currentSettings);
    });
  });
}

async function saveSettings(newSettings) {
  currentSettings = { ...currentSettings, ...newSettings };
  return new Promise((resolve) => {
    chrome.storage.local.set(currentSettings, () => resolve(currentSettings));
  });
}

// --- Injected Page Extractor (Runs inside Active Tab) ---
function pageMultiSiteExtractor() {
  const url = window.location.href;
  const title = document.title || "";
  const host = window.location.hostname.toLowerCase();
  const leads = [];

  const cleanText = (s) => (s || "").replace(/\s+/g, " ").trim();

  // 1. GOOGLE MAPS ADAPTER
  if (host.includes("google.") && url.includes("/maps")) {
    // Cek panel detail tempat yang sedang dibuka
    const placeTitle = document.querySelector("h1.DUwDvf, h1.fontHeadlineLarge");
    if (placeTitle && cleanText(placeTitle.innerText)) {
      const name = cleanText(placeTitle.innerText);
      const category = cleanText(document.querySelector('button[jsaction*="category"]')?.innerText || "");
      const address = cleanText(document.querySelector('button[data-item-id="address"]')?.innerText || "");
      const phone = cleanText(document.querySelector('button[data-item-id^="phone:"]')?.innerText || "");
      const website = document.querySelector('a[data-item-id="authority"]')?.href || "";
      leads.push({
        company_name: name,
        products: category || "Google Maps Business",
        address: address,
        phone_number: phone,
        website: website,
        source_url: url,
        industry: category || "Safety & Alat K3"
      });
    }

    // Cek daftar hasil pencarian di sidebar kiri (feed)
    const cards = document.querySelectorAll('div[role="feed"] > div, a.hfpxzc');
    const seen = new Set(leads.map((l) => l.company_name.toLowerCase()));
    document.querySelectorAll('a.hfpxzc').forEach((linkEl) => {
      const name = cleanText(linkEl.getAttribute("aria-label") || "");
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      const container = linkEl.closest('div[jsaction]') || linkEl.parentElement;
      const blockText = cleanText(container?.innerText || "");
      const phoneMatch = blockText.match(/(?:(?:\+?62|0)[2-9][0-9\-\s]{7,14})/);
      leads.push({
        company_name: name,
        phone_number: phoneMatch ? phoneMatch[0].trim() : "",
        address: blockText.slice(0, 140),
        source_url: linkEl.href || url,
        products: "Google Maps List"
      });
    });

    return { siteType: "maps", url, title, leads };
  }

  // 2. LINKEDIN ADAPTER (PIC Procurement / Purchasing / HSE)
  if (host.includes("linkedin.com")) {
    // Halaman Profil Individu (/in/...)
    if (url.includes("/in/")) {
      const personName = cleanText(document.querySelector("h1")?.innerText || "");
      const headline = cleanText(document.querySelector(".text-body-medium.break-words")?.innerText || "");
      const location = cleanText(document.querySelector(".text-body-small.inline.t-black--light.break-words")?.innerText || "");
      let company = "";
      const expEl = document.querySelector('div[aria-label*="Current company"], button[aria-label*="Current company"]');
      if (expEl) company = cleanText(expEl.innerText);
      if (!company && headline.includes(" at ")) company = headline.split(" at ").slice(1).join(" at ").trim();
      if (!company && headline.includes(" di ")) company = headline.split(" di ").slice(1).join(" di ").trim();

      if (personName) {
        leads.push({
          company_name: company || personName,
          contact_person: personName,
          job_title: headline,
          location: location,
          linkedin_url: url.split("?")[0],
          source_url: url,
          segment: "Segmen A: Partner Portal & BUMN",
          industry: "BUMN / Korporat / RS"
        });
      }
    } else {
      // Halaman Pencarian People di LinkedIn
      const items = document.querySelectorAll("li.reusable-search__result-container, div.entity-result");
      const seen = new Set();
      items.forEach((item) => {
        const link = item.querySelector('a[href*="/in/"]');
        if (!link) return;
        const name = cleanText(link.innerText.split("\n")[0]);
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        const job = cleanText(item.querySelector(".entity-result__primary-subtitle")?.innerText || "");
        const loc = cleanText(item.querySelector(".entity-result__secondary-subtitle")?.innerText || "");
        let comp = "";
        if (job.includes(" at ")) comp = job.split(" at ").slice(1).join(" at ").trim();
        else if (job.includes(" di ")) comp = job.split(" di ").slice(1).join(" di ").trim();

        leads.push({
          company_name: comp || name,
          contact_person: name,
          job_title: job,
          location: loc,
          linkedin_url: link.href.split("?")[0],
          source_url: url,
          segment: "Segmen A: Partner Portal & BUMN",
          industry: "BUMN / Korporat / RS"
        });
      });
    }
    return { siteType: "linkedin", url, title, leads };
  }

  // 3. MARKETPLACE ADAPTER (Tokopedia / Shopee / Lazada)
  if (host.includes("tokopedia.com") || host.includes("shopee.") || host.includes("lazada.")) {
    const seen = new Set();
    const links = document.querySelectorAll('a[href]');
    links.forEach((a) => {
      const txt = cleanText(a.innerText);
      if (txt.length < 15 || txt.length > 220) return;
      const priceMatch = txt.match(/(?:Rp|฿|₫|RM|PHP|₱)\s?[\d.,]+/i);
      if (!priceMatch) return;
      const name = txt.split(priceMatch[0])[0].trim().slice(0, 80) || "Produk Marketplace";
      const key = (name + priceMatch[0]).toLowerCase();
      if (seen.has(key) || leads.length >= 25) return;
      seen.add(key);
      leads.push({
        company_name: name,
        products: `${name} | Harga: ${priceMatch[0]}`,
        website: a.href,
        source_url: url,
        segment: "Riset Pasar SEA",
        industry: host
      });
    });
    return { siteType: "market", url, title, leads };
  }

  // 4. UNIVERSAL WEB RECOGNIZER (Website Perusahaan / Direktori B2B / e-Proc)
  const bodyText = (document.body?.innerText || "").slice(0, 12000);
  const emails = Array.from(new Set(bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []))
    .filter((e) => !/example\.com|sentry|wixpress|\.png|\.jpg/i.test(e));

  const waLinks = Array.from(document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"]'))
    .map((a) => a.href);
  let phone = "";
  if (waLinks.length > 0) {
    const m = waLinks[0].match(/(\d{10,15})/);
    if (m) phone = m[1];
  }
  if (!phone) {
    const mMobile = bodyText.match(/(?:(?:\+?62)|0)8[1-9][0-9\-\.\s]{6,14}/);
    const mOffice = bodyText.match(/(?:\+62|0)[2-7][0-9]{1,2}[\-\s]?\d{3,4}[\-\s]?\d{3,4}/);
    phone = mMobile ? mMobile[0].trim() : (mOffice ? mOffice[0].trim() : "");
  }

  leads.push({
    company_name: title.split("|")[0].split("-")[0].trim() || host,
    phone_number: phone,
    email: emails[0] || "",
    website: url,
    source_url: url,
    products: "Website Perusahaan (Auto-Detect)"
  });

  return { siteType: "web", url, title, leads, rawText: bodyText };
}

// --- Render Results ---
function renderResults() {
  const wrapper = document.getElementById("resultsWrapper");
  const list = document.getElementById("resultsList");
  const countEl = document.getElementById("resultCount");

  if (!scrapedLeads.length) {
    wrapper.classList.add("hidden");
    return;
  }

  wrapper.classList.remove("hidden");
  countEl.textContent = `${scrapedLeads.length} lead bersih siap simpan`;
  list.innerHTML = "";

  scrapedLeads.forEach((lead) => {
    const wa = extractMobileWA(lead.phone_number);
    const card = document.createElement("div");
    card.className = "lead-card";

    let pills = "";
    if (wa) {
      pills += `<span class="pill pill-wa">WA Valid: +${wa}</span>`;
    } else if (lead.phone_number) {
      pills += `<span class="pill pill-office">Telp Kantor (Bukan WA): ${lead.phone_number}</span>`;
    }
    if (lead.email) pills += `<span class="pill pill-email">${lead.email}</span>`;
    if (lead.contact_person) pills += `<span class="pill pill-pic">PIC: ${lead.contact_person}</span>`;

    card.innerHTML = `
      <div class="lead-title">${lead.company_name || "(Tanpa Nama)"}</div>
      <div class="lead-meta">${lead.job_title || lead.products || lead.address || lead.website || ""}</div>
      <div class="pill-row">${pills}</div>
    `;
    list.appendChild(card);
  });
}

// --- Main Init ---
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();

  // Detect active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    activeTabInfo = {
      id: tab.id,
      url: tab.url || "",
      title: tab.title || "",
      siteType: detectSiteType(tab.url || "")
    };
    const badge = document.getElementById("siteBadge");
    const labels = {
      maps: ["📍 Google Maps", "badge-maps"],
      linkedin: ["💼 LinkedIn PIC", "badge-linkedin"],
      market: ["🛒 Marketplace", "badge-market"],
      web: ["🌐 Website Umum", "badge-web"]
    };
    const [text, cls] = labels[activeTabInfo.siteType];
    badge.textContent = text;
    badge.className = `badge ${cls}`;
  }

  // Tab switching
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Quick AuthUser input auto-save
  document.getElementById("quickAuthUser").addEventListener("change", async (e) => {
    const val = e.target.value.trim();
    document.getElementById("setAuthUser").value = val;
    await saveSettings({ authUser: val });
  });

  // Quick Launch: Open Standalone Dashboard inside Chrome Tab (No Python needed)
  document.getElementById("btnOpenDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });

  // Quick Launch: Open Dashboard in Chrome Side Panel (beside WhatsApp Web / LinkedIn / Maps)
  document.getElementById("btnOpenSidePanel").addEventListener("click", async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      } else {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      }
    } catch (e) {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    }
  });

  // Quick Launch: Open Google Sheet with Selected Google/AI Account
  document.getElementById("btnOpenGSheet").addEventListener("click", async () => {
    const authUser = document.getElementById("quickAuthUser").value.trim();
    await saveSettings({ authUser });
    if (!currentSettings.gsheetUrl) {
      setStatus("URL Google Sheet belum diisi! Buka tab Pengaturan dulu.", true);
      document.querySelector('[data-tab="settings"]').click();
      return;
    }
    const targetUrl = buildAuthUserUrl(currentSettings.gsheetUrl, authUser);
    chrome.tabs.create({ url: targetUrl });
  });

  // Scan Page (DOM Multi-Site)
  document.getElementById("btnScanPage").addEventListener("click", async () => {
    if (!activeTabInfo.id) return;
    setStatus("⏳ Memindai halaman aktif...");
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: activeTabInfo.id },
        func: pageMultiSiteExtractor
      });
      const seg = document.getElementById("targetSegment").value;
      scrapedLeads = (result?.leads || []).map((l) => ({
        ...l,
        segment: l.segment || seg,
        batch_day: "Extension Scrape"
      }));
      renderResults();
      if (scrapedLeads.length) {
        setStatus(`✅ Berhasil ekstrak ${scrapedLeads.length} data dari ${result.siteType.toUpperCase()}!`);
      } else {
        setStatus("Tidak ada entitas terdeteksi di DOM. Coba klik '✨ AI Smart Scan'!", true);
      }
    } catch (e) {
      setStatus(`❌ Gagal scan halaman ini: ${e.message}`, true);
    }
  });

  // AI Smart Scan (Backend Gemini Universal Web Recognizer)
  document.getElementById("btnAiScan").addEventListener("click", async () => {
    if (!activeTabInfo.id) return;
    setStatus("✨ Mengirim teks halaman ke AI Smart Recognizer (CRM lokal)...");
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: activeTabInfo.id },
        func: () => ({
          url: window.location.href,
          title: document.title,
          text: (document.body?.innerText || "").slice(0, 12000)
        })
      });
      const base = (currentSettings.dashboardUrl || "http://localhost:5000").replace(/\/$/, "");
      const resp = await fetch(`${base}/api/extension/smart-extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "CRM lokal tidak merespons");
      const seg = document.getElementById("targetSegment").value;
      scrapedLeads = (data.leads || []).map((l) => ({
        ...l,
        segment: l.segment || seg,
        batch_day: "Extension Scrape"
      }));
      renderResults();
      setStatus(`✨ AI Smart Scan selesai: ${scrapedLeads.length} lead ditemukan!`);
    } catch (e) {
      setStatus(`❌ AI Scan gagal (pastikan start_crm.bat aktif): ${e.message}`, true);
    }
  });

  // Clear Results
  document.getElementById("btnClearResults").addEventListener("click", () => {
    scrapedLeads = [];
    renderResults();
    setStatus("Hasil dibersihkan.");
  });

  // Push to Standalone Chrome CRM Storage + Google Sheet Webhook (+ optional local Python CRM)
  document.getElementById("btnPushAll").addEventListener("click", async () => {
    if (!scrapedLeads.length) return;
    setStatus("🚀 Menyimpan ke Chrome CRM & Google Sheet...");

    // 1. Load existing leads in chrome.storage.local (or seed from bundled seed_leads.json)
    const stored = await chrome.storage.local.get(["hots_leads"]);
    let existing = Array.isArray(stored.hots_leads) ? stored.hots_leads : [];
    if (existing.length === 0) {
      try {
        const seedResp = await fetch(chrome.runtime.getURL("seed_leads.json"));
        existing = await seedResp.json();
      } catch {}
    }

    const byName = new Map(existing.map((l) => [String(l.company_name || "").toLowerCase(), l]));
    const byWa = new Map(existing.filter((l) => l.phone_wa).map((l) => [String(l.phone_wa), l.company_name]));

    let inserted = 0;
    let updated = 0;
    const cleanedPayload = [];

    for (const raw of scrapedLeads) {
      const comp = String(raw.company_name || "").trim();
      if (!comp) continue;
      const wa = extractMobileWA(raw.phone_number);
      const key = comp.toLowerCase();
      let warn = raw.warning_note || "";
      if (wa && byWa.has(wa) && byWa.get(wa).toLowerCase() !== key) {
        warn = `${warn} | Nomor WA sama dengan ${byWa.get(wa)}`.trim().replace(/^\|/, "").trim();
      }

      const rec = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        batch_day: raw.batch_day || "Extension Scrape",
        company_name: comp,
        segment: raw.segment || "Segmen A: Reseller & Toko K3",
        industry: raw.industry || "Safety & Alat K3",
        contact_person: raw.contact_person || "",
        job_title: raw.job_title || "",
        phone_wa: wa,
        is_wa_valid: wa ? 1 : 0,
        phone_number: raw.phone_number || "",
        email: raw.email || "",
        location: raw.location || "",
        wilayah: raw.location || "Lainnya",
        address: raw.address || "",
        products: raw.products || "",
        website: raw.website || "",
        linkedin_url: raw.linkedin_url || "",
        outreach_status: "Belum Dihubungi",
        follow_up_notes: raw.follow_up_notes || "",
        warning_note: warn,
        source_url: raw.source_url || ""
      };

      if (byName.has(key)) {
        const old = byName.get(key);
        if (!old.phone_wa && rec.phone_wa) { old.phone_wa = rec.phone_wa; old.is_wa_valid = 1; }
        if (!old.email && rec.email) old.email = rec.email;
        if (!old.contact_person && rec.contact_person) old.contact_person = rec.contact_person;
        if (!old.job_title && rec.job_title) old.job_title = rec.job_title;
        if (!old.linkedin_url && rec.linkedin_url) old.linkedin_url = rec.linkedin_url;
        if (rec.warning_note) old.warning_note = rec.warning_note;
        updated++;
      } else {
        existing.unshift(rec);
        byName.set(key, rec);
        if (wa) byWa.set(wa, comp);
        inserted++;
      }
      cleanedPayload.push(rec);
    }

    await chrome.storage.local.set({ hots_leads: existing });

    // 2. Push ke Google Sheet Webhook jika terkonfigurasi
    let gsheetMsg = "belum diset";
    if (currentSettings.webhookUrl) {
      try {
        await fetch(currentSettings.webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upsert_leads", leads: cleanedPayload })
        });
        gsheetMsg = "terkirim!";
      } catch (e) {
        gsheetMsg = "gagal";
      }
    }

    // 3. Optional background mirror ke CRM Python jika sedang nyala (silent fail)
    try {
      const base = (currentSettings.dashboardUrl || "http://localhost:5000").replace(/\/$/, "");
      fetch(`${base}/api/extension/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: cleanedPayload, push_gsheet: false })
      }).catch(() => {});
    } catch {}

    setStatus(`✅ Chrome CRM: +${inserted} baru, ${updated} update | GSheet: ${gsheetMsg}`);
  });

  // Download Clean CSV
  document.getElementById("btnDownloadCsv").addEventListener("click", () => {
    if (!scrapedLeads.length) return;
    const headers = ["company_name", "contact_person", "job_title", "phone_wa", "phone_office", "email", "location", "address", "products", "website", "linkedin_url", "segment", "source_url"];
    const rows = scrapedLeads.map((l) => {
      const wa = extractMobileWA(l.phone_number);
      const office = wa ? "" : (l.phone_number || "");
      const obj = { ...l, phone_wa: wa, phone_office: office };
      return headers.map((h) => `"${String(obj[h] || "").replace(/"/g, '""')}"`).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hots_leads_clean_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Save Settings
  document.getElementById("btnSaveSettings").addEventListener("click", async () => {
    const newSet = {
      dashboardUrl: document.getElementById("setDashboardUrl").value.trim() || "http://localhost:5000",
      gsheetUrl: document.getElementById("setGSheetUrl").value.trim(),
      authUser: document.getElementById("setAuthUser").value.trim() || "0",
      webhookUrl: document.getElementById("setWebhookUrl").value.trim()
    };
    await saveSettings(newSet);
    document.getElementById("quickAuthUser").value = newSet.authUser;

    // Also push settings to local CRM if online
    try {
      const base = newSet.dashboardUrl.replace(/\/$/, "");
      await fetch(`${base}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gsheet_url: newSet.gsheetUrl,
          gsheet_authuser: newSet.authUser,
          gsheet_webhook_url: newSet.webhookUrl
        })
      });
      document.getElementById("settingsStatus").textContent = "✅ Pengaturan tersimpan di Extension & tersinkron ke CRM!";
    } catch {
      document.getElementById("settingsStatus").textContent = "✅ Tersimpan di Extension (CRM lokal sedang offline).";
    }
  });

  // Pull Settings from CRM
  document.getElementById("btnPullDashboardSettings").addEventListener("click", async () => {
    const base = (document.getElementById("setDashboardUrl").value.trim() || "http://localhost:5000").replace(/\/$/, "");
    try {
      const resp = await fetch(`${base}/api/settings`);
      const s = await resp.json();
      await saveSettings({
        gsheetUrl: s.gsheet_url || currentSettings.gsheetUrl,
        authUser: s.gsheet_authuser || currentSettings.authUser,
        webhookUrl: s.gsheet_webhook_url || currentSettings.webhookUrl
      });
      await loadSettings();
      document.getElementById("settingsStatus").textContent = "✅ Settings berhasil ditarik dari Dashboard CRM!";
    } catch (e) {
      document.getElementById("settingsStatus").textContent = `❌ Gagal konek ke CRM (${base}): ${e.message}`;
    }
  });
});
