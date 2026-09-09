# Stand der Prüfung – 7. September 2026

## Version 0.5.0: Canvas-Steuerung und Farbgruppen

- Grund- und Außenschicht über Canvas-Symbole gewechselt und an unabhängig festgelegten Kopf-UV-Pixeln getrennt bemalt.
- Fixierte Vorder-, linke und rechte Seitenansicht durch tatsächliche Rechts-/Mitteltastenziehgesten geprüft: Canvas-Screenshots bleiben pixelgleich. Zoomen verändert die Ansicht weiterhin; nach Entriegeln funktioniert Drehen wieder.
- 88 permanente Studio-Farben in Grundfarben, Haut & Haare sowie Grau & Natur; Projekt-/Bildfarben separat. Kräftiges Rot ist auch nach Import einer Fotopalette verfügbar.
- 60 bestehende Unit-/Adaptertests sowie Projekt-Neustart, Palettenlayout und 3D-Malen mit Undo erfolgreich geprüft. Keine neuen kostenpflichtigen API-Aufrufe für diese Oberflächenänderungen.
- Produktionsbuild und Start des gepackten Builds einschließlich Preload/IPC und Rastervorschau erfolgreich geprüft.
- Portable Windows-ARM64-App fertiggestellt: `release/0.5.0/Skin Forge 0.5.0.exe`. Oberflächenansicht: `artifacts/skin-forge-0.5.0.png`.

## Version 0.4.2: Palette, Projektstart und Kleidung

- 60 Unit-/Adaptertests bestanden, einschließlich 256-Farben-Codec, lokaler Farbauswahl, Cap-Abdeckung, fester Augenpositionen und Kleidung für Classic/Slim.
- Produktionsbuild und portable Windows-ARM64-App `release/0.4.2/Skin Forge 0.4.2.exe` erstellt. Gepackten Build, vollständigen Electron-Smoke-Test, Kleidungsablauf mit aufgezeichneten Antworten und echten `npm run dev`-Start erfolgreich geprüft.
- Electron: Neu mit Speichern/Verwerfen/Abbrechen, abgebrochener und fehlgeschlagener Speicherdialog, korrekter Dateiinhalt, 256-Farben-Extraktion sowie sichtbare Palette und Werkzeugleiste bei 1200×800 und 1600×1000 geprüft.
- 3D-Malen mit unabhängiger UV-Koordinate und Undo sowie die Porträtpipeline mit aufgezeichneten Antworten erneut erfolgreich geprüft.
- Echte API-Tests mit Niko und Umut: granulare Gesichter bei 256 Farben; zusätzlich Umut im direkten Rastermodus. Die feste Augenanordnung verhindert verstreute Pupillenpixel. Vergleich unter `Results/Vergleich.html`.
- Kleidungs-Live-Test mit „Rote Haare, lila Basecap, weißes T-Shirt, schwarze Hose, weiße Sneaker.“: `Results/Niko_outfit_1788785063552/`. Zwei Luna-Aufrufe, 11.409 Eingabe- und 3.034 Ausgabetokens, 23,9 Sekunden. Nur Körperflächen ausgewählt; Kopf und Cap in beiden Schichten bytegenau unverändert. Weiße Ärmel und Sneaker, freie hautfarbene Unterarme und schwarze Hose visuell bestätigt.
- Die aufgezeichnete erste Kleidungsvariante hat eine leere Körper-Außenschicht. Die finale Implementierung ergänzt schmale Ärmelbündchen und Schuhsohlen auf der Außenschicht; diese Variante ist durch lokale Tests abgedeckt.

Die frühere Demo-/Testoberfläche und Beispiel-Importlinks wurden entfernt. Neue Projekte starten neutral; bestehende Autosaves werden erst nach der Neu-Rückfrage ersetzt.

## Version 0.3.0: Porträtvergleich

- 41 Unit-/Adaptertests bestanden: zusätzlich 64 Palettensymbole einschließlich Sonderzeichen, alte 32-Farben-Aufträge, Merkmalsfarben, neun getrennte Gesichtsmasken, begrenzte Korrekturflächen und verdeckte/kontrastarme Pupillen.
- `check-portrait.mjs` besteht mit aufgezeichneten Antworten und ohne Netzwerk: Analyse → Bildentwurf → Raster → Gesichtsreview, Fortschrittsmeldungen, Palette erst bei Annahme und unverändertes Projekt bei einem absichtlich ungültigen letzten Review.
- `check-dev.mjs` startet den echten npm-Befehl: sichtbares natives Electron-Fenster unter Windows, funktionierende IPC, belegter Port 5173 stört nicht, Server endet mit dem Fenster. Der sichtbare Electron-Prozess wird ausdrücklich nicht mit `windowsHide` verborgen; geerbtes `ELECTRON_RUN_AS_NODE` wird entfernt.
- Produktionsbuild und der vollständige Electron-Smoke-Test bestanden.
- Der entpackte Release `release/0.3.0/win-arm64-unpacked` besteht den Pakettest: ASAR-Dateien, Preload, IPC, WebGL und validierte Vorschau.
- Portable Windows-ARM64-App erfolgreich gebaut: `release/0.3.0/Skin Forge 0.3.0.exe` (94.129.974 Bytes).

### Live-Ergebnisse

Referenzen: `Example/Niko_Test.jpg` und `Example/Umut_Test.jpg`. Raster/Analyse/Review: `gpt-5.6-luna`. Gesichtsentwürfe: `gpt-image-2`, 1024×1024, Qualität medium. Der ursprüngliche Niko-Entwurf ist unverändert unter `Results/Niko_image_1788780460710/face-draft.png` erhalten.

| Finale Merkmalsmasken | Responses-Eingabe | Responses-Ausgabe | Laufzeit ohne neue Bildgenerierung | Format / Augen-Kontrast |
|---|---:|---:|---:|---|
| Niko | 13.358 | 4.201 | 40,4 s | bestanden / bestanden |
| Umut | 12.972 | 5.604 | 63,3 s | bestanden / bestanden |

Finale PNGs, Projektdateien und Protokolle: `Results/Niko_hybrid_1788781671051` und `Results/Umut_hybrid_1788781703802`. Die bestehenden Bildentwürfe wurden wiederverwendet; pro finalem Versuch drei echte Luna-Aufrufe. Der vollständige neue Bildmodus benötigt mit frischer Bildgenerierung vier Aufrufe und wurde mit den aufgezeichneten Anbieterantworten zusätzlich vollständig über die Electron-Oberfläche geprüft.

[Vergleich öffnen](../Results/Vergleich.html): Foto, Bildentwurf, direktes 64-Farben-Raster, einfache Bildverkleinerung, Zwischenraster und finale Merkmalsmasken. Die naive Verkleinerung verlor kleine Pupillen und übernahm teils Hals/Hemd in die Kopftextur. Deshalb wird sie nicht als finale Gesichtsmethode verwendet. Auch eine freie Raster-Nachprüfung verlor zunächst Nikos Cap; getrennte Masken mit Materialfarben erhalten diese besser.

Die ersten beiden Umut-Durchläufe enthielten versehentlich Nikos Textbeschreibung und wurden aus dem Qualitätsvergleich ausgeschlossen. Insgesamt wurden für die Versuchsreihe drei Bildentwürfe und 18 Luna-Aufrufe ausgeführt, einschließlich verworfener Varianten und der nach Nutzerfeedback erweiterten Pipeline. Zwei frühere Replay-Starts scheiterten vor einem API-Aufruf am Verschlüsselungskontext; der Replay-Test verwendet nun denselben App-Kontext für die sichere Entschlüsselung. Der Key wird nie protokolliert, der Nutzer-Skin wird nicht verändert.

Die finale lokale Kontrastprüfung bestätigt Kontrast an den vom Modell angegebenen Augenpositionen, keine allgemeine Gesichtsqualität. Zwei Personen ohne Brille oder sichtbare Narbe belegen nicht, dass diese Sondermerkmale bereits zuverlässig funktionieren. Die 8×8-Grenze bleibt sichtbar: Der hochauflösende Entwurf enthält mehr Details, als ein Standardkopf abbilden kann. Noch nicht geprüft: In-Game-Import, weitere Betriebssysteme und größere unabhängige Referenzsammlungen.

## Frühere Prüfungen für Version 0.2.0

- TypeScript-Prüfung und Produktionsbuild erfolgreich.
- 32 Unit-/Adaptertests erfolgreich. Kein echter API-Aufruf in diesen Tests. Zusätzlich abgedeckt: beide Schichten, strikte Grundschicht-Transparenzregeln und heuristische Gesichtshinweise.
- Electron-Oberflächentest erfolgreich: WebGL, IPC-Isolation, Raster-Demo, Vorschau, Verwerfen/Übernehmen, Auswahlmasken, Undo/Redo, manuelles Malen im Flächeneditor, Ablehnung fehlerhafter JSON, verschlüsseltes Speichern/Löschen eines künstlichen Test-Keys, PNG-Export und Import des vorhandenen Beispiels sowie Slim-Geometrie.
- Gezielter 3D-Test erfolgreich: Ein berechneter Klick auf den Rumpf schreibt ausschließlich den erwarteten PNG-Pixel `(21,22)`; Undo stellt den ursprünglichen Puffer wieder her.
- Vite-Entwicklungsstart samt React-Refresh und Electron-IPC geprüft.
- Gepackte App aus `release/win-arm64-unpacked` gestartet: ASAR-Ressourcen, Preload, IPC, Darstellung und validierte Raster-Vorschau geprüft.
- Portable Windows-ARM64-App mit Electron Builder erzeugt.

Alle Electron-Tests verwenden isolierte Profile unter `artifacts/`. Die vorhandenen Beispielbilder werden nicht verändert. Die API-Adaptertests simulieren Antworten; die sichere Key-Speicherung wurde ausschließlich mit einem absichtlich ungültigen Test-Key geprüft.

## Autorisierter Live-Test für Version 0.2.0

Ein echter Aufruf mit `gpt-5.6-luna`, dem vom Nutzer gespeicherten API-Key, `Example/Niko_Test.jpg`, allen Körperteilen und beiden Schichten. Ergebnis: 72 gültige Flächen, sichtbare Augen und eine nichtleere, teilweise transparente Außenschicht. Die Vorschau wurde visuell geprüft. 6.392 Eingabe- und 2.446 Ausgabetokens, rund 22,4 Sekunden API-Laufzeit. Keine automatische Wiederholung und keine Veränderung des Nutzerprojekts. Ergebnisse: `artifacts/live-1788778745108/` (PNG, Projektdatei, Vorschau und Protokoll). Das verschlüsselte Test-Key-Duplikat wurde anschließend entfernt; der Original-Key blieb unverändert.

Die Ergebnisse liegen zusätzlich unter `Results/Niko_Luna_v2*`. Der vollständige Electron-Smoke-Test besteht auch mit der neuen gemeinsamen Schichtgenerierung. Version 0.2.0 wird separat unter `release/0.2.0` gebaut; als Laufzeitquelle dient die vorhandene lokale Electron-Installation, um ein Windows-Problem beim Umbenennen frisch entpackter Laufzeitordner zu umgehen.

Noch nicht geprüft: allgemeine gestalterische Qualität über viele Referenzen, Import in einer laufenden Minecraft-Installation und andere Betriebssysteme/Prozessorarchitekturen. Die App erzeugt technisch standardisierte 64×64-PNGs; eine umfassende automatische Bewertung von Motiven und Körperteilnähten ist nicht implementiert.
