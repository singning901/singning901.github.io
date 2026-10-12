@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE=C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"

if not defined NODE (
  echo.
  echo   找不到 Node.js，无法启动管理面板。
  echo.
  pause
  exit /b 1
)

"%NODE%" "%~dp0admin\server.mjs"
echo.
echo   管理面板已停止。
pause
