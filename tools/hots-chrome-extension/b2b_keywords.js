/**
 * Built-in Smart B2B Industry, Segment & Keyword Recommendation Database
 * Mendukung HOTS Trading (Safety Footwear / APD / Ekspor ASEAN) dan B2B CRM Umum.
 */
window.B2B_DATABASE = {
  industries: [
    {
      id: "safety_apd",
      label: "Safety Footwear, APD & K3 Industri (HOTS Trading)",
      defaultSegments: [
        "Segmen A: Reseller & Toko K3",
        "Segmen A: Partner Portal & BUMN",
        "Segmen A: Buyer Korporat",
        "Segmen B: Manufaktur Sepatu",
        "Riset Pasar SEA"
      ],
      mapsKeywords: [
        "toko alat safety {region}",
        "distributor APD safety shoes {region}",
        "supplier safety equipment {region}",
        "grosir sepatu safety {region}",
        "PPE safety boots distributor {region}"
      ],
      linkedinKeywords: [
        "Procurement Manager {region} construction OR mining",
        "HSE Manager {region} safety equipment",
        "Purchasing Manager {region} hospital OR food manufacturing"
      ]
    },
    {
      id: "construction_epc",
      label: "Konstruksi, Kontraktor & EPC",
      defaultSegments: [
        "Kontraktor EPC Tier-1",
        "Kontraktor Sipil & Infrastruktur",
        "Subkontraktor Proyek",
        "Developer Properti"
      ],
      mapsKeywords: [
        "kontraktor konstruksi {region}",
        "perusahaan EPC {region}",
        "kontraktor infrastruktur {region}",
        "construction contractor company {region}"
      ],
      linkedinKeywords: [
        "Procurement Manager construction {region}",
        "Supply Chain Manager EPC {region}",
        "Project Manager contractor {region}"
      ]
    },
    {
      id: "mining_energy",
      label: "Pertambangan, Minyak, Gas & Energi",
      defaultSegments: [
        "Perusahaan Tambang Batubara/Nikel",
        "Kontraktor Tambang",
        "Oil & Gas / Energi",
        "Vendor Site Support"
      ],
      mapsKeywords: [
        "kontraktor tambang {region}",
        "perusahaan pertambangan {region}",
        "oil and gas contractor {region}",
        "mining services company {region}"
      ],
      linkedinKeywords: [
        "Procurement mining {region}",
        "HSE Lead oil gas {region}",
        "Vendor Management mining {region}"
      ]
    },
    {
      id: "footwear_manufacturing",
      label: "Manufaktur & Pabrik Alas Kaki / Tekstil",
      defaultSegments: [
        "Pabrik Sepatu Skala Besar (OEM)",
        "Sentra Pengrajin / UMKM Sepatu",
        "Supplier Bahan Baku & Sol",
        "Importir / Buyer Ekspor"
      ],
      mapsKeywords: [
        "pabrik sepatu {region}",
        "produsen sandal sepatu {region}",
        "pabrik alas kaki {region}",
        "footwear manufacturer factory {region}"
      ],
      linkedinKeywords: [
        "Export Manager footwear {region}",
        "Factory Owner shoe manufacturing {region}",
        "Sourcing Manager footwear {region}"
      ]
    },
    {
      id: "healthcare_fnb",
      label: "Rumah Sakit, Farmasi & F&B (Higienis)",
      defaultSegments: [
        "Rumah Sakit & Klinik",
        "Pabrik Makanan & Minuman (F&B)",
        "Catering / SPPG / Dapur Umum",
        "Industri Farmasi & Lab"
      ],
      mapsKeywords: [
        "pabrik makanan minuman {region}",
        "rumah sakit swasta {region}",
        "industri farmasi {region}",
        "food processing factory {region}"
      ],
      linkedinKeywords: [
        "Purchasing Manager hospital {region}",
        "Procurement food manufacturing {region}",
        "QA HSE Manager F&B {region}"
      ]
    },
    {
      id: "logistics_warehouse",
      label: "Logistik, Pergudangan & Manufaktur Berat",
      defaultSegments: [
        "Kawasan Industri & Pabrik",
        "Perusahaan Logistik & 3PL",
        "Cold Storage & Pelabuhan",
        "Distributor Regional"
      ],
      mapsKeywords: [
        "perusahaan logistik pergudangan {region}",
        "kawasan industri pabrik {region}",
        "cold storage warehouse {region}",
        "logistics warehouse company {region}"
      ],
      linkedinKeywords: [
        "Warehouse Manager logistics {region}",
        "Operations Manager 3PL {region}",
        "Procurement manufacturing {region}"
      ]
    },
    {
      id: "plantation_agri",
      label: "Perkebunan, Kelapa Sawit & Agribisnis",
      defaultSegments: [
        "Perusahaan Perkebunan Sawit",
        "Pabrik Kelapa Sawit (PKS)",
        "Agribisnis & Pertanian",
        "Distributor Sarana Kebun"
      ],
      mapsKeywords: [
        "perusahaan perkebunan sawit {region}",
        "pabrik kelapa sawit {region}",
        "distributor alat pertanian perkebunan {region}"
      ],
      linkedinKeywords: [
        "Procurement palm oil plantation {region}",
        "Estate Manager agribusiness {region}"
      ]
    },
    {
      id: "general_b2b",
      label: "B2B Umum / Custom Bisnis Lainnya",
      defaultSegments: [
        "Distributor & Grosir",
        "Buyer Korporat",
        "Reseller & Toko",
        "Mitra Strategis"
      ],
      mapsKeywords: [
        "distributor grosir {region}",
        "supplier B2B {region}",
        "perusahaan trading {region}"
      ],
      linkedinKeywords: [
        "Purchasing Manager {region}",
        "Business Development Manager {region}"
      ]
    }
  ],

  generateRecommendations(industryId, regionsRaw, customTopic) {
    const ind = this.industries.find((i) => i.id === industryId) || this.industries[0];
    const regions = String(regionsRaw || "Jakarta")
      .split(/[,;\n]+/)
      .map((r) => r.trim())
      .filter(Boolean);
    const activeRegions = regions.length ? regions.slice(0, 4) : ["Jakarta"];

    const maps = [];
    const linkedin = [];

    activeRegions.forEach((reg) => {
      if (customTopic && customTopic.trim()) {
        maps.push({
          query: `${customTopic.trim()} ${reg}`,
          region: reg,
          url: `https://www.google.com/maps/search/${encodeURIComponent(customTopic.trim() + " " + reg)}`
        });
      }
      ind.mapsKeywords.slice(0, 3).forEach((tpl) => {
        const q = tpl.replace("{region}", reg);
        maps.push({
          query: q,
          region: reg,
          url: `https://www.google.com/maps/search/${encodeURIComponent(q)}`
        });
      });
      ind.linkedinKeywords.slice(0, 2).forEach((tpl) => {
        const q = tpl.replace("{region}", reg);
        linkedin.push({
          query: q,
          region: reg,
          url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`
        });
      });
    });

    return { industry: ind, maps: maps.slice(0, 10), linkedin: linkedin.slice(0, 6) };
  }
};
