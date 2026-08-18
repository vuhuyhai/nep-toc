@echo off
chcp 65001 >nul
title NEP TOC - Cap nhat tin
cd /d "%~dp0nep-toc-app"

echo.
echo   NEP TOC - Quet tin moi va viet goi y content
echo   ---------------------------------------------
echo   Viec nay mat vai phut. Reddit chan toc do nen bo quet
echo   phai nghi 22 giay giua moi lan goi, dung tuong no treo.
echo.

if "%ANTHROPIC_API_KEY%"=="" (
  echo   [!] Chua dat ANTHROPIC_API_KEY.
  echo       Van quet duoc tin, nhung KHONG co goi y content.
  echo       Dat mot lan bang lenh:  setx ANTHROPIC_API_KEY "sk-ant-..."
  echo       Roi mo lai cua so nay.
  echo.
)

node thu-thap.js
echo.
echo   Xong. Bam MO-APP.bat de xem.
pause
