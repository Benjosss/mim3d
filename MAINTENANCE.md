<img src="public/images/favicon.png" alt="logo" width="200"/>  

# Maintenance et mise à jour du projet MIM3D

## Prérequis :

Pour les mises à jour autres que les modifications du fichier `public/data/zones.json` il vaut mieux :
- Pouvoir faire tourner le projet en local (lire `INSTALLATION.md`)
- Avoir lu le rapport de stage concernant ce projet
- Ne pas envoyer les modifications sur le repo Github si les modifications ne sont pas validées
- Disposer du projet source VIRTUOMIM sur Unreal Engine et de Blender pour la modification des fichiers 3D.
- Avoir Python installé sur sa machine.
- Être sûr de ce qu'on fait :)


## Sommaire :

> 1. Modifier les occupants des bureaux/laboratoires  
> 2. Modifier le fichier `public/data/zones.json`  
> 3. Modifier les modèles 3D  
> a. Modifier le modèle du personnage  
> b. Modifier le modèle du navmesh  
> c. Modifier les modèles 3D     

---

## 1. Modifier les occupants des bureaux et laboratoires

Dans le dossier `admin/` deux scripts sont disponibles : un pour Linux, l'autre pour Windows.  
Ces scripts permettent d'accéder à une interface en ligne de commande (CLI) permettant de faire des actions
de modifications sur les personnes occupants les bureaux de l'UFR.

### Linux :

```bash
cd ~/mim3d
bash ./admin/linux_modif_zones.sh
```

### Windows : 

```cmd
cd /mim3d/admin
windows_modif_zones.bat
```

Ou double-cliquer sur le `.bat`

### Autre :

Utiliser directement le script source Javascript :

```bash
cd mim3d/admin
node edit_zones.js
```

---

## 2. Modifier le fichier `public/data/zones.json`

Ce fichier est présent à : `public/data/zones.json`

### Structure : 

#### Structure des zones `corridor` ou `stairs` (couloir ou escalier) :

```json
{
    "name": "floor-1",                                                      // Nom technique de la zone 
    "displayName": "Rez-de-jardin, aile B",                                 // Nom affiché de la zone
    "path": "/models/zones/-1_floor_aisle_b_sized.glb",                     // Chemin de modèle 3D de la zone (avec boite de collision)
    "impostorPath" : "/models/impostors/imp_-1_floor_aisle_b_sized.glb",    // Chemin du modèle 3D imposteur de la zone (sans collisions)
    "physics" : true,                                                       // Booléen gestion des collisions - NE PAS MODIFIER
    "type": "corridor",                                                     // Type de zone
    "description" : "Rez de jardin aile b",                                 // Description de la zone
    "adjacentZoneNames": ["floor0", "stairs0to-1_1", "allstairs_1", "allstairs_2", "allstairs_3", "floor-1hall"], // Zone adjacentes
    "triggerBox": {                                                         // Boite englobante de la zone
      "min": [56.320, -0.200, -69.797],
      "max": [87.549, 4.006, -9.059]
    }
  }
```

#### Structure des salles `CM`, `TD`, `TP`, `toilets`, `misc` (CM, TD, TP, toilettes, divers) :

```json
{
    "name": "Caféteria CROUS",                                              // Nom technique de la zone 
    "displayName":  "Caféteria CROUS",                                      // Nom affiché de la zone
    "path": "/models/furnitures/fur_cafeteria_sized.glb",                   // Chemin de modèle 3D du mobilier de la salle
    "impostorPath" : "",                                                    // Pas d'imposteur (non chargé quand joueur en dehors de la zone)
    "physics" : false,                                                      // Pas de collions pour le mobilier - NE PAS MODIFIER
    "type": "misc",                                                         // Type de zone
    "description" : "Caféteria du CROUS",                                   // Description de la zone
    "adjacentZoneNames": [],                                                // Pas de zones adjacentes
    "triggerBox": {                                                         // Boite englobante de la salle
      "min": [71.7541, 4.18376, -22.73291],
      "max": [88.74828, 7.67197, -11.19636]
    },
    "pathCoords" : [83.08, 2.651, -19.25]                                   // Coordonnées d'arrivée de la navigation automatique
  }
```

#### Structure des salles `office` (bureau) :

```json
{
    "name": "LCOMS",                                                       // Nom technique de la zone
    "displayName":  "LCOMS",                                               // Nom affiché de la zone
    "path": "/models/furnitures/fur_lcoms_sized.glb",                      // Chemin du modèle 3D du mobilier de la salle
    "impostorPath" : "",                                                   // Pas d'imposteur (non chargé quand joueur en dehors de la zone)
    "physics" : false,                                                     // Pas de collions pour le mobilier - NE PAS MODIFIER
    "type": "office",                                                      // Type de zone
    "description" : "Laboratoire de Conception, Optimisation et Modélisation des Systèmes - Zone réglementée", // Description de la zone
    "persons" : [                                                          // Nom, prénom et fonction des occupants du bureau (1 ou plus)
      {"name": "LANUEL Yann", "function": "MCF"},
      {"name": "MINICH Sarah", "function": "MCF"},
      {"name": "LUCARELLI Giorgio", "function": "MCF"}
    ],
    "adjacentZoneNames": [],                                              // Pas de zones adjacentes
    "triggerBox": {                                                       // Boite englobante de la salle
      "min": [49.226, 11.008, -34.390],
      "max": [56.113, 14.490, -31.602]
    },
    "pathCoords" : [52.50, 12.75, -32.91]                                 // Coordonnées d'arrivée de la navigation automatique
  }
```

> ### ATTENTION ! Plusieurs points sont à prendre en considération :
> - Le système de zones adjacentes est décrit dans le rapport de stage, il est utilisé pour le chargement et l'affichage 
> des zones `corridor` et `stairs`. Cela fonctionne comme une matrice d'adjacence, elle doit rester totalement symétrique.  
> Chaque zone qui en déclare une autre dans sa liste doit être elle-même déclarée dans la liste de l'autre. Le fichier 
> `public/data/adjacencyMatrix.html` permet de vérifier l'intégrité de la matrice d'adjacence, il suffit de l'ouvrir 
> dans un navigateur.  
> <br>
> - De la même façon, le système d'imposteur (zones lointaines dont la physique n'est plus chargée pour optimiser 
> les performances) n'est utilisé que pour les zones `corridor` et `stairs`.  
> <br>
> - Pour obtenir les coordonnées des boites englobantes, rentrer le modèle seul dans le site https://gltf.report/. 
> Les coordonées sont affichées dans l'onglet `Metadata` sous le nom de `BBOX_MIN` et `BBOX_MAX`. 
> Ces boîtes sont visibles en mode `DEBUG` et permettent de charger/décharger les zones et mobilier.  
> <br>
> - Les coordonées d'arrivée de la navigation automatique sont disponibles en bas à droite de l'écran en activant 
> le mode DEBUG puis en se rendant à l'endroit voulu ` !! dans la zone !!`.  
> <br>
> - Pour les bureaux dont le mobilier n'est pas modéliser, charger le fichier `public/models/furnitures/blob.glb`.

Chaque modification doit être testée à l'issue.

---

## 3. Modifier les modèles 3D 

C'est de loin la partie la plus fastidieuse. Tous les modèles sont disponibles dans `public/models`.

### a. Modifier le modèle du personnage :

- Attention à bien nommer toutes les parties corporelles, il faut absolument les parties `'head', 'hair' et 'eyes'` 
car elles sont cachées dans le code.

- Les animations doivent, elles aussi, être nommées `'walk', 'idle' et 'pointing'`.

Je conseille le site https://www.mixamo.com/

### b. Modifier le modèle du navmesh :

Nécessaire après toute modification de collisions (ouverture/fermeture de portes dans les modèles 3D).

- Le navmesh a été réaliser grâce au site https://navmesh.isaacmason.com/. Il faut charger le bâtiment complet et 
bien régler les différents paramètres, un post-traitement dans Blender sera nécessaire pour combler les trous dans le
maillage.

### c. Modifier les modèles 3D :

Les détails techniques du workflow sont disponibles dans le rapport de stage.

#### Workflow :
1. Exporter la zone en `GLB` (murs, sols, plafonds, portes, fenêtres, ...) depuis Unreal Engine, 
avec les textures au format `JPEG` dans un dossier sur votre machine. Format `NOM_ZONE.glb`.  
<br>
2. Ouvrir le fichier dans Blender et supprimer tous les éléments non voulus.  
<br>
3. Installer les deux add-ons présents dans `admin/blender` dans le logiciel.  
<br>
4. Pour les zones de type `corridor` et `stairs` qui doivent gérer les collisions, sélectionner tous les objets que le
joueur ne doit pas pouvoir traverser (murs, sols, portes surtout). 
Placer sa souris dans le Viewport et faire `alt+S`. Ceci va créer une boite de 
collision simplifiée composé d'un seul matériau et la renommer en `SIMP_COL` qui va être gérée par le code.  
<br>
5. Sélectionner tous les objets à part `SIMP_COL` et remettre sa souris dans le Viewport et faire `alt+N`. Ceci va
renommer les maillages et matériaux avec le préfixe `NO_COL` qui vont être gérés dans le code.  
<br>
6. Exporter d'abord l'objet `SIMP_COL` seul en .glb dans le format `simp_col_NOM_ZONE.glb`
(Cocher `Include : Limit to selected objects`).  
<br>
7. De la même façon, exporter les objets `NO_COL` dans le format `NOM_ZONE.glb`.  
<br>
8. Copier le script python `admin/traitement/post_traitement_zones.py` dans le dossier où se trouvent vos nouveaux 
fichiers, créer des dossiers `sized` et `impostors` et exécuter avec 
```bash 
python post_traitment_zones.py
```
Ceci va optimiser et fusionner les paires de fichiers comme décrit dans le rapport de stage et créer le fichier visuel
et son imposteur.
9. Copier les fichiers créés dans les dossiers `sized` et `impostors`
respectivement dans `public/models/zones` et `public/models/impostors`  
<br>
10. Dans le cas où il s'agit du mobiler pour les zones de type `CM`, `TD`, `TP`, `office` ou `misc`, sauter les étapes 
2 à 7 et à l'étape 8 exécuter `admin/traitement/post_traitement_furnitures.py` après avoir créé un dossier `furnitures` 
là où se trouvent les fichiers exportés.  
<br>

---
> Benjamin LALLEMENT - UFR MIM - Mis à jour le 02/06/2026 