@echo off
rem Critical Minerals Desk 桌面端启动器
cd /d "%~dp0"
set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
start "" "%APPDIR%\node_modules\electron\dist\electron.exe" "%APPDIR%"
