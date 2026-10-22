@echo off
cd /d "%~dp0"
docker compose ps
docker compose logs --tail 10 agent
pause
