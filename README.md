# VocabQuest

Vokabeltrainer als 3D-Abenteuer (Web-App für PC, Handy und Tablet).
Das vollständige Konzept steht in [KONZEPT.md](KONZEPT.md).

## Starten

```bash
npm install
npm run dev
```

Dann im Browser `http://localhost:5173` öffnen. Mit `--host` ist die Seite auch im Heimnetz erreichbar (für den Handy-Test).

## Struktur

- `index.html` – Seite mit HUD, Menüs, Inventar, Einstellungen
- `src/main.js` – Spiel (Three.js): Welt, Figuren, Steuerung, Kampf, Quests
- `preview/` – frühe Design-Vorschau als einzelne HTML-Datei (Referenz)
- `KONZEPT.md` – das abgestimmte Spielkonzept
