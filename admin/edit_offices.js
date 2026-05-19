// scripts/edit-offices.js
// Usage : node scripts/edit-offices.js

import fs from 'fs';
import readline from 'readline';

const JSON_PATH = '../public/data/zones.json';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const zones = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
const offices = zones.filter(z => z.type === 'office');

const save = () => fs.writeFileSync(JSON_PATH, JSON.stringify(zones, null, 2), 'utf-8');

const showOffice = (office) => {
    console.log(`\n📌 ${office.name}`);
    if (!office.persons?.length) {
        console.log('  (aucune personne)');
    } else {
        office.persons.forEach((p, i) => console.log(`  [${i}] ${p}`));
    }
    console.log('');
};

const officeMenu = async (office) => {
    showOffice(office);
    console.log('Actions :');
    console.log('  [a] Ajouter une personne');
    console.log('  [s] Supprimer une personne');
    console.log('  [m] Modifier une personne');
    console.log('  [q] Retour\n');
    console.log(' ');

    console.log('Choisissez l\'action que vous voulez effectuer');


    const action = await ask('> ');

    if (action === 'q') return;

    if (action === 'a') {
        const name = await ask('Nom (FORMAT: "NOM Prénom") : ');
        office.persons = office.persons ?? [];
        office.persons.push(name.trim());
        save();
        console.log('✅ Ajouté.\n');

    } else if (action === 's') {
        if (!office.persons?.length) { console.log('Aucune personne à supprimer.\n'); return officeMenu(office); }
        const idx = parseInt(await ask('Index à supprimer (parmis les index des personnes ci-dessus) : '));
        if (isNaN(idx) || idx < 0 || idx >= office.persons.length) { console.log('Index invalide.\n'); return officeMenu(office); }
        const removed = office.persons.splice(idx, 1);
        save();
        console.log(`✅ "${removed}" supprimé.\n`);

    } else if (action === 'm') {
        if (!office.persons?.length) { console.log('Aucune personne à modifier.\n'); return officeMenu(office); }
        const idx = parseInt(await ask('Index à modifier (parmis les index des personnes ci-dessus) : '));
        if (isNaN(idx) || idx < 0 || idx >= office.persons.length) { console.log('Index invalide.\n'); return officeMenu(office); }
        console.log(`Actuel : ${office.persons[idx]}`);
        const newName = await ask('Nouveau nom : ');
        office.persons[idx] = newName.trim();
        save();
        console.log('✅ Modifié.\n');
    }

    return officeMenu(office);
};

const mainMenu = async () => {
    console.log(`\n📋 ${offices.length} bureau(x)\n`);
    offices.forEach((z, i) => {
        const persons = z.persons?.join(', ') || '(vide)';
        console.log(`  [${i}] ${z.name} — ${persons}`);
    });
    console.log('');
    console.log('Choisissez l\'index du bureau à modifier ou quittez [q]');


    const input = await ask('> ');
    if (input === 'q') { rl.close(); return; }

    const idx = parseInt(input);
    if (isNaN(idx) || idx < 0 || idx >= offices.length) {
        console.log('Index invalide.');
        return mainMenu();
    }

    await officeMenu(offices[idx]);
    return mainMenu();
};

mainMenu();