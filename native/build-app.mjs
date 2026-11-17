// GerdûnNews — uygulama (Capacitor) için web varlıklarını native/www'e toplar.
// Siteden farkı: veri (data/*) canlı gerdun.news'ten yüklenir (uygulama hep güncel kalır),
// service worker kapatılır (Capacitor şemasıyla çakışmasın), yerel data/ klasörü paketlenmez (küçük boyut).
//   node build-app.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');        // site kökü
const OUT = path.join(HERE, 'www');           // Capacitor webDir
const REMOTE = 'https://gerdun.news';         // canlı veri kaynağı

const FILES = ['index.html', 'gizlilik.html', 'manifest.webmanifest', 'config.js', 'i18n.js',
  'app.js', 'style.css', 'icons.css', 'icons.js', 'space.js', 'space-data.js', 'space-extras.js'];
const DIRS = ['assets'];

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

async function copyDir(rel) {
  const src = path.join(ROOT, rel), dst = path.join(OUT, rel);
  await fs.mkdir(dst, { recursive: true });
  for (const name of await fs.readdir(src)) {
    const s = path.join(src, name);
    if ((await fs.stat(s)).isDirectory()) await copyDir(`${rel}/${name}`);
    else await fs.copyFile(s, path.join(dst, name));
  }
}

for (const f of FILES) await fs.copyFile(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) await copyDir(d);

// 1) config.js: DATA_BASE'i ekle → app.js veriyi gerdun.news'ten çeker.
let cfg = await fs.readFile(path.join(OUT, 'config.js'), 'utf8');
if (!/DATA_BASE/.test(cfg)) {
  cfg = cfg.replace(/window\.CONFIG\s*=\s*\{/, `window.CONFIG = {\n  DATA_BASE: '${REMOTE}',`);
}
await fs.writeFile(path.join(OUT, 'config.js'), cfg);

// 2) index.html: statik "data/places.js" etiketini canlıya yönlendir + uygulama modunu aç + places öncesi.
//    Uygulama modu (appBuild): mağaza kuralları gereği izinsiz canlı TV gizlenir, ilk açılışta 17+ uyarısı çıkar.
let html = await fs.readFile(path.join(OUT, 'index.html'), 'utf8');
html = html.replace(/src="data\/places\.js"/g, `src="${REMOTE}/data/places.js"`);
html = html.replace('<script src="app.js"></script>',
  '<script>try{localStorage.setItem("appBuild","1")}catch(e){}</script>\n  <script src="app.js"></script>');
await fs.writeFile(path.join(OUT, 'index.html'), html);

// 3) app.js: service worker kaydını etkisizleştir (uygulamada gerekmez, karışıklık çıkarır).
let js = await fs.readFile(path.join(OUT, 'app.js'), 'utf8');
js = js.replace(/navigator\.serviceWorker\s*&&\s*/g, 'false && ')
       .replace(/navigator\.serviceWorker\.register\([^)]*\)/g, 'Promise.resolve()');
await fs.writeFile(path.join(OUT, 'app.js'), js);

const count = FILES.length;
console.log(`native/www hazır: ${count} dosya + assets/. Veri kaynağı: ${REMOTE}`);
