export class PanelUtils{
    constructor(){}

    async loadHtmlPanel(targetId, path){
        const res = await fetch(path);
        const html = await res.text();
        document.getElementById(targetId).innerHTML = html;
    }

    async loadAllHtmlPanels(fragments){
        await Promise.all(
            fragments.map(([targetId, path]) => this.loadHtmlPanel(targetId, path))
        );
    }

    onPanelBtnClick(id, action){
        document.getElementById(id)?.addEventListener('click', (e)=>{
            e.preventDefault();
            action();
        })
    }
}