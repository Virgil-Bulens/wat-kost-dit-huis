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
    const uitBarema = euro(schijfbedrag(BAREMA_KOOP, 400000) * BTW);

    // In de baremastand rekent het barema en is het vak niet te wijzigen. Het staat op
    // readonly en niet op disabled, want er staat een uitkomst in die leesbaar hoort te
    // blijven.
    assert.equal(await p.alleenLezen('notVal'), true,
      'in de baremastand hoort het invoervak niet te wijzigen te zijn');

    await p.klik('#notSeg button[data-m="eur"]');
    assert.equal(await p.alleenLezen('notVal'), false);
    await p.vul({notVal:5000});
    assert.equal((await p.regels('r-buy'))['Ereloon notaris'], 5000);

    await p.klik('#notSeg button[data-m="pct"]');
    assert.equal((await p.regels('r-buy'))['Ereloon notaris'], uitBarema);
    geenFouten(p);
    await p.sluit();
  });

  test('in de baremastand staat het berekende ereloon in het vak', async () => {
    // Het vak stond leeg zolang je het op barema liet staan, en dan lijkt het alsof er
    // niets berekend wordt. Het barema rekent per schijf, dus het bedrag dat eruit komt
    // hoort er ook in te staan, en het hoort de prijs te volgen.
    const p = await metPagina({priceN:250000});
    const bij = n => '\u20AC ' + new Intl.NumberFormat('nl-BE',
      {maximumFractionDigits:0}).format(euro(schijfbedrag(BAREMA_KOOP, n) * BTW));

    assert.equal((await p.waarden(['notVal'])).notVal, bij(250000));
    await p.vul({priceN:400000});
    assert.equal((await p.waarden(['notVal'])).notVal, bij(400000),
      'het vak volgt de prijs niet');

    // en het staat gelijk met wat het resultaatblok zegt
    assert.equal((await p.regels('r-buy'))['Ereloon notaris'],
      euro(schijfbedrag(BAREMA_KOOP, 400000) * BTW));

    geenFouten(p);
    await p.sluit();

    // Zonder prijs valt er niets te rekenen, dan blijft het vak leeg. Dat vraagt een
    // verse pagina: het invoervak leegmaken laat de schuifbalk staan, en v() valt daar
    // met opzet op terug, dus dan is er nog steeds een prijs.
    const leeg = await metPagina();
    assert.equal((await leeg.waarden(['notVal'])).notVal, '');
    geenFouten(leeg);
    await leeg.sluit();
  });

  test('een uitkomst gaat niet mee in een deelbare link', async () => {
    // Zou het ereloon in de baremastand meegaan, dan draagt elke link een bedrag dat
    // niemand heeft ingevuld. In de euro-stand is het wel invoer en gaat het wel mee.
    const p = await metPagina({priceN:400000});
    assert.doesNotMatch(await p.link(), /notVal/);

    await p.klik('#notSeg button[data-m="eur"]');
    await p.vul({notVal:5000});
    assert.match(await p.link(), /notVal=5000/);
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

  test('de maximumprijs houdt rekening met andere kredieten', async () => {
    // Deze test dekt het gat dat de vorige laat: die rekent zonder andere
    // kredieten. Met een autolening erbij hoort de maximumprijs te dalen, en
    // hoort de grens te gelden voor de woonlast plus die kredieten samen. Het
    // getoonde percentage laat de andere kredieten bewust weg, dus dat percentage
    // ligt op de maximumprijs lager dan de ingestelde grens; het verschil is
    // precies wat die kredieten van het inkomen opeisen.
    const zonder = await metPagina({...situatie, debts:0});
    const met = await metPagina({...situatie, debts:400});

    const prijs = async p => {
      const g = (await p.tekst('r-notes')).match(/aankoopprijs van ongeveer\s*€\s*([\d.]+)/);
      assert.ok(g, 'de afgeleide maximumprijs ontbreekt');
      return parseInt(g[1].replace(/\./g, ''), 10);
    };
    const prijsZonder = await prijs(zonder), prijsMet = await prijs(met);
    assert.ok(prijsMet < prijsZonder,
      'met andere kredieten hoort de maximumprijs lager te liggen: '
      + prijsMet + ' tegen ' + prijsZonder);

    await met.vul({priceN:prijsMet});
    const m = await met.regels('r-month');
    const woonlast = m['Deel van je inkomen, alle woonkosten'];
    const kredieten = 400 / situatie.inc1 * 100;
    assert.ok(Math.abs(woonlast + kredieten - 33) <= 1,
      'de woonlast van ' + woonlast + '% plus ' + kredieten.toFixed(0)
      + '% aan andere kredieten hoort op de ingestelde 33% uit te komen');

    geenFouten(zonder); geenFouten(met);
    await zonder.sluit(); await met.sluit();
  });

  test('de vuistregel van een derde wordt tegen de aflossing gelegd', async () => {
    // Wikifin houdt een derde aan voor de afbetaling zelf en noemt de
    // verzekeringen en de onroerende voorheffing als kosten die daar bovenop
    // komen. Ligt de aflossing onder die grens en het totaal erboven, dan mag de
    // pagina niet melden dat je de vuistregel overschrijdt.
    const p = await metPagina(situatie);
    const m = await p.regels('r-month');
    const aflossing = m['Deel van je inkomen, aflossing alleen'];
    const totaal = m['Deel van je inkomen, alle woonkosten'];
    assert.ok(aflossing <= 33 && totaal > 33,
      'deze test heeft een geval nodig waarin de aflossing onder een derde ligt en '
      + 'het totaal erboven; nu is dat ' + aflossing + '% en ' + totaal + '%');

    const notes = await p.tekst('r-notes');
    assert.doesNotMatch(notes, /Wikifin houdt ongeveer een derde/,
      'de aflossing ligt onder een derde, dus die melding hoort er niet te staan');
    // Maar de pagina hoort niet te zwijgen over haar eigen kerncijfer: dat het
    // meevalt is ook een antwoord, en beide getallen horen erin te staan.
    assert.match(notes, /blijf je onder de vuistregel/);
    assert.match(notes, new RegExp(aflossing + '% van je netto inkomen gaat naar de aflossing'));
    assert.match(notes, new RegExp('erbij is het ' + totaal + '%'));
    geenFouten(p);
    await p.sluit();
  });

  test('boven een derde aflossing wordt de vuistregel wel genoemd, met het totaal erbij', async () => {
    // Tussen de twee drempels: boven een derde, maar niet zo hoog dat de
    // waarschuwing over een hoge last de plaats van deze melding inneemt.
    const p = await metPagina({...situatie, priceN:300000, b1InN:40000});
    const m = await p.regels('r-month');
    const aflossing = m['Deel van je inkomen, aflossing alleen'];
    assert.ok(aflossing > 33 && aflossing <= 40,
      'deze test heeft een aflossing tussen een derde en 40% nodig, nu ' + aflossing + '%');

    const notes = await p.tekst('r-notes');
    assert.match(notes, /gaat naar de aflossing/);
    assert.match(notes, /voor de afbetaling zelf; de verzekeringen en de onroerende voorheffing komen daar bovenop/);
    assert.match(notes, new RegExp('erbij is het ' + m['Deel van je inkomen, alle woonkosten'] + '%'),
      'het totaal hoort in dezelfde melding te staan');
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

  test('op papier wordt geen enkel label tot een letterkolom geknepen', async () => {
    // De waarde op papier is lang niet altijd een bedrag: bij het verlaagde
    // tarief en bij de kosten van de kredietakte staat er een halve zin. Nam die
    // zin haar volle breedte, dan bleef er voor het label niets over en kwam het
    // letter onder letter te staan, terwijl de waarde zelf van het blad liep.
    // Deze test kijkt naar de opmaak op bladbreedte, niet naar de tekst.
    const p = await metPagina({priceN:350000, kind:'own', inc1:3200,
                               hasHome:true, saleN:260000, agent:true,
                               hasOld:true, oldBal:90000});
    await p.afdrukstand();
    const regels = await p.afdrukregels();
    assert.ok(regels.length > 10, 'er staan nauwelijks regels op papier');
    for(const r of regels){
      assert.ok(r.overloop < 1,
        'de regel "' + r.label + '" loopt ' + Math.round(r.overloop) + 'px buiten het blad');
      assert.ok(r.labelRegels <= 2,
        'het label "' + r.label + '" is over ' + r.labelRegels + ' regels gebroken, '
        + 'in een kolom van ' + Math.round(r.labelBreedte) + 'px');
    }
    geenFouten(p);
    await p.sluit();
  });

  test('een waarde die langer is dan de regel breed is, duwt het label niet weg', async () => {
    // De vorige test kijkt naar de tekst die er nu staat. Deze toetst de opmaak
    // zelf: ook een waarde die niet op een regel past, hoort de kolom van het
    // label te laten staan en binnen het blad af te breken.
    const p = await metPagina({priceN:350000, kind:'own'});
    await p.afdrukstand();
    await p.zetAfdrukwaarde('Situatie',
      'een waarde die veel te lang is om op een regel te passen en die daarom '
      + 'over meerdere regels moet afbreken in plaats van de kolom van het label op te eten');
    const r = (await p.afdrukregels()).find(x => x.label === 'Situatie');
    assert.ok(r.overloop < 1,
      'de regel loopt ' + Math.round(r.overloop) + 'px buiten het blad');
    assert.ok(r.labelRegels <= 2,
      'het label is over ' + r.labelRegels + ' regels gebroken, '
      + 'in een kolom van ' + Math.round(r.labelBreedte) + 'px');
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de opmaak van de invoervakken', () => {

  // De vakjes zijn text en geen number, want een number-veld weigert elke opgemaakte
  // vorm op één na: het aanvaardt "600.000" en leest dat als 600. Daarom loopt alle
  // invoer door één ontleder en alle weergave door één opmaker, en daarom staat hier
  // een toets op elk van beide.

  test('een bedrag groeit mee terwijl je typt', async () => {
    const p = await metPagina();
    const gezien = [];
    await p.typ('priceN', '');
    for(const teken of '600000'){
      await p.typ('priceN', teken);
      gezien.push((await p.waarden(['priceN'])).priceN);
    }
    assert.deepEqual(gezien, ['€ 6', '€ 60', '€ 600',
                              '€ 6.000', '€ 60.000', '€ 600.000']);
    geenFouten(p);
    await p.sluit();
  });

  test('de velden met een beginwaarde staan bij het laden al opgemaakt', async () => {
    const p = await metPagina();
    const w = await p.waarden(['disb', 'mortFix', 'bankFee', 'release', 'rateN', 'termN']);
    assert.equal(w.disb, '€ 1.407');
    assert.equal(w.mortFix, '€ 1.200');
    assert.equal(w.bankFee, '€ 350');
    assert.equal(w.release, '€ 800');
    assert.equal(w.rateN, '3,75');          // een percentage, met komma en zonder teken
    assert.equal(w.termN, '25');            // een aantal blijft kaal
    geenFouten(p);
    await p.sluit();
  });

  test('backspace op een scheidingsteken wist het cijfer ervoor', async () => {
    // Zonder dit wist backspace de punt, maakt de opmaak exact dezelfde tekst terug
    // op, en lijkt de cursor vast te zitten.
    const p = await metPagina({priceN: 600000});
    const gezien = [];
    await p.zetCursor('priceN', (await p.waarden(['priceN'])).priceN.length);
    for(let i = 0; i < 3; i++){
      await p.toets('priceN', 'Backspace');
      gezien.push((await p.waarden(['priceN'])).priceN);
    }
    assert.deepEqual(gezien, ['€ 60.000', '€ 6.000', '€ 600']);
    geenFouten(p);
    await p.sluit();
  });

  test('backspace op het scheidingsteken zelf wist het cijfer ervoor', async () => {
    // Dit is de plek waar het echt om gaat. Staat de cursor net achter de punt van
    // "€ 600.000", dan zou een gewone backspace die punt wissen; de opmaak zet er
    // precies dezelfde tekst voor terug en dan lijkt de cursor vast te zitten. De punt
    // hoort dus overgeslagen te worden en het cijfer ervóór te verdwijnen.
    const p = await metPagina({priceN: 600000});
    assert.equal((await p.waarden(['priceN'])).priceN, '\u20AC 600.000');
    await p.zetCursor('priceN', 6);            // "€ 600.|000"
    await p.toets('priceN', 'Backspace');
    assert.equal((await p.waarden(['priceN'])).priceN, '\u20AC 60.000',
      'de punt is gewist in plaats van het cijfer ervoor, dus de cursor zit vast');
    geenFouten(p);
    await p.sluit();
  });

  test('een komma in de maak blijft staan in een percentageveld', async () => {
    // Wie ontleedt en opnieuw opmaakt, krijgt van "3," een "3" terug en dan verdwijnt
    // de komma onder je vingers op het moment dat je hem zet.
    const p = await metPagina();
    await p.vul({rateN: ''});
    const gezien = [];
    for(const teken of '3,75'){
      await p.typ('rateN', teken);
      gezien.push((await p.waarden(['rateN'])).rateN);
    }
    assert.deepEqual(gezien, ['3', '3,', '3,7', '3,75']);
    geenFouten(p);
    await p.sluit();
  });

  test('de cursor blijft op zijn plek in de cijferreeks', async () => {
    // De cursor wordt in cijfers geteld en niet in tekens: zodra er een
    // scheidingsteken bijkomt, klopt een positie in tekens niet meer.
    const p = await metPagina({priceN: 600000});
    await p.zetCursor('priceN', 4);              // "€ 60|0.000", dus na twee cijfers
    await p.typ('priceN', '9');
    assert.equal((await p.waarden(['priceN'])).priceN, '€ 6.090.000');
    // de cursor staat direct achter de 9 die net getypt is
    assert.equal(await p.cursor('priceN'), 6);
    geenFouten(p);
    await p.sluit();
  });

  test('de pijltjes stappen met de stap van het veld', async () => {
    // type="number" deed dit zelf; die stap is hier herschreven. De stappen doen mee:
    // duizend voor een prijs, een honderdste voor een rentevoet, een jaar voor de looptijd.
    const p = await metPagina({priceN: 300000});
    await p.toets('priceN', 'ArrowUp');
    assert.equal((await p.waarden(['priceN'])).priceN, '€ 301.000');
    await p.toets('priceN', 'ArrowDown', 2);
    assert.equal((await p.waarden(['priceN'])).priceN, '€ 299.000');
    await p.toets('rateN', 'ArrowUp');
    assert.equal((await p.waarden(['rateN'])).rateN, '3,76');
    await p.toets('termN', 'ArrowUp');
    assert.equal((await p.waarden(['termN'])).termN, '26');
    geenFouten(p);
    await p.sluit();
  });

  test('de pijltjes blijven binnen de grenzen van het veld', async () => {
    const p = await metPagina({termN: 5});
    await p.toets('termN', 'ArrowDown', 3);
    assert.equal((await p.waarden(['termN'])).termN, '5');   // data-min
    await p.vul({termN: 40});
    await p.toets('termN', 'ArrowUp', 3);
    assert.equal((await p.waarden(['termN'])).termN, '40');  // data-max
    geenFouten(p);
    await p.sluit();
  });

  test('de ontleder leest de Belgische vorm en de vorm van een cijferblok', async () => {
    // Wat de punt betekent, hangt af van het soort veld. Bij een bedrag is het een
    // duizendteken, want bedragen worden hier op hele euro's gehouden. Bij een
    // percentage is het een decimaalteken, want die getallen blijven onder honderd en
    // worden nooit gegroepeerd; zo leest een 3.2 van een cijferblok als drie komma
    // twee en niet als tweeendertig, wat een number-veld er wel van maakt.
    const p = await metPagina();
    for(const [ingevuld, verwacht] of [['600000', '€ 600.000'],
                                       ['600.000', '€ 600.000'],
                                       ['1.000.000', '€ 1.000.000'],
                                       ['€ 450.000', '€ 450.000']]){
      await p.vul({priceN: ingevuld});
      assert.equal((await p.waarden(['priceN'])).priceN, verwacht, 'ingevuld: ' + ingevuld);
    }
    // en in een percentageveld leest een punt met één cijfer erachter als decimaal
    await p.vul({rateN: '3.2'});
    assert.equal((await p.waarden(['rateN'])).rateN, '3,2');
    geenFouten(p);
    await p.sluit();
  });

  test('de link draagt kale getallen en niet de opmaak', async () => {
    // Anders zou er "%E2%82%AC%20600.000" in de url staan, en dat leest geen mens.
    const p = await metPagina({priceN: 600000, inc1: 3200});
    const link = await p.link();
    assert.match(link, /price=600000/);
    assert.match(link, /inc1=3200/);
    assert.doesNotMatch(link, /600\.000/);
    assert.doesNotMatch(link, /%E2%82%AC/);
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de inbreng en haar grenzen', () => {

  // "Je hebt", "minstens" en "hoogstens" begrenzen de schuifbalk. Ze mogen het
  // bedrag in het invoervak niet aanraken: dat vak is de bron van waarheid, en de
  // functie die de grenzen zet draait bij elke herberekening, dus ook terwijl er in
  // een van die drie vakjes getypt wordt.
  const GRENSVELDEN = [['b1Have', 'je hebt'], ['b1Min', 'minstens'], ['b1Max', 'hoogstens']];

  for(const [veld, naam] of GRENSVELDEN){
    test(`"${naam}" invullen laat de inbreng staan`, async () => {
      const p = await metPagina({priceN: 300000, b1InN: 50000});
      // teken voor teken, want bij het eerste cijfer stond er 6 in plaats van 600000
      await p.tik(veld, 600000);
      // Het vak toont een opgemaakt bedrag; dat het er nog staat én dat het opgemaakt
      // is, staat hier in één regel.
      assert.equal((await p.waarden(['b1InN'])).b1InN, '\u20AC 50.000',
        'het invullen van "' + naam + '" heeft de inbreng verschoven');
      geenFouten(p);
      await p.sluit();
    });
  }

  test('ook bij de tweede koper blijft de inbreng staan', async () => {
    const p = await metPagina({priceN: 300000, two: true, b2InN: 40000});
    await p.tik('b2Have', 100000);
    assert.equal((await p.waarden(['b2InN'])).b2InN, '\u20AC 40.000');
    geenFouten(p);
    await p.sluit();
  });

  test('de schuifbalk kan het bedrag uit het vak aanwijzen', async () => {
    // Anders klemt de duim aan een uiteinde en liegt hij over wat er in het vak
    // staat. De grove stapgrootte rondt de duim af, dus hier wordt getoetst dat het
    // bedrag binnen het bereik valt en niet dat de duim er exact op staat.
    const p = await metPagina({priceN: 300000, b1InN: 50000, b1Have: 10000});
    const balk = await p.bereik('b1In');
    assert.ok(balk.min <= 50000 && 50000 <= balk.max,
      'de inbreng van 50000 valt buiten het bereik ' + JSON.stringify(balk));
    assert.equal((await p.waarden(['b1InN'])).b1InN, '\u20AC 50.000');
    geenFouten(p);
    await p.sluit();
  });

  test('meer inbrengen dan je hebt wordt gezegd, niet weggerekend', async () => {
    const p = await metPagina({priceN: 300000, b1InN: 50000, b1Have: 30000});
    const notes = await p.tekst('r-notes');
    assert.match(notes, /Er komt .*20\.000 te kort/);
    // en dan niet ook nog de melding over een krappe buffer, die iets anders zegt
    assert.doesNotMatch(notes, /achter de hand/);
    assert.match(await p.tekst('s-cash-sub'), /meer ingebracht dan je hebt/);
    geenFouten(p);
    await p.sluit();
  });

  test('een krappe buffer blijft een krappe buffer', async () => {
    // De melding over te kort mag de bestaande melding over een krappe buffer niet
    // verdringen zolang er niets te kort komt.
    const p = await metPagina({priceN: 300000, b1InN: 50000, b1Have: 55000});
    const notes = await p.tekst('r-notes');
    assert.match(notes, /achter de hand/);
    assert.doesNotMatch(notes, /te kort/);
    geenFouten(p);
    await p.sluit();
  });
});

// ---------------------------------------------------------------------------

describe('de bewaarbare en deelbare link', () => {

  const html = readFileSync(
    join(dirname(dirname(fileURLToPath(import.meta.url))), 'index.html'), 'utf8');
  const asOf = html.match(/asOf:'([^']+)'/)[1];

  // De kerncijfers bovenaan, als één regel tekst. Een rondgang hoort ze
  // ongewijzigd terug te geven: staat er na het openen van de link hetzelfde, dan
  // is niet alleen de invoer teruggezet maar ook alles wat eruit volgt.
  const KERN = ['s-cash', 's-loan', 's-pay', 's-ratio'];
  async function kerncijfers(p){
    const uit = [];
    for(const id of KERN) uit.push(await p.tekst(id));
    return uit.join(' | ');
  }

  test('een link neemt de invoer mee en geeft ze ongewijzigd terug', async () => {
    // Eén scenario dat elke soort veld raakt: een gekoppeld paar, een gewoon
    // bedrag, een aanvinkvakje, een keuzelijst, een groep radioknoppen en een
    // schakelaar die op euro staat.
    const p = await metPagina({priceN: 450000, termN: 30, rateN: 3.2, inc1: 3200,
                               hasHome: true, saleN: 300000, kind: 'new',
                               two: true, b2InN: 20000, ovr: 900});
    await p.kies('vatRate', 6);
    await p.klik('#landSeg button[data-m=eur]');
    await p.vul({landVal: 60000});

    const VELDEN = ['priceN', 'termN', 'rateN', 'inc1', 'hasHome', 'saleN', 'kind',
                    'two', 'b2InN', 'ovr', 'landVal'];
    const heen = {kern: await kerncijfers(p), velden: await p.waarden(VELDEN),
                  stand: await p.stand('landSeg'), btw: await p.keuze('vatRate')};
    const link = await p.link();
    geenFouten(p);
    await p.sluit();

    const q = await openPagina(link);
    assert.deepEqual({kern: await kerncijfers(q), velden: await q.waarden(VELDEN),
                      stand: await q.stand('landSeg'), btw: await q.keuze('vatRate')}, heen);
    geenFouten(q);
    await q.sluit();
  });

  test('de link blijft kort: alleen wat afwijkt van de beginwaarde gaat mee', async () => {
    // Anders zou elke link alle negentien beginwaarden meeslepen. De
    // tarievendatum gaat altijd mee, want daar hangt de waarschuwing aan.
    const p = await metPagina({priceN: 250000});
    assert.equal(await p.link(), '#v1&price=250000&asOf=' + asOf);
    geenFouten(p);
    await p.sluit();
  });

  test('een geopende link blijft deelbaar', async () => {
    // Wie een link krijgt en hem doorstuurt, hoort dezelfde link door te sturen.
    // Dat gaat mis zodra de beginwaarden pas worden opgenomen nadat de link is
    // teruggezet: dan gelden de waarden uit de link als beginwaarde, en levert de
    // knop een lege link op.
    // in de volgorde waarin de tabel de velden opsomt, want die volgorde is vast
    const frag = '#v1&price=380000&sale=250000&term=28&inc1=2800&hasHome=1&asOf=' + asOf;
    const p = await openPagina(frag);
    assert.equal(await p.link(), frag);
    geenFouten(p);
    await p.sluit();
  });

  test('een link met meer inbreng dan spaargeld komt ongewijzigd terug', async () => {
    // Voor de reparatie van #12 stelde clampBuyer de inbreng bij tijdens de eerste
    // herberekening, dus deze link kwam terug met een andere inbreng dan hij bij zich
    // had. Een link hoort te zeggen wat hij zegt, ook als de invoer zichzelf
    // tegenspreekt; de pagina meldt die tegenspraak in de aandachtspunten.
    const frag = '#v1&price=300000&b1In=50000&b1Have=30000&asOf=' + asOf;
    const p = await openPagina(frag);
    assert.equal((await p.waarden(['b1InN'])).b1InN, '\u20AC 50.000');
    // en de link draagt een kaal getal, niet de opgemaakte tekst
    assert.equal(await p.link(), frag);
    geenFouten(p);
    await p.sluit();
  });

  test('een lege invoer geeft een link zonder waarden', async () => {
    const p = await metPagina();
    assert.equal(await p.link(), '#v1&asOf=' + asOf);
    geenFouten(p);
    await p.sluit();
  });

  test('een stand op euro wordt bij het terugzetten niet omgerekend', async () => {
    // Dit is de val: de knop rekent de waarde om naar de nieuwe eenheid, en een
    // link brengt haar al in de juiste eenheid mee. Wie het terugzetten via die
    // knop laat lopen, deelt 60.000 nog eens door de prijs.
    const p = await openPagina('#v1&price=400000&kind=new&mLand=eur&landVal=60000&asOf=' + asOf);
    assert.equal((await p.waarden(['landVal'])).landVal, '\u20AC 60.000');
    assert.equal(await p.stand('landSeg'), 'eur');
    geenFouten(p);
    await p.sluit();
  });

  test('een stand uit de link rekent een veld op zijn beginwaarde niet om', async () => {
    // Hier scheiden de wegen van de knop en de link. De commissie staat standaard
    // op 3, en omdat dat de beginwaarde is, staat ze niet in de link. Zou het
    // terugzetten via de knop lopen, dan rekende die de 3 om naar 3% van de
    // verkoopprijs en stond er 9.000 in het vak. De link zegt "beginwaarde", dus
    // hoort er 3 te staan.
    const p = await openPagina('#v1&price=400000&hasHome=1&sale=300000&mFee=eur&asOf=' + asOf);
    // Nog steeds de beginwaarde 3 en niet 9.000; ze staat er nu als bedrag, want de
    // link zet de stand op euro.
    assert.equal((await p.waarden(['feeVal'])).feeVal, '\u20AC 3');
    assert.equal(await p.stand('feeSeg'), 'eur');
    geenFouten(p);
    await p.sluit();
  });

  test('een schakelaar die op de beginstand staat, komt ook zo terug', async () => {
    const p = await openPagina('#v1&price=400000&kind=new&landVal=15&asOf=' + asOf);
    assert.equal(await p.stand('landSeg'), 'pct');
    geenFouten(p);
    await p.sluit();
  });

  test('een vreemde link maakt niets stuk en laat de pagina op haar beginwaarden', async () => {
    // Een link komt van buiten. Een onbekende sleutel, een waarde die niet in het
    // veld past en een getal in exponentvorm worden genegeerd en niet geraden:
    // kind=onzin zou de selectedIndex op -1 zetten, waarna het opzoeken van de
    // keuzetekst valt, en 1e400 zou als Infinity in de bovengrens van de
    // schuifbalk belanden.
    const p = await openPagina('#v1&kind=onzin&price=1e400&zzz=1&landVal=%E2%82%AC&two=ja');
    const w = await p.waarden(['priceN', 'kind', 'landVal', 'two']);
    assert.equal(w.priceN, '');
    assert.equal(w.kind, 'own');
    assert.equal(w.landVal, '');
    assert.equal(w.two, false);
    assert.equal((await p.waarden(['price'])).price, '0');
    assert.equal(await p.tekst('s-loan'), '€0');
    // De schuifbalk verruimt haar bovengrens zodra je een groter bedrag typt. Met
    // een waarde als 1e400 zou daar Infinity in komen te staan.
    const grens = await p.grens('price');
    assert.ok(Number.isFinite(Number(grens)), 'de bovengrens van de schuifbalk is ' + grens);
    geenFouten(p);
    await p.sluit();
  });

  test('een waarde buiten het bereik van het veld wordt naar de grens gebracht', async () => {
    // De looptijd loopt tot 40 jaar. Een link die 999 meebrengt, hoort niet met
    // 999 jaar te rekenen.
    const p = await openPagina('#v1&price=250000&term=999&asOf=' + asOf);
    assert.equal((await p.waarden(['termN'])).termN, '40');
    geenFouten(p);
    await p.sluit();
  });

  test('een fragment zonder versie wordt niet gelezen', async () => {
    // Zonder die eis zou een oude link ooit stil verkeerd gelezen worden.
    const p = await openPagina('#price=999000&term=40');
    const w = await p.waarden(['priceN', 'termN']);
    assert.equal(w.priceN, '');
    assert.equal(w.termN, '25');
    geenFouten(p);
    await p.sluit();
  });

  test('elk invoerveld past in de link', async () => {
    // Zonder deze toets zakt een nieuw invoerveld stil buiten de link: de pagina
    // blijft werken, maar wie zijn link opent, mist precies dat ene bedrag.
    const lijst = naam => {
      const van = html.indexOf('var ' + naam + '=[');
      assert.ok(van >= 0, 'de lijst ' + naam + ' is niet gevonden');
      const tot = html.indexOf('];', van);
      return [...html.slice(van, tot).matchAll(/'([^']+)'/g)].map(x => x[1]);
    };
    const paren = [...html.match(/var pairOf=\{([^}]*)\}/s)[1]
      .matchAll(/(\w+):'(\w+)'/g)].map(m => [m[1], m[2]]);

    const gedekt = new Set([...lijst('linkNum'), ...lijst('linkChk'), ...lijst('linkSel'),
                            // het invoervak van een gekoppeld paar staat onder de basis-id
                            ...paren.map(([, twin]) => twin),
                            // het veld met de link zelf is geen invoer voor de berekening
                            'linkUrl']);

    const velden = [...html.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
    assert.ok(velden.length > 40, 'de invoervelden zijn niet gevonden');
    const vergeten = velden.filter(id => !gedekt.has(id));
    assert.deepEqual(vergeten, [],
      'deze invoervelden gaan niet mee in de link: ' + vergeten.join(', '));
  });

  test('een link met een oudere tarievendatum meldt zich', async () => {
    // Een link bewaart de invoer en niet de uitkomst, dus hij rekent met de
    // tarieven van vandaag. Zonder deze regel verschuift het bedrag stil.
    const oud = await openPagina('#v1&price=250000&asOf=2025-01-15');
    const tekst = await oud.tekst('r-notes');
    assert.match(tekst, /15 januari 2025/);
    assert.match(tekst, /gemaakt toen de tarieven/);
    geenFouten(oud);
    await oud.sluit();

    // en met de huidige datum niet
    const nu = await openPagina('#v1&price=250000&asOf=' + asOf);
    assert.doesNotMatch(await nu.tekst('r-notes'), /gemaakt toen de tarieven/);
    geenFouten(nu);
    await nu.sluit();
  });

  test('de waarschuwing komt er ook zonder aankoopprijs', async () => {
    // De aandachtspunten stoppen vroeg zolang er geen prijs staat. De
    // waarschuwing over de tarieven hoort daarboven te staan.
    const p = await openPagina('#v1&inc1=3000&asOf=2025-01-15');
    assert.match(await p.tekst('r-notes'), /gemaakt toen de tarieven/);
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

    // RATES.asOf staat in ISO-vorm, want die datum gaat mee in een deelbare
    // link. Het is dus een vierde plek waar dezelfde datum staat, en zonder
    // deze toets zou ze stil uit de pas lopen met het proza.
    const MAANDEN = ['januari','februari','maart','april','mei','juni','juli',
                     'augustus','september','oktober','november','december'];
    const [dag, maand, jaar] = [...datums][0].split(' ');
    const iso = jaar + '-' + String(MAANDEN.indexOf(maand) + 1).padStart(2, '0')
              + '-' + dag.padStart(2, '0');
    const gevonden = html.match(/asOf:'([^']+)'/);
    assert.ok(gevonden, 'RATES.asOf is niet gevonden');
    assert.equal(gevonden[1], iso,
      'RATES.asOf loopt niet gelijk met de datum in het proza');
  });

  test('het script verstuurt niets en bewaart niets', () => {
    // Dit is de privacybelofte uit de README. Ze is de reden dat de tarieven in
    // een objectliteral in dit bestand staan en niet in een apart bestand.
    //
    // Alleen het script wordt hier bekeken, niet de hele pagina: de tekst van de
    // privacyparagraaf noemt deze namen zelf, en dat is geen gebruik ervan.
    const script = html.slice(html.lastIndexOf('<script>'), html.lastIndexOf('</script>'));
    assert.ok(script.length > 1000, 'het script is niet gevonden');
    //
    // replaceState en pushState staan er ook bij. Ze versturen niets, maar ze
    // zouden de ingevulde bedragen in de adresbalk en in de geschiedenis van de
    // browser zetten. Een deelbare link hoort pas te bestaan als iemand erom
    // vraagt, en die keuze ligt hier vast.
    for(const verboden of ['fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
                           'sendBeacon', 'WebSocket', 'EventSource', 'import(',
                           'replaceState', 'pushState']){
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
