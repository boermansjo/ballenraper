# BALLENRAPER — TTC Wielsbeke-Spotit

> *"Jeugdspeler moet na élke training alle ballen rapen, dus maakt het bestuur er een
> videogame van zodat hij het leuk blijft vinden."*
> — Wielsbeke nieuwsflits

Het tweede clubspel, na [PIPS OUT!](https://ttcwielsbeke.github.io/pipsout/). Snake, maar
dan in de zaal: jij raapt de ballen op en de ballenbuis achter je wordt almaar langer.

## Spelen

- **Veeg** om te sturen, of gebruik de pijltjes (ook WASD en ZQSD).
- De buis vertrekt pas als je zelf stuurt — ook na een botsing.
- ⚪ **Bal** — 10 punten, je buis groeit een stukje.
- 🟠 **Oranje 3-sterren bal** — 50 punten, en je buis groeit *niet*. Blijft maar even liggen.
- 🟩 **Tafels** — om de 8 ballen plooit iemand er eentje open. Hoe voller de zaal, hoe krapper.
- 🔵 **Clubgenoten** — die wandelen dwars door de zaal en kijken niet uit.

Tegen jezelf, een tafel, een clubgenoot of de zijlijn kost een hartje. Drie hartjes en de
training zit erop. Na afloop zet je je naam bij je score en kom je in de erelijst.

## Technisch

Vier bestanden, geen build, geen dependencies, geen assets.

| bestand | inhoud |
|---|---|
| `index.html` | HUD, overlays, ticker |
| `style.css` | dezelfde arcade-skin als PIPS OUT! |
| `game.js` | raster, tekenwerk, geluid |
| `board.js` | de erelijst, gedeeld met de andere clubspellen |
| `config.js` | sleutels en instellingen |

- Het speelveld is een raster van 22 × 26 cellen van 20 pixels.
- Alle geluid is gesynthetiseerd met de Web Audio API.
- `?debug` in de url zet `window.__BR` open met de spelstaat erin, handig om te testen.

### De klok

De spelklok loopt op `performance.now()` en **niet** op de tijdstempel die
`requestAnimationFrame` meegeeft. Dat is geen detail: in sommige omgevingen — ingebouwde
previews, opnames, sterk vertraagde tabs — loopt die tijdstempel niet gelijk met de echte
tijd, en dan kruipt het spel in slow motion terwijl het beeld gewoon doorloopt. Met de
wandklok blijft de snelheid overal dezelfde, ook als het tekenen hapert.

## Lokaal draaien

```bash
python -m http.server 8130
```

Dan naar <http://localhost:8130>.

## De erelijst

Werkt precies zoals bij PIPS OUT!: zolang `config.js` geen sleutels bevat, houdt het spel
de lijst bij op het toestel zelf. Er gaat dus niets stuk zolang dit niet ingesteld is.

**Let op — vóór dit live gaat**, moet de bestaande `scores`-tabel een kolom `game` krijgen,
anders komen deze scores in de ranglijst van PIPS OUT! terecht:

```sql
alter table public.scores add column game text not null default 'pipsout';
create index scores_game_score_idx on public.scores (game, score desc);

-- de insert-policy opnieuw zetten, nu met game erbij
drop policy "score toevoegen" on public.scores;
create policy "score toevoegen"
  on public.scores for insert to anon
  with check (
    char_length(btrim(name)) between 1 and 16
    and level between 1 and 99
    and score >= 0
    and game in ('pipsout', 'ballenraper')
    and score <= case game
          when 'pipsout'     then 30000 * level * (level + 1)
          else                    12000 * level * (level + 1)
        end
  );
```

Daarna in `config.js` de Project URL en de publishable key invullen. `board.js` stuurt
`game` mee bij het opslaan en filtert erop bij het ophalen, dus beide spellen delen
dezelfde tabel zonder elkaars lijst te vullen.

PIPS OUT! heeft dan ook de nieuwere `board.js` nodig, die `game` meestuurt — anders komen
die scores binnen zonder spelnaam en vallen ze door de `default 'pipsout'` toevallig goed,
maar filtert het oude spel er niet op.
