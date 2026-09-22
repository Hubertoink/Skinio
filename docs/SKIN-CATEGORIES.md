# Vorschlag: Skin-Kategorien und Generatorvergleich

Stand: 9. September 2026. Die sechs Stil-Presets mit anpassbaren Merkmalen sind implementiert. Die unten beschriebene Datensammlung und der automatische A/B-Benchmark bleiben ein Vorschlag.

## Implementierter Stand

In der KI-Werkstatt stehen Freie Gestaltung, Classic Human, Soft / Anime, Porträt, Masked, Creature und Robot zur Wahl. Motiv, Augen, Mund, Haare, Schattierung, Außenschicht und Zusatzdetails können angepasst werden. Versionierte Profile werden im Projekt und Autosave gespeichert; alte Projekte starten mit Freier Gestaltung.

Die Profile steuern Rasterprompt, Bildentwurf und Porträtprüfung. Feste Pupillen werden beim passenden Porträtprofil verwendet; große Augen bleiben in der Maskenkomposition erhalten. Freie Gestaltung behält die bisherigen optionalen menschlichen Gesichtsvorgaben. Verdeckte oder nichtmenschliche Gesichter deaktivieren die menschliche Porträtanalyse, können aber einen Bildentwurf verwenden. „Keine Außenschicht“ leert nur ausgewählte äußere Flächen. Technische Rastervalidierung und Auswahlschutz bleiben erhalten.

In den Einstellungen ist Astra (`gpt-6-astra`) direkt auswählbar; vorhandene Modell-IDs bleiben erhalten. Das Bildmodell ist separat konfigurierbar (bisheriger Standard `gpt-image-2`). GPT-5/6-Rasteranfragen verwenden standardmäßig `reasoning.effort: low`; Modellstandard, mittel und hoch sind wählbar. Ob Astra hier bessere Ergebnisse erzielt, wurde noch nicht mit bezahlten Aufrufen gemessen.

Die Generierung zeigt Gesamtzeit und Zeit im aktuellen Schritt. Ergebnisse zeigen Stufenlaufzeiten, Modell, Pipeline sowie Ausgabe- und Reasoning-Token, soweit die API sie liefert. Das bestehende Gesamtzeitlimit von sieben Minuten meldet jetzt den letzten Schritt. Vier sequenzielle Aufrufe, große Raster und Reasoning können die Laufzeit erhöhen; aus dem abgebrochenen Nutzerlauf liegen keine Messdaten vor.

Ein manuell entworfenes Gesicht zum bereitgestellten Foto liegt als [exaktes Raster mit Palette](examples/portrait-face.json), [8×8-PNG](examples/portrait-face-8x8.png) und [Pixelvergrößerung](examples/portrait-face-512x512.png) vor. Dies ist nur die Vorderseite des Kopfes, kein vollständiger Skin-Atlas. Mit `node scripts/render-face-example.mjs` lassen sich die PNGs aus dem Raster reproduzieren.

## Ausgangspunkt

Skin Forge unterstützt bereits OpenAI Responses für strukturierte Pixelraster und optional die Images-Edits-API mit `gpt-image-2` als Gesichtsentwurf. Der Entwurf wird anschließend vom Rastermodell interpretiert. Die aktuelle Porträtkomposition erzwingt kleine Augen an festen Positionen. Ein Bildentwurf plus Luna ist deshalb eine eigene Pipeline, kein unabhängiger Bildmodell-Generator.

## Kategorien aus Beispielen ableiten

Skindex als Referenzkatalog verwenden. Die gesichteten Seiten zeigen unterschiedliche Motive: [Optimus Prime](https://www.minecraftskins.com/skin/24320581/optimus-prime/), [Skulk Elf](https://www.minecraftskins.com/skin/24324432/-skulk-elf---oc/) und [Duck](https://www.minecraftskins.com/skin/24325162/--*---flowery-overalls-duck---*--/). Das begründet eine breite Motivabdeckung, aber noch keine empirisch validierte Gesichtstaxonomie. Die folgenden Merkmale sind ein Arbeitsvorschlag.

Für den Pilot 60 Beispiele aus Top, Latest und gezielten Motivsuchen manuell auswählen; mehrere Autoren und beide Armvarianten berücksichtigen. Pro Beispiel Quell-URL, Autor, Abrufdatum, Nutzungsfreigabe und Merkmalslabels erfassen. Nur freigegebene Dateien in einen verteilten Benchmark übernehmen. Keine automatische Übernahme der Community-Skins als Trainingsdaten.

PNG-Atlas und identisch gerenderte Vorder-, Rück- und Seitenansichten betrachten. Für das Gesicht Grundschicht, Außenschicht und das Komposit getrennt als 8×8-Ausschnitt und vergrößerte Pixelansicht zeigen. Zwei Personen labeln unabhängig; Uneinigkeit klären und Definitionen nachschärfen. Ähnliche Recolors und Werke desselben Autors zusammenhalten, damit Entwicklungs- und Testfälle nicht nahezu identisch sind.

## Mehrere Merkmalsachsen statt einer einzigen Schublade

| Achse | Startwerte |
| --- | --- |
| Motiv | Mensch, humanoide Fantasy, Tier, Monster, Roboter, maskiert |
| Augen | Punktaugen, klassische Augen mit Weißanteil, große stilisierte Augen, Visor, verdeckt, keine |
| Mund | keiner, minimal, Lächeln, Schnauze/Schnabel, Maske |
| Haare | keine, kurz, Pony, lang, Kopfbedeckung |
| Zusatzdetails | Bart, Brille, Narbe, Ohren/Hörner; Mehrfachauswahl |
| Schattierung | flach, weiche Cluster, kontrastreich |
| Außenschicht | keine, Akzente, Volumen, bewusste Gesichtsabdeckung |

Nicht jedes Kreuzprodukt braucht einen Test. Sechs verständliche Presets kombinieren diese Achsen: Classic Human, Soft/Anime, Portrait, Masked, Creature, Robot. Ein Preset ist editierbar; nicht jedes menschliche Gesicht muss dem Porträtlayout folgen.

## Festlegung in der App

In der Werkstatt vor dem Prompt eine Auswahl „Skin-Stil“ mit kleinen selbst erstellten Beispielgesichtern und darunter „Merkmale anpassen“ ergänzen. Merkmale bleiben im Projekt gespeichert. Beim Import alter Projekte gilt „Freie Gestaltung“, damit bestehende Pixel und Einstellungen erhalten bleiben.

Ein versioniertes `styleProfile` wird zusammen mit Prompt und Auswahl an das Harness übergeben. Es steuert konsistent Prompt, Bildentwurf, Merkmalsanalyse und Nachprüfung. Der Renderer zeigt die tatsächlich angewendeten Vorgaben. Unvereinbare Kombinationen wie „keine Augen“ und verpflichtende Pupillenprüfung werden vor dem Start aufgelöst.

Technische Einbaupunkte:

- `src/core/harness.ts`: Profil-ID, Version und validierte Merkmale im GenerationRequest; profilabhängige Qualitätshinweise.
- `src/App.tsx`: Stilwahl, Merkmalfelder und explizite Wahl der Pipeline.
- `electron/face-image.ts`: Bildmodell konfigurierbar machen; Entwurfsprompt an Profil binden; Bildentwürfe für nichtmenschliche Motive ermöglichen.
- `electron/provider.ts` und `src/core/face-raster.ts`: feste Porträt-Augenregeln ausschließlich für das entsprechende Profil anwenden; große Augen, Visor und Schnabel erhalten eigene Regeln.
- Projektspeicherung: optionale Profilmetadaten und Migration ergänzen.

Rastermaße, erlaubte Palette, Transparenz und Schutz nicht ausgewählter Pixel bleiben für alle Profile harte Regeln. Augengröße, Mundposition und Symmetrie sind stilabhängige Vorgaben. Menschenähnlichkeit ist kein allgemeines Qualitätskriterium für Roboter oder Tiere.

## Fairer Vergleich

Zunächst zwei bereits vorhandene Wege vergleichen: A = Luna-Raster; B = Bildentwurf plus dasselbe Luna-Raster. Referenz, Ausgangsskin, Prompt, Auswahl, Palette und Nachprüfung identisch halten. Bei aktivierter Merkmalsanalyse deren Ergebnis für beide Arme wiederverwenden. So lässt sich der Zusatznutzen des Bildentwurfs untersuchen.

Für einen unabhängigen Vergleich später C = Bildmodell plus deterministische Überführung in validierte Flächen ergänzen. Hier darf Luna nicht unbemerkt reparieren. Ein bloßes Verkleinern eines generierten Gesamtbilds garantiert kein gültiges Minecraft-UV-Layout. Die Überführung gehört als eigener Pipelinebestandteil ins Protokoll.

Pilot: sechs Profile × fünf feste Aufgaben × drei Wiederholungen × zwei Pipelines = 180 Ergebnisse, ausdrücklich keine 180 API-Aufrufe. Die mehrstufigen Pipelines benötigen zusätzliche Aufrufe. Vor einem Batch Gesamtumfang und Kostenschätzung anzeigen.

Ein Vergleichsbereich zeigt zufällig zugeordnete A/B-Ergebnisse aus denselben Kamerawinkeln sowie Gesicht in Originalgröße und Pixelvergrößerung. Bewertung getrennt nach Prompttreue, Erhalt der Referenzmerkmale, Gesichtlesbarkeit, Stiltreue und Nahtübergängen (je 1–5), plus bevorzugtes Ergebnis oder Gleichstand. Technische Fehler und Abbrüche mit auswerten, nicht herausfiltern.

Speichern: Fall-ID, Profilversion, Eingabehash, Modell-IDs, vollständige Einstellungen, Pipeline-/Promptversion, Rohentwurf, Raster vor/nach Review, validierter Skin, Laufzeit, API-Nutzung, Fehler und Bewertung. Kosten nur anhand dokumentierter Preise berechnen. Nach Profil aggregieren; Mittelwerte und A/B-Präferenz samt Streuung berichten. Likes auf Skindex sind kein Qualitätslabel.

## API-Grundlage

Die [offizielle OpenAI-Bilddokumentation](https://developers.openai.com/api/docs/guides/image-generation) beschreibt Generations und Edits sowie aktuelle Bildmodelle. Die lokale Implementierung verwendet derzeit fest GPT Image 2; Modellwahl und Account-Zugriff müssen für einen konkreten Vergleich separat festgelegt werden. API-Schlüssel verbleiben im Electron-Hauptprozess.
