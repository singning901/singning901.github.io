@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE (
  set "DSH_NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
  if exist "%DSH_NODE%" set "NODE_EXE=%DSH_NODE%"
)

if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Install Node.js 20+ or run this from DSH.
  pause
  exit /b 1
)

echo Building static site into public\ ...
"%NODE_EXE%" "%~dp0node_modules\hexo\bin\hexo" generate
pause
