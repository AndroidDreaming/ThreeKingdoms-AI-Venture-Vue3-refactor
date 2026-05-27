@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\package-prebuilt.ps1" -PackageName three-kingdoms-lightweight
if errorlevel 1 (
  echo.
  echo Packaging failed.
  exit /b 1
)
echo.
echo Lightweight deployment zip created in the three-kingdoms-upload directory.
