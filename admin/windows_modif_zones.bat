@echo off
cd /d "%~dp0"
node ./edit_zones.js

echo .
echo Deploiement de la mise à jour...
cd ..
npm run build
pause