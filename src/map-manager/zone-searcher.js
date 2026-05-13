export class ZoneSearcher {
    constructor(zones) {
        this.zones = zones;
    }

    /**
     * Affiche toutes les zones triées par types
     */
    printHierarchy() {
        const zones = this.zones;

        let types = [];
        let sort = [];
        zones.forEach((zone) => {
            if(!types.includes(zone.type)) {
                types.push(zone.type);
            }
        })
        types.forEach((type) => {
            zones.forEach((zone) => {
                if(zone.type === type) {
                    sort.push({
                        name: zone.name,
                        type: zone.type,
                        description: zone.description,
                    });
                }
            })
        })
        console.table(types);
        console.table(sort);
    }

    /**
     * Affiche toutes les zones dont le type est le paramètre type
     * @param type
     */
    printHierarchyByType(type) {
        const zones = this.zones;

        let sort = [];
        zones.forEach((zone) => {
            if(zone.type === type) {
                sort.push({
                    name: zone.name,
                    type: zone.type,
                    description: zone.description,
                });
            }
        })
        console.table(sort);
    }

    // ================= RESEARCH =================

    zoneSearchByString(str){
        str = str.toLowerCase();
        const filteredZones = this.zones.filter(zone => zone.displayName.toLowerCase().includes(str));
        return filteredZones.sort((a,b) => a.displayName.localeCompare(b.displayName, "fr"));
    }

    zonesFilterByType(types, zones){
        let filteredZones = [];
        zones.forEach((zone) => {
            types.forEach((type) => {
                if(zone.type === type) {
                    filteredZones.push(zone);
                }
            })
        })
        return filteredZones;
    }

    zoneSearchAndFilter(str, types){
        return this.zonesFilterByType(types, this.zoneSearchByString(str));
    }

}