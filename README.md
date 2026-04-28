# mim3d

> Visite virtuelle interactive de l'UFR MIM — explorez les espaces, repérez-vous, naviguez de salle en salle.

---

## Présentation

**mim3d** est une application web de visite virtuelle 3D permettant aux étudiants, enseignants et visiteurs de se repérer dans les locaux de l'UFR MIM. Le bâtiment est explorable en vue à la première personne (FPS).

---

## Fonctionnalités

- **Navigation FPS** — déplacement libre dans le bâtiment à la première personne
- **Chargement dynamique des zones** — seuls l'étage courant et les zones adjacentes sont chargés en mémoire, pour des performances optimales
- **Collisions BVH** — détection de collisions précise et performante via `three-mesh-bvh`
- **Pathfinding automatique** — navigation guidée vers une salle via un agent 3D et un NavMesh (`three-pathfinding`)
- **Mobilier par salle** — chargement indépendant du mobilier de chaque salle, sans impact sur les collisions globales

---

## Stack technique

| Outil | Rôle |
|---|---|
| [Three.js](https://threejs.org/) | Moteur de rendu 3D WebGL |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | Collisions BVH haute performance |
| [three-pathfinding](https://github.com/donmccurdy/three-pathfinding) | Navigation par NavMesh |
| [DRACOLoader](https://threejs.org/docs/#examples/en/loaders/DRACOLoader) | Décompression des modèles GLB |
| Vite / Webpack | Bundler |

---

## Installation

```bash
# Cloner le dépôt
git clone https://github.com/Benjosss/mim3d.git
cd mim3d

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

L'application est accessible sur `http://localhost:5173` (ou le port affiché dans le terminal).

---

## Configuration des zones (`data.json`)

Chaque zone du bâtiment est décrite dans `public/data/data.json` :

```json
{
  "name": "floor0",
  "path": "models/0_floor_aisle_b_sized.glb",
  "impostorPath" : "models/impostors/0_floor_aisle_b_sized.glb",
  "physics" : true,
  "type": "corridor",
  "description" : "Rez de chaussé aile b",
  "adjacentZoneNames": ["stairs1to0_1", "floor1", "floor-1", "floor0ground", "stairs0to-1_1", "allstairs_2", "allstairs_3", "floor0hall"],
  "triggerBox": {
    "min": [70.925, 2.651, -75.214],
    "max": [89.943, 7.642, -0.082]
  }
}
```

| Champ               | Description                                      |
|---------------------|--------------------------------------------------|
| `name`              | Identifiant unique de la zone                    |
| `path`              | Chemin vers le fichier GLB HD                    |
| `impostorPath`      | Chemin vers le fichier GLB SD                    |
| `physics`           | `true` pour activer les collisions BVH           |
| `type`              | `stairs`, `corridor`, `office`, `TD`, `TP`, `CM` |
| `description`       | Description de la zone                           |
| `adjacentZoneNames` | Zones à précharger en arrière-plan               |
| `triggerBox`        | Boîte de détection de présence du joueur         |

> **Note** : les zones SANS physique sont chargées automatiquement quand le joueur entre dans leur triggerBox, sans devenir la zone courante de navigation.

---

## Contrôles

| Touche | Action |
|---|---|
| `Z` / `↑` | Avancer |
| `S` / `↓` | Reculer |
| `Q` / `←` | Déplacer à gauche |
| `D` / `→` | Déplacer à droite |
| `Souris` | Regarder (après clic pour verrouiller) |
| `Échap` | Déverrouiller la souris |

---

## Build production

```bash
npm run build
```

Les fichiers compilés sont générés dans `dist/`.

---

## Licence

Projet universitaire — usage interne à la faculté.