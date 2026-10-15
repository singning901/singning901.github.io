@echo off
chcp 65001 >nul
title Liubai Website Manager
setlocal
cd /d "%~dp0"

set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" set "NODE=C:\Users\singning\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE goto NONODE

"%NODE%" "%~dp0admin\server.mjs"

echo.
echo   Manager stopped.
pause
exit /b 0

:NONODE
echo.
echo   Node.js not found. Cannot start the manager.
echo.
pause
exit /b 1