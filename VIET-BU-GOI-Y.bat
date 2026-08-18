@echo off
chcp 65001 >nul
title NEP TOC - Viet bu goi y content
cd /d "%~dp0nep-toc-app"

echo.
echo   NEP TOC - Viet bu goi y content cho kho dang co
echo   -------------------------------------------------
echo   KHONG quet tin moi. Chi viet tiep goi y cho nhung bai
echo   con thieu. Dung khi kho con nhieu bai chua co cau mo bai.
echo.
echo   Moi lan chay lam toi da 150 bai. Kho con nhieu thi chay
echo   lai nhieu lan, bai da xong khong bi lam lai.
echo.

if "%ANTHROPIC_API_KEY%"=="" (
  echo   [!] Chua dat ANTHROPIC_API_KEY. Khong chay duoc buoc nay.
  echo       Dat mot lan bang lenh:  setx ANTHROPIC_API_KEY "sk-ant-..."
  echo       Roi mo lai cua so nay.
  pause
  exit /b 1
)

set CHI_DICH=1
set MAX_PHANTICH=150
node thu-thap.js
echo.
echo   Xong. Bam MO-APP.bat de xem.
pause
