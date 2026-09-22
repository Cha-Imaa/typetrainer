@echo off
rem Optional launcher: serves TypeTrainer 3 over http (nicer for DevTools).
rem Double-clicking index.html directly also works.
cd /d "%~dp0"
start "" http://localhost:8125
python -m http.server 8125
