/**
 * Classe utilitaire pour la gestion du chargement dynamique de panneaux HTML
 * et la gestion des événements d'interface.
 */
export class PanelUtils{
    /**
     * Crée une instance de PanelUtils.
     */
    constructor(){}

    /**
     * Charge le contenu d'un fichier HTML externe dans un élément cible du DOM.
     * @param {string} targetId - L'ID de l'élément HTML qui recevra le contenu.
     * @param {string} path - Le chemin vers le fichier HTML à charger.
     * @returns {Promise<void>}
     */
    async loadHtmlPanel(targetId, path){
        // Effectue la requête HTTP pour récupérer le fichier
        const res = await fetch(path);

        // Injecte le texte récupéré dans l'élément cible via son innerHTML
        document.getElementById(targetId).innerHTML = await res.text();
    }

    /**
     * Charge plusieurs panneaux HTML en parallèle.
     * @param {string[][]} fragments - Un tableau de couples [targetId, path].
     * @returns {Promise<void>}
     */
    async loadAllHtmlPanels(fragments){
        // Utilise Promise.all pour exécuter tous les chargements simultanément
        await Promise.all(
            fragments.map(([targetId, path]) => this.loadHtmlPanel(targetId, path))
        );
    }

    /**
     * Attache un écouteur d'événement 'click' à un bouton de panneau.
     * @param {string} id - L'ID du bouton sur lequel attacher l'événement.
     * @param {Function} action - La fonction de rappel (callback) à exécuter lors du clic.
     */
    onPanelBtnClick(id, action){
        // Récupère l'élément et vérifie s'il existe (optional chaining)
        document.getElementById(id)?.addEventListener('click', (e)=>{
            // Empêche le comportement par défaut (ex: rechargement de page pour un lien/bouton)
            e.preventDefault();

            // Exécute l'action passée en paramètre
            action();
        })
    }
}