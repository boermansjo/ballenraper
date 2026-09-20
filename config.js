/* ============================================================
   BALLENRAPER — instellingen
   Zelfde opzet als bij PIPS OUT: zolang url en key leeg zijn,
   houdt het spel de erelijst gewoon op het toestel zelf bij.
   ============================================================ */
window.PIPSOUT = {

  leaderboard: {

    provider: 'supabase',

    /* Nog leeg tijdens het testen. De SQL voor de tabel staat in
       README.md — een eigen tabel, los van die van PIPS OUT.        */
    url: 'https://aqaikstibteqcdgxtuiw.supabase.co',
    key: 'sb_publishable_yt1HRtTr-Z8WCiZv3_uCkQ_on2j5ZJ4',
    table: 'scores_ballenraper',

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
