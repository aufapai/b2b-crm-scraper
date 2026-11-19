const DEFAULT_PROFILE = {
  companyBrand: "HOTS Trading",
  senderName: "Aufa",
  industryId: "safety_apd",
  regions: "Jakarta, Surabaya, Balikpapan, Bangkok, HCMC",
  segments: [
    "Segmen A: Reseller & Toko K3",
    "Segmen A: Partner Portal & BUMN",
    "Segmen A: Buyer Korporat",
    "Segmen B: Manufaktur Sepatu",
    "Riset Pasar SEA"
  ]
};

let settings = { gsheetUrl: "", authUser: "", webhookUrl: "" };
let profile = { ...DEFAULT_PROFILE };
let detectedEmail = "";
let scrapedLeads = [];
let activeTabInfo = { id: null, url: "", title: "", siteType: "web" };

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
    if (authUser && authUser.trim() !== "") u.searchParams.set("authuser", authUser.trim());
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

function setStatus(msg, isError = false) {
  const el = document.getElementById("statusMsg");
  el.textContent = msg;
  el.style.borderLeftColor = isError ? "#dc2626" : "#0f2942";
}

function detectChromeAccount() {
  return new Promise((resolve) => {
    if (chrome.identity && chrome.identity.getProfileUserInfo) {
      chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }, (info) => {
        detectedEmail = (info && info.email) ? info.email : "";
        resolve(detectedEmail);
      });
    } else {
      resolve("");
    }
  });
}

function populateSegments() {
  const sel = document.getElementById("targetSegment");
  const segs = Array.isArray(profile.segments) && profile.segments.length ? profile.segments : DEFAULT_PROFILE.segments;
  sel.innerHTML = segs.map((s) => `<option value="${s.replace(/"/g, "&quot;")}">${s}</option>`).join("");
}

function populateIndustries() {
  const sel = document.getElementById("kwIndustry");
  const list = (window.B2B_DATABASE && window.B2B_DATABASE.industries) || [];
  sel.innerHTML = list.map((i) => `<option value="${i.id}">${i.label}</option>`).join("");
  sel.value = profile.industryId || "safety_apd";
  document.getElementById("kwRegion").value = profile.regions || "Jakarta, Surabaya";
}

function renderKeywords() {
  if (!window.B2B_DATABASE) return;
  const indId = document.getElementById("kwIndustry").value;
  const regions = document.getElementById("kwRegion").value;
  const topic = document.getElementById("kwCustomTopic").value;
  const rec = window.B2B_DATABASE.generateRecommendations(indId, regions, topic);
  const box = document.getElementById("keywordResults");
  box.innerHTML = "";

  const addGroup = (title, items, btnLabel) => {
    const h = document.createElement("div");
    h.className = "kw-group-title";
    h.textContent = title;
    box.appendChild(h);

    items.forEach((it) => {
      const card = document.createElement("div");
      card.className = "kw-card";
      card.innerHTML = `<span class="kw-text">${it.query}</span><button class="kw-go">${btnLabel}</button>`;
      card.querySelector(".kw-go").addEventListener("click", () => {
        chrome.tabs.create({ url: it.url });
      });
      box.appendChild(card);
    });
  };

  addGroup("Google Maps (Siap Auto-Scroll)", rec.maps, "Buka Maps");
  addGroup("LinkedIn (Cari PIC Procurement / HSE)", rec.linkedin, "Buka LinkedIn");
}

// =========================================================================
// INJECTED ENGINE 1: DEEP ONLINE MULTI-SITE SCRAPER (100% IN-BROWSER)
// =========================================================================
async function deepOnlineExtractor(crawlContactSubpage = false) {
  const url = window.location.href;
  const title = document.title || "";
  const host = window.location.hostname.toLowerCase();
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();

  // Helper: extract contacts & address from an HTML Document or text block
  function extractContactsFromDoc(doc, pageUrl) {
    const emails = new Set();
    const phones = new Set();
    const addresses = new Set();

    // 1. JSON-LD Organization / LocalBusiness schema
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((sc) => {
      try {
        const parsed = JSON.parse(sc.textContent || "{}");
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        arr.forEach((obj) => {
          if (obj.email) emails.add(String(obj.email).replace(/^mailto:/i, "").trim());
          if (obj.telephone) phones.add(String(obj.telephone).trim());
          if (obj.address) {
            if (typeof obj.address === "string") addresses.add(clean(obj.address));
            else if (typeof obj.address === "object") {
              const parts = [obj.address.streetAddress, obj.address.addressLocality, obj.address.addressRegion, obj.address.addressCountry].filter(Boolean);
              if (parts.length) addresses.add(clean(parts.join(", ")));
            }
          }
        });
      } catch {}
    });

    // 2. Explicit mailto:, tel:, wa.me links anywhere on page
    doc.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const e = a.getAttribute("href").replace(/^mailto:/i, "").split("?")[0].trim();
      if (e && e.includes("@")) emails.add(e);
    });
    doc.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      const t = a.getAttribute("href").replace(/^tel:/i, "").trim();
      if (t && t.replace(/\D/g, "").length >= 7) phones.add(t);
    });
    doc.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp.com"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(/(\d{10,15})/);
      if (m) phones.add("+" + m[1]);
    });

    // 3. Prioritize Footer, Contact sections, <address>, and full body text (NO 12k truncation!)
    const priorityEls = doc.querySelectorAll('footer, [id*="footer" i], [class*="footer" i], [id*="contact" i], [class*="contact" i], address');
    let priorityText = "";
    priorityEls.forEach((el) => {
      const t = el.innerText || el.textContent || "";
      if (t.length < 15000) priorityText += "\n" + t;
    });

    const fullText = doc.body ? (doc.body.innerText || doc.body.textContent || "") : "";
    // Combine priority sections + top + bottom of page so footer is NEVER cut off
    const combinedText = priorityText + "\n" + fullText.slice(0, 15000) + "\n" + fullText.slice(-15000);

    // Email regex
    const mailMatches = combinedText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    mailMatches.forEach((e) => {
      if (!/example\.com|sentry|wixpress|\.png|\.jpg|\.jpeg|\.webp|\.svg|noreply/i.test(e)) {
        emails.add(e.trim());
      }
    });

    // Phone regex: Indonesia (+62 / 08 / 021) AND ASEAN / International ((+84) 28 3620 5151, +66, +65, +60, +63, etc.)
    const phonePatterns = [
      /\(\+\d{1,3}\)[\s\-\.]?\d{1,4}[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g,
      /\+\d{1,3}[\s\-\.]?\(?\d{1,4}\)?[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g,
      /(?:(?:\+?62)|0)8[1-9][0-9\-\.\s]{6,14}/g,
      /(?:\(0\d{2,3}\)|0[2-7]\d{1,2})[\s\-\.]?\d{3,4}[\s\-\.]?\d{3,4}/g
    ];
    phonePatterns.forEach((rx) => {
      const ms = combinedText.match(rx) || [];
      ms.forEach((m) => {
        const digits = m.replace(/\D/g, "");
        if (digits.length >= 8 && digits.length <= 15) phones.add(clean(m));
      });
    });

    // Address extraction (lines containing Jl., Jalan, Ward, District, Street, Suite, Industrial, HCMC, Ha Noi, Bangkok, Jakarta, etc.)
    const addrRx = /(?:jl\.|jalan|komp\.|komplek|kaw\.|kawasan industri|gedung|menara|ruko|ward|district|hcmc|ho chi minh|ha noi|hanoi|vietnam|bangkok|thailand|singapore|malaysia|selangor|kuala lumpur|street|road|ave\.|avenue|no\.\s*\d+|floor|lt\.\s*\d+)/i;
    const lines = (priorityText || fullText.slice(-8000)).split(/\r?\n/).map(clean).filter((l) => l.length >= 15 && l.length <= 180);
    for (const ln of lines) {
      if (addrRx.test(ln) && !ln.includes("@") && !/^http/i.test(ln) && !/copyright|all rights reserved|sitemap/i.test(ln)) {
        addresses.add(ln);
        if (addresses.size >= 2) break;
      }
    }

    // Detect location/country
    let loc = "";
    const locPool = Array.from(addresses).join(" ") + " " + priorityText.slice(0, 2000);
    const knownLocs = ["Jakarta", "Bandung", "Surabaya", "Sidoarjo", "Tangerang", "Bekasi", "Cikarang", "Medan", "Semarang", "Balikpapan", "Makassar", "HCMC", "Ho Chi Minh", "Ha Noi", "Hanoi", "Vietnam", "Bangkok", "Thailand", "Singapore", "Malaysia", "Manila", "Philippines", "Cambodia", "Phnom Penh"];
    for (const kl of knownLocs) {
      if (new RegExp(`\\b${kl}\\b`, "i").test(locPool)) {
        loc = kl;
        break;
      }
    }

    // Pick best phone (prefer Indonesian mobile WA first, then international/office)
    const phoneList = Array.from(phones);
    const idMobile = phoneList.find((p) => /(?:(?:\+?62)|0)8[1-9]/.test(p));
    const bestPhone = idMobile || phoneList[0] || "";

    return {
      email: Array.from(emails)[0] || "",
      phone: bestPhone,
      allPhones: phoneList.slice(0, 3).join(" / "),
      address: Array.from(addresses).join(" | "),
      location: loc
    };
  }

  const leads = [];

  // 1. GOOGLE MAPS ADAPTER
  if (host.includes("google.") && url.includes("/maps")) {
    const placeTitle = document.querySelector("h1.DUwDvf, h1.fontHeadlineLarge");
    if (placeTitle && clean(placeTitle.innerText)) {
      const name = clean(placeTitle.innerText);
      const category = clean(document.querySelector('button[jsaction*="category"]')?.innerText || "");
      const address = clean(document.querySelector('button[data-item-id="address"]')?.innerText || "");
      const phone = clean(document.querySelector('button[data-item-id^="phone:"]')?.innerText || "");
      const website = document.querySelector('a[data-item-id="authority"]')?.href || "";
      leads.push({
        company_name: name,
        products: category || "Google Maps Business",
        address,
        location: address.split(",").slice(-2, -1)[0]?.trim() || "",
        phone_number: phone,
        website,
        source_url: url,
        industry: category || "B2B Lead"
      });
    }

    const seen = new Set(leads.map((l) => l.company_name.toLowerCase()));
    document.querySelectorAll("a.hfpxzc").forEach((linkEl) => {
      const name = clean(linkEl.getAttribute("aria-label") || "");
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      const card = linkEl.closest('div[jsaction]') || linkEl.parentElement;
      const lines = (card?.innerText || "").split("\n").map(clean).filter(Boolean);
      const blockText = lines.join(" · ");
      const phoneMatch = blockText.match(/(?:\(\+\d{1,3}\)|\+\d{1,3}|0)[0-9\-\s\(\)]{7,15}/);
      leads.push({
        company_name: name,
        phone_number: phoneMatch ? clean(phoneMatch[0]) : "",
        address: lines.slice(1, 4).join(" | ").slice(0, 160),
        source_url: linkEl.href || url,
        products: "Google Maps List"
      });
    });

    return { siteType: "maps", url, title, leads };
  }

  // 2. LINKEDIN ADAPTER
  if (host.includes("linkedin.com")) {
    if (url.includes("/in/")) {
      const personName = clean(document.querySelector("h1")?.innerText || "");
      const headline = clean(document.querySelector(".text-body-medium.break-words")?.innerText || "");
      const location = clean(document.querySelector(".text-body-small.inline.t-black--light.break-words")?.innerText || "");
      let company = "";
      if (headline.includes(" at ")) company = headline.split(" at ").slice(1).join(" at ").trim();
      else if (headline.includes(" di ")) company = headline.split(" di ").slice(1).join(" di ").trim();

      if (personName) {
        leads.push({
          company_name: company || personName,
          contact_person: personName,
          job_title: headline,
          location,
          linkedin_url: url.split("?")[0],
          source_url: url
        });
      }
    } else {
      const seen = new Set();
      document.querySelectorAll("li.reusable-search__result-container, div.entity-result").forEach((item) => {
        const link = item.querySelector('a[href*="/in/"]');
        if (!link) return;
        const name = clean(link.innerText.split("\n")[0]);
        if (!name || seen.has(name.toLowerCase())) return;
        seen.add(name.toLowerCase());
        const job = clean(item.querySelector(".entity-result__primary-subtitle")?.innerText || "");
        const loc = clean(item.querySelector(".entity-result__secondary-subtitle")?.innerText || "");
        let comp = "";
        if (job.includes(" at ")) comp = job.split(" at ").slice(1).join(" at ").trim();
        else if (job.includes(" di ")) comp = job.split(" di ").slice(1).join(" di ").trim();

        leads.push({
          company_name: comp || name,
          contact_person: name,
          job_title: job,
          location: loc,
          linkedin_url: link.href.split("?")[0],
          source_url: url
        });
      });
    }
    return { siteType: "linkedin", url, title, leads };
  }

  // 3. MARKETPLACE ADAPTER
  if (host.includes("tokopedia.com") || host.includes("shopee.") || host.includes("lazada.")) {
    const seen = new Set();
    document.querySelectorAll("a[href]").forEach((a) => {
      const txt = clean(a.innerText);
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
        industry: host
      });
    });
    return { siteType: "market", url, title, leads };
  }

  // 4. UNIVERSAL DEEP WEBSITE RECOGNIZER (Footer + JSON-LD + Intl Phone + Address + Auto /contact)
  let info = extractContactsFromDoc(document, url);

  // If requested OR missing email/phone, try fetching same-origin /contact page automatically!
  if (crawlContactSubpage || (!info.email && !info.phone)) {
    const contactLink = Array.from(document.querySelectorAll("a[href]")).find((a) => {
      const h = (a.getAttribute("href") || "").toLowerCase();
      const t = (a.innerText || "").toLowerCase();
      return (h.includes("contact") || h.includes("hubungi") || t.includes("contact") || t.includes("hubungi")) && !h.startsWith("mailto:") && !h.startsWith("tel:");
    });
    const candidates = [];
    if (contactLink && contactLink.href.startsWith(window.location.origin)) candidates.push(contactLink.href);
    candidates.push(`${window.location.origin}/contact`, `${window.location.origin}/contact-us`);

    for (const cUrl of Array.from(new Set(candidates))) {
      try {
        const resp = await fetch(cUrl, { credentials: "omit" });
        if (!resp.ok) continue;
        const html = await resp.text();
        const doc2 = new DOMParser().parseFromString(html, "text/html");
        const sub = extractContactsFromDoc(doc2, cUrl);
        if (!info.email && sub.email) info.email = sub.email;
        if (!info.phone && sub.phone) info.phone = sub.phone;
        if (!info.address && sub.address) info.address = sub.address;
        if (!info.location && sub.location) info.location = sub.location;
        if (info.email && info.phone) break;
      } catch {}
    }
  }

  const companyName =
    clean(document.querySelector('meta[property="og:site_name"]')?.content || "") ||
    clean(title.split("|")[0].split("-")[0].split("–")[0]) ||
    host;

  leads.push({
    company_name: companyName,
    phone_number: info.phone,
    email: info.email,
    address: info.address,
    location: info.location || "",
    website: window.location.origin,
    source_url: url,
    products: clean(document.querySelector('meta[name="description"]')?.content || "").slice(0, 140) || "Website Perusahaan"
  });

  return { siteType: "web", url, title, leads };
}

// =========================================================================
// INJECTED ENGINE 2: GOOGLE MAPS AUTO-SCROLL & BATCH SCRAPER
// =========================================================================
async function googleMapsAutoScroller(targetCount = 40) {
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const feed = document.querySelector('div[role="feed"]');
  if (!feed) {
    return { error: "Daftar hasil Google Maps belum terbuka. Lakukan pencarian di Google Maps terlebih dahulu." };
  }

  let stableRounds = 0;
  let lastCount = 0;
  const maxRounds = Math.min(35, Math.ceil(targetCount / 2) + 6);

  for (let i = 0; i < maxRounds; i++) {
    const cards = document.querySelectorAll("a.hfpxzc");
    if (cards.length >= targetCount) break;

    feed.scrollTop = feed.scrollHeight;
    await new Promise((r) => setTimeout(r, 900));

    const newCount = document.querySelectorAll("a.hfpxzc").length;
    if (newCount === lastCount) {
      stableRounds++;
      if (stableRounds >= 3) break; // reached end of list
    } else {
      stableRounds = 0;
      lastCount = newCount;
    }
  }

  const leads = [];
  const seen = new Set();
  document.querySelectorAll("a.hfpxzc").forEach((linkEl) => {
    if (leads.length >= targetCount) return;
    const name = clean(linkEl.getAttribute("aria-label") || "");
    if (!name || seen.has(name.toLowerCase())) return;
    seen.add(name.toLowerCase());

    const card = linkEl.closest('div[jsaction]') || linkEl.parentElement;
    const lines = (card?.innerText || "").split("\n").map(clean).filter(Boolean);
    const blockText = lines.join(" · ");
    const phoneMatch = blockText.match(/(?:\(\+\d{1,3}\)|\+\d{1,3}|0)[0-9\-\s\(\)]{7,15}/);

    // Filter out rating line for cleaner address/category
    const infoLines = lines.filter((l) => l !== name && !/^\d[\.,]\d\(\d/.test(l) && !/^(Buka|Tutup|Open|Closed)/i.test(l));
    leads.push({
      company_name: name,
      phone_number: phoneMatch ? clean(phoneMatch[0]) : "",
      address: infoLines.slice(0, 2).join(" | ").slice(0, 160),
      products: infoLines[0] || "Google Maps Business",
      source_url: linkEl.href || window.location.href,
      website: linkEl.href || ""
    });
  });

  return { siteType: "maps", leads };
}

// --- Render Scraped Preview ---
function renderResults() {
  const wrap = document.getElementById("resultsWrapper");
  const list = document.getElementById("resultsList");
  const count = document.getElementById("resultCount");

  if (!scrapedLeads.length) {
    wrap.classList.add("hidden");
    return;
  }

  wrap.classList.remove("hidden");
  count.textContent = `${scrapedLeads.length} lead bersih siap disimpan`;
  list.innerHTML = "";

  scrapedLeads.forEach((lead) => {
    const wa = extractMobileWA(lead.phone_number);
    const item = document.createElement("div");
    item.className = "lead-item";

    let tags = "";
    if (wa) tags += `<span class="tag tag-wa">WA: +${wa}</span>`;
    else if (lead.phone_number) tags += `<span class="tag tag-tel">Telp: ${lead.phone_number}</span>`;
    if (lead.email) tags += `<span class="tag tag-mail">${lead.email}</span>`;
    if (lead.address) tags += `<span class="tag tag-addr">Alamat terdeteksi</span>`;

    item.innerHTML = `
      <div class="lead-name">${lead.company_name || "(Tanpa Nama)"}</div>
      <div class="lead-sub">${lead.address || lead.job_title || lead.products || lead.website || ""}</div>
      <div class="tag-row">${tags || '<span class="tag tag-addr">Kontak belum terdeteksi — coba Cek /contact</span>'}</div>
    `;
    list.appendChild(item);
  });
}

// --- Main Init ---
document.addEventListener("DOMContentLoaded", async () => {
  await detectChromeAccount();
  const stored = await chrome.storage.local.get(["gsheetUrl", "authUser", "webhookUrl", "crm_profile"]);
  if (stored.crm_profile) profile = { ...DEFAULT_PROFILE, ...stored.crm_profile };
  settings = {
    gsheetUrl: stored.gsheetUrl || "",
    authUser: stored.authUser || detectedEmail || "0",
    webhookUrl: stored.webhookUrl || ""
  };

  // Update header brand & connected account
  document.getElementById("popupBrandName").textContent = `${profile.companyBrand || "B2B CRM"}`;
  document.getElementById("popupBrandMark").textContent = (profile.companyBrand || "HT").slice(0, 2).toUpperCase();
  document.getElementById("popupAccountSub").textContent = settings.authUser && settings.authUser !== "0"
    ? `Akun: ${settings.authUser}`
    : (detectedEmail ? `Akun: ${detectedEmail}` : "Akun Chrome Aktif");

  document.getElementById("setGSheetUrl").value = settings.gsheetUrl;
  document.getElementById("setAuthUser").value = settings.authUser;
  document.getElementById("setWebhookUrl").value = settings.webhookUrl;

  populateSegments();
  populateIndustries();
  renderKeywords();

  // Detect active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    activeTabInfo = { id: tab.id, url: tab.url || "", title: tab.title || "", siteType: detectSiteType(tab.url || "") };
    const labels = { maps: "Google Maps", linkedin: "LinkedIn", market: "Marketplace", web: "Website" };
    document.getElementById("siteBadge").textContent = labels[activeTabInfo.siteType];
    if (activeTabInfo.siteType === "maps") {
      document.getElementById("mapsAutoPanel").classList.remove("hidden");
    }
  }

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  // Launchers
  document.getElementById("btnOpenDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
  document.getElementById("btnOpenSidePanel").addEventListener("click", async () => {
    try {
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (t && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: t.windowId });
        window.close();
        return;
      }
    } catch {}
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });
  document.getElementById("btnOpenGSheet").addEventListener("click", () => {
    if (!settings.gsheetUrl) {
      setStatus("URL Google Sheet belum diisi. Buka tab Pengaturan dulu.", true);
      document.querySelector('[data-tab="settings"]').click();
      return;
    }
    chrome.tabs.create({ url: buildAuthUserUrl(settings.gsheetUrl, settings.authUser) });
  });

  // Deep Scan Halaman Ini
  async function runDeepScan(forceContactSubpage) {
    if (!activeTabInfo.id) return;
    setStatus(forceContactSubpage ? "Mencari & memindai halaman /contact website ini..." : "Memindai Email, Telepon (ID/ASEAN), & Alamat...");
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: activeTabInfo.id },
        func: deepOnlineExtractor,
        args: [forceContactSubpage]
      });
      const seg = document.getElementById("targetSegment").value;
      scrapedLeads = (result?.leads || []).map((l) => ({
        ...l,
        segment: l.segment || seg,
        batch_day: "Extension Scrape"
      }));
      renderResults();
      setStatus(`Selesai! Terdeteksi ${scrapedLeads.length} entitas dari ${result.siteType.toUpperCase()}.`);
    } catch (e) {
      setStatus(`Halaman ini tidak bisa di-scan (halaman sistem Chrome): ${e.message}`, true);
    }
  }

  document.getElementById("btnScanPage").addEventListener("click", () => runDeepScan(false));
  document.getElementById("btnScanContactSubpage").addEventListener("click", () => runDeepScan(true));

  // Google Maps Auto-Scroll & Scrape
  document.getElementById("btnAutoScrollMaps").addEventListener("click", async () => {
    if (!activeTabInfo.id) return;
    const targetCount = parseInt(document.getElementById("mapsTargetCount").value, 10) || 40;
    const btn = document.getElementById("btnAutoScrollMaps");
    btn.disabled = true;
    setStatus(`Auto-scrolling Google Maps (target ${targetCount} bisnis)... Jangan tutup popup.`);
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: activeTabInfo.id },
        func: googleMapsAutoScroller,
        args: [targetCount]
      });
      if (result?.error) {
        setStatus(result.error, true);
      } else {
        const seg = document.getElementById("targetSegment").value;
        scrapedLeads = (result?.leads || []).map((l) => ({
          ...l,
          segment: seg,
          batch_day: "Google Maps Auto"
        }));
        renderResults();
        setStatus(`Auto-Scroll selesai! Berhasil tarik ${scrapedLeads.length} bisnis dari Google Maps.`);
      }
    } catch (e) {
      setStatus(`Gagal Auto-Scroll Maps: ${e.message}`, true);
    } finally {
      btn.disabled = false;
    }
  });

  // Clear Results
  document.getElementById("btnClearResults").addEventListener("click", () => {
    scrapedLeads = [];
    renderResults();
    setStatus("Daftar hasil dibersihkan.");
  });

  // Save to Standalone CRM Storage + Google Sheet Webhook
  document.getElementById("btnPushAll").addEventListener("click", async () => {
    if (!scrapedLeads.length) return;
    setStatus("Menyimpan ke Chrome CRM & Google Sheet...");

    const st = await chrome.storage.local.get(["hots_leads"]);
    let existing = Array.isArray(st.hots_leads) ? st.hots_leads : [];
    const byName = new Map(existing.map((l) => [String(l.company_name || "").toLowerCase(), l]));
    const byWa = new Map(existing.filter((l) => l.phone_wa).map((l) => [String(l.phone_wa), l.company_name]));

    let inserted = 0, updated = 0;
    const cleanedPayload = [];

    for (const raw of scrapedLeads) {
      const comp = String(raw.company_name || "").trim();
      if (!comp) continue;
      const wa = extractMobileWA(raw.phone_number);
      const key = comp.toLowerCase();
      let warn = raw.warning_note || "";
      if (wa && byWa.has(wa) && byWa.get(wa).toLowerCase() !== key) {
        warn = `${warn} | Nomor WA sama dengan ${byWa.get(wa)}`.replace(/^\s*\|\s*/, "");
      }

      const rec = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        batch_day: raw.batch_day || "Extension Scrape",
        company_name: comp,
        segment: raw.segment || document.getElementById("targetSegment").value,
        industry: raw.industry || profile.industryId || "B2B",
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
        if (!old.phone_number && rec.phone_number) old.phone_number = rec.phone_number;
        if (!old.email && rec.email) old.email = rec.email;
        if (!old.address && rec.address) old.address = rec.address;
        if (!old.location && rec.location) old.location = rec.location;
        if (!old.contact_person && rec.contact_person) old.contact_person = rec.contact_person;
        if (!old.job_title && rec.job_title) old.job_title = rec.job_title;
        if (!old.linkedin_url && rec.linkedin_url) old.linkedin_url = rec.linkedin_url;
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

    let gsNote = "Webhook belum diset";
    if (settings.webhookUrl) {
      try {
        await fetch(settings.webhookUrl, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upsert_leads",
            sender_name: profile.senderName,
            company_brand: profile.companyBrand,
            leads: cleanedPayload
          })
        });
        gsNote = "Terkirim ke Google Sheet";
      } catch {
        gsNote = "Gagal sync Sheet";
      }
    }

    setStatus(`Tersimpan! CRM: +${inserted} baru, ${updated} update | GSheet: ${gsNote}`);
  });

  // Download Clean CSV
  document.getElementById("btnDownloadCsv").addEventListener("click", () => {
    if (!scrapedLeads.length) return;
    const headers = ["company_name", "contact_person", "job_title", "phone_wa", "phone_number", "email", "location", "address", "products", "website", "linkedin_url", "segment", "source_url"];
    const rows = scrapedLeads.map((l) => {
      const obj = { ...l, phone_wa: extractMobileWA(l.phone_number) };
      return headers.map((h) => `"${String(obj[h] || "").replace(/"/g, '""')}"`).join(",");
    });
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `b2b_leads_clean_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Keywords Tab
  document.getElementById("btnGenKeywords").addEventListener("click", renderKeywords);
  document.getElementById("kwIndustry").addEventListener("change", renderKeywords);

  // Settings Tab
  document.getElementById("btnCopyGsPopup").addEventListener("click", async () => {
    try {
      const resp = await fetch(chrome.runtime.getURL("apps_script_template.gs"));
      await navigator.clipboard.writeText(await resp.text());
      document.getElementById("settingsStatus").textContent = "Kode .gs tersalin! Paste di Extensions > Apps Script di Google Sheet.";
    } catch (e) {
      document.getElementById("settingsStatus").textContent = "Gagal copy kode .gs: " + e.message;
    }
  });

  document.getElementById("btnSaveSettings").addEventListener("click", async () => {
    settings = {
      gsheetUrl: document.getElementById("setGSheetUrl").value.trim(),
      authUser: document.getElementById("setAuthUser").value.trim() || detectedEmail || "0",
      webhookUrl: document.getElementById("setWebhookUrl").value.trim()
    };
    await chrome.storage.local.set(settings);
    document.getElementById("popupAccountSub").textContent = `Akun: ${settings.authUser}`;
    document.getElementById("settingsStatus").textContent = "Pengaturan akun & Google Sheet tersimpan.";
  });

  document.getElementById("btnOpenOnboarding").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html#onboarding") });
  });
});
