#!/bin/bash
node ./edit_offices.js
echo .
echo Déploiement de la mise à jour...
cd ..
npm run build
read -p "Appuyez sur Entrée pour fermer..."