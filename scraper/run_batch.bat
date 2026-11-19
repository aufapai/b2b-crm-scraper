@echo off
setlocal
cd /d "%~dp0"
set "PLAYWRIGHT_BROWSERS_PATH=%~dp0..\tools\ms-playwright"
"%~dp0.venv\Scripts\python.exe" "%~dp0generate_leads.py" %*
