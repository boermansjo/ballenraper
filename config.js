/* ============================================================
   BALLENRAPER — instellingen
   Zelfde opzet als bij PIPS OUT: zolang url en key leeg zijn,
   houdt het spel de erelijst gewoon op het toestel zelf bij.
   ============================================================ */
window.PIPSOUT = {

  leaderboard: {

    provider: 'supabase',

    /* Nog leeg tijdens het testen. Vóór dit live gaat moet de tabel
       een kolom `game` krijgen — zie README.md — anders komen deze
       scores in de ranglijst van PIPS OUT terecht.                  */
    url: '',
    key: '',
    table: 'scores',

    /* Welk spel deze scores zijn. Wordt meegestuurd bij het opslaan
       en gebruikt om de juiste ranglijst op te halen.               */
    game: 'ballenraper',

    /* Bovengrens tegen verzonnen scores: maxPerLevel * n * (n + 1),
       met n = het aantal tafels dat je gehaald hebt. Ruim boven wat
       een uitzonderlijke partij kan opleveren.                      */
    maxPerLevel: 12000,

    limit: 25
  }
};
