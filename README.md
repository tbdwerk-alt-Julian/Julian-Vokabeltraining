# VocabQuest

Vokabeltrainer als 3D-Abenteuer (Web-App für PC, Handy und Tablet).
Das vollständige Konzept steht in [KONZEPT.md](KONZEPT.md).

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
