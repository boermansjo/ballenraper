# BALLENRAPER — TTC Wielsbeke-Spotit

> *"Jeugdspeler moet na élke training alle ballen rapen, dus maakt het bestuur er een
> videogame van zodat hij het leuk blijft vinden."*
> — Wielsbeke nieuwsflits

Het tweede clubspel, na [PIPS OUT!](https://ttcwielsbeke.github.io/pipsout/). Snake, maar
dan in de zaal: jij raapt de ballen op, de ballenbuis achter je wordt almaar langer, en
om de zoveel tijd moet ze leeg in de ballenkar — want vol is vol.

## Spelen

- **Veeg** om te sturen, of gebruik de pijltjes (ook WASD en ZQSD).
- De buis vertrekt pas als je zelf stuurt — ook na een botsing en na elke tafel erbij.
- ⚪ **Bal** — 10 punten, je buis groeit een stukje.
- 🛒 **Ballenkar** — rij erin en je buis gaat leeg: **20 punten per bal**, en 250 extra
  als ze vol zat. Daarna rolt iemand de kar ergens anders naartoe. Ze houdt je niet tegen;
  je rijdt er gewoon doorheen.
- 🛑 **De buis houdt 24 ballen.** Vol is vol: wat er daarna nog binnenkomt, ketst eraf —
  geen punten, geen groei. De meter onder je ballenteller kleurt mee, en het plastic van de
  buis kleurt mee op het veld: helder, dan amber, dan rood.
- 🟠 **Oranje 3-sterren bal** — 50 punten, en je buis groeit *niet*. Blijft maar even liggen.
- 🟡 **Celluloid bal** — zeldzaam (één bal op twintig), 150 punten, maar ze neemt plaats
  voor drié in je buis. Die van achter de radiator.
- 🎺 **Trainersfluitje** — om de 22 à 30 seconden fluit de trainer: vijf seconden lang
  tellen alle punten dubbel, ook de bonus van de kar, en loopt alles een tikje rapper.
- 🟩 **Tafels** — om de 8 ballen plooit iemand er eentje open, tot er acht staan. Nooit
  vlak voor je neus: de baan recht vóór je blijft vrij.
- 🟦 **Omheiningen** — de lage borden rond de speelvakken. Eén baan breed, drie tot vijf
  lang. Ze komen er pas bij als de zaal vol tafels staat, dus vanaf niveau 9, en houden
  altijd een cel speling van tafels en van elkaar zodat er overal een doorgang blijft.
- 🔵 **Clubgenoten** — die wandelen dwars door de zaal en kijken niet uit.
- 🚪 **Deuren** — vanaf drie tafels staan er twee open, altijd in een muur van de zaal.
  Rij de ene binnen en je komt de andere uit, de zaal in. Je rijrichting wordt dus
  bepaald door de muur waar je uitkomt. Ze verhuizen bij elke nieuwe tafel.

Tegen jezelf, een tafel, een clubgenoot of de zijlijn kost een hartje — **én je buis valt
om**, dus wat erin zat ben je kwijt. Drie hartjes en de training zit erop. Na afloop zet je
je naam bij je score en kom je in de erelijst.

Daar zit het hele spel in: de kar betaalt per bal, dus hoe langer je doorrijdt hoe meer het
opbrengt — maar hoe voller je buis, hoe langer en onhandiger je bent, en hoe meer je
verliest als het misgaat.

## Technisch

Vijf bestanden, geen build, geen dependencies, geen assets.

| bestand | inhoud |
|---|---|
| `index.html` | HUD, overlays, ticker, og-tags |
| `style.css` | dezelfde arcade-skin als PIPS OUT! |
| `game.js` | raster, tekenwerk, geluid, de zaal van de dag |
| `board.js` | de erelijst, gedeeld met de andere clubspellen |
| `config.js` | sleutels en instellingen |
| `og.jpg` | 1200×630 kaart voor de link-preview |
| `tools/og.html` | generator die die kaart opnieuw maakt |
| `tools/ogsave.py` | piepklein endpoint dat de kaart in de repo schrijft |

- Het speelveld is een raster van 22 × 26 cellen van 20 pixels.
- Het speeltempo zit in drie constanten bovenaan [`game.js`](game.js): `TRAAGSTE` (de start,
  155 ms per cel), `RAPSTE` (het plafond, 95 ms) en `PER_BAL` (hoeveel er per geraapte bal
  af gaat, 1,2 ms). Het plafond ligt dus na vijftig ballen. Dat plafond lag vroeger op 75 ms
  en werd al na achtendertig ballen bereikt — prima toen een partij daar ongeveer eindigde,
  maar met de ballenkar speel je honderden ballen door en zat je zowat de hele partij op
  volle snelheid.
- De ballenkar houdt altijd een cel speling van tafels en omheiningen, en omgekeerd gaat er
  nooit een tafel of omheining tegen de kar staan. Anders sta je met een volle buis voor een
  kar waar je niet meer bij kan.
- Alle geluid is gesynthetiseerd met de Web Audio API.
- `?debug` in de url zet `window.__BR` open met de spelstaat erin, handig om te testen.

### De bocht valt waar je hem ziet

De trechter wordt tot een hele cel vooruit getekend, maar een bocht draait rond de cel
waar de kop logisch staat. Veeg je laat in een stap, dan staat de trechter op het scherm
al bij het volgende kruispunt terwijl de bocht een baan eerder viel — precies het gevoel
dat je een rij te vroeg afslaat. Een veeg voorbij de helft van de stap wacht daarom één
tik, zodat de bocht op het kruispunt valt dat je zag liggen.

### De klok

De spelklok loopt op `performance.now()` en **niet** op de tijdstempel die
`requestAnimationFrame` meegeeft. Dat is geen detail: in sommige omgevingen — ingebouwde
previews, opnames, sterk vertraagde tabs — loopt die tijdstempel niet gelijk met de echte
tijd, en dan kruipt het spel in slow motion terwijl het beeld gewoon doorloopt. Met de
wandklok blijft de snelheid overal dezelfde, ook als het tekenen hapert.

### De zaal van de dag

Iedereen speelt vandaag dezelfde zaal: de tafels, de omheiningen en de deuren staan
bij heel de club op dezelfde plek. Morgen een nieuwe zaal. Ballen blijven willekeurig
liggen — die hangen toch af van waar jouw buis ligt.

Daar is geen server voor nodig. Een gewone `Math.random()` geeft elke keer iets anders,
maar een **gezaaide** generator (mulberry32) geeft altijd dezelfde reeks bij hetzelfde
vertrekgetal. Dat vertrekgetal is de datum, door een FNV-hash gehaald. Elke browser
rekent zo dezelfde zaal uit, zonder één netwerkoproep.

Het addertje zit in de volgorde. Een tafel mag nooit opengeplooid worden op de plek
waar jíj net rijdt, en al helemaal niet bovenop je buis — en waar jij rijdt, kan niet
vooraf vastliggen. Simpelweg `Math.random()` vervangen door een gezaaide generator
werkt daarom **niet**: zodra twee spelers anders rijden, valt de ene keuze anders uit
dan de andere en loopt alles daarna uit de pas. Gemeten: nog 2 tot 4 van de 8 tafels
op dezelfde plek.

Daarom wordt de zaal niet tafel per tafel geloot maar **in één keer vooraf gelegd**, in
een lege zaal en zonder speler: acht tafels en zes omheiningen die onderling hun cel
speling houden. Tijdens het spelen worden ze uit die wachtrij onthuld. Ligt de
eerstvolgende net onder je buis, dan blijft ze in de rij staan en komt er eentje van
verderop eerst. Je krijgt dus dezelfde acht tafels als de rest, af en toe in een andere
volgorde, en tegen het einde staat ieders zaal identiek opgesteld.

Er wordt nooit een plek verzonnen die niet in het plan staat. Past er op dit moment
geen enkele, dan plooit er deze keer gewoon niets open en is er acht ballen later weer
plaats. Gemeten over 24 spelers die elk anders rondreden: 284 plaatsingen, waarvan 0
buiten het plan, en elke speler die de zaal volspeelde kwam exact op de zaal van die
dag uit.

Deuren en karplekken worden vooraf getoetst aan de vólle zaal. Wat daar past, past ook
in een zaal waar nog maar de helft van staat, dus kloppen ze op elk niveau.

De datum komt van de klok van **Europe/Brussels**, niet van het toestel — anders speelt
wie op reis is een andere zaal dan de rest van de club.

### Vandaag en aller tijden

De erelijst opent op **vandaag**: daar zit de wedstrijd van de dag. Eén knop ernaast
zet hem op aller tijden. Dat vroeg geen kolom erbij en geen migratie — elke rij draagt
al een `ts` in milliseconden, dus "vandaag" is niets meer dan één filter extra op de
query (`ts=gte.<middernacht>`).

Middernacht wordt berekend op de klok van **Europe/Brussels**, niet op die van het
toestel. Anders ziet wie op reis is een andere dag dan de rest van de club, en klopt
zijn ranglijst van vandaag niet. Dat gebeurt met `Intl.DateTimeFormat`, zonder
bibliotheek; kan de browser dat niet, dan valt het terug op de lokale middernacht.

## Hosten op GitHub Pages

Deze repo staat op <https://github.com/ttcwielsbeke/ballenraper>.

Eenmalig aanzetten: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**
(<https://github.com/ttcwielsbeke/ballenraper/settings/pages>).

Een minuutje later staat het spel op **<https://ttcwielsbeke.github.io/ballenraper/>**.
Vanaf dan is elke `git push` naar `main` meteen een release: er is geen build, dus wat in
de repo staat, is wat er online staat.

## Op de clubwebsite zetten

Voor wie de spelletjespagina bouwt — alles hieronder is publiek en heeft geen sleutel nodig.

| veld | waarde |
|---|---|
| titel | BALLENRAPER |
| ondertitel | Het tweede videospel van TTC Wielsbeke-Spotit |
| omschrijving | Raap alles op wat rolt, kieper het in de ballenkar. |
| afbeelding | `https://ttcwielsbeke.github.io/ballenraper/og.jpg` (1200×630, jpeg) |
| link | `https://ttcwielsbeke.github.io/ballenraper/` |

## De link-preview opnieuw maken

`og.jpg` is geen screenshot: `tools/og.html` laadt het echte spel in een iframe, zet het op
een mooie stand — volle buis, tafels, ballenkar — en tekent dat in een kaart van 1200×630.
Zo blijft de afbeelding vanzelf kloppen als de zaal er ooit anders uitziet.

```bash
python tools/ogsave.py        # schrijft de binnenkomende JPEG naar de repo
python -m http.server 8130    # en in een tweede terminal
```

Open dan <http://localhost:8130/tools/og.html>. De pagina tekent zichzelf en post het
resultaat als `og.jpg`. Daarna committen en pushen; Facebook haalt de nieuwe versie op via
<https://developers.facebook.com/tools/debug/> → **Scrape Again**. Hou het tabblad zichtbaar
terwijl het tekent: een achtergrondtabblad tekent niet en dan blijft de zaal leeg.

## Lokaal draaien

```bash
python -m http.server 8130
```

Dan naar <http://localhost:8130>.

## De erelijst

Werkt precies zoals bij PIPS OUT!: zolang `config.js` geen sleutels bevat, houdt het spel
de lijst bij op het toestel zelf. Er gaat dus niets stuk zolang dit niet ingesteld is.

Dit spel krijgt zijn **eigen tabel**, los van die van PIPS OUT!. Dat is minder werk en
vooral: er wordt niets aangeraakt aan de tabel die de ranglijst van PIPS OUT! al bedient.
PIPS OUT! hoeft dus ook niet aangepast te worden.

Plak dit in de SQL Editor van hetzelfde Supabase-project:

```sql
create table public.scores_ballenraper (
  id         bigint generated always as identity primary key,
  name       text        not null,
  score      integer     not null,
  level      integer     not null,
  ts         bigint      not null,
  game       text        not null default 'ballenraper',
  created_at timestamptz not null default now()
);

create index scores_ballenraper_score_idx on public.scores_ballenraper (score desc);

alter table public.scores_ballenraper enable row level security;

-- iedereen mag de ranglijst lezen
create policy "ranglijst lezen"
  on public.scores_ballenraper for select to anon
  using (true);

-- iedereen mag een score toevoegen, maar geen onzin
create policy "score toevoegen"
  on public.scores_ballenraper for insert to anon
  with check (
    char_length(btrim(name)) between 1 and 16
    and level between 1 and 99
    and score >= 0
    and score <= 12000 * level * (level + 1)
  );
```

Net als bij PIPS OUT! staat er bewust **geen** update- of delete-policy: scores kunnen
toegevoegd en gelezen worden, maar niet gewijzigd of gewist. `level` is hier het niveau
dat je gehaald hebt — eerst de acht tafels, daarna de omheiningen.

Daarna in `config.js` de Project URL en de publishable key invullen, en pushen. De kolom
`game` staat er al in, zodat er later makkelijk één gezamenlijke ranglijst over alle
clubspellen gemaakt kan worden met een `union`.
