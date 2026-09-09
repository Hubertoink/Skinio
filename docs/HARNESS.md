# Pixel-Harness v4

## Architektur

```text
Prompt + optionales Referenzbild + bestehender Skin
             ↓
GenerationRequest: Modell, Körperteile, Skin-Schicht, Palette
             ↓
Dynamisches JSON-Schema + Kontext aller Körperflächen
             ↓
OpenAI Responses API
             ↓
Vollständige Validierung, bevor ein Pixel verändert wird
             ↓
Deterministisches Zusammensetzen ausschließlich innerhalb der Auswahl
             ↓
3D-/2D-Vorschau → Annehmen / Verwerfen → 64×64-PNG
```

`src/core/skin.ts` besitzt das kanonische Minecraft-UV-Layout und die Pixeloperationen. `src/core/harness.ts` besitzt Anfragen, Schemata, Validierung und Zusammensetzen. `electron/provider.ts` ist der erste Anbieteradapter. Ein weiterer Adapter muss eine `GenerationResult` liefern; dieselbe Rastervalidierung bleibt obligatorisch.

## Verbindliches Rasterformat

Jede Fläche wird als vollständige Matrix aus Palettensymbolen erzeugt. Bis 64 Farben gelten die Symbole `0–9`, `A–Z`, `a–z`, `_` und `-`; `.` bedeutet transparent. Bei 65 bis 256 Farben ist jedes Pixel ein zweistelliger Hex-Index (`00` bis `ff`), Transparenz wird als `..` codiert. Eine 8-Pixel-Zeile hat dann genau 16 Zeichen. Transparenz ist ausschließlich auf der äußeren Skin-Schicht zulässig. Das Schema, der Validator und die Pixelanwendung verwenden denselben Codec.

Die Oberfläche enthält keinen Demo-Einstieg und keinen manuellen Raster-JSON-Import mehr. Interne Testmuster bleiben für automatisierte Prüfungen erhalten.

Für nachgeprüfte menschliche Porträts begrenzt die lokale Komposition Augen auf Zeile 3, Brauen auf Zeile 2 und Mund auf Zeile 5/6. Zwei dunkle Einzelpixel bei (2,3) und (5,3) erhalten helle Nachbarpixel. Diese bewusste stilistische Einschränkung verhindert vertikale Augenflecken; sie ist keine Messung fotografischer Ähnlichkeit. Die übrigen Merkmale stammen aus den KI-Masken. Die abschließende Kontrastprüfung erfolgt nach dem Zusammensetzen und dem optionalen Schließen der Cap.

Beispiel **einer Fläche** innerhalb von `faces`, bei einem Rumpf mit 8×12 Pixeln:

```json
{
  "torso_base_front": [
    "00011000",
    "00111100",
    "22222222",
    "22222222",
    "22233222",
    "22233222",
    "22222222",
    "22222222",
    "33333333",
    "22222222",
    "22222222",
    "22222222"
  ]
}
```

Eine vollständige Antwort hat die Form `{ "name": "Kurzer Titel", "faces": { ... } }` und enthält sämtliche sechs Flächen jedes ausgewählten Körperteils. Das Beispiel allein ist kein vollständiger Patch. Das exportierte Schema definiert die für einen konkreten Auftrag erforderlichen Flächen.

Körperteile: `head`, `torso`, `rightArm`, `leftArm`, `rightLeg`, `leftLeg`. Schichten: `base`, `outer`. Flächen: `front`, `back`, `right`, `left`, `top`, `bottom`. IDs kombinieren diese Werte mit Unterstrichen. Rechts/links sind aus Sicht des Charakters.

Der Auftrag akzeptiert außerdem `layer: "both"`: dann werden für die ausgewählten Körperteile beide Schichten gemeinsam erzeugt (maximal 72 Flächen). Transparenzregeln werden pro Fläche geprüft, sodass Punkte auf der Grundschicht auch im gemeinsamen Modus unzulässig bleiben. Die Antwortform bleibt unverändert; ältere Aufträge mit einer einzelnen Schicht sind weiterhin gültig.

`humanFace: true` aktiviert explizite Vorgaben für zwei Augen mit kontrastierenden Pupillen, Positionen auf dem 8×8-Raster und freie Augenbereiche in der Außenschicht. Das ist eine Gestaltungsvorgabe, keine neue harte Formatbedingung. `qualityWarnings` prüft nach dem Zusammensetzen heuristisch den Kontrast in beiden Augenregionen und ob eine angeforderte Außenschicht leer geblieben ist. Hinweise blockieren die Übernahme nicht und malen keine Details automatisch hinzu. Die Prüfung betrachtet Grund- und Außenschicht zusammen; auch verdeckte Grundschicht-Augen können einen Hinweis auslösen.

Zeilen entsprechen der PNG-Textur von oben nach unten, Spalten von links nach rechts. Die Renderer-Orientierung folgt dem klassischen Minecraft-UV-Netz. Bei Ober- und Unterseiten läuft die Atlas-Zeilenrichtung von der hinteren zur vorderen Kante; die Unterseite benötigt dafür eine vertikal gedrehte UV-Zuordnung auf der 3D-Fläche.

## Granulare Porträtpipeline

`portraitDetails: true` benötigt ein Referenzbild, `humanFace: true` und die ausgewählte Kopf-Grundschicht. Es aktiviert Merkmalsanalyse vor der Rastergenerierung und einen einmaligen Gesichtsreview danach. `faceMethod: "image"` ergänzt einen GPT-Image-2-Aufruf; `"grid"` ist der direkte Weg. Ohne die neuen Optionen bleiben alte Requests gültig.

`electron/portrait.ts` validiert zwölf Materialfarben und sechs Merkmalsbeschreibungen. Eine abgeleitete Palette mit bis zu 64, 128 oder 256 Farben entsprechend dem gewählten Limit kommt in `GenerationResult.palette` zurück. Renderer und Testadapter müssen genau diese Palette zum Anwenden verwenden. Der Ausgangspuffer bleibt identisch; die Palette wird erst mit dem Skin angenommen.

Der Review erhält das tatsächlich aus beiden Minecraft-Schichten zusammengesetzte Gesicht als exakt vergrößertes 8×8-Bild. Er liefert neun interne Masken mit eigenen Farbvorräten: `skin`, `facialHair`, `hair`, `headwear`, `eyebrows`, `mouth`, `eyes`, `glasses`, `scar`. Nur `skin` ist deckend, die anderen verwenden Punkte für unbelegte Pixel. Diese Masken sind keine zusätzlichen Minecraft-Schichten.

Die Zusammensetzung erfolgt lokal in dieser Reihenfolge. Nur `head_base_front` und bei `both` die transparente `head_outer_front` werden ersetzt. Andere Körperflächen und Kopfseiten bleiben aus dem validierten Raster erhalten. Bei reiner Grundschichtbearbeitung bleibt die vorhandene Außenschicht unberührt. Die anschließende lokale Kontrastprüfung betrachtet die gemeldeten Augenpositionen im Komposit. Hinweise lösen keine automatischen weiteren Aufrufe aus.

Das Testprotokoll enthält Stufenlaufzeiten und Responses-Tokenverbrauch, gesonderten Bildverbrauch soweit verfügbar, Merkmale, das Raster vor dem Review und die Merkmalsmasken. Es enthält keinen Key und kein ursprüngliches Referenzfoto, im Bildmodus aber den generierten Gesichtsentwurf.

## Garantien

### Optionaler Kleidungsabgleich

`clothingReview: true` aktiviert bei ausgewählten Körper-Grundflächen einen zusätzlichen strukturierten `outfit_plan`-Aufruf vor dem Raster. Er bestimmt Standard-Oberteil, Ärmellänge, Hose/Shorts, Schuhe/Stiefel und Materialfarben. Explizite Promptangaben haben Vorrang vor der Kleidung auf dem Foto. Nicht unterstützte Kostüme und komplexe Muster sollen `none` verwenden und bleiben dem freien Raster überlassen.

Die benötigten Stofffarbreihen werden vor der Rasteranfrage innerhalb des Palettenlimits reserviert. `electron/outfit.ts` gleicht anschließend nur ausgewählte Körperflächen ab: kurze Ärmel in den oberen vier Armzeilen, Haut darunter; lange Ärmel mit freien Händen; Sneaker in den letzten drei Beinzeilen, Stiefel in den letzten vier. Farblich passende schmale Bündchen und Sohlen können auf der Außenschicht liegen. Kopf-Flächen werden nie verändert, und reine Außenschicht-Aufträge werden nicht abgeglichen. Die Ausgabe durchläuft erneut den vollständigen Rastervalidator. Dies ist eine kontrollierte Gestaltung für Standardkleidung, keine universelle Erhaltung beliebiger KI-Muster; der Nutzer kann sie ausschalten.

- API-Anfragen werden an der IPC-Grenze auf Modell, Palette, Pixeldaten, Auswahl und Referenzformat geprüft.
- Structured Outputs erzwingt bereits beim Anbieter ein dynamisches Schema; dies ersetzt **nicht** die lokale Prüfung.
- Fehlende oder zusätzliche Körperflächen, zusätzliche Hauptfelder, falsche Zeilenzahlen/-breiten, ungültige Farben und unerlaubte Transparenz führen zur Ablehnung des **gesamten** Patches.
- Der Patch wird erst nach erfolgreicher Gesamtprüfung in einen kopierten Pixelpuffer geschrieben. Das Original bleibt bis zur Übernahme unverändert.
- Nur die vom Auftrag vorgegebenen UV-Rechtecke werden geschrieben. Die KI bestimmt keine globalen Koordinaten und kann keine anderen Bereiche freigeben.
- Antwort und Vorschau sind an den exakten Ausgangspuffer samt Modell gebunden. Veraltete Antworten werden abgelehnt.
- Während einer Anfrage/Vorschau sind mutierende Editoraktionen gesperrt. Kamera und Originalvergleich bleiben verfügbar.
- Der PNG-Export setzt die Grundschicht deckend und ungenutzte Atlasbereiche transparent. Die Ausgabe ist immer 64×64.
- Eine erfolgreiche Generierung zählt als einzelner Undo-Schritt.
- Kein Ausführen von Modell-Code, kein generiertes SVG und kein stilles Nachskalieren einer ungültigen Rasterantwort. Der optionale Bildentwurf ist eine Vorlage für einen folgenden Rasteraufruf, kein importierbarer Skin-Atlas.

## Grenzen und nächste Experimente

Technisch gültige Pixel können gestalterisch schlecht sein. Das Harness garantiert weder Wiedererkennbarkeit noch zusammenpassende Nähte. Der aktuelle Prompt beschreibt die Orientierung und fordert kohärente Farbgruppen. Die einfachen Kontrasthinweise sind keine umfassende automatische Gestaltungsbewertung und können sowohl falsche Hinweise geben als auch Probleme übersehen.

Empfohlene erste Testreihe, jeweils mit derselben Palette und demselben Modell:

1. Nur Rumpf, einfacher Prompt mit zwei bis drei Hauptfarben.
2. Rumpf und Arme, Muster über Schulter-/Seitenkanten hinweg.
3. Gesamter Körper aus einer klaren Charakterzeichnung.
4. Asymmetrisches Motiv, etwa Emblem nur am linken Arm.
5. Ausschließlich äußere Schicht mit transparentem Hintergrund.

Jeweils PNG und Testprotokoll speichern. Beurteilen: Front/Rückseite, Orientierung, Wiedererkennung, Nähte, sinnvolle Schattierung, Tokenverbrauch und manuelle Nacharbeit. Danach lässt sich fundiert entscheiden, ob ein vorgeschalteter Designplan, gemeinsame Kantenbedingungen oder gezielte Korrekturaufrufe die Qualität verbessern. Kostenpflichtige Korrekturen werden nicht automatisch ausgelöst.

## Datenschutz und Fehler

Der Key verlässt den Hauptprozess nur als Authorization-Header an den fest eingestellten OpenAI-Endpunkt. Er wird weder im Projekt noch im Testprotokoll gespeichert. Die schmale Preload-Bridge erlaubt keine beliebigen Dateipfade, URLs oder IPC-Kanäle. Der Renderer lädt keine externen Webseiten und hat keinen Node-Zugriff.

Bei API-Fehlern, Ablehnung, unvollständiger Antwort oder ungültigem Raster bleiben alle Pixel und die ursprüngliche Palette unverändert. Keine automatischen Wiederholungen. Ein Timeout beendet nach sieben Minuten das lokale Warten. Eine Anbieterabrechnung bereits begonnener Arbeit kann trotzdem erfolgen.
