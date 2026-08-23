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
//
// Met een fragment erbij wordt de pagina geopend zoals iemand een bewaarde of
// gedeelde link opent. Dat is de enige manier om het terugzetten te toetsen: de
// invoer staat achter een hekje, dus ze hoort bij de url en niet bij een handeling
// op de pagina.
export async function openPagina(fragment = '', opties = {}){
  // opties gaan door naar de browser. De toets op de code van de afdruk vraagt een
  // hogere pixeldichtheid: op papier is de code 42 mm, maar een schermafbeelding op
  // 96 dpi geeft anderhalve pixel per module en daar leest geen lezer iets uit.
  const pg = await browser.newPage(opties);
  const fouten = [];
  pg.on('pageerror', e => fouten.push('pageerror: ' + e.message));
  pg.on('console', m => { if(m.type() === 'error') fouten.push('console: ' + m.text()); });
  await pg.goto(bestand + fragment);

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

    // Teken voor teken typen, zoals een bezoeker dat doet. vul() hierboven zet een
    // waarde in één keer, en dat is precies waarom issue #12 door de suite glipte:
    // het kwaad gebeurde bij het eerste cijfer, toen "je hebt" nog letterlijk 1 was.
    async tik(id, tekst){
      await pg.locator('#' + id).pressSequentially(String(tekst), {delay: 1});
    },

    // De link zoals de knop hem maakt, zonder het pad ervoor: een test kan hem zo
    // vergelijken en hem als fragment aan openPagina meegeven.
    async link(){
      await pg.click('#linkBtn');
      const url = await pg.$eval('#linkUrl', e => e.value);
      const i = url.indexOf('#');
      return i < 0 ? '' : url.slice(i);
    },

    // De waarden van invoervelden, om een rondgang te vergelijken. Bij een
    // gekoppeld paar hoort het invoervak gelezen te worden: dat is de bron van
    // waarheid, de schuifbalk rondt af.
    async waarden(ids){
      return pg.evaluate(lijst => {
        const uit = {};
        for(const id of lijst){
          const el = document.getElementById(id);
          if(!el) throw new Error('onbekend invoerveld: ' + id);
          uit[id] = el.type === 'checkbox' ? el.checked : el.value;
        }
        return uit;
      }, ids);
    },

    // Welke knop van een schakelaar ingedrukt staat, zodat een test ziet of een
    // stand uit de link is teruggezet.
    async stand(seg){
      return pg.evaluate(s => [...document.querySelectorAll('#' + s + ' button')]
        .filter(b => b.getAttribute('aria-pressed') === 'true')
        .map(b => b.dataset.m)[0] ?? '', seg);
    },

    // De bovengrens van een schuifbalk. Die verschuift zodra iemand een groter
    // bedrag typt, dus een vijandige link kan er iets onmogelijks in zetten.
    async grens(id){
      return pg.evaluate(i => document.getElementById(i).max, id);
    },

    // Een toets aanslaan in een veld dat de cursor heeft. Nodig om backspace door een
    // scheidingsteken en de pijltjes-stap te toetsen: dat gedrag zit in keydown en is
    // met een waarde zetten niet te bereiken.
    async toets(id, naam, keer){
      await pg.focus('#' + id);
      for(let i = 0; i < (keer ?? 1); i++) await pg.keyboard.press(naam);
    },

    // Typen op de plek waar de cursor staat.
    async typ(id, tekst){
      await pg.focus('#' + id);
      if(String(tekst) !== '') await pg.keyboard.type(String(tekst));
    },

    // De cursorpositie in een veld, en die zelf zetten. Bij een opgemaakt bedrag
    // schuift het scheidingsteken, dus de cursor hoort mee te schuiven.
    async cursor(id){ return pg.evaluate(i => document.getElementById(i).selectionStart, id); },
    async zetCursor(id, pos){
      await pg.focus('#' + id);
      await pg.evaluate(([i, p]) => document.getElementById(i).setSelectionRange(p, p), [id, pos]);
    },

    // Alle begrippen waarvoor er op dit moment een vraagteken op de pagina staat.
    async begrippen(){
      return pg.evaluate(() => [...new Set([...document.querySelectorAll('button.q')]
        .map(b => b.getAttribute('data-t')))].sort());
    },

    // Het uitlegblokje dat bij een begrip openstaat: de tekst, de bron en de link.
    async uitleg(term){
      return pg.evaluate(t => {
        const knop = document.querySelector('button.q[data-t="' + t + '"]');
        if(!knop) return null;
        const inRes = !!knop.closest('.res');
        const houder = inRes ? knop.closest('.row')
          : (knop.closest('.field, .trio > div, .pair > div, .card > p, h3, li') || knop.parentElement);
        // op het begrip zoeken, want er kunnen meerdere blokjes naast elkaar staan
        let blok = houder && houder.nextElementSibling;
        while(blok && blok.classList && blok.classList.contains('uitlegblok')
              && blok.getAttribute('data-t') !== t) blok = blok.nextElementSibling;
        if(!blok || !blok.classList.contains('uitlegblok')
           || blok.getAttribute('data-t') !== t) return null;
        const a = blok.querySelector('.bron a');
        return {tekst: blok.querySelector('p').textContent,
                bron: blok.querySelector('.bron').textContent,
                url: a ? a.getAttribute('href') : null,
                rel: a ? a.getAttribute('rel') : null,
                open: knop.getAttribute('aria-expanded')};
      }, term);
    },

    async klikBegrip(term){ await pg.click('button.q[data-t="' + term + '"]'); },

    // Hoeveel uitlegblokken er op dit moment openstaan.
    async aantalUitleg(){
      return pg.evaluate(() => document.querySelectorAll('.uitlegblok').length);
    },

    // Het bereik van een schuifbalk, als getallen.
    async bereik(id){
      return pg.evaluate(i => {
        const e = document.getElementById(i);
        return {min: Number(e.min), max: Number(e.max), value: Number(e.value)};
      }, id);
    },

    // De keuze die in een groep radioknoppen aanstaat.
    async keuze(naam){
      return pg.evaluate(n => document.querySelector('input[name=' + n + ']:checked')?.value ?? '', naam);
    },

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

    // Een vak dat een uitkomst draagt staat op readonly en niet op disabled: het bedrag
    // hoort leesbaar en selecteerbaar te blijven.
    async alleenLezen(id){ return pg.evaluate(i => document.getElementById(i).readOnly, id); },

    // De afdrukstand aanzetten. Papier heeft een eigen opmaak en een eigen
    // breedte, dus het venster krijgt de maat van A4 bij 96 dpi; anders breken
    // de regels op een breedte die op geen enkel blad bestaat. Het overzicht
    // wordt opnieuw opgebouwd zoals een browser dat voor het afdrukken doet.
    async afdrukstand(){
      await pg.setViewportSize({width:794, height:1123});
      await pg.emulateMedia({media:'print'});
      await pg.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    },

    // De maten van de regels in het afdrukoverzicht: hoe breed het label is, over
    // hoeveel tekstregels het loopt, en of de regel buiten de bladspiegel valt.
    // Daarmee is te toetsen hoe de opmaak op papier uitpakt, niet alleen welke
    // tekst er staat. Het aantal tekstregels komt uit een Range over het label:
    // een browser geeft daar een rechthoek per regel voor terug, dus een label
    // dat letter onder letter staat, telt evenveel regels als het letters heeft.
    async afdrukregels(){
      return pg.evaluate(() => [...document.querySelectorAll('#printdoc .row')].map(r => {
        const k = r.querySelector('.k'), v = r.querySelector('.v');
        const tekst = k.childNodes[0];
        const bereik = document.createRange();
        bereik.selectNodeContents(tekst);
        return {
          label: tekst.textContent.trim(),
          labelRegels: bereik.getClientRects().length,
          labelBreedte: k.getBoundingClientRect().width,
          waardeBreedte: v.getBoundingClientRect().width,
          regelBreedte: r.getBoundingClientRect().width,
          overloop: r.scrollWidth - r.clientWidth
        };
      }));
    },

    // Een waarde in het afdrukoverzicht vervangen. Daarmee is te toetsen hoe de
    // opmaak zich houdt bij een waarde die langer is dan de regel breed is,
    // zonder dat er een invoer hoeft te bestaan die zo'n zin oplevert.
    async zetAfdrukwaarde(label, tekst){
      await pg.evaluate(([l, t]) => {
        const regel = [...document.querySelectorAll('#printdoc .row')]
          .find(r => r.querySelector('.k')?.childNodes[0]?.textContent?.trim() === l);
        if(!regel) throw new Error('onbekende afdrukregel: ' + l);
        regel.querySelector('.v').textContent = t;
      }, [label, tekst]);
    },

    // Een deel van het blad als afbeelding. Daarmee kan een lezer van buiten de
    // gedrukte code nakijken, en dat is de enige toets die deze pagina tegen een
    // bron buiten zichzelf legt in plaats van tegen haar eigen berekening.
    async afbeelding(selector){ return pg.locator(selector).screenshot(); },
    async maten(selector){ return pg.locator(selector).boundingBox(); },
    // Waar de code staat: op het blad zelf, of in de voetregel die op elke bladzijde
    // terugkomt.
    async aantalQr(){
      return pg.evaluate(() => ({
        blad: document.querySelectorAll('#printdoc svg').length,
        voet: document.querySelectorAll('#printdoc tfoot svg').length
      }));
    },
    async attribuut(selector, naam){
      return pg.evaluate(([s, n]) => document.querySelector(s)?.getAttribute(n) ?? null, [selector, naam]);
    },
    async stijl(selector, eigenschap){
      return pg.evaluate(([s, e]) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el)[e] : null;
      }, [selector, eigenschap]);
    },

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
