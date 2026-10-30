# VocabQuest – Ablaufplan bis Sonntag (1. 11. 2026)

Stand: Freitag, 31. 10. 2026. Alles unten ist im Spiel und committet, außer die Punkte unter „Offen“.

## Fertig (seit Donnerstag)

**Grafik**
- Himmel mit Atmosphäre, Wolken, Sonne, Mond, Sternen; Tag-Nacht-Zyklus (25 Min), Einstellung Tag/Abend/Nacht
- Nachbearbeitung: Bloom, Kantenglättung, Farbkorrektur, Vignette, Sonnenstrahlen, Linsenreflexe
- Echte Schatten, Wolkenschatten, Bäume im Wind, Pollen im Licht, Bodennebel
- Wetter: Wolken, Regen mit Spritzern, nasser Boden, Sturm mit verästelten Blitzen, Schneedecke
- Dichter Wald mit toten Bäumen, Farnen, umgestürzten Stämmen, 10 verlassene Hütten, 8 Ruinen
- Felsen mit Moos, Wasser mit Wellen, Bergkette am Horizont, Fackel nachts in der Hand

**Spiel**
- Kampf: Seitenkamera, Schlag-/Treffer-Animationen, Schadenszahlen, Bildschirmwackeln, Banner (Boss, Phase 2, Sieg, Level-Up)
- Gegner: Troll-Krieger (Ork), Schattenwichte (blaue Dämonen, schnell), Häuptling (roter Dämon), Waldtroll-Boss mit 2 Phasen hinter dem Festungstor (ab Level 10)
- Bewegung: Laufen/Rennen nach Tempo, Sprint mit Shift, Ausweichrolle, Reiten mit Galopp, Schwimmen, Fallschaden
- Hinweis-System (Grundkurs frei mit halbem Schaden, Erweiterungskurs über Hinweis-Punkte aus Quests), 10 Quests bei Bram, geheime Quest mit Mondklinge
- Schnellreise über fünf Lagerfeuer (entdecken, dann auf der Karte anklicken)
- Emotes (T/G/H), Rolle im Kampf mit Wirkung, Regenbogen nach Regen, Sternschnuppen, Vogelschwärme
- Zweites Gebiet **Wüste** (nach dem Waldtroll über die Weltkarte): Dünen, Oase mit Palmen, Kakteen, Sandsturm, Sandräuber, Sandteufel, Sandkönig, Sandwurm-Arena ab Level 25, eigene Quests und Lagerfeuer
- Drittes bis fünftes Gebiet: **Kirschen-Gebiet** (rosa Wald, Blütenwind, Kirschgeist ab Level 50), **Vulkan** (Asche, Lavasee, Lavaspalten, Lavadrache ab Level 75 – fliegt in Phase 2) und **Schattenfestung** (Level 100, Ignatius der Schattenkönig mit 4 Phasen und Spiegeln der vier Bosse). Jedes Gebiet mit eigenen Gegnern, Quests, Wetter, Karte, Lagerfeuern und Trophäe
- Boss-Belohnungen: Trophäen (Trollzahn, Wurmschuppe, Blütenkristall, Drachenkralle), Drop-Chance auf Boss-Waffe, alle 4 Trophäen = legendäre Waffe beim Schmied
- Begleiter Lumi: folgt dir, leuchtet gelb Richtung Truhe, findet Münzen
- Lager-Ausbau: Schmiede (Waffe +1 Stärke je Stufe), Stall (Reittier-Skills), Trophäenwand
- Vier Helden: Ritter, Schurkin, Magier, Barbar
- Händler Orrin: jede volle Stunde 15 Minuten im Lager, Tränke für Münzen, Kräfte für Kristalle (Schutzschild, Feuerschlag, Stärke, Glück)
- Inventar: 4 Kategorien à 20 Plätze (Waffen, Rüstung, Tränke, Sonstiges), Taste I
- Saison-Pass (30 Stufen, Willkommensstufe, Alles einsammeln), Tagesaufgaben (3 zur Wahl), Statistik-Seite, Login-Bonus
- HUD: HP/Ausdauer über der Hotbar, moderne Hotbar, Weltkarte im cleanen Stil, Minimap
- Sound: Musik (ruhig / Nacht / Kampf), Wind, Regen, Vögel, Grillen, Schritte, Hufe, Hiebe, Treffer, Münzen, Level-Up, Donner
- 3 Spielstände, Server-Sicherung, PWA fürs Handy, Querformat-Hinweis

**Balance und Kamera (Freitag)**
- HP wachsen mit dem Level (+3 pro Level, Level 100 = ca. 400 HP), Rüstung senkt Boss-Schaden, ein Fehler kostet nie mehr als 45 % der HP
- Kamera stößt nicht mehr durch Baumstämme, Kakteen und große Felsen; Held wird ausgeblendet, wenn die Kamera ganz nah ist
- Boss-Hallen: ebener Boden, keine Felsen und kein Gras, Sonne innen abgeblendet (Fackellicht), Lavadrache mit Stacheln, Beinen, Krallen und Glutbauch
- Saison-Pass öffnet sich nur noch einmal pro Tag von selbst (vorher bei jedem Gebietswechsel) und erst nach dem Tutorial
- Grafik-Automatik senkt die Stufe nur noch bei dauerhaft niedriger Bildrate (6 s unter 28 FPS, nie in den ersten 20 s, Shader-Hänger zählen nicht) – vorher wurde beim ersten Start fälschlich auf „Niedrig“ gestellt
- Bildrate auf dem Intel-Laptop bei „Schön“: ca. 45 FPS
- Tasten für alles: E benutzen, F Reittier, I Inventar, M Karte, B Emote, V Vokabeln, L Saison, Q Aufgabe, Esc schließt/Pause; Tastenchips auf den Knöpfen, Knöpfe und HUD-Panels im Glas-Look
- Gegner höherer Gebiete: größer (bis +36 %), Gefahrenring und Glühen in Gebietsfarbe, Angriffe in der Welt skalieren mit dem Gebiet (Schattenfestung ×2,4)
- Gebäude: Hütten mit Vordach, Laterne (Licht), Zaun, Fässern, Kiste, leuchtenden Fenstern; Ruinen mit Altar und drehendem Kristall, kopfloser Statue, umgestürzten Säulen, Bodenring
- Bram hat in jedem Gebiet einen eigenen Titel und Begrüßungstext (Karawanenführer, Tempelwächter, Aschewanderer, letzter Wächter)
- Heilung: außerhalb des Kampfes langsam (1,2 %/s), am Lagerfeuer schnell (8 %/s), sobald kein Gegner in 10 m ist; Spielstand lädt mit mindestens halben HP
- Alle fünf Gebiete nacheinander geladen und gesichtet: keine Fehler in der Konsole
- Anfang durchgespielt: Tutorial (7 Schritte), erster Kampf auf Level 1 gegen einen Troll-Krieger. Gegner in der Welt schlagen jetzt nur alle 1,6 s zu (vorher jede Sekunde – Level-1-Held war in 10 s tot)
- Handy quer (z. B. 844×390): Joystick, kompakte Hotbar, Aktionsknöpfe zweispaltig – nichts überlappt mehr mit der Minimap
- Ladehänger: beim Laden eines Gebiets kompiliert der Browser ca. 53 Shader-Programme (Intel-Laptop 20–40 s). Dafür bleibt jetzt der Ladebildschirm stehen, bis das Bild flüssig läuft, und nach „Spielen“ erscheint „Welt wird vorbereitet …“ statt eines eingefrorenen Bilds.

## Offen – Reihenfolge bis Sonntag

1. **Freitag: Vokabeln.** Julians Englischbuch und aktuelle Unit eintragen (📚 Vokabeln → Liste einfügen). Ohne echte Wörter bleibt es ein Demo.
2. **Boss-Kämpfe:** alle fünf (Waldtroll, Sandwurm, Kirschgeist, Lavadrache, Ignatius mit 4 Phasen) bis zum Sieg getestet – Trophäen, Drops und Freischaltungen kommen an. Erledigt.
3. **Charakter-Farben.** Mit den KayKit-Modellen nur über Texturen möglich; vorerst stattdessen vier Helden zur Wahl.
4. **Handy außerhalb des WLANs.** Spiel auf GitHub Pages oder Netlify veröffentlichen. Vorbereitet: `npm run build` erzeugt den Ordner `dist/` (geprüft, Modelle laden), alle Pfade sind relativ, läuft also auch unter einem Unterordner wie GitHub Pages. Es fehlt nur noch ein Konto.
5. **Später:** Multiplayer per Link (Server nötig), Emotes, Freunde-Rangliste.

## Bekannte Grenzen
- Browser begrenzt die Bildrate auf die Monitor-Hertz (60/144/240).
- Auf dem Intel-Laptop „Schön“, auf dem Gaming-PC „Sehr schön“ einstellen.
- Figuren sind Low-Poly (KayKit/Quaternius, frei nutzbar), kein Fotorealismus.
