#!/bin/bash
node ./edit_zones.js
echo .
echo Deploiement de la mise à jour...
cd ..
npm run build
read -p "Appuyez sur Entree pour fermer..."