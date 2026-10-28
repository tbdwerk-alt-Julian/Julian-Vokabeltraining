# VocabQuest – Konzept (Stand: 28.10.2026)

**Für:** Julian, 9. Klasse IGS Rheinzabern, Richtung Realschulabschluss
**Ziel:** Vokabeln lernen ohne Karteikarten – als 3D-Abenteuer-Spiel, in dem jedes Lernen gleichzeitig Fortschritt im Spiel ist
**Plattform:** Web-App für PC, Laptop, iPhone, iPad und Android. Auf dem Handy über „Zum Home-Bildschirm" wie eine echte App.

---

## 1. Grafik, Steuerung & Eingabe

- **3D, Third-Person**, Low-Poly, gemischter Stil: Fantasy-Welt, leicht Anime-angehauchte Charaktere
- **Eingabe:** PC = WASD + Maus · Handy = virtueller Joystick · **Controller** (Xbox, PlayStation, Switch Pro) auf PC und Mobile
- Am Handy/Tablet angeschlossene **Tastatur oder Controller** werden automatisch erkannt, Joystick blendet sich aus
- **Controller steuert, Tastatur schreibt:** Vokabeln werden immer auf einer Tastatur getippt – keine Controller-Bildschirmtastatur
- **Keine Vibration**
- **Fallschaden:** kleine Sprünge okay, hohe Stürze kosten Herzen, sehr tief = tot

---

## 2. Spielstart

1. **Name** frei wählbar
2. **Charakter** im Editor gestalten (siehe 15)
3. **Kurs:** Grundkurs oder Erweiterungskurs
4. **Erweiterungskurs zusätzlich:** Modus Sanft oder Streng
5. **Reittier:** Schildkröte oder Tiger
6. Alle starten am **gleichen Startpunkt**: Lager am Waldrand

Mehrere Spielstände möglich.

| | Grundkurs | Erweiterungskurs |
|---|---|---|
| Antworten | Multiple-Choice erlaubt, mehr Zeit | Tippen, Zeitdruck, Lückentexte |
| Hinweise | immer verfügbar | **nur durch Quests verdient** |
| Bosse | weniger Leben | stärker |
| Belohnung | normal | mehr XP, seltenere Items |

| Modus (Erweiterungskurs) | Schreibfehler |
|---|---|
| **Sanft** | zählt als richtig, **rot markiert** + richtige Schreibweise; normaler Schaden, kein Krit |
| **Streng** | zählt als **falsch** – Herz weg |

---

## 3. Weltkarte & Gebiete

Land- und Wasserwege, Gebiete nacheinander:

| # | Gebiet | Mini-Boss | Boss | Mindestlevel | Freischaltung |
|---|---|---|---|---|---|
| 1 | 🌲 Wald | Alpha-Wolf | Waldtroll | 10 | Start |
| 2 | 🏜️ Wüste | Riesenskorpion | Sandwurm | 25 | Waldtroll besiegt |
| 3 | 🌸 Kirschen-Gebiet | Kirschen-Samurai | Kirschgeist | 50 | Sandwurm besiegt |
| 4 | 🌋 Vulkan | Magma-Golem | Lavadrache | 75 | alle drei abgeschlossen |
| 5 | 👑 Schattenfestung (geheim) | – | Ignatius | 100 | alle 4 Trophäen |

- **Max-Level 100**
- Map-Menü: Position, geschafft ✓, gesperrt 🔒, offene Quests
- Jedes Gebiet 3–5 Min zu Fuß von Rand zu Rand, mit Reittier halb so lang
- **Schnellreise** über besuchte Lagerfeuer (nur außerhalb von Kämpfen)
- **Wetter** nur Optik: Regen, Sandsturm, Blütenregen, Aschefall
- **Plauder-NPCs** mit Sprüchen und Hinweisen auf Secret Quests
- **10 versteckte Kristalle** pro Gebiet → alle gefunden = Gebiets-Skin fürs Reittier
- Vokabel-Zuordnung: je Gebiet eine Unit, Lavadrache fragt alles gemischt ab

---

## 4. In den Gebieten

**Stationen** – Vokabel-Runden für XP

**Gegner** – greifen an, kämpfen oder fliehen (nicht garantiert), Respawn nach 5 Min, Belohnung XP/Münzen/Trank

**Truhen** – kleine Vokabel-Aufgabe zum Öffnen, täglicher Reset mit neuem Loot; pro Gebiet eine **goldene Truhe** (wöchentlich, besserer Loot)

**NPCs mit Quests**
- Normale Quests (XP, Münzen, Aussehen)
- **Secret Quests** (versteckt, seltene Schwerter)
- Im Erweiterungskurs einzige Quelle für Hinweise

**Quest-Tracker** – aktive Quest oben am Bildschirm mit Fortschritt; abbrechen oder liegen lassen; mehrere gleichzeitig, eine verfolgt; klappt im Kampf zusammen

**Tagesaufgaben** – täglich 3 zur Auswahl, eine nehmen; XP, Münzen, Saison-XP

---

## 5. Kämpfe

| Antwort | Wirkung |
|---|---|
| **Komplett richtig, kein Schreibfehler** | **Kritischer Treffer – 2× Schaden** |
| Richtig mit Tippfehler | Sanft: 1×, rot markiert · Streng: wie falsch |
| Falsch | kein Schaden, Herz weg |
| Grundkurs (Multiple-Choice) | Krit bei schneller Antwort (< 3 Sek.) |

- **Combo-Leiste** – 5 in Folge +10 % · 10 = +25 % · 15 = Kräfte laden doppelt so schnell; Fehler setzt zurück
- **Ausweichrolle** – eigene Taste, sichtbare Boss-Attacken ausweichen, kurze Abklingzeit; Kampf pausiert nicht beim Tippen
- **Kein Friendly Fire** – Kräfte gehen durch Freunde durch
- **Tod:** Singleplayer Respawn am Speicherpunkt · Multiplayer: Teammate kommt und belebt mit einer richtigen Vokabel wieder
- Beim Kampfbeginn steigt man automatisch vom Reittier ab, es nimmt keinen Schaden

---

## 6. Bosse

- **Mindestlevel ist Pflicht**, beliebig oft wiederholbar; nach Niederlage nochmal oder aufleveln
- **Mini-Bosse** auf halber Strecke, kein Mindestlevel, kleiner Drop

### Phasen
Alle normalen Bosse **2 Phasen**: Phase 2 ab 50 % Leben – **stärker, Aussehen ändert sich**, Vokabeln wechseln zu Sätzen/Lückentexten.

| Boss | Phase 2 |
|---|---|
| Waldtroll | Augen glühen rot, wirft Baumstämme |
| Sandwurm | Panzer bricht auf, Kern leuchtet, Sandsturm |
| Kirschgeist | Blüten werden schwarz, teilt sich in zwei |
| Lavadrache | Schuppen glühen, **fliegt** – nur mit Bogen |

### Arena-Umgebung
Wald: Bäume als Deckung · Wüste: Treibsand · Kirschen: Blütenwind nimmt Sicht · Vulkan: Lavaspalten (Fallschaden)

### Drops & Trophäen
| Boss | Drop-Chance | Garantiert beim | Trophäe (immer) |
|---|---|---|---|
| Waldtroll | 1/3 | 6. Sieg | Trollzahn |
| Sandwurm | 1/4 | 8. Sieg | Wurmschuppe |
| Kirschgeist | 1/5 | 10. Sieg | Kirschblüten-Kristall |
| Lavadrache | 1/6 | 12. Sieg | Drachenkralle |

- Drop = eigenes Schwert oder Rüstungsteil, kein doppelter Drop
- **Alle 4 Trophäen beim Schmied → legendäre Waffe**

### Geheimer Boss: Ignatius, der Schattenkönig
- **Schattenfestung** auf dem Vulkangipfel: schwarze Burg, Fackeln, Zugbrücke, Thronsaal, Spiegel mit den vier Bossen
- Ritter in schwarzer Rüstung, vier Schwerter im Stil der Bosse – **4 Phasen**, pro Phase ein anderes Schwert mit dessen Attacken
- Alle Units, beide Richtungen, Level 100 Pflicht, Streng, keine Hinweise
- Belohnung: Titel „Schattenbezwinger", Ignatius' Rüstung als Skin, 5. Rahmen an der Trophäenwand

---

## 7. Ausrüstung, Items & Händler

- **Waffen:** Schwerter (hoher Schaden), Bögen (Boni bei Tempo / fast richtig; Pflicht gegen fliegenden Lavadrachen)
- **Rüstung:** aus Boss-Drops, sichtbar am Charakter
- **Kräfte** (nur beim Händler): Zeitstopp, Feuerball, Heilung, Eiswand, Schattenschritt, Echo
- **Keine Elemente**
- **Münzen** als Währung; **Inventar** 20 Plätze, erweiterbar
- **Seltenheiten:** Gewöhnlich (grau) · Selten (blau) · Episch (lila) · Legendär (gold) · Saison (rot)
- **Tränke:** Heiltrank, Großer Heiltrank, Phönix-Trank, Ausdauer-Trank, Glückstrank, Zeittrank

**Händler** – jede volle Stunde, bleibt 15 Min; Sortiment pro Besuch: 2 Tränke, 3 Kräfte, 1 Skin, 1 Überraschungs-Item; manche Kräfte nur in bestimmten Gebieten

---

## 8. Reittiere

| Tier | Land | Wasser |
|---|---|---|
| Schildkröte | langsam | schnell |
| Tiger | schnell | langsam |

- **Skill-Baum:** 3 Stufen Land, 3 Stufen Wasser, 3 Stufen Ausdauer, 1 Sprung-Upgrade
- Ausdauer leer → 10 Vokabeln füllen auf
- Per Taste **rufen**, zweites Tier über Secret Quest, beide im Stall wechselbar
- Skins: Panzer-/Fellfarbe, Muster, Sattel, Gebiets-Skins über Kristalle

---

## 9. Lager

Wächst mit Münzen:
- **Schmiede** – Waffen/Rüstung verbessern, legendäre Waffe aus Trophäen
- **Stall** – Reittier-Upgrades und Skins
- **Lagerfeuer** – Herzen regenerieren, speichern
- **Trophäenwand** – besiegte Bosse mit Zähler
- **Wiederholungs-Station** – nur 1- und 2-Sterne-Wörter, kein Kampf
- Freunde können das Lager besuchen; Multiplayer-Lobby ist hier

---

## 10. Begleiter

Kleines Tier (Fuchs, Eule, Drachenbaby, Katze …), läuft mit, kein Schaden, **sammelt Münzen** und **zeigt Truhen**. Aus Secret Quests oder Saison-Pass, Skins, im Lager wechselbar.

---

## 11. Täglich, Freunde & Saison

**Login-Bonus** – nur Mo–Fr, zählt ab 15 Min Spielzeit (Fortschrittsring), 1× pro Woche wiederherstellbar

**Freunde** – Liste, Rangliste (Level, XP, Bosse), direkt einladen

**Saison-Pass** – alle 4 Wochen, eigenes Thema, 30 Stufen, Stufe 30 = seltener Skin, komplett kostenlos

**Statistik-Seite** – welche Wörter sitzen/wackeln/fehlen, Minuten pro Woche, Login-Serie, Bosse – auch zum Zeigen zu Hause

**Erinnerungen** – Push-Nachrichten (Login-Tag, Händler, Tagesaufgabe), standardmäßig aus

---

## 12. Multiplayer (Co-op)

- **Einladungslink**, bis zu **4 Spieler**, über jede Entfernung
- **Lobby im Lager**: alle Spieler, Level, Bereitschaft, Host startet
- Nur Gebiete, die der **Host** freigeschaltet hat; Drops/Freischaltungen zählen nur mit passendem Level
- Jeder spielt **seine eigenen Vokabellisten**
- Jeder sieht den Look der anderen
- **Schnellchat** mit festen Sätzen, **Emotes** (winken, tanzen, Daumen hoch …) über Emote-Rad
- **Verbindungsabbruch:** 60 Sek. Rückkehr möglich, danach aus dem Kampf entfernt

**Boss im Multiplayer:** HP × Spielerzahl (2 = 2×, 3 = 3×, 4 = 4×); eigene Herzen; wer bei 0 ist, löst weiter und lädt **Power-ups**: Heiltrank · Schild · Doppelschlag (mit Krit = 4×) · Hinweis

Technisch: braucht Server → zweite Baustufe.

---

## 13. Einstellungen

Für PC und Mobile, alles änderbar, **wirkt sofort ohne Neustart**:

- **Steuerung:** Tasten/Controller-Belegung frei (inkl. Rolle), Joystick-Größe/-Position, Knöpfe tauschen
- **Sensitivität** getrennt: Maus (X/Y, Bogen-Ziel), Controller (beide Sticks, Deadzone), Touch (Joystick, Kamera-Wisch), Kamera (Zoom, umkehren) – Schieberegler mit Zahl, „Zurücksetzen" pro Bereich
- **Ton:** Musik/Effekte getrennt, Stummschalter
- **Grafik:**
  - FPS-Limit PC **60 / 120 / 240 / unbegrenzt**, Handy **60 / 120**, FPS-Anzeige
  - Stufen **Sehr schön / Schön / Mittel / Niedrig** – manuell wählbar, Auto-Vorschlag beim ersten Start
  - **Sichtweite auf allen Stufen gleich** – nur Schatten, Wetter, Partikel, Spiegelung, Kantenglättung, Texturen ändern sich. Niedrig ist nie ein Nachteil
- **Spiel:** Sprache, Spielstand, Konto, Freunde, Einladungslink, Erinnerungen
- **Charakter:** Editor jederzeit öffnen
- **Barrierefreiheit:** Schriftgröße, Farbschwache Modi

---

## 14. Speichern, Sound & Lernsystem

- **Speicherknopf** überall + Autosave; „Weiter, wo du aufgehört hast?"
- **Musik:** ruhig auf der Karte, Boss-Musik bei Bossen und Gegnern
- **Vokabel-Sets** pro Unit, Gebieten zuordenbar
- **Neue Wörter werden erst gezeigt** (Übersetzung, Beispielsatz), dann abgefragt
- **Sterne:** 1 = einmal richtig · 2 = dreimal an verschiedenen Tagen · 3 = fünfmal, davon einmal nach über einer Woche Pause
- Schwache Wörter kommen automatisch öfter
- **Beispielsätze** pro Wort, im Erweiterungskurs als Lückentext

---

## 15. Charakter-Editor

Beim Erstellen und jederzeit in den Einstellungen, 3D drehbar, Zufalls-Knopf:
- **Körper:** 8 Hauttöne, Größe, Statur
- **Frisuren** ca. 15, **Haarfarbe** natürlich + bunt + zweifarbig
- **Augen** 6 Formen (inkl. groß/Anime), Farbe frei
- **Gesicht:** Narben, Sommersprossen, Augenklappe, Bemalung, Bart
- **Kleidung** (Haupt- + Nebenfarbe): Hoodie, T-Shirt, Lederweste, Mantel, Kimono-Jacke, Ritterhemd, Umhang · Jeans, Cargo, Stoff, Beinschienen · Sneaker, Stiefel, Sandalen, barfuß
- **Extras:** Brille, Kopfband, Mütze, Kapuze, Hörner, Ohrringe, Halskette, Rucksack, Schwert sichtbar
- **Farb-Paletten:** Nacht, Flamme, Ozean, Wald, Kirsche
- **Boss-Rüstungen sichtbar:** Rinden-Panzer · Schuppenpanzer · Blütenstoff · Drachenschuppen · Ignatius' Rüstung
- Neue Teile aus Händler, Truhen, Quests, Drops, Saison-Pass

---

## 16. Vokabeln & Bau-Reihenfolge

- Buch + Unit folgen → Listen werden vorgeschlagen und korrigiert; eigene Eingabe in der App als Basis; Foto vom Buch später
- **Bau-Reihenfolge:** Lernsystem + Kämpfe → 3D-Welt mit Wald, Alpha-Wolf, Waldtroll → Gegner/Truhen/Händler/Quests/Lager → Charakter-Editor, restliche Gebiete → Ignatius → Multiplayer, Saison-Pass, Erinnerungen

---

## Nicht gewählt (bewusst draußen)
Elemente · Klassen-System · Wochen-Boss · Geister-Wörter · Hörverstehen · Übersetzungsrichtung-Stationen · Reittier-Rennen · Tag-Nacht · Fotomodus · Vokabel-Block bei Boss-Attacken · Boss-Schwachstelle · Beschwörer-Mechanik · Boss-Rang · Hardmode · Vibration · Controller-Bildschirmtastatur
