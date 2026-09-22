# Skin Forge

Lokaler Minecraft-Skin-Editor für Windows mit Electron, React, TypeScript und Three.js. Das **validierte Pixel-Harness** verarbeitet strukturierte Raster. Ein optionaler Bildentwurf dient als zusätzliche Vorlage, niemals als direkt importierter Skin-Atlas.

## Starten

Voraussetzung für Entwicklung: Node.js 22.12 oder neuer und npm.

```powershell
npm install
npm run dev
```

Fertigen lokalen Build starten:

```powershell
npm run build
npm start
```

`npm run dev` öffnet ein sichtbares Electron-Fenster. Der interne Vite-Server verwendet einen eigenen freien Port und endet beim Schließen des Fensters. `npm run dev:web` startet ausdrücklich die Browserversion; API-Key und API-Aufrufe stehen ausschließlich in Electron zur Verfügung.

`npm run package` erstellt eine portable Windows-App in einem Versionsordner unter `release`, aktuell `release/0.5.0`. Die App ist nicht digital signiert.

Zum Paketieren wird die bereits installierte Electron-Laufzeit verwendet. Der Build hat damit die Architektur der lokalen Electron-Installation (auf diesem Rechner Windows ARM64).

## Neues Projekt

Neue Projekte starten mit einer neutralen, unbemalten Figur. „Neu“ bietet Speichern und neu, Ohne Speichern fortfahren oder Abbrechen. Wird der Dateidialog abgebrochen oder schlägt das Speichern fehl, bleibt das aktuelle Projekt erhalten. Bereits lokal gespeicherte Projekte werden weiterhin geladen; ein früherer Beispiel-Skin lässt sich über „Neu“ ersetzen.

## Erster echter KI-Test

Neu: Unter **Skin-Stil** stehen sechs anpassbare Presets zur Verfügung. Sie werden im Projekt gespeichert und steuern auch die Gesichtsregeln. In den Einstellungen kann **Astra als Rastermodell** gewählt und der Reasoning-Aufwand eingestellt werden. Raster- und Bildmodell sind getrennte Einstellungen. Ein Bildentwurf bleibt eine Vorlage für das Rastermodell. Details und Testkonzept: [Skin-Kategorien](docs/SKIN-CATEGORIES.md).

Für einen kurzen Gesichtstest: nur Kopf, nur Grundschicht, direktes Pixelraster, Reasoning niedrig und Merkmalsanalyse zunächst aus. Dies benötigt einen API-Aufruf. Gesamtzeit und aktuelle Schrittzeit werden angezeigt; das Ergebnis enthält Laufzeiten und Tokenverbrauch je Stufe. Astra wurde noch nicht quantitativ gegen Luna verglichen.

1. In den Einstellungen die gewünschte **OpenAI-Modell-ID** eintragen. Das Modell muss Structured Outputs unterstützen; für ein Referenzbild zusätzlich Vision. Es gibt absichtlich keine fest verdrahtete Modellannahme.
2. Deinen eigenen API-Key speichern. Er wird im Electron-Hauptprozess mit `safeStorage` verschlüsselt gespeichert und nicht an den Renderer zurückgegeben.
3. Optional ein Referenzbild auswählen. Die App bereitet es lokal auf höchstens 1024 Pixel Kantenlänge auf und zeigt an, dass es an OpenAI gesendet wird.
4. Körperteile auswählen. Unter „KI bearbeitet“ stehen **beide Schichten gemeinsam** (Standard), nur Grundschicht oder nur äußere Schicht zur Wahl. Die Körperteilauswahl begrenzt auch das manuelle Malen; die aktive Malschicht im Canvas ist davon unabhängig.
5. Palette wählen, Prompt beschreiben, „Mit KI generieren“ drücken.
6. Nach der lokalen Validierung die Vorschau beurteilen und erst dann übernehmen.

Bei einem Porträt mit ausgewählter Kopf-Grundschicht ist „Merkmale analysieren & Gesicht nachprüfen“ standardmäßig aktiv:

1. Hauttöne, Haare, Iris, Brauen, Bart, Lippen, Brille, Narbe und Cap getrennt erfassen; erkannte Materialfarben ergänzen die Palette.
2. Optional: GPT Image 2 erstellt einen Gesichtsentwurf.
3. Das Rastermodell überträgt Foto, Merkmale und optionalen Entwurf in die freigegebenen Skin-Flächen.
4. Eine gezielte Gesichtskorrektur prüft das tatsächlich zusammengesetzte 8×8-Gesicht. Neun interne Merkmalsmasken mit eigenen erlaubten Farben werden lokal zusammengesetzt. Anschließend prüft die App den Kontrast an den gemeldeten Pupillenpositionen. Körperflächen bleiben in diesem Schritt erhalten.

Ohne Porträtanalyse kostet das direkte Raster einen API-Aufruf, mit Analyse und Gesichtsprüfung drei. Der Bildentwurf ergänzt einen Aufruf mit `gpt-image-2`. Der standardmäßig aktive Kleidungsabgleich ergänzt einen weiteren Aufruf, sofern Körperflächen mit Grundschicht gewählt sind. Damit benötigt eine reine Kleidungsänderung zwei Aufrufe, ein komplettes Porträt mit Kleidungsabgleich vier beziehungsweise fünf mit Bildentwurf. Die Werkstatt zeigt die Anzahl vor dem Start. Keine automatischen Wiederholungen. Responses-Aufrufe verwenden `store: false`. Übertragen werden Prompt, Palette, Rasterkontext, Referenzfoto und gegebenenfalls Bildentwurf und gerenderte Gesichtsvorschau. Ein Abbruch macht bereits entstandene Kosten nicht rückgängig.

Die **88 Studio-Farben sind keine offizielle Minecraft-Palette**. Sie sind dauerhaft in „Grundfarben“, „Haut & Haare“ und „Grau & Natur“ verfügbar, einschließlich kräftiger Rot-, Grün- und Blautöne. „Projekt / Bild“ zeigt die aktuelle Palette aus dem Projekt, Foto oder KI-Ergebnis. Ein gewählter Studio-Farbton wird bei Bedarf zur Projektpalette hinzugefügt; bei vollem Limit ersetzt er deren letzten Eintrag. „Alle Farbgruppen laden“ übernimmt alle 88 Farben. Neue Projekte ohne Autosave starten damit; bestehende Projektpaletten werden nicht ungefragt ersetzt.

Die Palettengröße ist auf 64, 128 oder 256 Farben einstellbar. „Farben aus Referenzbild übernehmen“ extrahiert lokal bis zu dieser Anzahl repräsentativer Farben. Eigene Farben und Farben aus dem Skin können ebenfalls übernommen werden. Die Porträtanalyse ergänzt Materialfarben innerhalb dieses Limits. Die ergänzte Palette wird erst mit der KI-Vorschau übernommen. Bestehende Pixel außerhalb der Auswahl bleiben exakt erhalten.

Die Kleidungsdetails sind als einfach, schattiert oder detailliert einstellbar. Der detaillierte Modus fordert zusammenhängende Stofftöne, Nähte, Säume und passende Kragen statt einfarbiger Flächen. „Cap/Mütze geschlossen halten“ schließt die obere Kopffläche und den oberen Rand in den gewählten Schichten anhand der erkannten Kopfbedeckung. Augen und untere Gesichtspartien bleiben dabei erhalten.

„Kleidung und Schuhe abgleichen“ erstellt vor dem Raster einen Materialplan. Ein lokaler Schritt vereinheitlicht anschließend Standardkleidung: kurze T-Shirt-Ärmel mit freien Unterarmen, lange Ärmel mit freien Händen, Hosen/Shorts und getrennte Sneaker/Stiefel. Shirt und Ärmel verwenden dieselbe Farbreihe. Kopf und nicht ausgewählte Flächen bleiben unberührt. Aufwendige Muster, Logos und besondere Schnitte sind in diesem Schritt nicht abbildbar; dafür den Abgleich ausschalten. Für eine reine Kleidungsänderung den Kopf in der Körperteilauswahl abwählen.


Haare gehören bereits auf die Grundschicht. Kurze Haare brauchen außen keine deckende Hülle; einzelne Strähnen oder Cap-Details können dort Tiefe ergänzen. Bei gemeinsamer Schichterzeugung hält der Porträt-Review die vordere Außenschicht frei, damit das Gesicht sichtbar bleibt.

Seit Version 0.2.0 kann ein einzelner Aufruf Grund- und Außenschicht zusammen gestalten. „Menschliches Gesicht mit sichtbaren Augen“ ergänzt konkrete Gesichtsvorgaben; für Monster, Roboter oder absichtlich verdeckte Gesichter lässt sich dies ausschalten. Eine lokale heuristische Prüfung weist auf möglicherweise unklare Augen oder eine leere angeforderte Außenschicht hin. Sie verändert keine Pixel und garantiert keine gestalterische Qualität.

## Bedienung

- Grundschicht und äußere Schicht werden über Würfel- und Ebenensymbol rechts im Canvas gewählt. Das aktive Symbol ist hervorgehoben; die Auswahl gilt auch für den Flächeneditor.
- Die Kameraauswahl oberhalb des Canvas bietet vorne, hinten, linke und rechte Seite. Diese Ansichten werden automatisch fixiert: Drehen und Verschieben sind gesperrt, Zoomen bleibt möglich. Das Schloss löst die Sperre oder fixiert eine freie Kameraausrichtung. „Freie 3D-Ansicht“ stellt die bewegliche Ausgangsansicht wieder her. Seitenbezeichnungen beziehen sich auf die Figur.

- Linke Maustaste malt am 3D-Modell. Rechte Maustaste oder Alt + Ziehen dreht; Mausrad zoomt. Mittlere Maustaste verschiebt die Kamera.
- Stift `B`, Radierer `E`, Pipette `I`, Füllen `F`, Drehen `V`.
- `Strg+Z` macht rückgängig, `Strg+Shift+Z` stellt wieder her. Ein Pinselstrich oder eine KI-Übernahme entspricht einem Schritt; bis zu 80 Schritte bleiben in der Sitzung.
- Der Flächeneditor erreicht jede der sechs Seiten eines Körperteils, auch verdeckte Flächen. Füllen bleibt innerhalb der aktuellen Fläche und Farbgrenze.
- Radieren ist nur in der äußeren Skin-Schicht möglich. Die Grundschicht wird deckend exportiert.
- Classic und Slim haben unterschiedliche Arm-Raster. Beim Umschalten werden Armflächen lokal umgerechnet; das ist rückgängig machbar.
- PNG enthält keine zuverlässige Classic-/Slim-Auswahl. Beim Import und später in Minecraft das passende Modell wählen.
- Änderungen werden lokal automatisch gesichert. Eine `.skinforge`-Datei enthält Pixel, Modell, Name und Palette. API-Key, Referenzbild und Undo-Historie werden nicht mit exportiert.

## Harness-Vertrag

Siehe [docs/HARNESS.md](docs/HARNESS.md) für Format, Orientierung, Validierung und Erweiterung.

Die KI erhält dynamische JSON-Schemata für die ausgewählten Flächen beziehungsweise Merkmalsmasken mit exakten Rastermaßen und erlaubten Farben. Jede Zeile ist eine Zeichenkette; ein Pixel benötigt bis 64 Farben ein Zeichen, darüber zwei Hex-Zeichen. Modell-Code wird nie ausgeführt. Der Bildmodus decodiert einen quadratischen PNG-Entwurf als Vorlage für einen folgenden Rasteraufruf.

Testprotokolle entstehen ausschließlich über Entwicklungsskripte unter `scripts/`; die Demo- und Testoberfläche ist entfernt. Die Malwerkzeuge und Undo/Redo liegen als schwebende Symbolleiste in der 3D-Ansicht. Die Palette besitzt einen eigenen scrollbaren Bereich, der nicht auf wenige Pixel zusammenschrumpft.

## Prüfungen

```powershell
npm test
npm run build
npm run test:e2e
```

Zusätzliche Integrationstests: `node scripts/check-painting.mjs` prüft einen 3D-Klick gegen eine unabhängig festgelegte PNG-Pixelposition und Undo. `node scripts/check-dev.mjs` startet tatsächlich `npm run dev` und prüft ein sichtbares Windows-Fenster, IPC, Port-Isolation und Serverende. `node scripts/check-portrait.mjs` prüft alle vier Porträtstufen mit gespeicherten Antworten ohne Netzwerk. `node scripts/check-package.mjs` prüft den entpackten Release-Build nach dem Paketieren.

`node scripts/check-canvas-controls.mjs` prüft getrenntes Schichtmalen, fixe Kameraseiten, gesperrte Mausgesten, Zoom und Entriegeln. `node scripts/check-color-import.mjs` prüft die permanenten Farbgruppen nach einem Projektimport und dass eine neue Palettenfarbe keine bestehenden Pixel umfärbt.

Unit-Tests prüfen feste UV-Koordinaten, Überschneidungen, Masken für jedes Körperteil und beide Modelle, gemeinsame Schichterzeugung, Transparenz, Gesichtshinweise, fehlerhafte Raster, veraltete Antworten, Projektdateien und den API-Adapter mit simulierten Antworten. Der Electron-Smoke-Test verwendet ein isoliertes Testprofil, einen ungültigen Test-Key und keine echten API-Anfragen. Screenshots und ein exportiertes PNG liegen anschließend unter `artifacts/`.

`node scripts/test-live.mjs --paid` testet Niko mit Luna und dem verschlüsselten App-Key in einem isolierten Profil. `--umut` verwendet Umuts Bild, `--image` ergänzt den Bildentwurf. Mit aktiver Porträtanalyse und Kleidungsabgleich sind es vier beziehungsweise fünf kostenpflichtige Aufrufe. Ergebnisse landen unter `Results/`. Nicht Bestandteil von `npm test`.

[Results/Vergleich.html](Results/Vergleich.html) zeigt beide Fotos, Bildentwürfe, direkte Raster, die verworfene einfache Verkleinerung sowie das Raster vor und nach granularer Gesichtskorrektur. Für die letzten Tests wurden die vorhandenen Bildentwürfe wiederverwendet. Details: [docs/VALIDATION.md](docs/VALIDATION.md).

## Umfang dieses Prototyps

Implementiert: Standard-64×64-Skins, Classic/Slim, zwei Minecraft-Skin-Schichten, direktes 3D-Malen, Flächeneditor, Palette, Import/Export, Projekte, Autosave, Undo/Redo, Auswahl, Vorschau, strukturierte OpenAI-Anbindung.

Noch offen: unabhängige benannte Editorebenen, Symmetrie-Werkzeug, Legacy-64×32-Konvertierung, Resource-Pack-Paletten, weitere KI-Anbieter, quantitative Gestaltungsevaluation und Bedrock-Skin-Packs. Ein echter Luna-Test mit Referenzbild hat sichtbare Augen und eine nichtleere Außenschicht geliefert. Das ist noch keine allgemeine Qualitätsgarantie; der Import in einer laufenden Minecraft-Installation ist weiterhin offen.

## Technische Quellen

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI Bildgenerierung](https://developers.openai.com/api/docs/guides/image-generation)
- [OpenAI Bildeingaben](https://developers.openai.com/api/docs/guides/images-vision)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Minecraft Skin Pack-Dokumentation](https://learn.microsoft.com/en-us/minecraft/creator/documents/packagingaskinpack)
- [Three.js Raycaster](https://threejs.org/docs/pages/Raycaster.html)
- [skinview3d Modell als UV-Referenz](https://github.com/bs-community/skinview3d/blob/master/src/model.ts)

Unabhängiges Projekt, nicht von Mojang oder Microsoft. Das Beispielbild im vorhandenen `Example`-Ordner stammt aus dem Nutzer-Workspace.
