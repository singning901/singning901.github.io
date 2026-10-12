@echo off
chcp 65001 >nul
title 留白 · 网站管理
setlocal
cd /d "%~dp0"

echo.
echo   留白 · 网站管理程序
echo   ============================================
echo.

set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE=C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE (
  echo   找不到 Node.js，无法启动。
  echo.
  pause
  exit /b 1
)

echo   正在启动，浏览器会自动打开……
echo.
echo   （这个黑窗口不要关，关掉就等于退出程序）
echo.

"%NODE%" "%~dp0admin\server.mjs"

echo.
echo   程序已退出。
pause
