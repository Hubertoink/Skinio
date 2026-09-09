import { readFile, writeFile } from "node:fs/promises";
const cases = [
  {
    person: "Niko",
    direct: "Niko_grid_1788780270672",
    image: "Niko_image_1788780460710",
    hybrid: "Niko_expansive_1788784716152",
  },
  {
    person: "Umut",
    direct: "Umut_grid_1788780471059",
    image: "Umut_image_1788780543121",
    hybrid: "Umut_expansive_1788784351249",
  },
];
const esc = (x) =>
  String(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const symbols =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-";
function face(report, patch = report.patch) {
  const large = report.palette.length > 64;
  const token = (row, x) => (large ? row?.slice(x * 2, x * 2 + 2) : row?.[x]);
  const index = (s) => (large ? parseInt(s, 16) : symbols.indexOf(s));
  let rects = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const c = report.palette[index(token(patch.faces.head_base_front[y], x))];
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
    }
  let overlay = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const s = token(patch.faces.head_outer_front?.[y], x);
      if (s && s !== "." && s !== "..")
        overlay += `<rect x="${x}" y="${y}" width="1" height="1" fill="${report.palette[index(s)]}"/>`;
    }
  return `<svg viewBox="0 0 8 8" role="img" aria-label="Kopf-Vorderseite mit 8 mal 8 Pixeln" shape-rendering="crispEdges">${rects}<g class="outer">${overlay}</g></svg>`;
}
let rows = "";
for (const c of cases) {
  const direct = JSON.parse(
    await readFile(`Results/${c.direct}/report.json`, "utf8"),
  );
  const naive = JSON.parse(
    await readFile(`Results/${c.image}/report.json`, "utf8"),
  );
  const final = JSON.parse(
    await readFile(`Results/${c.hybrid}/report.json`, "utf8"),
  );
  const ref = (await readFile(`Example/${c.person}_Test.jpg`)).toString(
    "base64",
  );
  rows += `<section><h2>${c.person}</h2><div class="row"><figure><figcaption>Foto</figcaption><img class="photo" src="data:image/jpeg;base64,${ref}" /></figure><figure><figcaption>Face-Draft · 1024×1024</figcaption><img src="${naive.faceDraft}" /></figure><figure><figcaption>Direktes Raster · 64 Farben</figcaption>${face(direct)}</figure><figure><figcaption>Einfach verkleinert · verworfen</figcaption>${face(naive)}</figure><figure><figcaption>Merkmale → Raster</figcaption>${face(final, final.beforeReview)}</figure><figure><figcaption>Nach gezielter Gesichtsprüfung</figcaption>${face(final)}<a href="${c.hybrid}/${c.person}-hybrid.png" download>64×64-Skin laden</a></figure></div><p><b>Erkannte Merkmale:</b> ${esc(final.portrait.hairstyle)} · ${esc(final.portrait.facialHair)} · ${esc(final.portrait.headwear)}</p><p><b>Gesichtsprüfung:</b> ${esc(final.faceReview.notes)} · Lokaler Augen-Kontrast: ${final.faceReview.warnings.length ? "Hinweis vorhanden" : "bestanden"}.</p><p><a href="${c.hybrid}/${c.person}-hybrid.skinforge">Projektdatei</a> · <a href="${c.hybrid}/report.json">Testprotokoll</a> · ${Math.round(final.elapsedMs / 1000)} s für Analyse, Raster und Review; vorhandener Bildentwurf wiederverwendet.</p></section>`;
}
const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Skin Forge · Porträtvergleich</title><style>body{margin:0;padding:30px;background:#121a16;color:#e5eddf;font:15px/1.5 system-ui}h1{font-size:28px;margin:0}h2{font-size:21px}p{max-width:1200px;color:#adbcaa}section{margin-top:28px;border-top:1px solid #40533e;padding-top:4px}.row{display:grid;grid-template-columns:repeat(6,minmax(120px,1fr));gap:18px}figure{margin:0}figcaption{height:48px;font-size:13px;color:#bdcfb1}img,svg{width:100%;aspect-ratio:1;object-fit:contain;background:#243026;display:block}.photo{object-fit:contain}a{color:#c1e79b}button{padding:9px 16px;color:#152312;background:#c1e79b;border:0;border-radius:8px;cursor:pointer}.no-outer .outer{display:none}@media(max-width:900px){.row{grid-template-columns:repeat(3,1fr)}}</style><h1>Gesichter: vom Foto zum gültigen Skin</h1><p>Vergleich vom 7. September 2026. Alle Raster hier sind echte 8×8-Kopf-Vorderseiten. Die Bildentwürfe sind keine direkt importierbaren Skins. Zwei Referenzen, keine allgemeine Qualitätsgarantie.</p><button onclick="document.body.classList.toggle('no-outer');this.textContent=document.body.classList.contains('no-outer')?'Außenschicht anzeigen':'Außenschicht ausblenden'">Außenschicht ausblenden</button>${rows}<p>Die ersten Umut-Durchläufe mit Nikos Beschreibung wurden ausgeschlossen. Die einfache Bildverkleinerung wird nur zum Vergleich gezeigt; die App verwendet im Bildmodus die Übertragung durch das Rastermodell.</p></html>`;
await writeFile("Results/Vergleich.html", html);
console.log("Results/Vergleich.html");
