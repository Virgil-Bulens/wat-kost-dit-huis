// Toetsen op het kostenmodel van de rekenhulp.
//
// De opzet: elke test vult de invoer zoals een bezoeker dat doet en leest de
// bedragen van het scherm. Waar het kan wordt niet tegen een eerder afgelezen
// getal getoetst maar tegen een onafhankelijke bron: een gepubliceerd
// rekenvoorbeeld, of een formule die in test/pagina.mjs los is uitgeschreven.
// Een test die de pagina met zichzelf vergelijkt, bevriest immers ook de fout.

import {test, before, after, describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {startBrowser, stopBrowser, openPagina,
        annuiteit, BAREMA_KOOP, schijfbedrag} from './pagina.mjs';

before(startBrowser);
after(stopBrowser);

const BTW = 1.21;

// Rond af zoals de pagina doet, zodat een verwachting op hele euro's te
// vergelijken is met wat er op het scherm staat.
const euro = x => Math.round(x);

// Elke test krijgt een verse pagina en faalt als de pagina intern struikelt.
async function metPagina(vullen){
  const p = await openPagina();
  if(vullen) await p.vul(vullen);
  return p;
}
function geenFouten(p){
  assert.deepEqual(p.fouten, [], 'de pagina gaf fouten: ' + p.fouten.join(' | '));
}

// ---------------------------------------------------------------------------

describe('ijkpunten uit gepubliceerde bronnen', () => {

  test('het barema van de koopakte klopt op het voorbeeld van EUR 150.000', () => {
    // 342 + 285 + 285 + 264,96 + 212,04 + 489,66 = 1.878,66. Dit toetst de tabel
    // in de test zelf; de tests daaronder leggen de pagina tegen die tabel.
    assert.ok(Math.abs(schijfbedrag(BAREMA_KOOP, 150000) - 1878.66) < 0.01,
      'barema geeft ' + schijfbedrag(BAREMA_KOOP, 150000) + ' in plaats van 1878,66');
  });

  test('de annuiteitsformule klopt op het voorbeeld van Wikifin', () => {
    // EUR 100.000 op 20 jaar aan 2% geeft EUR 505,03 per maand en EUR 21.206,35
    // aan intrest. Dat toetst de Belgische conventie: de maandrente is de
    // twaalfde wortel uit de jaarrente, niet de jaarrente gedeeld door twaalf.
    const maand = annuiteit(100000, 0.02, 20);
    assert.ok(Math.abs(maand - 505.03) < 0.01, 'maandlast ' + maand);
    assert.ok(Math.abs(maand * 240 - 100000 - 21206.35) < 0.5,
      'intrest ' + (maand * 240 - 100000));
  });

  test('een gezinswoning van EUR 250.000 kost EUR 9.370 aan aankoopkosten', async () => {
    // Het rekenvoorbeeld van notaris.be. Volledig met eigen geld, zodat er geen
    // kredietakte bijkomt en de drie posten los te zien zijn.
    const p = await metPagina({priceN:250000, b1InN:400000});
    const r = await p.regels('r-buy');
    assert.equal(r['2% registratiebelasting'], 5000);
    assert.equal(r['Ereloon notaris'], euro(schijfbedrag(BAREMA_KOOP, 250000) * BTW));
    assert.equal(r['Akte- en opzoekingskosten'], 1407);
    assert.equal(r['Kosten van de aankoop'], 9370,
      'het ijkpunt van notaris.be reproduceert niet meer; ereloon en akte- en ' +
      'opzoekingskosten zijn samen geijkt, dus pas ze samen aan');
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('ereloon van de notaris', () => {

  test('volgt het barema over de hele prijsreeks', async () => {
    const p = await metPagina({b1InN:2000000});
    for(const prijs of [80000, 125000, 150000, 200000, 250000, 300000, 420000, 600000, 900000]){
      await p.vul({priceN:prijs});
      const r = await p.regels('r-buy');
      assert.equal(r['Ereloon notaris'], euro(schijfbedrag(BAREMA_KOOP, prijs) * BTW),
        'ereloon wijkt af bij een prijs van ' + prijs);
    }
    geenFouten(p);
    await p.sluit();
  });

  test('is degressief: het percentage daalt als de prijs stijgt', async () => {
    const p = await metPagina({b1InN:2000000});
    let vorig = Infinity;
    for(const prijs of [125000, 200000, 300000, 500000, 800000]){
      await p.vul({priceN:prijs});
      const r = await p.regels('r-buy');
      const pct = r['Ereloon notaris'] / prijs;
      assert.ok(pct < vorig, 'het percentage stijgt bij ' + prijs);
      vorig = pct;
    }
    await p.sluit();
  });

  test('een vast bedrag in euro overschrijft het barema', async () => {
    const p = await metPagina({priceN:400000, b1InN:2000000});
    assert.equal(await p.uitgeschakeld('notVal'), true,
      'in de baremastand hoort het invoervak uit te staan');

    await p.klik('#notSeg button[data-m="eur"]');
    assert.equal(await p.uitgeschakeld('notVal'), false);
    await p.vul({notVal:5000});
    assert.equal((await p.regels('r-buy'))['Ereloon notaris'], 5000);

    await p.klik('#notSeg button[data-m="pct"]');
    assert.equal((await p.regels('r-buy'))['Ereloon notaris'],
      euro(schijfbedrag(BAREMA_KOOP, 400000) * BTW));
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('kosten van de kredietakte', () => {

  test('de heffingen staan op het kapitaal plus de aanhorigheden', async () => {
    const p = await metPagina({priceN:300000, b1InN:40000, acc:10});
    const koop = await p.regels('r-buy'), lening = await p.regels('r-loan');
    const gewaarborgd = lening['Te lenen'] * 1.10;

    assert.equal(koop['waarvan registratierecht'], euro(gewaarborgd * 0.01));
    assert.equal(koop['waarvan hypotheekrecht'], euro(gewaarborgd * 0.003));
    assert.ok(koop['waarvan registratierecht'] > euro(lening['Te lenen'] * 0.01),
      'het registratierecht hoort op het gewaarborgde bedrag te staan, niet op het kapitaal');
    geenFouten(p);
    await p.sluit();
  });

  test('zonder aanhorigheden staan de heffingen op het kapitaal zelf', async () => {
    const p = await metPagina({priceN:300000, b1InN:40000, acc:0});
    const koop = await p.regels('r-buy'), lening = await p.regels('r-loan');
    assert.equal(koop['waarvan registratierecht'], euro(lening['Te lenen'] * 0.01));
    await p.sluit();
  });

  test('de onderdelen tellen op tot de lijn erboven', async () => {
    const p = await metPagina({priceN:380000, b1InN:60000});
    const r = await p.regels('r-buy');
    const som = r['waarvan registratierecht'] + r['waarvan hypotheekrecht']
              + r['waarvan ereloon'] + r['waarvan vaste kosten'];
    assert.ok(Math.abs(r['Kredietakte'] - som) <= 2,
      'kredietakte ' + r['Kredietakte'] + ' tegen een som van ' + som);
    await p.sluit();
  });

  test('zonder lening zijn er geen aktekosten', async () => {
    const p = await metPagina({priceN:200000, b1InN:400000});
    const r = await p.regels('r-buy');
    assert.equal(r['Kredietakte'], undefined);
    assert.match(await p.tekst('r-loan'), /Je hoeft niets te lenen/);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de brug naar het kredietbedrag', () => {

  test('wat te financieren is min het eigen geld is wat je leent', async () => {
    // Dit toetst tegelijk dat de kosten van de kredietakte rond opgelost zijn:
    // ze zitten in "mee te financieren" en hangen af van de uitkomst.
    const p = await metPagina({priceN:420000, b1InN:70000, moving:8000,
                               bankFee:400, valFee:300});
    const r = await p.regels('r-loan');
    // De aftreklijn staat op het scherm met een minteken, dus die komt als
    // negatief getal terug; voor de leesbaarheid trekken we de omvang af.
    const eigenGeld = Math.abs(r['Eigen geld dat daarvan afgaat']);
    assert.equal(r['Mee te financieren'] - eigenGeld, r['Te lenen'],
      'de brug sluit niet');
    geenFouten(p);
    await p.sluit();
  });

  test('zelf betaalde posten gaan van het eigen geld af, niet in de lening', async () => {
    const p = await metPagina({priceN:350000, b1InN:80000, moving:9000,
                               bankFee:400, valFee:300});
    const koop = await p.regels('r-buy'), lening = await p.regels('r-loan');

    assert.equal(lening['Eigen geld samen'], 80000 - 9000 - 400 - 300);
    assert.equal(koop['Mee te financieren'], lening['Mee te financieren'],
      'beide blokken horen hetzelfde te financieren bedrag te tonen');
    assert.equal(koop['Alles samen'], koop['Mee te financieren'] + 9000 + 400 + 300);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('registratiebelasting en het verlaagde tarief', () => {

  test('het verschil met 12% staat er als apart scenario', async () => {
    const p = await metPagina({priceN:300000, b1InN:60000});
    const r = await p.regels('r-buy');
    assert.equal(r['Als het tarief van 2% wegvalt'], 300000 * 0.12 - 300000 * 0.02);
    await p.sluit();
  });

  test('koop je terwijl je nog een woning bezit, dan komt er een waarschuwing', async () => {
    const p = await metPagina({priceN:300000, b1InN:60000});
    assert.doesNotMatch(await p.tekst('r-notes'), /nog een woning bezit/,
      'zonder verkoop hoort die waarschuwing er niet te staan');

    await p.vul({hasHome:true, saleN:250000});
    const notes = await p.tekst('r-notes');
    assert.match(notes, /nog een woning bezit/);
    assert.match(notes, /vrijstelling onder voorwaarde van verkoop/);
    geenFouten(p);
    await p.sluit();
  });

  test('de voorwaarden van 2026 staan er altijd bij', async () => {
    const p = await metPagina({priceN:300000, b1InN:60000});
    const notes = await p.tekst('r-notes');
    assert.match(notes, /ononderbroken ingeschreven/);
    assert.match(notes, /elke koper afzonderlijk/);
    await p.sluit();
  });

  test('bij een tweede woning is er geen wegvalscenario', async () => {
    const p = await metPagina({priceN:300000, b1InN:60000, kind:'other'});
    const r = await p.regels('r-buy');
    assert.equal(r['Als het tarief van 12% wegvalt'], undefined);
    assert.equal(r['12% registratiebelasting'], 36000);
    await p.sluit();
  });

  test('de korting op een bescheiden woning geldt tot EUR 220.000', async () => {
    const p = await metPagina({b1InN:400000});

    await p.vul({priceN:200000});
    assert.equal((await p.regels('r-buy'))['2% registratiebelasting, min de korting'],
      200000 * 0.02 - 1867);

    await p.vul({priceN:220000});
    assert.equal((await p.regels('r-buy'))['2% registratiebelasting, min de korting'],
      220000 * 0.02 - 1867, 'op de grens zelf hoort de korting nog te gelden');

    await p.vul({priceN:220500});
    assert.equal((await p.regels('r-buy'))['2% registratiebelasting'], 4410,
      'boven de grens hoort er geen korting meer te zijn');
    geenFouten(p);
    await p.sluit();
  });

  test('het veld voor de ligging bestaat niet meer', async () => {
    // Vanaf 2026 is er een maximumprijs, zonder onderscheid naar ligging.
    const p = await metPagina();
    assert.equal(await p.bestaat('zone'), false);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de verkoop van je huidige woning', () => {

  test('de handlichting gaat van de opbrengst af', async () => {
    const p = await metPagina({priceN:300000, hasHome:true, saleN:250000,
                               agent:false, certs:0, hasOld:true,
                               oldBal:120000, oldRate:2, oldYears:10});
    const r = await p.regels('r-sell');
    assert.equal(r['Handlichting'], -800);
    // 250.000 min 120.000 aflossing, min drie maanden interest, min handlichting
    assert.equal(r['Houd je over'], 250000 - 120000 - 120000 * 0.02 * 0.25 - 800);
    geenFouten(p);
    await p.sluit();
  });

  test('bij een pandwissel is er geen handlichting', async () => {
    const p = await metPagina({priceN:300000, hasHome:true, saleN:250000,
                               hasOld:true, oldBal:120000, oldRate:2, oldYears:10});
    await p.kies('oldChoice', 'port');
    assert.equal(await p.zichtbaar('payoffBox'), false);
    const tekst = await p.tekst('r-sell');
    assert.doesNotMatch(tekst, /Handlichting/);
    assert.match(tekst, /pandwisselakte/);

    await p.kies('oldChoice', 'repay');
    assert.equal(await p.zichtbaar('payoffBox'), true);
    assert.match(await p.tekst('r-sell'), /Handlichting/);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('betaalbaarheid', () => {

  const situatie = {priceN:300000, b1InN:60000, inc1:4200, ratioN:33,
                    ovr:900, fire:35, ssv:40};

  test('de maandlast volgt de annuiteit van de lening', async () => {
    const p = await metPagina(situatie);
    const lening = await p.regels('r-loan'), maand = await p.regels('r-month');
    const verwacht = annuiteit(lening['Te lenen'], 0.0375, 25);
    assert.ok(Math.abs(maand['Nieuwe lening'] - verwacht) <= 1,
      'maandlast ' + maand['Nieuwe lening'] + ' tegen ' + verwacht);
    await p.sluit();
  });

  test('beide percentages staan er, en het totaal is het hoogste', async () => {
    const p = await metPagina(situatie);
    const m = await p.regels('r-month');
    const aflossing = m['Deel van je inkomen, aflossing alleen'];
    const totaal = m['Deel van je inkomen, alle woonkosten'];
    assert.ok(typeof aflossing === 'number', 'het aflossingspercentage ontbreekt');
    assert.ok(totaal > aflossing,
      'het percentage op alle woonkosten hoort hoger te liggen dan op de aflossing alleen');
    geenFouten(p);
    await p.sluit();
  });

  test('het kerncijfer staat op de totale last', async () => {
    const p = await metPagina(situatie);
    const m = await p.regels('r-month');
    const tegel = parseFloat((await p.tekst('s-ratio')).replace(/[^\d]/g, ''));
    assert.ok(Math.abs(tegel - m['Deel van je inkomen, alle woonkosten']) <= 1,
      'de tegel toont ' + tegel + '% en het blok ' + m['Deel van je inkomen, alle woonkosten'] + '%');
    await p.sluit();
  });

  test('de afgeleide maximumprijs staat op dezelfde basis als het percentage', async () => {
    // Dit was het punt waar de toets scheef stond: het percentage rekende met de
    // aflossing en de maximumprijs ook, terwijl het blok eronder de volledige
    // uitstroom toonde. Vul je de maximumprijs in, dan hoort het percentage nu
    // precies op de ingestelde grens uit te komen.
    const p = await metPagina(situatie);
    const notes = await p.tekst('r-notes');
    const gevonden = notes.match(/aankoopprijs van ongeveer\s*€\s*([\d.]+)/);
    assert.ok(gevonden, 'de afgeleide maximumprijs staat niet bij de aandachtspunten');

    const max = parseInt(gevonden[1].replace(/\./g, ''), 10);
    await p.vul({priceN:max});
    const m = await p.regels('r-month');
    assert.ok(Math.abs(m['Deel van je inkomen, alle woonkosten'] - 33) <= 1,
      'op de maximumprijs komt de last op ' + m['Deel van je inkomen, alle woonkosten']
      + '% in plaats van op de ingestelde 33%');
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('nieuwbouw', () => {

  test('de prijs valt uiteen in grond en gebouw, elk met eigen heffing', async () => {
    const p = await metPagina({priceN:400000, kind:'new', landVal:30, b1InN:600000});
    const r = await p.regels('r-buy');
    assert.equal(r['21% btw op de bouw'], 280000 * 0.21);
    assert.equal(r['12% registratiebelasting op de grond'], 120000 * 0.12);
    assert.equal(r['Ereloon notaris'], euro(schijfbedrag(BAREMA_KOOP, 120000) * BTW),
      'het ereloon hoort alleen op het grondaandeel te staan');
    geenFouten(p);
    await p.sluit();
  });

  test('zonder grondaandeel wordt de volle prijs als bouw gerekend, met waarschuwing', async () => {
    const p = await metPagina({priceN:400000, kind:'new', b1InN:600000});
    const r = await p.regels('r-buy');
    assert.equal(r['21% btw op de bouw'], 400000 * 0.21);
    assert.match(await p.tekst('r-notes'), /geen grondaandeel ingevuld/i);
    await p.sluit();
  });

  test('6% geldt alleen als alle voorwaarden aanstaan', async () => {
    const p = await metPagina({priceN:400000, kind:'new', landVal:30, b1InN:600000});
    await p.kies('vatRate', '6');
    let r = await p.regels('r-buy');
    assert.equal(r['21% btw op de bouw'], 280000 * 0.21,
      'zolang een voorwaarde ontbreekt hoort de pagina met 21% te rekenen');
    assert.match(await p.tekst('r-notes'), /niet alle voorwaarden staan aan/);

    await p.vul({v6demo:true, v6only:true, v6area:true, v6five:true});
    r = await p.regels('r-buy');
    assert.equal(r['6% btw op de bouw'], 280000 * 0.06);
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('randgevallen en de afdruk', () => {

  test('zonder aankoopprijs staat er geen nul maar een uitnodiging', async () => {
    const p = await metPagina();
    assert.match(await p.tekst('r-buy'), /Vul een aankoopprijs in/);
    assert.match(await p.tekst('s-ratio'), /—/);
    geenFouten(p);
    await p.sluit();
  });

  test('meer eigen geld dan nodig geeft een overschot in plaats van een lening', async () => {
    const p = await metPagina({priceN:200000, b1InN:400000});
    assert.match(await p.tekst('r-loan'), /Je hoeft niets te lenen/);
    assert.doesNotMatch(await p.tekst('r-loan'), /Mee te financieren/);
    await p.sluit();
  });

  test('het afdrukoverzicht bouwt alle blokken op', async () => {
    const p = await metPagina({priceN:420000, hasHome:true, saleN:300000,
                               hasOld:true, oldBal:90000, oldRate:2.1, oldYears:8,
                               b1InN:70000, inc1:5200, ovr:1100, fire:40, ssv:45,
                               moving:8000});
    const h = await p.html('pd-body');
    for(const kop of ['Uitgangspunten', 'Wat de verkoop opbrengt', 'Wat de woning kost',
                      'De lening', 'Wat je elke maand betaalt', 'Aandachtspunten']){
      assert.ok(h.includes('<h2>' + kop + '</h2>'), 'het afdrukoverzicht mist "' + kop + '"');
    }
    assert.match(h, /voorwaardelijk/, 'het voorwaardelijke tarief hoort op papier te staan');
    assert.match(h, /aanhorigheden/, 'de kredietakte hoort op papier uitgelegd te staan');
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de pagina zelf', () => {

  const html = readFileSync(
    join(dirname(dirname(fileURLToPath(import.meta.url))), 'index.html'), 'utf8');

  test('er staat maar een datum waarop de tarieven zijn nagekeken', () => {
    // De datum staat op drie plekken: de stempel op het scherm, de bronvermelding
    // en het voorbehoud op papier. Ze horen gelijk te lopen, anders leest een
    // bezoeker een andere datum dan hij afdrukt.
    const datums = new Set([...html.matchAll(/nagekeken op (\d+ \w+ \d{4})/g)].map(m => m[1]));
    assert.equal(datums.size, 1,
      'er lopen verschillende datums door de pagina: ' + [...datums].join(', '));
  });

  test('het script verstuurt niets en bewaart niets', () => {
    // Dit is de privacybelofte uit de README. Ze is de reden dat de tarieven in
    // een objectliteral in dit bestand staan en niet in een apart bestand.
    //
    // Alleen het script wordt hier bekeken, niet de hele pagina: de tekst van de
    // privacyparagraaf noemt deze namen zelf, en dat is geen gebruik ervan.
    const script = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
    assert.ok(script.length > 1000, 'het script is niet gevonden');
    for(const verboden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
                           'sendBeacon', 'WebSocket', 'EventSource', 'import(']){
      assert.ok(!script.includes(verboden),
        'het script gebruikt "' + verboden + '"; dat breekt de privacybelofte');
    }
  });

  test('de pagina laadt geen enkel bestand van buiten', () => {
    // Navigatielinks in een a-element mogen: die halen niets op tot je klikt.
    // Wat niet mag is een bestand dat de browser zelf gaat ophalen, want dan
    // gaat er een ip-adres naar een derde partij zonder dat iemand iets deed.
    for(const patroon of [/<script[^>]+\bsrc=/i, /<link\b[^>]*\bhref=/i, /<img\b/i,
                          /<iframe\b/i, /<video\b/i, /<audio\b/i, /<embed\b/i,
                          /<object\b/i, /@import/i, /url\(\s*['"]?https?:/i]){
      assert.ok(!patroon.test(html),
        'de pagina laadt een extern bestand, gevonden met ' + patroon);
    }
  });

  test('de rekenhulp blijft een enkel bestand zonder afhankelijkheden', () => {
    // De tests hebben wel een afhankelijkheid, de rekenhulp niet. Zodra
    // index.html naar node_modules of een bundel verwijst, is dat verschil weg.
    assert.ok(!html.includes('node_modules'));
    assert.ok(!html.includes('require('));
  });
});
