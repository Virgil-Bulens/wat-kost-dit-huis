// Kijkt de bronlinks in index.html na.
//
// Dit staat bewust niet in npm test. Een netwerkcontrole is wisselvallig: een site
// kan even plat liggen, een client weren of een snelheidsbegrenzing opleggen. Zo'n
// controle mag geen pull request tegenhouden die er niets mee te maken heeft. Wat
// wél in de suite zit, is de vaste controle: elke bronlink is https en heeft
// rel=noreferrer. Dat is deterministisch en dus een goede poortwachter.
//
// De pagina kan dit zelf niet doen. Een link nakijken vraagt een verzoek naar
// buiten, en dat is precies wat de privacybelofte uitsluit. Daarom gebeurt het hier,
// buiten de pagina om, op een schema.

import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const wortel = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(wortel, 'index.html'), 'utf8');

// Twee vindplaatsen. De navigatielinks staan als <a href> in de html, maar de
// bronlinks staan in de tabel UITLEG als url:'...' en worden pas een <a> op het
// moment dat iemand een begrip openklapt. Wie alleen naar <a href> kijkt, kijkt
// precies de bronnen niet na, en dat is waar het hier om gaat.
const uitHtml = [...html.matchAll(/<a href="(https?:[^"]+)"/g)].map(m => m[1]);
const uitTabel = [...html.matchAll(/\burl:'(https?:[^']+)'/g)].map(m => m[1]);
const urls = [...new Set([...uitHtml, ...uitTabel])].sort();
if (uitTabel.length === 0) {
  console.error('Geen bronlinks gevonden in de tabel UITLEG. Is het patroon veranderd?');
  process.exit(1);
}
console.log(`${urls.length} links: ${uitHtml.length} uit de html, ${uitTabel.length} uit de tabel.\n`);

// Een echte browser-User-Agent, want een deel van de overheidssites weert onbekende
// clients. HEAD wordt vaak met 405 geweigerd, dus het is GET.
const KOP = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'nl-BE,nl;q=0.9'
};

async function eenPoging(url) {
  const stop = AbortSignal.timeout(25000);
  const antwoord = await fetch(url, {redirect: 'follow', headers: KOP, signal: stop});
  return antwoord.status;
}

// Eén herkansing, want een enkele storing is geen dode link.
async function nakijken(url) {
  for (let poging = 1; poging <= 2; poging++) {
    try {
      const status = await eenPoging(url);
      if (status >= 200 && status < 300) return {soort: 'ok', status};
      // Geweerd of begrensd: dat zegt niets over de vraag of de pagina er nog is.
      if ([401, 403, 405, 406, 429].includes(status)) return {soort: 'onbekend', status};
      if (status >= 500 && poging === 1) continue;          // tijdelijk? nog één keer
      return {soort: 'dood', status};
    } catch (e) {
      if (poging === 2) return {soort: 'dood', status: e.name === 'TimeoutError' ? 'timeout' : 'geen verbinding'};
    }
  }
}

const uitslag = [];
for (const url of urls) {
  const r = await nakijken(url);
  uitslag.push({url, ...r});
  console.log(`${String(r.status).padEnd(16)} ${r.soort.padEnd(9)} ${url}`);
}

const dood = uitslag.filter(r => r.soort === 'dood');
const onbekend = uitslag.filter(r => r.soort === 'onbekend');

console.log(`\n${uitslag.length} links: ${uitslag.filter(r => r.soort === 'ok').length} in orde, `
  + `${onbekend.length} niet na te kijken, ${dood.length} dood.`);

if (onbekend.length) {
  console.log('\nNiet na te kijken (de site weert deze controle; met de hand bekijken):');
  for (const r of onbekend) console.log(`  ${r.status}  ${r.url}`);
}
if (!dood.length) process.exit(0);

console.log('\nDeze links zijn dood en horen vervangen te worden:');
for (const r of dood) console.log(`  ${r.status}  ${r.url}`);

// Een melding openen op GitHub. Alleen als er een token is, dus lokaal gebeurt er
// niets en blijft dit script gewoon een script. Er wordt geen tweede melding
// gemaakt als er al een open melding staat: dan komt er een reactie bij, anders
// staan er na een half jaar zes identieke meldingen.
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const TITEL = 'Dode bronlink gevonden';

async function api(pad, opties = {}) {
  const antwoord = await fetch('https://api.github.com' + pad, {
    ...opties,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opties.headers || {})
    }
  });
  if (!antwoord.ok) throw new Error(pad + ' gaf ' + antwoord.status + ': ' + await antwoord.text());
  return antwoord.json();
}

const lijst = dood.map(r => `- ${r.url} — \`${r.status}\``).join('\n');
const run = process.env.GITHUB_RUN_ID
  ? `\n\n[De controle die dit vond](https://github.com/${repo}/actions/runs/${process.env.GITHUB_RUN_ID})`
  : '';
const romp = `De maandelijkse controle van de bronlinks vond ${dood.length} dode `
  + `${dood.length === 1 ? 'link' : 'links'}.\n\n${lijst}\n\n`
  + `Een dode link is erger dan geen link: hij belooft een bron en levert een foutmelding. `
  + `Zoek de pagina opnieuw op en pas de url aan in de tabel \`UITLEG\` in \`index.html\`, `
  + `of laat het begrip zonder bron als de instantie de pagina niet meer heeft.`
  + `\n\nNagekeken met \`npm run bronnen\`.${run}`;

if (!token || !repo) {
  console.log('\nGeen GITHUB_TOKEN, dus geen melding geopend. Buiten CI is dat normaal.');
  process.exit(1);
}

try {
  const open = await api(`/repos/${repo}/issues?state=open&per_page=100`);
  const bestaat = open.find(i => !i.pull_request && i.title === TITEL);
  if (bestaat) {
    await api(`/repos/${repo}/issues/${bestaat.number}/comments`,
      {method: 'POST', body: JSON.stringify({body: romp})});
    console.log(`\nReactie toegevoegd aan de bestaande melding #${bestaat.number}.`);
  } else {
    const nieuw = await api(`/repos/${repo}/issues`,
      {method: 'POST', body: JSON.stringify({title: TITEL, body: romp})});
    console.log(`\nMelding #${nieuw.number} geopend.`);
  }
} catch (e) {
  // De melding is een gemak, niet het doel. Lukt ze niet, dan faalt de controle nog
  // steeds en staat de uitslag hierboven.
  console.error('\nDe melding kon niet geopend worden: ' + e.message);
}
process.exit(1);
