@echo off
setlocal
cd /d "%~dp0"

rem Prefer a system node; fall back to the DSH bundled runtime.
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

echo Starting local preview at http://localhost:4000/  (Ctrl+C to stop)
"%NODE_EXE%" "%~dp0node_modules\hexo\bin\hexo" server --port 4000
pause
