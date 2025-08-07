@echo off
cd /d "%~dp0"
title Servidor Controle de Editais

echo Iniciando servidor Flask...
start "Flask Server" python server.py

rem dá um tempinho pro Flask subir
timeout /t 2 /nobreak >nul

echo Abrindo browser em http://localhost:8000/index.html
start "" "http://localhost:8000/index.html"

echo Pressione CTRL+C na janela do servidor para parar.
pause
