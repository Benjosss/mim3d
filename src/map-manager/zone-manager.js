import * as THREE from 'three';

/**
 * Orchestrateur du système de streaming.
 * Gère le cycle de vie des zones, les transitions fluides et la mise à jour des collisionneurs actifs.
 */
export class ZoneManager {
    /**
     * @param {THREE.Scene} scene - Scène principale.
     * @param {GLTFLoader} loader - Chargeur partagé.
     * @param {THREE.Mesh[]} colliderMeshes - Référence vers le tableau de collisions global.
     * @param {boolean} debugMode - Etat du mode debug.
     */
    constructor(scene, loader, colliderMeshes, debugMode) {
        this.scene = scene;
        this.loader = loader;
        this.colliderMeshes = colliderMeshes; // Tableau modifié par référence pour la physique globale
        this.zones = new Map();
        this.currentZone = null;  // Zone de navigation (avec physique)
        this.currentRoom = null;  // Zone précise (peut être du mobilier/sans physique)
        this.managedZones = new Set();

        this._transitioning = false;
        this._loadQueue = [];
        this._isProcessingQueue = false;
        this._rebuildScheduled = false;

        this.debugMode = debugMode;
    }

    /** Messages d'alerte spécifiques à certaines zones réglementées */
    MSG_LABOS = {
        "floor2_a": "⚠️ Zone réglementée — sonnez à l'interphone, émargez et attendez qu'on vous ouvre. Uniquement sur RDV !",
        "floor1_a": "⚠️ Zone réglementée — sonnez à l'interphone et attendez qu'on vous ouvre. Uniquement sur RDV !",
        "floor0_a": "⚠️ Zone réglementée — sonnez à l'interphone et attendez qu'on vous ouvre. Uniquement sur RDV !",
    };

    /** Enregistre une zone dans le dictionnaire du manager */
    registerZone(zone) {
        this.zones.set(zone.name, zone);
    }

    /** Enregistre un tableau de zones */
    registerMultiZones(zones) {
        zones.forEach(zone => this.registerZone(zone));
    }

    /** Mise à jour appelée à chaque frame pour gérer la détection de proximité */
    update(playerPosition) {
        this._detectZoneChange(playerPosition);
    }

    /**
     * Initialise l'application dans une zone précise.
     * @param {string} startZoneName
     */
    async init(startZoneName) {
        const startZone = this.zones.get(startZoneName);
        if (!startZone) return;

        // Chargement critique de la première zone
        await this._loadZone(startZone);
        this._showZone(startZone);
        this.currentZone = startZone;

        this._rebuildColliders(); // Initialisation de la physique
        this._queueAdjacentZones(startZone); // Préchargement des voisines

        // Affichage initial des imposteurs pour les zones lointaines
        for (const [name, zone] of this.zones) {
            if (name !== this.currentZone.name && zone.impostorPath) {
                this._manageImpostorVisibility(zone, true).catch(console.error);
            }
        }
    }

    /**
     * Détecte si le joueur s'approche d'une nouvelle zone ou change de pièce.
     * Gère la hiérarchie des zones (la plus petite contenant le joueur gagne).
     * @private
     */
    _detectZoneChange(playerPosition) {
        if (!this.currentZone) return;

        // 1. Anticipation : charge les zones voisines si le joueur s'approche à moins de 15m
        for (const adjName of this.currentZone.adjacentZoneNames) {
            const adjZone = this.zones.get(adjName);
            if (adjZone && !adjZone.isLoaded && !adjZone.isLoading) {

                // Calcul de distance entre le joueur et la boîte de la zone adjacente
                const distance = adjZone.triggerBox.distanceToPoint(playerPosition);
                if (distance < 15.0) void this._loadZone(adjZone);
            }
        }

        // 2. Identification de la zone actuelle (Collision avec les TriggerBoxes)
        const candidates = [];
        for (const [, zone] of this.zones) {
            if (zone.isPointInside(playerPosition)) candidates.push(zone);
        }

        // Nettoyage des zones sans physique dès qu'on en sort
        for (const [, zone] of this.zones) {
            if (!zone.physics && zone.isVisible && !zone.isPointInside(playerPosition)) {
                zone.hide(this.scene);
            }
        }

        if (candidates.length === 0) return;

        // Priorité à la zone ayant le plus petit volume (ex: bureau à l'intérieur d'un étage)
        const boxVolume = (box) => {
            const s = new THREE.Vector3();
            box.getSize(s);
            return s.x * s.y * s.z;
        };
        candidates.sort((a, b) => boxVolume(a.triggerBox) - boxVolume(b.triggerBox));

        // Si la zone la plus petite est du mobilier (physics = false) :
        // - on la charge/affiche en arrière-plan
        // - mais la zone courante devient la 2ème plus petite (le sol/couloir)
        const smallest = candidates[0];
        let navigationZone;

        // Gestion du mobilier (sans physique) : on l'affiche mais on navigue sur la zone parente
        if (!smallest.physics) {
            this.currentRoom = smallest;
            // Charge le mobilier en arrière-plan sans en faire la zone courante
            if (!smallest.isLoaded && !smallest.isLoading) {
                this._loadZone(smallest).then(() => {
                    this._showZone(smallest);
                    this._scheduleColliderRebuild();
                });
            } else if (smallest.isLoaded && !smallest.isVisible) {
                this._showZone(smallest);
            }

            // La zone de navigation est la 2ème plus petite non-furniture
            navigationZone = candidates.find(z => z.physics);
        } else {
            navigationZone = smallest;
            this.currentRoom = smallest;
        }

        if (!navigationZone || navigationZone === this.currentZone) return;

        // Lancement de la transition vers la nouvelle zone majeure
        void this._triggerTransition(navigationZone);
    }

    /**
     * Gère le passage d'une zone HD à une autre.
     * @private
     */
    async _triggerTransition(newZone) {
        if (this._transitioning) return;
        this._transitioning = true;

        try {
            const previousZone = this.currentZone;
            await this._loadZone(newZone); // S'assure que c'est chargé
            this._showZone(newZone);

            // Affiche les voisines pour éviter les "trous" visuels
            for (const adjName of newZone.adjacentZoneNames) {
                const adjZone = this.zones.get(adjName);
                if (adjZone?.isLoaded) this._showZone(adjZone);
            }

            this.currentZone = newZone;
            this._showZoneWarning(newZone.name);
            this._rebuildColliders(); // Met à jour les murs/sols collisionnables

            this._scheduleUnloadFarZones(previousZone); // Nettoie les zones lointaines
            this._queueAdjacentZones(newZone); // Prépare les nouvelles voisines
        } catch (e) {
            console.error('Error while transitioning :', e);
        } finally {
            // TRÈS IMPORTANT : On ne libère la physique que quand TOUT est prêt
            this._transitioning = false;
        }
    }

    /**
     * Alterne entre modèle HD et Imposteur selon la distance.
     * @private
     */
    async _manageImpostorVisibility(zone, visible) {
        if (visible) {
            if (!zone.isImpostorLoaded) await zone.loadImpostor(this.loader, this.debugMode);
            if (zone.impostorContent && !zone.impostorContent.parent) this.scene.add(zone.impostorContent);
            zone.impostorContent.visible = true;
        } else {
            if (zone.impostorContent) zone.impostorContent.visible = false;
        }
    }

    /**
     * Planifie le déchargement des zones qui ne sont plus adjacentes.
     * @private
     */
    _scheduleUnloadFarZones(previousZone) {
        setTimeout(async () => {
            if (!this.currentZone) return;

            // Zones en être en HD (actuelle + voisines directes)
            const highDetailNames = new Set([
                this.currentZone.name,
                ...this.currentZone.adjacentZoneNames,
            ]);

            for (const [name, zone] of this.zones) {
                const isHDNeeded = highDetailNames.has(name);

                if (isHDNeeded) {
                    if (zone.isLoaded) this._showZone(zone);
                } else {
                    if (zone.isVisible) zone.hide(this.scene);
                    if (zone.impostorPath) await this._manageImpostorVisibility(zone, true);

                    // Si la zone n'est même plus voisine de l'ancienne zone, on libère la RAM
                    const wasAdjacent = previousZone?.adjacentZoneNames.includes(name);
                    if (!wasAdjacent) {
                        zone.unload(this.scene);
                        this.managedZones.delete(name);
                    }
                }
            }
            this._scheduleColliderRebuild();
        }, 100);
    }

    /** Affiche le modèle HD et cache l'imposteur correspondant */
    _showZone(zone) {
        if (!zone.isLoaded) return;
        zone.show(this.scene);
        if (zone.impostorContent) zone.impostorContent.visible = false;
    }

    /** Charge une zone et notifie le manager de sa disponibilité */
    async _loadZone(zone) {
        if (zone.isLoaded) return;

        // Attente active si déjà en cours de chargement par une autre tâche
        if (zone.isLoading) {
            while (zone.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            return;
        }

        await zone.load(this.loader);
        this.managedZones.add(zone.name);

        // Si la zone chargée est la zone actuelle ou une voisine, on l'affiche de suite
        if (this.currentZone && (this.currentZone.name === zone.name || this.currentZone.adjacentZoneNames.includes(zone.name))) {
            this._showZone(zone);
            this._rebuildColliders();
        }
    }

    /** Ajoute les voisines à la file d'attente de chargement en arrière-plan */
    _queueAdjacentZones(zone) {
        for (const name of zone.adjacentZoneNames) {
            const z = this.zones.get(name);
            if (!z || z.isLoaded || z.isLoading) continue;
            if (!this._loadQueue.includes(z)) this._loadQueue.push(z);
        }
        void this._processQueue();
    }

    /** Traite la file d'attente de chargement un par un pour ne pas saturer le CPU/GPU */
    async _processQueue() {
        if (this._isProcessingQueue) return;
        this._isProcessingQueue = true;

        while (this._loadQueue.length > 0) {
            const zone = this._loadQueue.shift();
            await new Promise(r => setTimeout(r, 0)); // Laisse respirer le navigateur

            if (!zone.isLoaded) {
                await this._loadZone(zone);
                if (this.currentZone?.adjacentZoneNames.includes(zone.name)) {
                    this._showZone(zone);
                    this._scheduleColliderRebuild();
                }
            }
        }
        this._isProcessingQueue = false;
    }

    /** Planifie une reconstruction des collisionneurs à la fin de la frame actuelle */
    _scheduleColliderRebuild() {
        if (this._rebuildScheduled) return;
        this._rebuildScheduled = true;
        setTimeout(() => {
            this._rebuildColliders();
            this._rebuildScheduled = false;
        }, 0);
    }

    /**
     * Collecte tous les maillages de collision des zones actuellement visibles
     * et les injecte dans le tableau global utilisé par le moteur de physique.
     */
    _rebuildColliders() {
        this.colliderMeshes.length = 0; // Vide le tableau sans changer la référence
        for (const [, zone] of this.zones) {
            if (zone.isVisible && zone.colliderMeshes?.length) {
                for (const mesh of zone.colliderMeshes) {
                    mesh.updateMatrixWorld(true);
                    this.colliderMeshes.push(mesh);
                }
            }
        }
    }

    /** Affiche un message d'avertissement HTML si nécessaire */
    _showZoneWarning(zoneName) {
        const warningMsg = document.getElementById("warningMsg");
        if (!warningMsg) return;

        const msg = this.MSG_LABOS[zoneName];
        if (msg) {
            warningMsg.textContent = msg;
            warningMsg.style.display = 'flex';

            // Disparaît après 5 secondes
            clearTimeout(this._warningTimeout);
            this._warningTimeout = setTimeout(() => {
                warningMsg.style.display = 'none';
            }, 5000);
        } else {
            warningMsg.style.display = 'none';
        }
    }

    /** Retourne un état textuel complet des zones pour le débogage console */
    getStatus() {
        const status = [];
        for (const [name, zone] of this.zones) {
            const isCurrent = zone === this.currentZone;

            status.push({
                name,
                // Utilisation d'emojis pour simuler la couleur
                loaded: zone.isLoaded ? "✅" : "❌",
                visible: zone.isVisible ? "👁️" : "🌑",
                impostor: zone.impostorContent?.visible ? "👁️" : "🌑",
                colliders: zone.colliderMeshes?.length ?? 0,
                current: isCurrent ? "⭐" : "❌",
            });
        }
        console.table(status);
        return status;
    }
}