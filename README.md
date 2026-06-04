![favicon.png](public/images/favicon.png)

> Visite virtuelle interactive de l'UFR MIM — explorez les espaces, repérez-vous, naviguez de salle en salle.

---
## Présentation

**MIM3D** est une application web de visite virtuelle 3D permettant aux étudiants, enseignants et visiteurs de se repérer dans les locaux de l'UFR MIM. Le bâtiment est explorable en vue à la première personne (FPS).

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