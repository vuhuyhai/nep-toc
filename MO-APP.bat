@echo off
chcp 65001 >nul
title NEP TOC - Mo app
cd /d "%~dp0nep-toc-app"

echo.
echo   NEP TOC - Tin nganh Toc ^& Van hanh salon
echo   --------------------------------------
echo   Dang mo app o http://localhost:8095
echo   Bam Ctrl + C de dung.
echo.

start "" http://localhost:8095
node may-chu.js 8095
pause
