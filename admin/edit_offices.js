// scripts/edit-offices.js
import fs from 'fs';
import readline from 'readline';

const JSON_PATH = '../public/data/zones.json';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

let zones = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));

const save = () => fs.writeFileSync(JSON_PATH, JSON.stringify(zones, null, 2), 'utf-8');

// --- SOUS-MENU : GESTION DES PERSONNES (Uniquement pour le type 'office') ---
const personsMenu = async (zone) => {
    console.log(`\n👥 Gestion du personnel pour : ${zone.displayName}`);
    if (!zone.persons?.length) {
        console.log('  (Aucune personne enregistrée)');
    } else {
        zone.persons.forEach((p, i) => console.log(`  [${i}] ${p.name} - ${p.function || 'Pas de fonction'}`));
    }

    console.log('\nChoisissez l\'action : [a] Ajouter | [s] Supprimer | [m] Modifier Nom | [f] Modifier Fonction | [q] Retour');
    const action = await ask('> ');

    if (action === 'q') return;

    if (action === 'a') {
        const name = await ask('Nom (ex: NOM Prénom) : ');
        const func = await ask('Fonction : ');
        zone.persons = zone.persons ?? [];
        zone.persons.push({ name: name.trim(), function: func.trim() });
    } else if (action === 's') {
        const idx = parseInt(await ask('Index à supprimer : '));
        if (zone.persons?.[idx]) zone.persons.splice(idx, 1);
    } else if (action === 'm') {
        const idx = parseInt(await ask('Index à modifier : '));
        if (zone.persons?.[idx]) {
            const newName = await ask(`Nouveau nom (${zone.persons[idx].name}) : `);
            zone.persons[idx].name = newName.trim();
        }
    } else if (action === 'f') {
        const idx = parseInt(await ask('Index à modifier : '));
        if (zone.persons?.[idx]) {
            const newFunc = await ask(`Nouvelle fonction (${zone.persons[idx].function}) : `);
            zone.persons[idx].function = newFunc.trim();
        }
    }
    save();
    return personsMenu(zone);
};

// --- SOUS-MENU : GESTION DES NOMS ALTERNATIFS (otherNames) ---
const otherNamesMenu = async (zone) => {
    console.log(`\n🏷️ Noms alternatifs pour : ${zone.displayName}`);
    if (!zone.otherNames?.length) {
        console.log('  (Aucun autre nom)');
    } else {
        zone.otherNames.forEach((n, i) => console.log(`  [${i}] ${n}`));
    }

    console.log('\nChoisissez l\'action : [a] Ajouter | [s] Supprimer | [m] Modifier | [q] Retour');
    const action = await ask('> ');

    if (action === 'q') return;

    if (action === 'a') {
        const name = await ask('Nouveau nom alternatif : ');
        zone.otherNames = zone.otherNames ?? [];
        zone.otherNames.push(name.trim());
    } else if (action === 's') {
        const idx = parseInt(await ask('Index à supprimer : '));
        if (zone.otherNames?.[idx]) zone.otherNames.splice(idx, 1);
    } else if (action === 'm') {
        const idx = parseInt(await ask('Index à modifier : '));
        if (zone.otherNames?.[idx]) {
            const newName = await ask(`Nouveau nom (${zone.otherNames[idx]}) : `);
            zone.otherNames[idx] = newName.trim();
        }
    }
    save();
    return otherNamesMenu(zone);
};

// --- MENU DE LA ZONE SÉLECTIONNÉE ---
const zoneMenu = async (zone) => {
    const isOffice = zone.type === 'office';

    console.log(`\n--- ÉDITION DE LA ZONE : ${zone.name} [Type: ${zone.type}] ---`);
    console.log(`[1] Nom d'affichage : ${zone.displayName}`);
    console.log(`[2] Description    : ${zone.description}`);
    console.log(`[3] Noms alternatifs (${zone.otherNames?.length || 0})`);

    // Condition d'affichage pour l'option des personnes
    if (isOffice) {
        console.log(`[4] Personnes       (${zone.persons?.length || 0})`);
    }

    console.log(`[q] Retour au menu principal`);

    const choice = await ask('\nAction à réaliser (ou retour "q") : ');

    if (choice === 'q') return;

    switch (choice) {
        case '1':
            const newDN = await ask(`Nouveau nom d'affichage (${zone.displayName}) : `);
            if (newDN.trim()) zone.displayName = newDN.trim();
            break;
        case '2':
            const newDesc = await ask(`Nouvelle description (${zone.description}) : `);
            if (newDesc.trim()) zone.description = newDesc.trim();
            break;
        case '3':
            await otherNamesMenu(zone);
            break;
        case '4':
            // Sécurité : on bloque l'accès si ce n'est pas un bureau
            if (isOffice) {
                await personsMenu(zone);
            } else {
                console.log('❌ Option invalide pour ce type de zone.');
            }
            break;
        default:
            console.log('Choix invalide.');
    }
    save();
    return zoneMenu(zone);
};

// --- MENU PRINCIPAL ---
const mainMenu = async () => {
    console.log('\n--- ÉDITEUR DE ZONES ---');
    zones.forEach((z, i) => {
        const typeBadge = `[${z.type}]`.padEnd(11);
        console.log(`  [${i.toString().padStart(2, ' ')}] ${typeBadge} ${z.name.padEnd(15)} | ${z.displayName}`);
    });

    const input = await ask('\nIndex de la zone à modifier (ou "q" pour quitter) : ');
    if (input.toLowerCase() === 'q') {
        console.log('Au revoir !');
        rl.close();
        return;
    }

    const idx = parseInt(input);
    if (!isNaN(idx) && zones[idx]) {
        await zoneMenu(zones[idx]);
    } else {
        console.log('Index invalide.');
    }
    return mainMenu();
};

mainMenu();