# Wat kost dit huis?

Rekenhulp voor kandidaat-kopers in Vlaanderen. Rekent uit wat er bovenop de
vraagprijs komt, wat je overhoudt als je eerst je eigen woning verkoopt,
hoeveel je moet lenen en wat dat elke maand kost.

Niets staat voorgevuld. Standaard rekent de tool met één koper; een koppel kan
gezamenlijke bedragen invullen of een tweede koper met eigen bedragen
toevoegen. Elke schuifbalk heeft een invoervak, zodat je ook een exact bedrag
kan typen.

## Uitleg bij de begrippen

Naast elk vakjargon staat een vraagteken. Dat klapt een blokje open met uitleg in
gewone taal en een link naar de bron. Zesentwintig begrippen, van
registratiebelasting tot wederbeleggingsvergoeding.

Bewust geen `title`-attribuut. Dat is niet met het toetsenbord te bereiken,
onzichtbaar op een aanraakscherm en het wordt wisselend voorgelezen, maar de reden
die de knoop doorhakt is eenvoudiger: in een tooltip van de browser kan je niet
klikken, en de link naar de bron is de helft van de bedoeling. Het is dus een
echte knop met een blokje dat in de pagina staat. Daardoor hoeft er niets
gepositioneerd te worden en valt er niets buiten een kaart weg op een smal scherm.

De uitleg staat in één tabel bovenaan het script, `UITLEG`, net zoals `RATES` dat
voor de tarieven doet. De vraagtekens bij de resultaatregels haken zichzelf aan:
`row()` kijkt of er een begrip in het label voorkomt. Daardoor hoeft er geen
enkele aanroep bewerkt te worden, en een nieuwe regel over een bekend begrip krijgt
zijn uitleg vanzelf.

Bij elke bron staat wélke instantie het is, want officieel is niet één categorie.
De Vlaamse overheid en de FOD Economie zijn de overheid. Wikifin is van de FSMA,
de toezichthouder. De Nationale Bank houdt toezicht op de banken. Maar notaris.be
is van Fednot, de federatie van notarissen, en dat is de sector zelf. Dat verschil
hoort een lezer te weten voordat hij erop vertrouwt.

De links dragen `rel="noreferrer"`, zodat de bron niet te zien krijgt van welke
pagina je komt. Ze halen niets op tot je klikt, dus de privacybelofte blijft
staan. Op papier verdwijnen de vraagtekens en de blokjes: een knop heeft daar geen
betekenis en het blad is bewust kort.

## Dode links opsporen

Overheidspagina's verhuizen, en een dode link is erger dan geen link. De pagina
kan dat zelf niet nakijken: dat vraagt een verzoek naar buiten en dat is precies
wat de privacybelofte uitsluit. Daarom gebeurt het buiten de pagina om:

```
npm run bronnen
```

`.github/workflows/bronnen.yml` draait dat maandelijks en op verzoek. Bewust niet
bij elke pull request: een netwerkcontrole is wisselvallig en mag geen werk
tegenhouden dat er niets mee te maken heeft. Wat wél in `npm test` zit, is de
vaste kant ervan — elke bronlink is https, en beide plekken die zo'n link
opbouwen zetten `rel="noreferrer"`.

Het script leest de links op twee plaatsen: de navigatielinks staan als `<a href>`
in de html, maar de bronnen staan in de tabel `UITLEG` en worden pas een link als
iemand uitklapt. Wie alleen naar `<a href>` kijkt, kijkt precies de bronnen niet
na. Een 403 of 405 geldt niet als dood maar als "niet na te kijken": een deel van
de overheidssites weert onbekende clients, en anders roept deze controle elke maand
wolf.

## De invoervakken

Bedragen staan er opgemaakt in, `€ 600.000` en niet `600000`, en ze groeien mee
terwijl je typt. Dat laatste is de bedoeling: een scheidingsteken bestaat om
nullen niet te hoeven tellen, en dat tellen doe je tijdens het typen. Opmaak die
pas verschijnt als je het veld verlaat, komt na het risico.

Percentages krijgen een decimaalkomma, `3,75`, en geen teken; hun label zegt al
`(%)`. De drie aantallen, de looptijd en de jaren en maanden, blijven kaal: `30`
heeft geen hulp nodig.

Daarom zijn de vakjes `type="text"` met `inputmode="decimal"` en geen
`type="number"`. Een number-veld weigert elke opgemaakte vorm op één na, en die
ene is de gevaarlijke: het aanvaardt `600.000` en leest dat als 600, want voor de
specificatie is de punt een decimaalteken. Dat is precies de Belgische notatie,
dus wie duizendpunten in een number-veld zet, deelt stil door duizend.
`parseFloat('600.000')` doet hetzelfde.

Alle invoer loopt daarom door één ontleder en alle weergave door één opmaker.
Wat de punt betekent, beslist het soort veld en niet een gok op het aantal
cijfers erachter: bij een bedrag is het een duizendteken, bij een percentage een
decimaalteken. Zo leest een `3.2` van een cijferblok als drie komma twee, en
loopt het wissen van een cijfer uit `600.000` niet vast op de tussenstand
`600.00`.

Staat het ereloon van de notaris op barema, dan is dat vak geen invoer maar een
uitkomst: het barema rekent per schijf en het bedrag dat eruit komt staat er ook
in, en het volgt de prijs. Zo'n vak staat op `readonly` en niet op `disabled`,
want het bedrag hoort leesbaar en selecteerbaar te blijven. Het gaat ook niet mee
in een deelbare link; anders draagt elke link een bedrag dat niemand invulde.

De pijltjestoetsen stappen met de stap van het veld, duizend bij een prijs en een
honderdste bij een rentevoet. Dat deed `type="number"` zelf en het is hier
herschreven, want die stappen doen mee in het gebruik.

## Een link bewaren of delen

De knop "Link bewaren" in de balk bovenaan maakt een link waarin je invoer zit,
om als bladwijzer te bewaren of aan iemand door te sturen. De pagina zelf bewaart
nog steeds niets: de bezoeker bewaart de link.

De invoer staat achter een hekje en niet in een query. Dat is geen
schoonheidsfout maar de kern van de zaak: wat achter een vraagteken staat, gaat
mee in het verzoek en komt in het logboek van de hostingpartij terecht, en een
van die velden is het netto maandinkomen. Wat achter een hekje staat, blijft in
de browser: het gaat niet mee in het verzoek en niet in de verwijzende url.

De vorm is leesbaar, `#v1&price=450000&term=30&asOf=2026-08-23`, en geen base64
van json. Dat laatste zou even lang zijn en verbergen wat er in de link zit; wie
zijn eigen link kan lezen, ziet meteen dat zijn bedragen erin staan. Alleen wat
afwijkt van de beginwaarde gaat mee, dus een gewone link blijft kort. De `v1`
vooraan houdt de weg open om de vorm te wijzigen zonder oude links stil verkeerd
te lezen.

De datum waarop de tarieven zijn nagekeken gaat altijd mee. Een link bewaart de
invoer en niet de uitkomst, dus een link van vorig jaar rekent met de tarieven
van vandaag; klopt die datum niet meer, dan zegt de pagina dat bij de
aandachtspunten.

De adresbalk wordt niet bijgewerkt terwijl je typt en er komt niets in de
geschiedenis van de browser. Anders zouden de bedragen op elke schermafdruk staan
en in de geschiedenis blijven staan. De link bestaat pas als je op de knop drukt.
Een toets houdt die keuze vast.

Een link die van buiten komt, wordt niet op zijn woord geloofd: elke sleutel gaat
tegen de lijst met velden en elke waarde tegen het veld waar ze in gaat. Wat niet
klopt wordt genegeerd, niet geraden.

## Afdrukken

De knop "Afdrukken of pdf" in de balk bovenaan drukt een eigen overzicht af
in plaats van de pagina zoals ze op het scherm staat: de vier kerncijfers,
de uitgangspunten die je invulde, de vier resultaatblokken, de
aandachtspunten en het voorbehoud. De schuifbalken, de invoervakken en de
lijst met wat je nog moet uitzoeken staan niet op papier.

Er komt geen kop- of voetregel van de browser op het blad: geen url, geen
bladzijdenummer en geen datum van de browser. Dat lukt door de paginamarge
op nul te zetten, want net daar tekent de browser die regels. De witruimte
rond de tekst komt dan uit een eigen kop- en voetregel, die in een `thead`
en een `tfoot` zitten omdat browsers die op elke bladzijde herhalen. Staat
het scherm in het donker, dan drukt het overzicht toch zwart op wit af, en
de opmaak leunt op lijnen in plaats van gevulde vlakken, zodat ze ook klopt
zonder "achtergronden afdrukken" aan te vinken.

Ctrl+P of cmd+P geeft hetzelfde resultaat als de knop. Afdrukken of bewaren
als pdf gebeurt volledig in je eigen browser; er wordt niets verstuurd.

## Terug van papier naar de invoer

Onderaan het blad staat een weg terug: een link en een code. Beide dragen
dezelfde invoer als de knop "Link bewaren", want ze komen uit dezelfde
functie.

De link is een echte `<a href>`. Druk je het blad af als pdf, dan blijft hij
aanklikbaar: Chromium zet er een linkannotatie in, fragment en al. Voor wie
een pdf bewaart is dat de hele oplossing en is de code overbodig. De code is
er voor echt papier, waar geen link te volgen valt.

Beide wijzen naar de gepubliceerde pagina en niet naar `location.href`. Wie
`index.html` van zijn schijf opent, heeft een `file:`-adres in de balk, en een
code met dat adres erin is op papier waardeloos. Het adres staat daarom als
`CANON` in het script. Gevolg: een blad uit een gewijzigde kopie leidt naar de
gepubliceerde versie. De datum van de tarieven gaat mee in de link, dus dat
verschil meldt zich op de pagina zelf.

De code is zelf gecodeerd, in ongeveer 190 regels, want een bibliotheek erbij
halen zou de belofte breken dat dit één bestand zonder afhankelijkheden is. Er
is één vaste vorm: versie 20, correctieniveau L, bytemodus, masker 0. Vast en
niet passend gekozen, want elke extra versie vraagt haar eigen blokindeling en
haar eigen plaatsen voor de uitlijnvierkanten. Dat kost formaat: 97 modules
plus vier stille modules aan elke kant, op 42 mm, is 0,4 mm per module. Kleiner
kan een telefooncamera niet meer volgen.

Versie 20 draagt 858 tekens. De langste link die deze pagina kan maken is 669
tekens, gemeten door elk veld te vullen dat in een link kan; een realistisch
volledig geval, met een tweede koper en een lopend krediet, is er 484. Past de
payload toch niet, dan komt er geen code en blijft de link staan.

De modules zijn één `<path fill="#000">` in een inline svg, aaneensluitende
modules samengevoegd tot één rechthoek. Dat is voorgrond en geen achtergrond,
dus de code drukt ook af zonder "achtergronden afdrukken" aan te vinken. De
code staat één keer aan het eind van het overzicht en niet in de `tfoot`, want
die herhaalt op elke bladzijde.

Wat de code niet doet, is de blootstelling vergroten. De bedragen staan al
voluit op hetzelfde blad. Wat ze wel doet, is ze met een camera in één keer
leesbaar maken, inclusief het inkomen. Dat staat er in één regel bij.

## Tests

De rekenhulp zelf heeft geen afhankelijkheden. De tests wel, en dat is een
ander ding: `playwright`, `jsqr` en `pngjs` staan als `devDependency` in
`package.json` en komen nooit in `index.html` terecht. Wie de pagina alleen wil
gebruiken of hosten, heeft dit alles niet nodig; `index.html` is en blijft op
zichzelf genoeg.

```
npm ci
npx playwright install chromium
npm test
```

De toetsen openen `index.html` in een echte browser, vullen de invoer zoals een
bezoeker dat doet en lezen de bedragen van het scherm. Dat is bewust: er valt
niets te importeren uit een enkel HTML-bestand, en zo wordt ook de koppeling
tussen invoer en berekening getoetst, plus de afdrukweergave en fouten in de
console.

Waar het kan wordt niet tegen een eerder afgelezen getal getoetst maar tegen een
onafhankelijke bron, want een test die de pagina met zichzelf vergelijkt
bevriest ook de fout:

- het rekenvoorbeeld van notaris.be: een gezinswoning van EUR 250.000 kost
  EUR 9.370 aan aankoopkosten;
- een doorgerekend voorbeeld van het barema bij EUR 150.000, dat op EUR 1.878,66
  uitkomt;
- het voorbeeld van Wikifin voor de maandlast: EUR 100.000 op 20 jaar aan 2%
  geeft EUR 505,03 per maand en EUR 21.206,35 aan intrest;
- de code op het blad, gelezen met `jsqr`: de afdrukstand aan, de code als
  afbeelding, en de tekst die eruit komt moet letterlijk de link zijn die de
  knop "Link bewaren" geeft. Dat gaat twee keer, met een gewone invoer en met
  elk veld gevuld, zodat de langste payload gedekt is. Een lezer van buiten is
  hier de bron: de codeerder wordt niet tegen zichzelf gelegd.

Die laatste toets is drie keer tegengelezen. Het masker weglaten maakt de suite
rood, en versie 19 in plaats van 20 ook. Eén bit in de foutcorrectie omzetten
maakt haar niet rood, en dat hoort: 28 correctiewoorden per blok herstellen tot
14 verminkte bytes, dus één omgezette bit is precies wat de code moet
overleven. Twintig verminkte correctiewoorden per blok gaan over die grens heen
en maken de suite wel rood.

Verder wordt getoetst dat een link met de invoer erin rondgaat, dat hij kort
blijft zolang de invoer op haar beginwaarden staat, dat een stand op euro niet
alsnog wordt omgerekend, dat een kapotte of vreemde link niets stukmaakt en de
pagina op haar beginwaarden laat, dat elk invoerveld in de link past, en dat een
link met een oudere tarievendatum zich meldt. Ook dat elk begrip uit de uitlegtabel ergens op de pagina te openen is en elk
vraagteken naar een begrip wijst dat bestaat, dat een blokje open- en dichtklapt
met de bron erin, dat één klik één blokje opent ook als het begrip meermaals
voorkomt, dat een open uitleg openblijft terwijl je typt, en dat er op papier geen
vraagtekens of blokjes staan. Ook dat een bedrag meegroeit terwijl je typt, dat backspace op een
scheidingsteken het cijfer ervóór wist in plaats van het teken zelf, dat een komma
in de maak blijft staan, dat de cursor op zijn plek in de cijferreeks blijft, dat
de pijltjestoetsen met de stap van het veld stappen en binnen zijn grenzen
blijven, en dat de link kale getallen draagt en niet de opmaak. Ook dat de
optionele grensvelden bij
je eigen geld alleen de schuifbalk begrenzen en het ingevulde bedrag niet
verschuiven, ook niet terwijl je erin typt, en dat meer inbrengen dan je hebt
gezegd wordt in plaats van weggerekend. Daarnaast dat de brug naar het
kredietbedrag sluit, dat de heffingen
van de kredietakte op het gewaarborgde bedrag staan, dat het percentage van je
inkomen en de afgeleide maximumprijs op dezelfde basis staan, dat de
waarschuwing over het verlaagde tarief verschijnt zodra er nog een woning te
verkopen is, en dat de pagina geen enkel bestand van buiten laadt en niets
bewaart.

De suite is nagekeken door de code opzettelijk te breken: het toptarief van het
barema verschuiven, de heffingen op het kapitaal in plaats van op het
gewaarborgde bedrag zetten, de zelf betaalde posten weer meefinancieren, de
maximumprijs weer op de aflossing alleen baseren, en de datum op een van de drie
plekken laten staan. Elk van die ingrepen maakt de suite rood.

GitHub Actions draait `npm test` bij elke pull request en bij elke push naar
`main`, zie `.github/workflows/test.yml`.

## Privacy

Eén statisch HTML-bestand. Geen build, geen afhankelijkheden, geen externe
verzoeken. Wat een bezoeker invult blijft in zijn browser: er is geen `fetch`,
geen `XMLHttpRequest`, geen formulier, geen cookie, geen `localStorage` en geen
enkel extern bestand. Ook geen webfonts, dus geen IP-adressen naar derden.

De pagina verstuurt dus niets. Een link die een bezoeker zelf maakt, bevat wel de
bedragen die hij invulde: die gaan niet naar deze pagina en niet naar een server,
maar wie de link krijgt, ziet ze. Zie het hoofdstuk over de link hierboven.

## Tarieven

Alle tarieven, drempels en ingangsdatums staan in de broncode op één plek, in
een `RATES`-object bovenaan het script, met de datum waarop ze zijn nagekeken.
Een jaarwissel is daarmee een wijziging op een regel in plaats van een
zoektocht door het bestand. Bewust geen apart tarievenbestand: de pagina is
één statisch HTML-bestand zonder externe verzoeken, en dat is precies wat de
privacybelofte hieronder draagt. Een tweede bestand zou een extra verzoek zijn.

## Bronnen

Tarieven nagekeken op 23 augustus 2026.

- Registratiebelasting Vlaanderen: 2% voor de enige eigen woning, 12% voor
  overige aankopen. Het tarief van 1% voor ingrijpende energetische renovatie
  is afgeschaft op 1 januari 2025. De meeneembaarheid is afgeschaft op
  1 januari 2024, zonder overgangsregeling. Geen van beide zit nog in de
  berekening.
- Het verlaagde tarief van 2% is voorwaardelijk. Het vraagt dat een natuurlijk
  persoon de volle eigendom verwerft, dat de koper op de datum van de akte geen
  andere woning of bouwgrond bezit, dat hij zich binnen drie jaar domicilieert
  en, voor verkoopovereenkomsten vanaf 1 januari 2026, dat hij daar minstens een
  jaar ononderbroken ingeschreven blijft. Bij meerdere kopers geldt dat per
  koper. Wie nog een woning bezit kan het tarief aanvragen via de vrijstelling
  onder voorwaarde van verkoop, met twee jaar om de oude woning te verkopen.
  De tool rekent met 2% zodra je die situatie kiest, maar zet het verschil met
  12% als apart scenario onder de kosten en waarschuwt zodra het verkoopblok is
  ingevuld.
- Ereloon van de notaris: het wettelijke degressieve barema per schijf,
  4,56% tot EUR 7.500, dan 2,85%, 2,28%, 1,71% en 1,14% tot EUR 64.095, en
  0,57% daarboven, met 21% btw erop. Getoetst op een doorgerekend voorbeeld van
  EUR 150.000: 342 + 285 + 285 + 264,96 + 212,04 + 489,66 = EUR 1.878,66.
  Tegencontrole op notaris.be, dat het ereloon aangeeft als ongeveer 1,3% bij
  EUR 125.000, 1% bij EUR 200.000 en 0,9% bij EUR 250.000; dit barema geeft
  1,39%, 1,08% en 0,98%. Een vast percentage overschat het ereloon bij een
  duurdere woning en onderschat het bij een goedkopere, dus dat is er uit; een
  vast bedrag blijft mogelijk als override.
- Kredietakte: 1% registratierecht en 0,3% hypotheekrecht, beide op het
  gewaarborgde bedrag, dus op het kapitaal verhoogd met de aanhorigheden die de
  bank inschrijft, doorgaans 5 tot 10%. Daarbovenop het ereloon van de notaris
  volgens een eigen, lager barema op het kredietbedrag, en een vast bedrag voor
  de akte, de hypothecaire inschrijving, de hypotheekstaten en het recht op
  geschriften. Het ereloon van de kredietakte is een benadering: het eerste
  tarief van 1,88% is gepubliceerd en de schijven daaronder volgen dezelfde
  degressie, wat bij een krediet van EUR 200.000 EUR 892 geeft tegen een elders
  gepubliceerde EUR 914 exclusief btw.
- Dossierkosten van de bank en schattingskosten staan apart. Ze zijn geen
  aktekosten, worden met eigen geld betaald en gaan niet in de lening. De
  dossierkosten zijn wettelijk geplafonneerd, de schatting kost gemiddeld
  EUR 250 tot 500.
- Handlichting bij een verkoop met een lopend krediet dat wordt afbetaald: het
  doorhalen van de hypothecaire inschrijving, doorgaans EUR 700 tot 1.200. Staat
  in mindering op wat de verkoop opbrengt.
- Bij nieuwbouw wordt de prijs gesplitst: btw op het gebouw en, als de grond
  van een andere verkoper komt, 12% registratiebelasting op de grond. Verkoopt
  dezelfde verkoper grond en gebouw samen onder het btw-stelsel, dan valt ook
  de grond onder btw. Het verlaagde tarief van 2% geldt nooit op grond.
- Btw op het gebouw: 21%, of 6% bij afbraak en heropbouw. Het verlaagde tarief
  vraagt onder meer afbraak en heropbouw op hetzelfde perceel, de enige eigen
  woning met eigen domicilie, minstens vijf jaar verblijf en een bewoonbare
  oppervlakte van maximaal 200 m2. De tool vraagt die voorwaarden apart uit en
  rekent met 21% zolang er een ontbreekt. De aparte weg naar 6% via langdurige
  verhuur aan een sociaal verhuurkantoor of woonmaatschappij zit er niet in,
  net zomin als het tarief van 6% voor renovatie van een woning ouder dan
  tien jaar.
- Notariskosten bij nieuwbouw worden op het grondaandeel gerekend: alleen de
  grond gaat via een notariele akte, het gebouw zit in een
  aannemingsovereenkomst.
- Bijkomende vermindering van EUR 1.867 voor een enige eigen bescheiden woning.
  De maximumprijs is EUR 220.000, en EUR 240.000 als de woning in de kernsteden
  of de Vlaamse Rand rond Brussel ligt. Dat onderscheid staat er nog en is niet
  afgeschaft, dus de invoer heeft een vinkje voor de ligging. De tool kan de
  gemeente niet zelf kennen: de lijst staat in de regelgeving en de koper zet
  het vinkje. Staat het uit terwijl de prijs tussen de twee grenzen valt, dan
  zegt de pagina dat de hogere grens bestaat.
- Aankoopkosten geijkt op de infofiche van notaris.be: een gezinswoning van
  EUR 250.000 in Vlaanderen kost EUR 9.370 aan aankoopkosten. Die ijking is een
  paar: het barema geeft EUR 2.962,88 aan ereloon inclusief btw, en de akte- en
  opzoekingskosten staan op EUR 1.407, wat samen met 2% registratiebelasting
  precies op EUR 9.370 uitkomt. Wie het ereloon aanpast, moet die tweede post
  dus mee herijken.
- De maandlast gebruikt de equivalente maandrente, de twaalfde wortel uit de
  jaarrente. Dat is de Belgische conventie. Controle op het voorbeeld van
  Wikifin: EUR 100.000 op 20 jaar aan 2% geeft EUR 505,03 per maand en
  EUR 21.206,35 aan intrest.
- Niet-conforme keuring van de elektriciteit: de koper herkeurt binnen
  18 maanden na de akte en kiest zelf een erkend organisme.
- Renovatieverplichting: wie een woning met EPC-label E of F koopt, moet ze binnen
  zes jaar na de authentieke akte naar minstens label D brengen. Dat geldt voor
  aankopen vanaf 2023.
- Wederbeleggingsvergoeding bij vervroegd aflossen: wettelijk maximaal drie
  maanden interest op het terugbetaalde deel.
- De betaalbaarheidstoets staat op twee bases. Het ene percentage is de
  aflossing alleen, het andere is alles wat er maandelijks aan de woning weggaat,
  inclusief de verzekeringen en de onroerende voorheffing. Het kerncijfer
  bovenaan en de afgeleide maximale aankoopprijs staan op dat tweede getal, want
  daar kijkt een bank naar, samen met wat er overblijft om van te leven. Beide
  staan dus op dezelfde basis.

## Juridisch

Geen advies en geen aanbod. Deze rekenhulp bemiddelt niet in kredieten, biedt
er geen aan, en geeft geen financieel, fiscaal of juridisch advies. Alleen een
bank kent een rentevoet toe en beslist over een krediet. Alleen een notaris
berekent de aankoopkosten exact.

Aangeboden zoals ze is, zonder garantie op juistheid of actualiteit. Geen
aansprakelijkheid voor schade door gebruik van de berekening. Wie deze pagina
verspreidt of op een eigen site plaatst, blijft zelf verantwoordelijk voor de
juistheid tegenover zijn lezers en voor de beroepsregels die op hem van
toepassing zijn.

Deze pagina verwerkt geen persoonsgegevens: geen formulier, geen cookies, geen
localStorage, geen analytics, geen externe bestanden. Een cookiebanner is dus
niet nodig. De hostingpartij registreert wel technische gegevens van de
opvraging, waaronder het IP-adres, zoals bij elke website.

## Licentie

PolyForm Noncommercial License 1.0.0 (zie `LICENSE`).

Niet-commercieel gebruik is vrij: bekijken, kopieren, aanpassen en verspreiden
mag, zolang de licentie en de auteursvermelding meegaan. Persoonlijk gebruik,
studie, hobbyprojecten, onderwijsinstellingen, overheden en organisaties zonder
winstoogmerk vallen daaronder.

Commercieel gebruik vraagt schriftelijke toestemming. Daaronder valt onder meer
het plaatsen van deze rekenhulp op de site van een makelaar, bank,
kredietmakelaar of notariskantoor, en het verwerken ervan in een betalend
product of een betalende dienst. Toestemming vragen kan via een issue op
GitHub.

## Voorbehoud

Dit is een rekenhulp, geen aanbod. Het ereloon van de notaris volgt het
wettelijke barema, maar de vaste aktekosten, het ereloon van de kredietakte en
de rentevoet zijn schattingen. Alleen een notaris kan de kosten exact
berekenen. Alleen een bank bepaalt de rentevoet en beslist over een krediet.
De grenswaarden voor quotiteit en afbetalingslast zijn vuistregels, geen
bankregels. Het verlaagde tarief van 2% is voorwaardelijk: de tool rekent ermee
zodra je die situatie kiest en zet het verschil met 12% ernaast, maar of je aan
de voorwaarden voldoet beslist de administratie, niet deze pagina.
