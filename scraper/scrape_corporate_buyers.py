"""Scraper & Lead Harvester untuk Segmen A: Buyer Korporat & Industri
Fokus: Pengadaan Safety Footwear (K3 SNI/EN ISO) & Integrasi SaaS e-Procurement
Target Industri: Konstruksi & EPC, Pertambangan & Energi, Perkebunan & Sawit, Manufaktur Berat & Logistik, Rumah Sakit.
Mendukung seeding direktori korporat Tier-1 Indonesia dan scraping live URL dengan Gemini API.
"""
import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

# Safe encoding on Windows PowerShell/CMD
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

import httpx
import pandas as pd
from bs4 import BeautifulSoup
from dotenv import load_dotenv

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent
load_dotenv(BASE / ".env")

# Add root directory to sys.path to access database module
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import database

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
}

PROMPT_SEGMENT_A = """Kamu adalah analis data B2B dan procurement intelligence Indonesia.
Ekstrak daftar perusahaan korporat / kontraktor / tambang / perkebunan / industri yang membutuhkan pengadaan alat pelindung diri (khususnya sepatu safety K3 SNI/EN ISO, rubber boots, AP Boots) dan sistem e-procurement dari teks web berikut.
Balas HANYA JSON valid: {"leads": [{...}]} dengan field:
- company_name: Nama resmi PT / BUMN / Tbk / CV.
- industry: Salah satu dari "Konstruksi & EPC", "Pertambangan & Energi", "Perkebunan & Sawit", "Logistik & Manufaktur Berat", "Rumah Sakit & Fasilitas".
- scale: "Besar", "Menengah", atau "UMKM".
- location: Kota/Kabupaten kantor pusat atau operasional.
- wilayah: Provinsi atau Wilayah (Jakarta, Jawa Barat, Jawa Timur, Sumatera, Kalimantan, Sulawesi, Papua).
- address: Alamat lengkap kantor/pabrik/site.
- phone_number: Nomor telepon kantor / kontak pengadaan.
- email: Email procurement, e-procurement, vendor management, atau info perusahaan.
- website: URL situs resmi atau portal e-procurement.
- contact_person: Nama PIC / "Tim Procurement & K3".
- job_title: Jabatan yang relevan (Head of Procurement, Purchasing Manager, HSE / K3 Manager).
- products: Kebutuhan spesifik alas kaki safety (misal: "Sepatu Safety K3 SNI, Steel Toe Boots, Safety Rubber Boots Tahan Minyak/Kimia").

Teks sumber:
"""

PROMPT_SEGMENT_B = """Kamu adalah asisten analisis data B2B manufaktur alas kaki Indonesia.
Ekstrak profil produsen/pabrik/pengrajin/UMKM sepatu, sandal, atau alas kaki dari teks halaman web berikut.
Balas HANYA JSON valid: {"leads": [{...}]} dengan field:
- company_name: Nama resmi PT / CV / Bengkel / Brand produsen.
- scale: "UMKM", "Menengah", "Besar".
- location: Kota atau Kabupaten (misal: Bandung, Sidoarjo, Tangerang, Mojokerto).
- wilayah: Wilayah/Provinsi sentra produksi.
- address: Alamat lengkap pabrik atau workshop.
- phone_number: Nomor telepon atau WhatsApp kontak bisnis.
- email: Alamat email perusahaan jika ada.
- website: URL situs perusahaan jika ada.
- contact_person: Nama pimpinan / pemilik pabrik / "Pimpinan Perusahaan".
- job_title: Jabatan (Owner, Direktur, Export-Import Manager).
- products: Spesialisasi produksi alas kaki (misal: "Sepatu Olahraga, Sneakers, Safety Shoes, Sandal Kulit, Boots").

Teks sumber:
"""

# Curated Tier-1 Indonesian Corporate Buyers for Industrial Safety Shoes & SaaS Procurement
SEED_CORPORATE_BUYERS = [
    # 1. KONSTRUKSI & EPC (INFRASTRUKTUR & ENERGI)
    {
        "company_name": "PT Wijaya Karya (Persero) Tbk (WIKA)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "Jl. D.I. Panjaitan Kav. 9-10, Cipinang Cempedak, Jatinegara, Jakarta 13340",
        "phone_number": "021-8192808",
        "phone_wa": "628119842808",
        "email": "procurement@wika.co.id",
        "website": "https://eproc.wika.co.id",
        "contact_person": "Tim Procurement & K3 Konstruksi",
        "job_title": "Head of Procurement & HSE Manager",
        "products": "Sepatu Safety K3 Standar SNI, Steel Toe Boots Lapangan, Safety Shoes Proyek Infrastruktur",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.wika.co.id"
    },
    {
        "company_name": "PT Adhi Karya (Persero) Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "Jl. Raya Pasar Minggu Km. 18, Jakarta Selatan 12510",
        "phone_number": "021-7975312",
        "phone_wa": "6281289753120",
        "email": "eproc@adhi.co.id",
        "website": "https://eproc.adhi.co.id",
        "contact_person": "Divisi Pengadaan & SCM",
        "job_title": "Purchasing Manager & HSE Director",
        "products": "Sepatu Safety K3 Konstruksi LRT/MRT, Heavy Duty Safety Boots, APD K3 Proyek",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://adhi.co.id"
    },
    {
        "company_name": "PT PP (Persero) Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "Plaza PP - Wisma Subiyanto, Jl. TB Simatupang No. 57, Pasar Rebo, Jakarta 13760",
        "phone_number": "021-8403883",
        "phone_wa": "628118403883",
        "email": "procurement@pt-pp.com",
        "website": "https://scm.pt-pp.com",
        "contact_person": "Tim SCM & Logistik Proyek",
        "job_title": "Supply Chain & Procurement Manager",
        "products": "Sepatu Safety K3 SNI/EN ISO, Midsole Steel Plate Boots, Safety Shoes Lapangan EPC",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.pt-pp.com"
    },
    {
        "company_name": "PT Hutama Karya (Persero)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "HK Tower, Jl. MT Haryono Kav. 8, Cawang, Jatinegara, Jakarta 13340",
        "phone_number": "021-8193708",
        "phone_wa": "6281281937080",
        "email": "eprocurement@hutamakarya.com",
        "website": "https://eproc.hutamakarya.com",
        "contact_person": "Divisi Pengadaan Barang Tol Trans-Sumatera",
        "job_title": "Head of SCM & K3 Proyek",
        "products": "Sepatu Safety Lapangan Jalan Tol, Safety Boots Tahan Air & Lumpur, Safety Footwear K3",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.hutamakarya.com"
    },
    {
        "company_name": "PT Total Bangun Persada Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Barat",
        "wilayah": "Jakarta",
        "address": "Jl. Letjen S. Parman Kav. 106, Grogol Petamburan, Jakarta 11440",
        "phone_number": "021-5666999",
        "phone_wa": "628155666999",
        "email": "procurement@totalbp.com",
        "website": "https://www.totalbp.com",
        "contact_person": "Divisi Purchasing & K3 Gedung",
        "job_title": "Purchasing Manager & HSE Officer",
        "products": "Sepatu Safety High-Rise Building, Steel Toe Shoes, Sol Anti-Slip Standar K3 Internasional",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.totalbp.com"
    },
    {
        "company_name": "PT Acset Indonusa Tbk (Astra Group)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Jakarta Pusat",
        "wilayah": "Jakarta",
        "address": "Acset Building, Jl. Majapahit No. 26, Petojo Selatan, Gambir, Jakarta 10160",
        "phone_number": "021-3511961",
        "phone_wa": "628113511961",
        "email": "procurement@acset.co",
        "website": "https://www.acset.co",
        "contact_person": "Tim Pengadaan Astra Acset",
        "job_title": "Procurement Manager & EHS Head",
        "products": "Sepatu Safety Pondasi & Konstruksi Berat, Steel Toe Safety Shoes SNI/EN ISO",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.acset.co"
    },
    {
        "company_name": "PT Tripatra Engineers and Constructors",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Tangerang Selatan",
        "wilayah": "Tangerang",
        "address": "Tripatra Building, CBD Bintaro Jaya Sektor 7, Blok B7/A6, Pondok Aren, Tangsel 15224",
        "phone_number": "021-7500701",
        "phone_wa": "6281275007010",
        "email": "eprocurement@tripatra.com",
        "website": "https://www.tripatra.com",
        "contact_person": "Divisi SCM & HSE Oil and Gas EPC",
        "job_title": "Supply Chain Director & HSE Lead",
        "products": "Sepatu Safety Migas & Petrokimia, Sol Tahan Minyak/Kimia/Listrik, Safety Shoes EN ISO 20345",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.tripatra.com"
    },
    {
        "company_name": "PT Petrosea Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Konstruksi & EPC",
        "scale": "Besar",
        "location": "Tangerang Selatan",
        "wilayah": "Tangerang",
        "address": "Indy Bintaro Office Park, Gedung B, Jl. Boulevard Bintaro Jaya Blok B7/A6, Tangsel 15224",
        "phone_number": "021-29770999",
        "phone_wa": "628112977099",
        "email": "procurement@petrosea.com",
        "website": "https://www.petrosea.com",
        "contact_person": "Tim Procurement Tambang & EPC",
        "job_title": "Head of Procurement & Safety (SHE)",
        "products": "Heavy Duty Mining Boots, Sepatu Safety Steel Toe & Puncture Resistant, AP Boots Tambang",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.petrosea.com"
    },

    # 2. PERTAMBANGAN, MINYAK & GAS, DAN ENERGI
    {
        "company_name": "PT Bukit Asam Tbk (PTBA)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Muara Enim / Jakarta",
        "wilayah": "Sumatera",
        "address": "Jl. Parigi No. 1, Tanjung Enim, Muara Enim, Sumatera Selatan 31716",
        "phone_number": "0734-451096",
        "phone_wa": "628117344510",
        "email": "eproc@ptba.co.id",
        "website": "https://eproc.ptba.co.id",
        "contact_person": "Tim Pengadaan APD & K3 Tambang",
        "job_title": "Manager Pengadaan Logistik & K3 Tambang",
        "products": "Sepatu Safety Tambang Batubara, Heavy Duty Leather Boots, Rubber Mining Boots K3",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.ptba.co.id"
    },
    {
        "company_name": "PT Aneka Tambang Tbk (ANTAM)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "Gedung Aneka Tambang, Jl. Letjen TB Simatupang No. 1, Tanjung Barat, Jakarta 12530",
        "phone_number": "021-7891234",
        "phone_wa": "6281278912340",
        "email": "procurement@antam.com",
        "website": "https://eproc.antam.com",
        "contact_person": "Divisi SCM & Pengadaan Operasional",
        "job_title": "VP Procurement & K3 (HSE) Smelter",
        "products": "Sepatu Safety Smelter & Tambang Nikel/Emas, Heat Resistant Boots, Steel Toe K3",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.antam.com"
    },
    {
        "company_name": "PT Vale Indonesia Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Luwu Timur / Jakarta",
        "wilayah": "Sulawesi",
        "address": "Plant Site Sorowako, Luwu Timur, Sulawesi Selatan / The Energy Building Lt. 31 Jakarta",
        "phone_number": "021-5249000",
        "phone_wa": "628115249000",
        "email": "procurement.indonesia@vale.com",
        "website": "https://www.vale.com/indonesia",
        "contact_person": "Tim Procurement & Supply Chain Nikel",
        "job_title": "Procurement Lead & Health and Safety Manager",
        "products": "High Ankle Mining Boots, Sepatu Safety Standar EN ISO, Sol Tahan Kimia Asam/Nikel",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.vale.com"
    },
    {
        "company_name": "PT Freeport Indonesia",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Mimika / Jakarta",
        "wilayah": "Papua",
        "address": "Kuala Kencana, Timika, Papua Tengah / Plaza 89 Lt. 5, Jl. HR Rasuna Said Jakarta",
        "phone_number": "021-2591811",
        "phone_wa": "628112591811",
        "email": "ptfi_supplychain@fmi.com",
        "website": "https://ptfi.co.id",
        "contact_person": "Supply Chain & Underground Safety Division",
        "job_title": "Manager SCM & Underground Mine Safety",
        "products": "Sepatu Safety Tambang Bawah Tanah, Waterproof Mining Boots, Metatarsal Protection Boots",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://ptfi.co.id"
    },
    {
        "company_name": "PT Pamapersada Nusantara (PAMA)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "Jl. Rawagelam 1 No. 9, Kawasan Industri Pulogadung, Jakarta 13930",
        "phone_number": "021-4602015",
        "phone_wa": "6281246020150",
        "email": "supplychain@pamapersada.com",
        "website": "https://eproc.pamapersada.com",
        "contact_person": "Divisi Logistik & Keselamatan Kerja PAMA",
        "job_title": "Purchasing Head & Safety Department Head",
        "products": "Sepatu Safety Kontraktor Tambang, Heavy Duty Boots, AP Boots Safety Tahan Minyak",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://pamapersada.com"
    },
    {
        "company_name": "PT Berau Coal Energy",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Berau / Jakarta",
        "wilayah": "Kalimantan",
        "address": "Jl. Pemuda No. 40, Tanjung Redeb, Berau, Kalimantan Timur 77311",
        "phone_number": "0554-23400",
        "phone_wa": "628115542340",
        "email": "procurement@beraucoal.co.id",
        "website": "https://www.beraucoal.co.id",
        "contact_person": "Divisi SCM & OHS Tambang Batubara",
        "job_title": "Procurement Manager & OHS Head",
        "products": "Sepatu Safety Lapangan Pit Tambang, Steel Toe Boots Anti Air, Sepatu Kerja K3",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.beraucoal.co.id"
    },
    {
        "company_name": "PT Medco Energi Internasional Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "The Energy Building Lt. 53, SCBD Lot 11A, Jl. Jend. Sudirman Kav. 52-53, Jakarta 12190",
        "phone_number": "021-29953000",
        "phone_wa": "628112995300",
        "email": "eprocurement@medcoenergi.com",
        "website": "https://www.medcoenergi.com",
        "contact_person": "Divisi Pengadaan Barang dan Jasa Migas",
        "job_title": "Head of SCM & HSE Manager",
        "products": "Sepatu Safety Rig Pengeboran Migas, Oil & Slip Resistant Safety Shoes, Standar ASTM/SNI",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.medcoenergi.com"
    },
    {
        "company_name": "PT Pertamina Hulu Energi (PHE)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Pertambangan & Energi",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "PHE Tower, Jl. TB Simatupang Kav. 99, Pasar Minggu, Jakarta Selatan 12520",
        "phone_number": "021-29547000",
        "phone_wa": "628112954700",
        "email": "procurement.phe@pertamina.com",
        "website": "https://ip2p.pertamina.com",
        "contact_person": "Fungsi SCM & HSSE Hulu Migas",
        "job_title": "VP Procurement & HSSE Operations Lead",
        "products": "Sepatu Safety Rig Offshore & Onshore, Antistatic Shoes, Boots Tahan Asam & Minyak",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://phe.pertamina.com"
    },

    # 3. AGRIBISNIS, PERKEBUNAN KELAPA SAWIT & PANGAN (F&B)
    {
        "company_name": "PT Astra Agro Lestari Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "Kawasan Industri Pulogadung, Jl. Puloayang Raya Blok OR-1, Jakarta 13930",
        "phone_number": "021-4616555",
        "phone_wa": "6281246165550",
        "email": "procurement@astra-agro.co.id",
        "website": "https://eproc.astra-agro.co.id",
        "contact_person": "Bagian Pengadaan Logistik Kebun & PKS",
        "job_title": "Purchasing Head & Safety Agriculture Lead",
        "products": "Sepatu Boot Karet Safety (AP Boots), Steel Toe Rubber Boots Sawit, Sepatu Kerja Kebun Tahan Duri",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.astra-agro.co.id"
    },
    {
        "company_name": "PT SMART Tbk (Sinar Mas Agribusiness and Food)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Pusat",
        "wilayah": "Jakarta",
        "address": "Sinar Mas Land Plaza Menara II Lt. 30, Jl. MH Thamrin No. 51, Jakarta 10350",
        "phone_number": "021-50338899",
        "phone_wa": "628115033889",
        "email": "procurement@sinarmas-agri.com",
        "website": "https://eproc.smart-tbk.com",
        "contact_person": "Divisi SCM Perkebunan & Pabrik Kelapa Sawit",
        "job_title": "Procurement Manager & EHS Head",
        "products": "Boots Safety Perkebunan Sawit, Sepatu Safety PKS Tahan Minyak Nabati, K3 Boots",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://smart-tbk.com"
    },
    {
        "company_name": "PT Salim Ivomas Pratama Tbk (Indofood Agri)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "Sudirman Plaza Indofood Tower Lt. 11, Jl. Jend. Sudirman Kav. 76-78, Jakarta 12910",
        "phone_number": "021-57958822",
        "phone_wa": "6281257958822",
        "email": "procurement@simp.co.id",
        "website": "https://www.simp.co.id",
        "contact_person": "Tim Pembelian Sarana & APD Kebun",
        "job_title": "Purchasing Manager & K3 Perkebunan",
        "products": "Safety Rubber Boots Tahan Air & Lumpur, Sepatu Kerja Lapangan Sawit, APD K3",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.simp.co.id"
    },
    {
        "company_name": "PT Dharma Satya Nusantara Tbk (DSNG)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Timur",
        "wilayah": "Jakarta",
        "address": "Sapta Mulia Center Lt. 3, Jl. Rawa Gelam V Kav. OR-3B, Kawasan Industri Pulogadung, Jakarta 13930",
        "phone_number": "021-4618135",
        "phone_wa": "628114618135",
        "email": "procurement@dsngroup.co.id",
        "website": "https://www.dsngroup.co.id",
        "contact_person": "Divisi SCM Sawit & Pabrik Kayu",
        "job_title": "Supply Chain Manager & HSE Officer",
        "products": "Sepatu Safety Kayu & PKS, Safety Boots Anti Selip, APD K3 Tenaga Panen",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.dsngroup.co.id"
    },
    {
        "company_name": "PT Mayora Indah Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Barat / Tangerang",
        "wilayah": "Jakarta",
        "address": "Gedung Mayora, Jl. Tomang Raya No. 21-23, Tomang, Grogol Petamburan, Jakarta 11440",
        "phone_number": "021-5655320",
        "phone_wa": "6281256553200",
        "email": "purchasing.mro@mayora.co.id",
        "website": "https://www.mayoraindah.co.id",
        "contact_person": "Tim Purchasing MRO & Plant Safety",
        "job_title": "MRO Purchasing Manager & HSE Food Plant",
        "products": "Sepatu Safety Higienis Pabrik Makanan, White Safety Boots, Sol Anti-Slip Tahan Minyak/Air",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.mayoraindah.co.id"
    },
    {
        "company_name": "PT Indofood CBP Sukses Makmur Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Perkebunan & Sawit",
        "scale": "Besar",
        "location": "Jakarta Selatan",
        "wilayah": "Jakarta",
        "address": "Sudirman Plaza Indofood Tower Lt. 23, Jl. Jend. Sudirman Kav. 76-78, Jakarta 12910",
        "phone_number": "021-57958822",
        "phone_wa": "628115795882",
        "email": "procurement.icbp@indofood.co.id",
        "website": "https://eproc.indofood.com",
        "contact_person": "Fungsi Purchasing & Industrial Safety",
        "job_title": "General Procurement Manager & HSE Head",
        "products": "Sepatu Safety Food Grade, Non-Marking Safety Shoes, Steel Toe Boots Pabrik Manufaktur Pangan",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.indofoodcbp.com"
    },

    # 4. LOGISTIK, PELABUHAN, DAN MANUFAKTUR BERAT
    {
        "company_name": "PT Samudera Indonesia Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Jakarta Barat",
        "wilayah": "Jakarta",
        "address": "Samudera Indonesia Building, Jl. Letjen S. Parman Kav. 35, Slipi, Palmerah, Jakarta 11480",
        "phone_number": "021-5480088",
        "phone_wa": "628115480088",
        "email": "procurement@samudera.id",
        "website": "https://www.samudera.id",
        "contact_person": "Bagian SCM & Keselamatan Operasional Pelabuhan",
        "job_title": "Procurement Manager & Port Safety Lead",
        "products": "Sepatu Safety Pelabuhan & Bongkar Muat, Steel Toe Heavy Shoes, Anti-Slip Deck Boots",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.samudera.id"
    },
    {
        "company_name": "PT Krakatau Steel (Persero) Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Cilegon",
        "wilayah": "Tangerang",
        "address": "Jl. Industri No. 5, Kotabumi, Purwakarta, Cilegon, Banten 42435",
        "phone_number": "0254-392159",
        "phone_wa": "6281225439215",
        "email": "pengadaan@krakatausteel.com",
        "website": "https://eproc.krakatausteel.com",
        "contact_person": "Divisi Pengadaan Barang Fabrikasi Baja",
        "job_title": "VP Procurement & K3 Pabrik Baja",
        "products": "Sepatu Safety Tahan Panas Baja / Slag, Steel Toe & Steel Midsole Boots K3 SNI/EN ISO",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.krakatausteel.com"
    },
    {
        "company_name": "PT Semen Indonesia (Persero) Tbk (SIG)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Jakarta Selatan / Tuban",
        "wilayah": "Jakarta",
        "address": "South Quarter Tower A Lt. 19-20, Jl. RA Kartini Kav. 8, Cilandak Barat, Jakarta 12430",
        "phone_number": "021-5261174",
        "phone_wa": "628115261174",
        "email": "procurement@sig.id",
        "website": "https://procurement.sig.id",
        "contact_person": "Divisi SCM & Logistik Pabrik Semen",
        "job_title": "Head of SCM & OHS Director",
        "products": "Sepatu Safety Pabrik Semen & Tambang Batu Kapur, Heavy Duty Boots K3, Sol Tahan Gesek",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.sig.id"
    },
    {
        "company_name": "PT Indocement Tunggal Prakarsa Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Bogor",
        "wilayah": "Bogor",
        "address": "Pabrik Citeureup, Jl. Mayor Oking Jaya Atmaja, Citeureup, Bogor 16810",
        "phone_number": "021-8754343",
        "phone_wa": "6281287543430",
        "email": "procurement@indocement.co.id",
        "website": "https://eproc.indocement.co.id",
        "contact_person": "Bagian Pengadaan MRO & K3 Semen Tiga Roda",
        "job_title": "Purchasing Manager & Safety Department Head",
        "products": "Sepatu Safety Industri Semen, Steel Toe Shoes, Rubber Boots Tahan Debu & Tekanan",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://indocement.co.id"
    },
    {
        "company_name": "PT Barata Indonesia (Persero)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Gresik",
        "wilayah": "Surabaya",
        "address": "Jl. Veteran No. 241, Gresik, Jawa Timur 61123",
        "phone_number": "031-3981580",
        "phone_wa": "628113981580",
        "email": "procurement@barata.id",
        "website": "https://eproc.barata.id",
        "contact_person": "Divisi Pengadaan Workshop Manufaktur Berat",
        "job_title": "Manager Pengadaan & K3 Manufaktur",
        "products": "Sepatu Safety Bengkel Fabrikasi Logam, Steel Toe Safety Shoes, Sol Tahan Minyak/Gram Besi",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://barata.id"
    },
    {
        "company_name": "PT Industri Kereta Api (INKA) (Persero)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Madiun",
        "wilayah": "Jawa Timur",
        "address": "Jl. Yos Sudarso No. 71, Madiun, Jawa Timur 63122",
        "phone_number": "0351-455241",
        "phone_wa": "6281235145524",
        "email": "pengadaan@inka.co.id",
        "website": "https://eproc.inka.co.id",
        "contact_person": "Divisi Pengadaan Fasilitas Manufaktur Kereta",
        "job_title": "Head of Procurement & Safety Lead",
        "products": "Sepatu Safety Perakitan Kereta Api, Steel Toe Boots, Sepatu Kerja K3 Pabrik",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.inka.co.id"
    },
    {
        "company_name": "PT PAL Indonesia (Persero)",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Logistik & Manufaktur Berat",
        "scale": "Besar",
        "location": "Surabaya",
        "wilayah": "Surabaya",
        "address": "Ujung, Semampir, PO BOX 1134, Surabaya 60155",
        "phone_number": "031-3292275",
        "phone_wa": "628113292275",
        "email": "procurement@pal.co.id",
        "website": "https://eproc.pal.co.id",
        "contact_person": "Divisi SCM & Galangan Kapal K3",
        "job_title": "VP Procurement & K3 Galangan Kapal",
        "products": "Sepatu Safety Galangan Kapal / Shipyard, Sol Tahan Air Laut & Slip, Metatarsal Guard Shoes",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://pal.co.id"
    },

    # 5. RUMAH SAKIT, FARMASI, & PENGELOLAAN FASILITAS
    {
        "company_name": "PT Siloam International Hospitals Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Rumah Sakit & Fasilitas",
        "scale": "Besar",
        "location": "Tangerang",
        "wilayah": "Tangerang",
        "address": "Gedung Fakultas Kedokteran UPH Lt. 32, Jl. Boulevard Jend. Sudirman Lippo Village, Tangerang 15811",
        "phone_number": "021-25668000",
        "phone_wa": "6281225668000",
        "email": "procurement@siloamhospitals.com",
        "website": "https://www.siloamhospitals.com",
        "contact_person": "Divisi SCM Medis & Fasilitas Rumah Sakit",
        "job_title": "Procurement Manager & Hospital HSE Officer",
        "products": "Sepatu Medis / Clogs Higienis, Sepatu Safety Khusus Petugas Pemeliharaan RS (MEP & Laundry)",
        "score": 90,
        "kategori": "Hot",
        "source_url": "https://www.siloamhospitals.com"
    },
    {
        "company_name": "PT Kalbe Farma Tbk",
        "segment": "Segmen A: Buyer Korporat",
        "industry": "Rumah Sakit & Fasilitas",
        "scale": "Besar",
        "location": "Jakarta Pusat",
        "wilayah": "Jakarta",
        "address": "Gedung KALBE, Jl. Let. Jend. Suprapto Kav. 4, Cempaka Putih, Jakarta 10510",
        "phone_number": "021-42873888",
        "phone_wa": "628114287388",
        "email": "procurement@kalbe.co.id",
        "website": "https://www.kalbe.co.id",
        "contact_person": "Divisi Purchasing MRO & K3 Pabrik Farmasi",
        "job_title": "Head of Corporate Procurement & EHS",
        "products": "Cleanroom Safety Shoes, Antistatic ESD Shoes, Sepatu K3 Fasilitas Manufaktur Farmasi",
        "score": 95,
        "kategori": "Hot",
        "source_url": "https://www.kalbe.co.id"
    }
]


def clean_json_str(s: str) -> str:
    s = s.strip()
    if s.startswith("```"):
        s = re.sub(r"^```[a-zA-Z]*\n", "", s)
        s = re.sub(r"\n```$", "", s)
    return s.strip()


def scrape_url_for_buyers(url: str, default_industry: str = "Konstruksi & EPC") -> list[dict]:
    """Mengambil halaman web dan mengekstrak leads Segmen A via Gemini API."""
    print(f"[*] Mengunduh dan menganalisis halaman: {url}...")
    try:
        r = httpx.get(url, headers=UA, timeout=15, follow_redirects=True)
        if r.status_code != 200:
            print(f"  [!] Gagal mengambil {url}: HTTP {r.status_code}")
            return []
        html = r.text
    except Exception as e:
        print(f"  [!] Error fetch: {e}")
        return []

    soup = BeautifulSoup(html, "html.parser")
    for t in soup(["script", "style", "noscript", "svg", "iframe"]):
        t.decompose()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("tel:", "mailto:", "https://wa.me", "https://api.whatsapp")):
            a.append(f" [{href}]")
    text = soup.get_text("\n")
    cleaned_text = re.sub(r"\n\s*\n+", "\n", text).strip()[:25000]

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("  [!] GEMINI_API_KEY tidak ditemukan di .env!")
        return []

    is_manufacturer = default_industry == "Manufaktur Alas Kaki"
    prompt_to_use = PROMPT_SEGMENT_B if is_manufacturer else PROMPT_SEGMENT_A

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt_to_use + cleaned_text,
            config={"response_mime_type": "application/json", "temperature": 0}
        )
        raw = clean_json_str(resp.text or "")
        if not raw:
            return []
        parsed = json.loads(raw)
        items = parsed if isinstance(parsed, list) else parsed.get("leads", [])

        results = []
        for item in items:
            comp = str(item.get("company_name", "")).strip()
            if not comp:
                continue

            if is_manufacturer:
                item["segment"] = "Segmen B: Manufaktur Sepatu"
                item["industry"] = "Manufaktur Alas Kaki"
                if not item.get("job_title"):
                    item["job_title"] = "Owner / Export Director"
                if not item.get("contact_person"):
                    item["contact_person"] = f"Pimpinan {comp}"
            else:
                item["segment"] = "Segmen A: Buyer Korporat"
                if not item.get("industry"):
                    item["industry"] = default_industry
                if not item.get("job_title"):
                    item["job_title"] = "Head of Procurement / HSE Manager"
                if not item.get("contact_person"):
                    item["contact_person"] = "Tim Procurement & K3"

            if not item.get("source_url"):
                item["source_url"] = url
            results.append(item)

        print(f"  [+] Berhasil mengekstrak {len(results)} leads dari {url}.")
        return results
    except Exception as e:
        print(f"  [!] Error Gemini extraction: {e}")
        return []


def insert_or_update_lead(lead_data: dict) -> bool:
    """Menyimpan atau memperbarui lead korporat ke database SQLite."""
    conn = database.get_db_connection()
    cursor = conn.cursor()

    comp = str(lead_data.get("company_name", "")).strip()
    if not comp:
        conn.close()
        return False

    cursor.execute("SELECT id FROM leads WHERE company_name = ?", (comp,))
    existing = cursor.fetchone()

    phone_raw = str(lead_data.get("phone_number", "")).strip()
    phone_wa_raw = str(lead_data.get("phone_wa", "")).strip() or phone_raw
    phone_clean = database.extract_indonesia_mobile(phone_wa_raw)
    if not phone_clean and phone_wa_raw.startswith("628"):
        phone_clean = re.sub(r"\D", "", phone_wa_raw)

    is_wa = 1 if (phone_clean and phone_clean.startswith("628")) else 0
    phone_display = database.format_phone_display(phone_clean) if is_wa else phone_raw

    scale = str(lead_data.get("scale", "Besar")).strip()
    loc = str(lead_data.get("location", "")).strip()
    wil = str(lead_data.get("wilayah", "")).strip()
    addr = str(lead_data.get("address", "")).strip()
    email = str(lead_data.get("email", "")).strip()
    website = str(lead_data.get("website", "")).strip()
    products = str(lead_data.get("products", "Sepatu Safety K3 SNI/EN ISO")).strip()
    segment = lead_data.get("segment", "Segmen A: Buyer Korporat")
    industry = lead_data.get("industry", "Konstruksi & EPC")
    contact_person = lead_data.get("contact_person", "Tim Procurement & K3")
    job_title = lead_data.get("job_title", "Head of Procurement")
    linkedin = lead_data.get("linkedin_url", "")
    score = lead_data.get("score", 95)
    kat = lead_data.get("kategori", "Hot")
    src = lead_data.get("source_url", "Direktori Korporat B2B")

    if existing:
        lead_id = existing[0]
        cursor.execute("""
        UPDATE leads 
        SET segment = ?, industry = ?, contact_person = ?, job_title = ?,
            products = ?, score = ?, kategori = ?, source_url = ?,
            scale = COALESCE(NULLIF(scale, ''), ?),
            location = COALESCE(NULLIF(location, ''), ?),
            wilayah = COALESCE(NULLIF(wilayah, ''), ?),
            address = COALESCE(NULLIF(address, ''), ?),
            phone_number = COALESCE(NULLIF(phone_number, ''), ?),
            phone_wa = COALESCE(NULLIF(phone_wa, ''), ?),
            phone_wa_display = COALESCE(NULLIF(phone_wa_display, ''), ?),
            is_wa_valid = MAX(is_wa_valid, ?),
            email = COALESCE(NULLIF(email, ''), ?),
            website = COALESCE(NULLIF(website, ''), ?),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (
            segment, industry, contact_person, job_title, products, score, kat, src,
            scale, loc, wil, addr, phone_raw, phone_clean, phone_display, is_wa, email, website,
            lead_id
        ))
    else:
        cursor.execute("""
        INSERT INTO leads (
            company_name, scale, location, wilayah, address, phone_number,
            phone_wa, phone_wa_display, is_wa_valid, email, website, products,
            score, kategori, source_url, outreach_status, follow_up_notes,
            segment, industry, contact_person, job_title, linkedin_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum Dihubungi', '', ?, ?, ?, ?, ?)
        """, (
            comp, scale, loc, wil, addr, phone_raw,
            phone_clean, phone_display, is_wa, email, website, products,
            score, kat, src, segment, industry, contact_person, job_title, linkedin
        ))

    conn.commit()
    conn.close()
    return True


def seed_all_corporate_buyers():
    """Mengimpor seluruh data perusahaan korporat Tier-1 ke database leads."""
    database.init_db()
    total_added = 0
    print(f"[*] Memulai seeding {len(SEED_CORPORATE_BUYERS)} Buyer Korporat Tier-1 ke leads.db...")
    for buyer in SEED_CORPORATE_BUYERS:
        if insert_or_update_lead(buyer):
            total_added += 1

    print(f"[✓] Berhasil memproses {total_added} Buyer Korporat & Industri!")
    stats = database.get_stats()
    print("\nRingkasan Database Saat Ini:")
    print(f"- Total Leads: {stats['total_leads']}")
    print(f"- Distribusi Segmen: {stats['by_segment']}")
    print(f"- Distribusi Industri: {stats['by_industry']}")


def export_corporate_leads():
    """Mengekspor leads Segmen A ke file CSV dan Excel di folder output."""
    out_dir = ROOT / "output"
    out_dir.mkdir(exist_ok=True)
    df = database.export_leads_df(segment="Segmen A: Buyer Korporat")

    date_str = datetime.now().strftime("%Y%m%d")
    csv_file = out_dir / f"leads_buyer_korporat_safety_{date_str}.csv"
    xlsx_file = out_dir / f"leads_buyer_korporat_safety_{date_str}.xlsx"

    df.to_csv(csv_file, index=False, encoding="utf-8-sig")
    with pd.ExcelWriter(xlsx_file, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Buyer Korporat")

    print(f"[✓] File export Segmen A tersimpan di:")
    print(f"  - CSV: {csv_file}")
    print(f"  - Excel: {xlsx_file}")


def main():
    parser = argparse.ArgumentParser(description="Scraper & Lead Harvester Segmen A: Buyer Korporat Safety Shoes & SaaS")
    parser.add_argument("--seed", action="store_true", help="Seeding curated Tier-1 Indonesian corporate buyers")
    parser.add_argument("--scrape", type=str, help="Scrape live URL web direktori/kontraktor")
    parser.add_argument("--industry", type=str, default="Konstruksi & EPC", help="Kategori industri untuk URL yang discrape")
    parser.add_argument("--export", action="store_true", help="Export Segmen A ke CSV dan Excel")
    parser.add_argument("--stats", action="store_true", help="Lihat statistik leads saat ini")

    args = parser.parse_args()

    if len(sys.argv) == 1 or args.seed:
        seed_all_corporate_buyers()
        export_corporate_leads()
    elif args.scrape:
        leads = scrape_url_for_buyers(args.scrape, default_industry=args.industry)
        for lead in leads:
            insert_or_update_lead(lead)
        export_corporate_leads()
    elif args.export:
        export_corporate_leads()
    elif args.stats:
        stats = database.get_stats()
        print(json.dumps(stats, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
