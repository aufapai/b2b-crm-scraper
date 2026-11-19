/**
 * HOTs Trading - Dual B2B CRM Engine & Multi-Channel Outreach
 * Interactive client-side application logic for Safety Shoes Procurement & Shoe Export Enablement
 */

let state = {
  leads: [],
  total: 0,
  limit: 25,
  offset: 0,
  currentPage: 1,
  search: "",
  segment: "",
  industry: "",
  batch_day: "",
  wilayah: "",
  scale: "",
  status: "",
  wa_only: false,
  sort_by: "score_desc",
  templates: [],
  selectedLeadForOutreach: null,
  activeChannel: "whatsapp",
  activeTemplateId: null,
  generatedData: null
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  loadStats();
  loadTemplates().then(() => {
    loadLeads();
  });
});

function setupEventListeners() {
  // Segment Switcher Tabs
  const tabButtons = document.querySelectorAll(".segment-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.segment = btn.getAttribute("data-segment") || "";
      state.offset = 0;
      state.currentPage = 1;
      loadLeads();
    });
  });

  // Search with debounce
  let searchTimeout = null;
  const searchInput = document.getElementById("searchInput");
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = e.target.value.trim();
      state.offset = 0;
      state.currentPage = 1;
      loadLeads();
    }, 300);
  });

  // Filter dropdowns
  const elBatchDay = document.getElementById("filterBatchDay");
  if (elBatchDay) {
    elBatchDay.addEventListener("change", (e) => {
      state.batch_day = e.target.value;
      state.offset = 0;
      state.currentPage = 1;
      loadLeads();
    });
  }

  document.getElementById("filterIndustry").addEventListener("change", (e) => {
    state.industry = e.target.value;
    state.offset = 0;
    state.currentPage = 1;
    loadLeads();
  });

  document.getElementById("filterWilayah").addEventListener("change", (e) => {
    state.wilayah = e.target.value;
    state.offset = 0;
    state.currentPage = 1;
    loadLeads();
  });

  document.getElementById("filterScale").addEventListener("change", (e) => {
    state.scale = e.target.value;
    state.offset = 0;
    state.currentPage = 1;
    loadLeads();
  });

  document.getElementById("filterStatus").addEventListener("change", (e) => {
    state.status = e.target.value;
    state.offset = 0;
    state.currentPage = 1;
    loadLeads();
  });

  document.getElementById("selectSort").addEventListener("change", (e) => {
    state.sort_by = e.target.value;
    loadLeads();
  });

  // Toggle WA Only
  const toggleWaOnly = document.getElementById("toggleWaOnly");
  toggleWaOnly.addEventListener("click", () => {
    state.wa_only = !state.wa_only;
    toggleWaOnly.classList.toggle("active", state.wa_only);
    state.offset = 0;
    state.currentPage = 1;
    loadLeads();
  });

  // Pagination buttons
  document.getElementById("btnPrevPage").addEventListener("click", () => {
    if (state.offset > 0) {
      state.offset = Math.max(0, state.offset - state.limit);
      state.currentPage--;
      loadLeads();
    }
  });

  document.getElementById("btnNextPage").addEventListener("click", () => {
    if (state.offset + state.limit < state.total) {
      state.offset += state.limit;
      state.currentPage++;
      loadLeads();
    }
  });

  // Modal Triggers
  const btnOpenScraper = document.getElementById("btnOpenScraper");
  if (btnOpenScraper) {
    btnOpenScraper.addEventListener("click", () => openModal("modalScraper"));
  }
  document.getElementById("btnOpenExport").addEventListener("click", () => openModal("modalExport"));
  document.getElementById("btnOpenAddLead").addEventListener("click", () => openModal("modalAddLead"));
  document.getElementById("btnOpenTemplates").addEventListener("click", () => {
    renderTemplatesManager();
    openModal("modalTemplates");
  });
}

// --- Data Fetching ---

async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();

    document.getElementById("kpiTotalLeads").textContent = data.total_leads || 0;
    document.getElementById("kpiTotalWa").textContent = data.total_wa || 0;
    document.getElementById("kpiContacted").textContent = data.total_contacted || 0;

    const segA = (data.by_segment && data.by_segment["Segmen A: Buyer Korporat"]) || 0;
    const segB = (data.by_segment && data.by_segment["Segmen B: Manufaktur Sepatu"]) || 0;

    const elKpiSegA = document.getElementById("kpiSegA");
    if (elKpiSegA) elKpiSegA.textContent = segA;

    const elKpiSegB = document.getElementById("kpiSegB");
    if (elKpiSegB) elKpiSegB.textContent = segB;

    const elCountAll = document.getElementById("tabCountAll");
    if (elCountAll) elCountAll.textContent = data.total_leads || 0;

    const elCountA = document.getElementById("tabCountA");
    if (elCountA) elCountA.textContent = segA;

    const elCountB = document.getElementById("tabCountB");
    if (elCountB) elCountB.textContent = segB;

    const contactedPct = data.total_leads > 0 
      ? Math.round((data.total_contacted / data.total_leads) * 100) 
      : 0;
    document.getElementById("kpiContactedPct").textContent = `${contactedPct}% dari total leads`;
  } catch (err) {
    console.error("Gagal memuat stats:", err);
  }
}

async function loadTemplates() {
  try {
    const res = await fetch("/api/templates");
    state.templates = await res.json();
    const defaultTemplate = state.templates.find(t => t.is_default) || state.templates[0];
    if (defaultTemplate) {
      state.activeTemplateId = defaultTemplate.id;
    }
  } catch (err) {
    console.error("Gagal memuat templates:", err);
  }
}

async function loadLeads() {
  const loadingIndicator = document.getElementById("loadingIndicator");
  const emptyState = document.getElementById("emptyState");
  const tableBody = document.getElementById("leadsTableBody");

  loadingIndicator.style.display = "flex";
  emptyState.style.display = "none";
  tableBody.innerHTML = "";

  const params = new URLSearchParams({
    search: state.search,
    segment: state.segment,
    industry: state.industry,
    batch_day: state.batch_day,
    wilayah: state.wilayah,
    scale: state.scale,
    status: state.status,
    wa_only: state.wa_only ? "1" : "0",
    sort_by: state.sort_by,
    limit: state.limit,
    offset: state.offset
  });

  try {
    const res = await fetch(`/api/leads?${params.toString()}`);
    const data = await res.json();

    state.leads = data.items || [];
    state.total = data.total || 0;

    loadingIndicator.style.display = "none";

    document.getElementById("displayCount").textContent = state.leads.length;
    document.getElementById("totalMatchCount").textContent = state.total;

    if (state.leads.length === 0) {
      emptyState.style.display = "flex";
    } else {
      renderTableRows(state.leads);
    }

    updatePaginationControls();
  } catch (err) {
    loadingIndicator.style.display = "none";
    showToast("Gagal memuat data leads: " + err.message, "error");
  }
}

function updatePaginationControls() {
  const totalPages = Math.ceil(state.total / state.limit) || 1;
  document.getElementById("pageIndicator").textContent = `Halaman ${state.currentPage} dari ${totalPages}`;
  document.getElementById("btnPrevPage").disabled = state.currentPage <= 1;
  document.getElementById("btnNextPage").disabled = state.currentPage >= totalPages;
}

// --- Render Table ---

function renderTableRows(leads) {
  const tbody = document.getElementById("leadsTableBody");
  tbody.innerHTML = "";

  leads.forEach((lead, index) => {
    const tr = document.createElement("tr");

    const scoreBadge = `<span class="score-badge ${lead.score >= 90 ? 'hot' : ''}">${lead.score}</span>`;

    // Scale styling
    let scaleClass = "";
    if (lead.scale === "Besar") scaleClass = "besar";
    else if (lead.scale === "UMKM") scaleClass = "umkm";
    const scaleBadge = lead.scale ? `<span class="scale-badge ${scaleClass}">${escapeHtml(lead.scale)}</span>` : "";

    // Segment badge
    const isSegA = (lead.segment || "").includes("Segmen A");
    const segmentBadge = isSegA 
      ? `<span class="badge-segment badge-seg-a">🏢 Buyer Korporat</span>`
      : `<span class="badge-segment badge-seg-b">🏭 Manufaktur Sepatu</span>`;

    const industryTag = lead.industry 
      ? `<span class="badge-industry">${escapeHtml(lead.industry)}</span>` 
      : "";

    // PIC details
    const picHtml = `
      <div class="pic-cell">
        <span class="pic-name">${escapeHtml(lead.contact_person || (isSegA ? 'Tim Procurement & K3' : 'Pimpinan Perusahaan'))}</span>
        <span class="pic-title">${escapeHtml(lead.job_title || (isSegA ? 'Head of Procurement' : 'Owner / Export Director'))}</span>
      </div>
    `;

    // Contact info (WhatsApp + Email)
    let contactHtml = "";
    if (lead.is_wa_valid && lead.phone_wa) {
      contactHtml = `
        <a href="javascript:void(0)" onclick="openOutreachModal(${lead.id}, 'whatsapp')" class="phone-link" title="Klik untuk kirim WhatsApp">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/>
          </svg>
          ${escapeHtml(lead.phone_wa_display || lead.phone_wa)}
        </a>
      `;
    } else if (lead.phone_number) {
      contactHtml = `
        <span class="phone-link phone-landline" title="Telepon kantor / kabel">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          ${escapeHtml(lead.phone_number)}
        </span>
      `;
    } else {
      contactHtml = `<span style="color:var(--text-dim); font-size:0.8rem;">Tidak ada telepon</span>`;
    }

    if (lead.email) {
      contactHtml += `
        <div class="email-sub" title="${escapeHtml(lead.email)}">
          <a href="javascript:void(0)" onclick="openOutreachModal(${lead.id}, 'email')" style="color:#60a5fa; text-decoration:none;">
            ✉️ ${escapeHtml(lead.email)}
          </a>
        </div>
      `;
    }

    // Status Pill / Quick Changer
    const statusSelect = `
      <select class="table-status-select" onchange="quickUpdateStatus(${lead.id}, this.value)">
        <option value="Belum Dihubungi" ${lead.outreach_status === 'Belum Dihubungi' ? 'selected' : ''}>Belum Dihubungi</option>
        <option value="Sudah Dihubungi" ${lead.outreach_status === 'Sudah Dihubungi' ? 'selected' : ''}>Sudah Dihubungi</option>
        <option value="Tertarik Demo/Katalog" ${lead.outreach_status === 'Tertarik Demo/Katalog' ? 'selected' : ''}>Tertarik Demo/Katalog ⭐</option>
        <option value="Tertarik Ekspor" ${lead.outreach_status === 'Tertarik Ekspor' ? 'selected' : ''}>Tertarik Ekspor ⭐</option>
        <option value="Follow-up Lagi" ${lead.outreach_status === 'Follow-up Lagi' ? 'selected' : ''}>Follow-up Lagi</option>
        <option value="Belum Tertarik" ${lead.outreach_status === 'Belum Tertarik' ? 'selected' : ''}>Belum Tertarik</option>
      </select>
    `;

    // Action buttons
    const waButton = lead.is_wa_valid 
      ? `<button class="btn-wa-table" onclick="openOutreachModal(${lead.id}, 'whatsapp')" title="Buka WhatsApp Web dan kirim pesan">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
             <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.81 13.47 3.81 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z"/>
           </svg>
           WA
         </button>`
      : `<button class="btn-wa-table" style="opacity:0.35; cursor:not-allowed;" title="Nomor HP seluler belum tersedia">
           WA
         </button>`;

    const emailButton = lead.email
      ? `<button class="btn-email-table" onclick="openOutreachModal(${lead.id}, 'email')" title="Buka Pitching Email">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
             <polyline points="22,6 12,13 2,6"></polyline>
           </svg>
           Email
         </button>`
      : "";

    tr.innerHTML = `
      <td>${scoreBadge}</td>
      <td>
        <div class="company-cell">
          <div class="company-name">${escapeHtml(lead.company_name)}</div>
          <div class="company-meta">
            ${scaleBadge}
            ${industryTag}
            ${lead.website ? `<a href="${escapeHtml(lead.website.startsWith('http') ? lead.website : 'https://' + lead.website)}" target="_blank" class="btn-link" style="font-size:0.75rem;">Portal/Web</a>` : ''}
          </div>
        </div>
      </td>
      <td>
        ${segmentBadge}
      </td>
      <td>
        ${picHtml}
      </td>
      <td>
        <div class="contact-cell">
          ${contactHtml}
        </div>
      </td>
      <td>
        <div class="products-cell" title="${escapeHtml(lead.products || '-')}">
          ${escapeHtml(lead.products || '-')}
        </div>
      </td>
      <td>
        ${statusSelect}
        ${lead.follow_up_notes ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;" title="${escapeHtml(lead.follow_up_notes)}">📝 Catatan tersimpan</div>` : ''}
      </td>
      <td class="text-right">
        <div class="table-actions">
          ${waButton}
          ${emailButton}
          <button class="btn-action-icon" onclick="openEditModal(${lead.id})" title="Edit / Detail & Catatan">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// --- Outreach Modal Logic (WhatsApp & Email Pitching) ---

async function openOutreachModal(leadId, defaultChannel = "whatsapp") {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  state.selectedLeadForOutreach = lead;
  state.activeChannel = defaultChannel;

  // Set Target summary in modal
  document.getElementById("targetCompany").textContent = lead.company_name;
  document.getElementById("targetSegment").textContent = `${lead.segment || 'Segmen Target'} (${lead.industry || 'Umum'})`;
  document.getElementById("targetPic").textContent = `${lead.contact_person || 'Tim Procurement'} - ${lead.job_title || 'Manager'}`;
  document.getElementById("targetPhone").textContent = lead.phone_wa_display || lead.phone_wa || lead.phone_number || "-";
  document.getElementById("targetEmail").textContent = lead.email || "-";
  document.getElementById("outreachModalTargetInfo").textContent = `Target: ${lead.company_name} | PIC: ${lead.contact_person || 'Tim Procurement'}`;

  // Update channel tabs
  updateChannelUI();
  populateMatchingTemplates();
  await generateAndDisplayOutreachMessage();

  openModal("modalOutreach");
}

function switchOutreachChannel(channel) {
  state.activeChannel = channel;
  updateChannelUI();
  populateMatchingTemplates();
  generateAndDisplayOutreachMessage();
}

function updateChannelUI() {
  const isWa = state.activeChannel === "whatsapp";
  document.getElementById("btnChannelWa").classList.toggle("active", isWa);
  document.getElementById("btnChannelEmail").classList.toggle("active", !isWa);

  document.getElementById("groupEmailSubject").style.display = isWa ? "none" : "block";
  document.getElementById("footerWaButtons").style.display = isWa ? "flex" : "none";
  document.getElementById("footerEmailButtons").style.display = isWa ? "none" : "flex";

  const headerIcon = document.getElementById("outreachHeaderIcon");
  if (isWa) {
    headerIcon.className = "modal-header-icon wa-bg";
    document.getElementById("outreachModalTitle").textContent = "Outreach via WhatsApp: PT Indo Sukses Semesta";
  } else {
    headerIcon.className = "modal-header-icon export-bg";
    document.getElementById("outreachModalTitle").textContent = "Pitching Resmi via Email: PT Indo Sukses Semesta";
  }
}

function populateMatchingTemplates() {
  const lead = state.selectedLeadForOutreach;
  const isSegA = lead && (lead.segment || "").includes("Segmen A");
  const targetSegKey = isSegA ? "buyer" : "manufaktur";

  const templateSelect = document.getElementById("outreachTemplateSelect");
  templateSelect.innerHTML = "";

  // Filter templates matching current channel and lead segment
  let matched = state.templates.filter(t => {
    const channelMatch = (t.channel === state.activeChannel || t.channel === "all" || !t.channel);
    const segMatch = isSegA 
      ? (t.segment.includes("Buyer") || t.segment === "all")
      : (t.segment.includes("Manufaktur") || t.segment === "all");
    return channelMatch && segMatch;
  });

  if (matched.length === 0) {
    matched = state.templates.filter(t => t.channel === state.activeChannel || t.channel === "all");
  }

  matched.forEach((t, i) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `${t.title} ${t.is_default ? '(Rekomendasi)' : ''}`;
    if (i === 0) {
      opt.selected = true;
      state.activeTemplateId = t.id;
    }
    templateSelect.appendChild(opt);
  });
}

async function onOutreachTemplateChange() {
  const templateSelect = document.getElementById("outreachTemplateSelect");
  state.activeTemplateId = parseInt(templateSelect.value);
  await generateAndDisplayOutreachMessage();
}

async function generateAndDisplayOutreachMessage() {
  if (!state.selectedLeadForOutreach) return;

  try {
    const res = await fetch(`/api/generate-message?lead_id=${state.selectedLeadForOutreach.id}&template_id=${state.activeTemplateId}`);
    const data = await res.json();
    state.generatedData = data;

    document.getElementById("outreachMessagePreview").value = data.message || "";
    document.getElementById("outreachSubject").value = data.subject || "Penawaran Kerja Sama Pengadaan Safety Shoes & Solusi SaaS";
  } catch (err) {
    console.error("Gagal generate pesan:", err);
  }
}

function copyOutreachMessage() {
  const text = document.getElementById("outreachMessagePreview").value;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Isi pesan berhasil disalin ke clipboard!");
  }).catch(() => {
    showToast("Gagal menyalin pesan", "error");
  });
}

function copySubjectText() {
  const subject = document.getElementById("outreachSubject").value;
  navigator.clipboard.writeText(subject).then(() => {
    showToast("Subjek email berhasil disalin!");
  }).catch(() => {
    showToast("Gagal menyalin subjek", "error");
  });
}

async function launchWhatsAppWeb() {
  const lead = state.selectedLeadForOutreach;
  if (!lead || !lead.phone_wa) {
    showToast("Nomor WhatsApp tidak valid!", "error");
    return;
  }

  const messageText = document.getElementById("outreachMessagePreview").value;
  const encodedText = encodeURIComponent(messageText);
  const waWebUrl = `https://web.whatsapp.com/send?phone=${lead.phone_wa}&text=${encodedText}`;

  window.open(waWebUrl, "_blank");

  // Check auto mark contacted
  const autoMark = document.getElementById("checkAutoMarkContacted").checked;
  if (autoMark) {
    try {
      await fetch(`/api/leads/${lead.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Sudah Dihubungi",
          notes: lead.follow_up_notes || "Dioutreach via WhatsApp Web"
        })
      });
      showToast(`Membuka WhatsApp Web! Status ${lead.company_name} diubah menjadi 'Sudah Dihubungi'.`);
      loadStats();
      loadLeads();
    } catch (err) {
      console.error(err);
    }
  } else {
    showToast(`Membuka WhatsApp Web untuk ${lead.company_name}...`);
  }

  closeModal("modalOutreach");
}

async function launchEmailClient() {
  const lead = state.selectedLeadForOutreach;
  if (!lead || !lead.email) {
    showToast("Alamat email perusahaan belum tersedia!", "error");
    return;
  }

  const subject = document.getElementById("outreachSubject").value;
  const messageText = document.getElementById("outreachMessagePreview").value;

  const mailtoUrl = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(messageText)}`;
  window.location.href = mailtoUrl;

  const autoMark = document.getElementById("checkAutoMarkContacted").checked;
  if (autoMark) {
    try {
      await fetch(`/api/leads/${lead.id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Sudah Dihubungi",
          notes: lead.follow_up_notes || "Dioutreach via Email Pitching"
        })
      });
      showToast(`Membuka client email! Status ${lead.company_name} diubah menjadi 'Sudah Dihubungi'.`);
      loadStats();
      loadLeads();
    } catch (err) {
      console.error(err);
    }
  } else {
    showToast(`Membuka email client untuk ${lead.company_name}...`);
  }

  closeModal("modalOutreach");
}

// --- Quick Status Changer ---

async function quickUpdateStatus(leadId, newStatus) {
  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreach_status: newStatus })
    });
    if (res.ok) {
      showToast(`Status berhasil diperbarui: ${newStatus}`);
      loadStats();
    } else {
      showToast("Gagal memperbarui status", "error");
    }
  } catch (err) {
    showToast("Error update status: " + err.message, "error");
  }
}

// --- Edit Lead Modal Logic ---

async function openEditModal(leadId) {
  try {
    const res = await fetch(`/api/leads/${leadId}`);
    const lead = await res.json();

    document.getElementById("editLeadId").value = lead.id;
    document.getElementById("editSegment").value = lead.segment || "Segmen A: Buyer Korporat";
    document.getElementById("editIndustry").value = lead.industry || "Konstruksi & EPC";
    document.getElementById("editCompanyName").value = lead.company_name || "";
    document.getElementById("editScale").value = lead.scale || "Besar";
    document.getElementById("editContactPerson").value = lead.contact_person || "";
    document.getElementById("editJobTitle").value = lead.job_title || "";
    document.getElementById("editPhoneWa").value = lead.phone_wa || "";
    document.getElementById("editPhoneRaw").value = lead.phone_number || "";
    document.getElementById("editWilayah").value = lead.wilayah || "";
    document.getElementById("editLocation").value = lead.location || "";
    document.getElementById("editProducts").value = lead.products || "";
    document.getElementById("editEmail").value = lead.email || "";
    document.getElementById("editWebsite").value = lead.website || "";
    document.getElementById("editAddress").value = lead.address || "";
    document.getElementById("editStatus").value = lead.outreach_status || "Belum Dihubungi";
    document.getElementById("editKategori").value = lead.kategori || "Hot";
    document.getElementById("editNotes").value = lead.follow_up_notes || "";

    document.getElementById("editModalTitle").textContent = `Edit & Catatan: ${lead.company_name}`;
    openModal("modalEditLead");
  } catch (err) {
    showToast("Gagal memuat detail lead", "error");
  }
}

async function saveLeadDetails(e) {
  e.preventDefault();
  const leadId = document.getElementById("editLeadId").value;

  const payload = {
    segment: document.getElementById("editSegment").value,
    industry: document.getElementById("editIndustry").value,
    company_name: document.getElementById("editCompanyName").value.trim(),
    scale: document.getElementById("editScale").value,
    contact_person: document.getElementById("editContactPerson").value.trim(),
    job_title: document.getElementById("editJobTitle").value.trim(),
    phone_wa: document.getElementById("editPhoneWa").value.trim(),
    phone_number: document.getElementById("editPhoneRaw").value.trim(),
    wilayah: document.getElementById("editWilayah").value.trim(),
    location: document.getElementById("editLocation").value.trim(),
    products: document.getElementById("editProducts").value.trim(),
    email: document.getElementById("editEmail").value.trim(),
    website: document.getElementById("editWebsite").value.trim(),
    address: document.getElementById("editAddress").value.trim(),
    outreach_status: document.getElementById("editStatus").value,
    kategori: document.getElementById("editKategori").value,
    follow_up_notes: document.getElementById("editNotes").value.trim()
  };

  try {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      showToast("Data lead & catatan berhasil disimpan!");
      closeModal("modalEditLead");
      loadStats();
      loadLeads();
    } else {
      showToast("Gagal menyimpan data lead", "error");
    }
  } catch (err) {
    showToast("Error simpan: " + err.message, "error");
  }
}

// --- Add Lead Modal Logic ---

async function submitNewLead(e) {
  e.preventDefault();

  const payload = {
    segment: document.getElementById("addSegment").value,
    industry: document.getElementById("addIndustry").value,
    company_name: document.getElementById("addCompanyName").value.trim(),
    scale: document.getElementById("addScale").value,
    contact_person: document.getElementById("addContactPerson").value.trim(),
    job_title: document.getElementById("addJobTitle").value.trim(),
    phone_wa: document.getElementById("addPhoneWa").value.trim(),
    wilayah: document.getElementById("addWilayah").value.trim(),
    location: document.getElementById("addLocation").value.trim(),
    products: document.getElementById("addProducts").value.trim(),
    email: document.getElementById("addEmail").value.trim(),
    address: document.getElementById("addAddress").value.trim()
  };

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      showToast("Lead baru berhasil ditambahkan!");
      document.getElementById("formAddLead").reset();
      closeModal("modalAddLead");
      loadStats();
      loadLeads();
    } else {
      const err = await res.json();
      showToast("Gagal menambahkan lead: " + (err.error || ""), "error");
    }
  } catch (err) {
    showToast("Error tambah lead: " + err.message, "error");
  }
}

// --- Export Logic ---

function triggerDownloadExport() {
  const format = document.querySelector('input[name="exportFmt"]:checked').value;
  const scope = document.querySelector('input[name="exportScope"]:checked').value;

  let url = `/api/export?format=${format}`;

  if (scope === "seg_a") {
    url += "&segment=Segmen A: Buyer Korporat";
  } else if (scope === "seg_b") {
    url += "&segment=Segmen B: Manufaktur Sepatu";
  } else if (scope === "wa_only") {
    url += "&wa_only=1";
  }

  showToast(`Sedang menyiapkan unduhan ${format.toUpperCase()}...`);
  window.location.href = url;
  closeModal("modalExport");
}

// --- Templates Manager ---

function renderTemplatesManager() {
  const container = document.getElementById("templateList");
  container.innerHTML = "";

  state.templates.forEach((t) => {
    const div = document.createElement("div");
    div.className = "template-item";
    
    const isWa = t.channel === "whatsapp";
    const channelBadge = isWa 
      ? `<span style="background:rgba(37,211,102,0.15); color:#25D366; font-size:0.75rem; padding:2px 7px; border-radius:4px; font-weight:700;">WhatsApp</span>`
      : `<span style="background:rgba(59,130,246,0.15); color:#60a5fa; font-size:0.75rem; padding:2px 7px; border-radius:4px; font-weight:700;">Email</span>`;

    const segBadge = t.segment.includes("Buyer")
      ? `<span style="background:rgba(59,130,246,0.12); color:#93c5fd; font-size:0.73rem; padding:2px 6px; border-radius:4px;">Buyer Korporat</span>`
      : (t.segment.includes("Manufaktur")
        ? `<span style="background:rgba(168,85,247,0.12); color:#d8b4fe; font-size:0.73rem; padding:2px 6px; border-radius:4px;">Manufaktur</span>`
        : `<span style="background:rgba(255,255,255,0.08); color:#cbd5e1; font-size:0.73rem; padding:2px 6px; border-radius:4px;">Semua</span>`);

    div.innerHTML = `
      <div class="template-header">
        <div>
          <span class="template-title-text">${escapeHtml(t.title)}</span>
          <div style="display:inline-flex; gap:6px; margin-left:8px;">
            ${channelBadge}
            ${segBadge}
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="saveTemplateEdit(${t.id})">Simpan Perubahan</button>
      </div>
      ${t.subject ? `<div style="margin-bottom:8px;"><label style="font-size:0.78rem; color:var(--text-dim);">Subjek Email:</label><input type="text" id="tplSub_${t.id}" class="form-control" value="${escapeHtml(t.subject)}" style="margin-top:2px;"></div>` : ''}
      <textarea id="tplText_${t.id}" class="form-control message-box" rows="5">${escapeHtml(t.message_text)}</textarea>
    `;
    container.appendChild(div);
  });
}

async function saveTemplateEdit(templateId) {
  const text = document.getElementById(`tplText_${templateId}`).value;
  const subEl = document.getElementById(`tplSub_${templateId}`);
  const subject = subEl ? subEl.value : "";
  const template = state.templates.find(t => t.id === templateId);

  try {
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: templateId,
        title: template.title,
        message_text: text,
        subject: subject || template.subject || "",
        channel: template.channel || "whatsapp",
        segment: template.segment || "all",
        is_default: template.is_default
      })
    });

    if (res.ok) {
      state.templates = await res.json();
      showToast("Template berhasil diperbarui!");
    } else {
      showToast("Gagal menyimpan template", "error");
    }
  } catch (err) {
    showToast("Error update template: " + err.message, "error");
  }
}

// --- AI Web Scraper Logic ---

function switchScrapeMode(mode) {
  const tabUrl = document.getElementById("tabScrapeUrl");
  const tabQuick = document.getElementById("tabScrapeQuick");
  const secUrl = document.getElementById("sectionScrapeUrl");
  const secQuick = document.getElementById("sectionScrapeQuick");

  if (!tabUrl || !tabQuick || !secUrl || !secQuick) return;

  if (mode === "url") {
    tabUrl.classList.add("active");
    tabQuick.classList.remove("active");
    secUrl.style.display = "block";
    secQuick.style.display = "none";
  } else {
    tabUrl.classList.remove("active");
    tabQuick.classList.add("active");
    secUrl.style.display = "none";
    secQuick.style.display = "block";
  }
}

function setScrapePreset(url, industry) {
  const urlInput = document.getElementById("scrapeUrlInput");
  const indSelect = document.getElementById("scrapeIndustrySelect");
  if (urlInput) {
    urlInput.value = url;
    urlInput.focus();
  }
  if (indSelect && industry) {
    indSelect.value = industry;
  }
}

async function runLiveScraper() {
  const urlInput = document.getElementById("scrapeUrlInput");
  const indSelect = document.getElementById("scrapeIndustrySelect");
  const btnRun = document.getElementById("btnRunScraper");
  const indicator = document.getElementById("scrapeProgressIndicator");
  const resultsContainer = document.getElementById("scrapeResultsContainer");
  const resultsList = document.getElementById("scrapeResultsList");
  const resultBadge = document.getElementById("scrapeResultBadge");

  const url = urlInput ? urlInput.value.trim() : "";
  const industry = indSelect ? indSelect.value : "Konstruksi & EPC";

  if (!url) {
    showToast("Silakan masukkan URL website atau direktori target.", "error");
    if (urlInput) urlInput.focus();
    return;
  }

  // UI loading state
  if (btnRun) {
    btnRun.disabled = true;
    btnRun.innerHTML = `<span class="spinner" style="display:inline-block; width:16px; height:16px; margin-right:8px; vertical-align:middle;"></span> Mengekstrak AI...`;
  }
  if (indicator) indicator.style.display = "block";
  if (resultsContainer) resultsContainer.style.display = "none";
  if (resultsList) resultsList.innerHTML = "";

  try {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "scrape_url",
        url: url,
        industry: industry
      })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message || `Berhasil mengekstrak leads dari ${url}!`, "success");

      // Render results
      if (resultsContainer) resultsContainer.style.display = "block";
      if (resultBadge) resultBadge.textContent = `${data.leads_saved || 0} Leads Disimpan`;

      if (resultsList) {
        if (data.leads && data.leads.length > 0) {
          data.leads.forEach(lead => {
            const item = document.createElement("div");
            item.className = "scrape-result-item";
            item.style.cssText = "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;";

            item.innerHTML = `
              <div>
                <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">${escapeHtml(lead.company_name)}</div>
                <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">
                  <span>PIC: ${escapeHtml(lead.contact_person || 'Tim Procurement')} (${escapeHtml(lead.job_title || 'Procurement')})</span> &bull; 
                  <span>${escapeHtml(lead.location || lead.wilayah || 'Indonesia')}</span>
                </div>
              </div>
              <div style="text-align: right;">
                <span class="badge-seg-a" style="font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; display: inline-block;">${escapeHtml(lead.industry || industry)}</span>
                <div style="font-size: 0.76rem; color: #10b981; margin-top: 3px; font-weight: 600;">${escapeHtml(lead.phone_wa || lead.email || 'Data Tersimpan')}</div>
              </div>
            `;
            resultsList.appendChild(item);
          });
        } else {
          resultsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-dim); padding: 12px; text-align: center;">Tidak ada profil leads baru yang dapat diekstrak dari halaman ini. Silakan periksa kembali URL target.</div>`;
        }
      }

      // Refresh background table and counters
      loadStats();
      loadLeads();
    } else {
      showToast(data.error || "Gagal scraping website.", "error");
    }
  } catch (err) {
    showToast("Error saat menghubungi scraper: " + err.message, "error");
  } finally {
    if (btnRun) {
      btnRun.disabled = false;
      btnRun.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Mulai Ekstraksi AI & Simpan ke Database
      `;
    }
    if (indicator) indicator.style.display = "none";
  }
}

async function runQuickSyncCorporate() {
  const indicator = document.getElementById("scrapeProgressIndicator");
  const progText = document.getElementById("scrapeProgressText");
  const resultsContainer = document.getElementById("scrapeResultsContainer");
  const resultsList = document.getElementById("scrapeResultsList");
  const resultBadge = document.getElementById("scrapeResultBadge");

  if (indicator) indicator.style.display = "block";
  if (progText) progText.textContent = "Sedang menyinkronkan 31 Buyer Korporat Tier-1 ke database...";

  try {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seed_corporate" })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, "success");
      loadStats();
      loadLeads();

      if (resultsContainer) resultsContainer.style.display = "block";
      if (resultBadge) resultBadge.textContent = "31 Leads Tier-1";
      if (resultsList) {
        resultsList.innerHTML = `
          <div style="background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-sm); padding: 12px; font-size: 0.85rem; color: #6ee7b7;">
            ✓ Berhasil menyinkronkan 31 akun Korporat Tier-1 (WIKA, Adhi Karya, PT PP, Freeport, Vale, Astra Agro, Sinarmas, Mayora, dll.) ke Segmen A.
          </div>
        `;
      }
    } else {
      showToast(data.error || "Gagal sinkronisasi.", "error");
    }
  } catch (err) {
    showToast("Error sinkronisasi: " + err.message, "error");
  } finally {
    if (indicator) indicator.style.display = "none";
    if (progText) progText.textContent = "Sedang mengunduh halaman dan mengekstrak data profil via Gemini AI...";
  }
}

// --- Modal Helpers ---

function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

// Close on click outside
window.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    e.target.classList.remove("open");
  }
});

// Toast Helper
function showToast(message, type = "success") {
  const toast = document.getElementById("toastNotification");
  toast.textContent = message;
  toast.style.borderColor = type === "error" ? "var(--color-rose)" : "var(--color-emerald)";
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Google Sheet & AuthUser Integration ---
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

async function openGSheetModal() {
  try {
    const res = await fetch("/api/settings");
    const s = await res.json();
    document.getElementById("gsheetUrlInput").value = s.gsheet_url || "";
    document.getElementById("gsheetAuthUserInput").value = s.gsheet_authuser || "0";
    document.getElementById("gsheetWebhookInput").value = s.gsheet_webhook_url || "";
    document.getElementById("gsheetSyncResult").textContent = "";
  } catch (e) {
    console.error("Gagal load settings:", e);
  }
  const modal = document.getElementById("modalGSheet");
  if (modal) modal.classList.add("open");
}

document.addEventListener("DOMContentLoaded", () => {
  const btnOpen = document.getElementById("btnOpenGSheet");
  if (btnOpen) btnOpen.addEventListener("click", openGSheetModal);

  const btnSave = document.getElementById("btnSaveGSheetSettings");
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const payload = {
        gsheet_url: document.getElementById("gsheetUrlInput").value.trim(),
        gsheet_authuser: document.getElementById("gsheetAuthUserInput").value.trim(),
        gsheet_webhook_url: document.getElementById("gsheetWebhookInput").value.trim()
      };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Pengaturan Google Sheet & Akun tersimpan!");
      } else {
        showToast("Gagal menyimpan pengaturan", "error");
      }
    });
  }

  const btnLaunch = document.getElementById("btnLaunchGSheet");
  if (btnLaunch) {
    btnLaunch.addEventListener("click", () => {
      const url = document.getElementById("gsheetUrlInput").value.trim();
      const auth = document.getElementById("gsheetAuthUserInput").value.trim();
      if (!url) {
        showToast("Masukkan URL Google Sheet terlebih dahulu!", "error");
        return;
      }
      window.open(buildAuthUserUrl(url, auth), "_blank");
    });
  }

  const btnPush = document.getElementById("btnPushToGSheet");
  if (btnPush) {
    btnPush.addEventListener("click", async () => {
      const webhook = document.getElementById("gsheetWebhookInput").value.trim();
      const resBox = document.getElementById("gsheetSyncResult");
      if (!webhook) {
        showToast("Isi Google Apps Script Webhook URL dulu!", "error");
        return;
      }
      resBox.textContent = "⏳ Sedang mengirim leads ke Google Sheet...";
      try {
        const res = await fetch("/api/sync-gsheet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ webhook_url: webhook, batch_day: state.batch_day || "" })
        });
        const data = await res.json();
        if (res.ok) {
          resBox.textContent = `✅ Selesai! ${data.count} leads dikirim (${data.gsheet_sync})`;
          showToast(`Berhasil sync ${data.count} leads ke Google Sheet!`);
        } else {
          resBox.textContent = `❌ ${data.error || "Gagal sync"}`;
          showToast(data.error || "Gagal sync", "error");
        }
      } catch (e) {
        resBox.textContent = `❌ Error: ${e.message}`;
      }
    });
  }
});
