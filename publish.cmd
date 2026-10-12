@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ---------- locate git ----------
set "GIT_EXE="
where git >nul 2>nul && set "GIT_EXE=git"
if not defined GIT_EXE (
  for %%P in (
    "%USERPROFILE%\tools\PortableGit\cmd\git.exe"
    "%ProgramFiles%\Git\cmd\git.exe"
    "%LOCALAPPDATA%\Programs\Git\cmd\git.exe"
  ) do if not defined GIT_EXE if exist %%P set "GIT_EXE=%%~P"
)

rem ---------- locate node ----------
set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE (
  set "DSH_NODE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
  if exist "!DSH_NODE!" set "NODE_EXE=!DSH_NODE!"
)

if not defined GIT_EXE  ( echo [ERROR] git not found.   & pause & exit /b 1 )
if not defined NODE_EXE ( echo [ERROR] node not found.  & pause & exit /b 1 )

echo ============================================
echo  1/3  Saving source to the [src] branch
echo ============================================
"%GIT_EXE%" add -A
"%GIT_EXE%" commit -m "Update source" 2>nul
"%GIT_EXE%" push -u origin src
if errorlevel 1 ( echo [ERROR] source push failed. & pause & exit /b 1 )

echo.
echo ============================================
echo  2/3  Building the static site
echo ============================================
"%NODE_EXE%" "%~dp0node_modules\hexo\bin\hexo" clean
"%NODE_EXE%" "%~dp0node_modules\hexo\bin\hexo" generate
if errorlevel 1 ( echo [ERROR] build failed. & pause & exit /b 1 )

echo.
echo ============================================
echo  3/3  Publishing to the [main] branch
echo ============================================
"%NODE_EXE%" "%~dp0node_modules\hexo\bin\hexo" deploy
if errorlevel 1 ( echo [ERROR] deploy failed. & pause & exit /b 1 )

echo.
echo Done. https://singning901.github.io should update in a minute or two.
pause
