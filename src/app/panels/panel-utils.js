export class PanelUtils{
    constructor(){}

    onPanelBtnClick(id, action){
        document.getElementById(id)?.addEventListener('click', (e)=>{
            e.preventDefault();
            action();
        })
    }
}