// Testhulp: de pagina in een echte browser openen en uitlezen.
//
// De rekenhulp is een enkel HTML-bestand zonder build, dus er is niets om te
// importeren. De enige manier om te toetsen wat een bezoeker werkelijk ziet, is
// het bestand openen en de bedragen van het scherm lezen. Dat vangt ook de
// dingen die een test op losse functies mist: de koppeling tussen de invoer en
// de berekening, de afdrukweergave, en fouten in de console.

import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const wortel = dirname(dirname(fileURLToPath(import.meta.url)));
export const bestand = 'file://' + join(wortel, 'index.html');

let browser;

export async function startBrowser(){ browser = await chromium.launch(); }
export async function stopBrowser(){ if(browser) await browser.close(); }

// Eén verse pagina per test, zodat tests elkaar niet beïnvloeden. Elke pagina
// houdt haar eigen lijst met fouten bij; een test die niets anders doet dan de
// invoer vullen, faalt alsnog als de pagina intern struikelt.
export async function openPagina(){
  const pg = await browser.newPage();
  const fouten = [];
  pg.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  pg.on('console', m => { if(m.type() === 'error') fouten.push('console: ' + m.text()); });
  await pg.goto(bestand);

  return {
    fouten,

    // Invoer vullen. De pagina hangt aan input- en change-gebeurtenissen, dus we
    // sturen beide, precies zoals een browser dat bij typen doet.
    async vul(waarden){
      await pg.evaluate(w => {
        for(const [id, waarde] of Object.entries(w)){
          const el = document.getElementById(id);
          if(!el) throw new Error('onbekend invoerveld: ' + id);
          if(el.type === 'checkbox') el.checked = !!waarde;
          else el.value = String(waarde);
          el.dispatchEvent(new Event('input', {bubbles:true}));
          el.dispatchEvent(new Event('change', {bubbles:true}));
        }
      }, waarden);
    },

    // Een keuze uit een groep radioknoppen aanzetten. De waarden worden
    // aangehaald, want een waarde als 6 is zonder aanhalingstekens geen geldige
    // selector.
    async kies(naam, waarde){
      await pg.evaluate(([n, w]) => {
        const r = document.querySelector('input[name="' + n + '"][value="' + w + '"]');
        if(!r) throw new Error('onbekende keuze: ' + n + '=' + w);
        r.checked = true;
        r.dispatchEvent(new Event('change', {bubbles:true}));
      }, [naam, waarde]);
    },

    async klik(selector){ await pg.click(selector); },

    // De bedragen uit een resultaatblok, op hun label. Bedragen komen terug als
    // getal, zodat een test ermee kan rekenen in plaats van op tekst te matchen.
    async regels(id){
      return pg.evaluate(i => {
        const uit = {};
        document.getElementById(i).querySelectorAll('.row, .big').forEach(r => {
          const label = r.querySelector('.k')?.childNodes[0]?.textContent?.trim();
          const ruw = r.querySelector('.v')?.innerText?.trim();
          if(!label) return;
          const getal = parseFloat(String(ruw || '')
            .replace(/[^\d,−-]/g, '').replace(/\./g, '')
            .replace(',', '.').replace('−', '-'));
          uit[label] = isNaN(getal) ? ruw : getal;
        });
        return uit;
      }, id);
    },

    async tekst(id){ return pg.evaluate(i => document.getElementById(i)?.innerText ?? '', id); },
    async html(id){ return pg.evaluate(i => document.getElementById(i)?.innerHTML ?? '', id); },
    async zichtbaar(id){
      return pg.evaluate(i => {
        const e = document.getElementById(i);
        return !!e && getComputedStyle(e).display !== 'none';
      }, id);
    },
    async bestaat(id){ return pg.evaluate(i => !!document.getElementById(i), id); },
    async uitgeschakeld(id){ return pg.evaluate(i => document.getElementById(i).disabled, id); },

    async sluit(){ await pg.close(); }
  };
}

// De Belgische conventie: de maandrente is de twaalfde wortel uit de jaarrente.
// Deze formule staat hier los van de pagina, zodat de test de maandlast van de
// pagina tegen een onafhankelijke berekening kan leggen in plaats van tegen
// zichzelf. Ze is zelf geijkt op het voorbeeld van Wikifin, zie de test.
export function annuiteit(kapitaal, jaarrente, jaren){
  if(kapitaal <= 0 || jaren <= 0) return 0;
  const i = Math.pow(1 + jaarrente, 1/12) - 1, n = jaren * 12;
  return i === 0 ? kapitaal / n : kapitaal * i / (1 - Math.pow(1 + i, -n));
}

// Het wettelijke degressieve barema, los van de pagina uitgeschreven. Ook hier
// geldt: de test moet een eigen bron van waarheid hebben. Deze tabel is geijkt
// op een gepubliceerd voorbeeld van EUR 150.000, zie de test.
export const BAREMA_KOOP = [[7500,0.0456],[17500,0.0285],[30000,0.0228],
                            [45495,0.0171],[64095,0.0114],[Infinity,0.0057]];

export function schijfbedrag(barema, grondslag){
  let som = 0, ondergrens = 0;
  for(const [bovengrens, tarief] of barema){
    if(grondslag <= ondergrens) break;
    som += (Math.min(grondslag, bovengrens) - ondergrens) * tarief;
    ondergrens = bovengrens;
  }
  return som;
}
