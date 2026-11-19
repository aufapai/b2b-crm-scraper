@echo off
chcp 65001 >nul
title HOTs Trading - Shoe Leads CRM dan WhatsApp Outreach Launcher
color 0A

:: Pastikan selalu berjalan di direktori script ini berada
cd /d "%~dp0"

echo =======================================================================
echo    HOTS TRADING - LEADS DATABASE DAN WHATSAPP OUTREACH CRM
echo =======================================================================
echo.

set "PY_BIN="

if exist "%~dp0scraper\.venv\Scripts\python.exe" (
    set "PY_BIN=%~dp0scraper\.venv\Scripts\python.exe"
) else if exist "%~dp0.venv\Scripts\python.exe" (
    set "PY_BIN=%~dp0.venv\Scripts\python.exe"
) else (
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        set "PY_BIN=python"
    ) else (
        where py >nul 2>nul
        if %errorlevel% equ 0 (
            set "PY_BIN=py"
        )
    )
)

if "%PY_BIN%"=="" (
    color 0C
    echo [ERROR] Python tidak ditemukan!
    pause
    exit /b 1
)

echo [OK] Menjalankan server CRM...
"%PY_BIN%" app.py

if %errorlevel% neq 0 (
    pause
)
