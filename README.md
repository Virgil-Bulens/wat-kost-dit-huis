# Wat kost dit huis?

Rekenhulp voor kandidaat-kopers in Vlaanderen. Rekent uit wat er bovenop de
vraagprijs komt, wat je overhoudt als je eerst je eigen woning verkoopt,
hoeveel je moet lenen en wat dat elke maand kost.

Niets staat voorgevuld. Standaard rekent de tool met één koper; een koppel kan
gezamenlijke bedragen invullen of een tweede koper met eigen bedragen
toevoegen. Elke schuifbalk heeft een invoervak, zodat je ook een exact bedrag
kan typen.

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

## Privacy

Eén statisch HTML-bestand. Geen build, geen afhankelijkheden, geen externe
verzoeken. Wat een bezoeker invult blijft in zijn browser: er is geen `fetch`,
geen `XMLHttpRequest`, geen formulier, geen cookie, geen `localStorage` en geen
enkel extern bestand. Ook geen webfonts, dus geen IP-adressen naar derden.

## Tarieven

Alle tarieven, drempels en ingangsdatums staan in de broncode op één plek, in
een `RATES`-object bovenaan het script, met de datum waarop ze zijn nagekeken.
Een jaarwissel is daarmee een wijziging op een regel in plaats van een
zoektocht door het bestand. Bewust geen apart tarievenbestand: de pagina is
één statisch HTML-bestand zonder externe verzoeken, en dat is precies wat de
privacybelofte hieronder draagt. Een tweede bestand zou een extra verzoek zijn.

## Bronnen

Tarieven nagekeken op 22 augustus 2026.

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
- Bijkomende vermindering van EUR 1.867 voor een enige eigen bescheiden woning,
  in 2026 tot een maximumprijs van EUR 220.000. Dat is een grens, zonder
  onderscheid naar ligging; het oude verschil met de kernsteden en de Vlaamse
  Rand is er niet meer, en het ligging-veld is daarmee uit de invoer.
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
