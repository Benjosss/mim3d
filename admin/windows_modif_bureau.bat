@echo off
cd /d "%~dp0"
node ./edit_offices.js

echo.
echo Déploiement de la mise à jour...
cd ..
npm run build
pause