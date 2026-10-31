# VocabQuest

Vokabeltrainer als 3D-Abenteuer (Web-App für PC, Handy und Tablet).
Das vollständige Konzept steht in [KONZEPT.md](KONZEPT.md).

**Online spielen:** https://tbdwerk-alt-julian.github.io/Julian-Vokabeltraining/ (PC, Handy, Tablet – am Handy im Querformat, „Zum Home-Bildschirm hinzufügen“ macht daraus eine App).

## Kurzanleitung für Julian

**Worum geht es?** Fünf Gebiete, fünf Bosse, am Ende Ignatius der Schattenkönig. Deine einzige Waffe sind Wörter: Im Kampf erscheint ein deutsches Wort, du tippst das englische. Richtig = Treffer, falsch = der Gegner trifft dich. Schnell antworten gibt mehr Schaden, Kombos (5/10/15 Treffer in Folge) noch mehr.

**Erst Vokabeln eintragen:** Taste **V** (oder Knopf „Vokabeln“) → Reiter **„Liste einfügen“** → die Wörter deiner Unit reinkopieren, eine pro Zeile, z. B.

```
der Wald - forest
gefährlich = dangerous
die Umwelt; environment; We must protect the environment.
```

Unit-Namen eintragen (z. B. „Unit 3“) → **Einfügen**. Geübt werden nur die Units, die du im Vokabel-Fenster angehakt hast. Jedes Wort sammelt Sterne; erst bei drei Sternen gilt es als sicher.

**Steuerung (PC)**

| Taste | Was passiert |
|---|---|
| W / S, A / D | laufen, drehen · Shift = rennen |
| Maus ziehen | Kamera drehen |
| E | benutzen: Gegner angreifen, mit Bram reden, Truhen, Händler, Krypta-Portal, Vokabel-Schlösser |
| Leertaste | Ausweichrolle |
| 1–9 | Schnellleiste: Tränke, Waffen |
| I / V / K / M / Q / L | Inventar · Vokabeln · Fähigkeiten · Karte · Aufgabe · Saison |
| B / T / G / H | Emotes: nächstes · jubeln · winken · sitzen |
| F | Reittier auf- und absteigen (sobald du eins hast) · Esc = Pause |
| Enter | im Kampf Antwort abschicken · Knopf „Hinweis“ = Tipp (halber Schaden) |

**Handy:** Joystick links, Knöpfe rechts, über den Bildschirm wischen dreht die Kamera.

**Was lohnt sich?**
- **Bram im Lager (E):** gibt Quests und zahlt für Köpfe. **Kopfgeldtafel** daneben: eine Tagesaufgabe pro Tag.
- **Elite-Gegner** (roter Ring) haben mehr Leben, lassen aber bessere Sachen fallen. Höhere Level = mehr Schaden.
- **Gruft (jedes Gebiet):** Krypta-Eingang östlich vom Lager, dem Wegweiser folgen (E am Portal). Im Wald heißt sie Trollgewölbe, das Siegel bricht ab Level 5; in den anderen Gebieten später (Wüste 20, Kirschen 40, Vulkan 60, Schattenfestung 85). Drei Gitter mit Vokabel-Schloss, zwei Goldtruhen, am Ende der **Kerkermeister** (Phönix-Trank + 150 Münzen). Grünes Podest = zurück nach oben.
- **Fähigkeiten (K):** jedes Level ein Punkt – Klinge (Schaden), Panzer (weniger Schaden, mehr HP), Verstand (mehr Zeit pro Wort).
- **Händler** im Lager (kommt zu festen Zeiten), **Truhen** in der Welt, **Lagerfeuer** heilt schnell.
- Der **Boss** jedes Gebiets wartet in der Halle; erst mit guten Vokabeln reingehen – er hat Phasen und macht richtig Schaden.
- Nach dem Tod: Münzbeutel bleibt liegen, hol ihn dir zurück.

**Speicherstand:** liegt im Browser (drei Slots). Handy und PC haben getrennte Spielstände.



## Starten

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:5173` öffnen.

## Handy-Test im Heimnetz

1. Handy und PC ins gleiche WLAN.
2. `npm run dev` starten – Vite zeigt eine Zeile `Network: http://192.168.x.x:5173/`. Diese Adresse am Handy im Browser öffnen (Chrome auf Android, Safari auf iPhone).
3. Beim ersten Mal fragt Windows evtl. nach einer Firewall-Freigabe für Node.js – „Zulassen" (privates Netzwerk).
4. Am Handy: Browser-Menü → **„Zum Home-Bildschirm hinzufügen"** (Android: „App installieren"). Danach startet VocabQuest wie eine App im Vollbild.
5. Querformat empfohlen. Joystick links, Knöpfe rechts; auf dem Bildschirm wischen dreht die Kamera.

Hinweis: Der Spielstand liegt im Browser des jeweiligen Geräts – Handy und PC haben getrennte Spielstände, bis es ein Konto gibt (Phase 3).

## Struktur

- `index.html` – Seite mit HUD, Menüs, Inventar, Einstellungen
- `src/main.js` – Spiel (Three.js): Welt, Figuren, Steuerung, Kampf, Quests
- `preview/` – frühe Design-Vorschau als einzelne HTML-Datei (Referenz)
- `KONZEPT.md` – das abgestimmte Spielkonzept


## Grafik (Stand 29.10.2026)

Die Grafik liegt in `src/graphics.js`: Himmel mit Atmosphäre, Wolken, Sonne, Mond und Sternen, Tag-Nacht-Zyklus (ein Tag = 25 Minuten, in den Einstellungen auf Tag/Abend/Nacht festlegbar), Nachbearbeitung (Bloom, FXAA, Farbkorrektur, Vignette), Linsenreflexe, Umgebungslicht aus dem Himmel, ferne Bergkette. Bäume sind gezeichnete Texturen auf drei gekreuzten Flächen, Boden und Wasser haben Normal-Maps, Schnee und Nässe liegen als Uniforms auf allen Materialien (`weatherize`). Qualitätsstufen: Niedrig (keine Nachbearbeitung), Mittel (FXAA + Farbkorrektur), Schön (+ Schatten, Bloom), Sehr schön (+ weiche Schatten 4096, höhere Auflösung).
