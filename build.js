// Monta o Snapforge: dist/snapforge.html (arquivo único) e dist/pwa/ (app instalável, igual ao Ponto Cruz)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const D = __dirname, OUT = path.join(D, 'dist'), PWA = path.join(OUT, 'pwa'), ICONS = path.join(D, 'icons');
const eng = fs.readFileSync(path.join(D, 'src', 'engines.js'), 'utf8');
const SRC = path.join(D, 'src'), V2 = path.join(SRC, 'v2');
const readJs = (dir) => fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'engines.js').sort().map(f => `/* ---- ${path.relative(SRC, path.join(dir, f))} ---- */\n` + fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
const js = readJs(SRC);
let h = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8').replace('/*@JS*/', () => js);
const VERSION = (h.match(/const VERSION = '([^']+)'/) || [])[1];
// Interface nova (cópia para comparação): mesma lógica de src/*.js + ajustes de src/v2/*.js, casca e CSS próprios em src/v2/shell.html.
// A versão vem do shell principal (__VERSION__), então as duas sempre batem.
const fontUri = (f) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(V2, 'fonts', f)).toString('base64');
let h2 = fs.readFileSync(path.join(V2, 'shell.html'), 'utf8').replace('/*@JS*/', () => js + '\n' + readJs(V2)).replace(/__VERSION__/g, VERSION)
  .replace(/__FONT_SILK_(\d+)(_EXT)?__/g, (_, w, ext) => fontUri(`silkscreen-${w}-latin${ext ? '-ext' : ''}.woff2`));
// bigorna em pixel com o pixel roxo sendo forjado e uma faísca (ícone próprio, não o do Waypoint)
const ART = '<path fill="#c9c9d1" d="M1 4h7v1H1zM2 5h6v1H2zM4 6h3v1H4zM3 7h5v1H3z"/><path fill="#8a8a96" d="M1 5h1v1H1zM3 8h5v-1H8v1z"/><path fill="#fbbf24" d="M7 1h1v1H7zM8 2h1v1H8zM6 2h1v1H6z"/><path fill="#fde68a" d="M7 2h1v1H7z"/><path fill="#a78bfa" d="M4 3h2v1H4z"/>';
const LOGO = `<svg viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${ART}</svg>`;
const ICON = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${10 + 2 * pad} ${10 + 2 * pad}" shape-rendering="crispEdges"><rect x="${-pad}" y="${-pad}" width="${10 + 2 * pad}" height="${10 + 2 * pad}" fill="#18181b"/>${ART}</svg>`;
(async () => {
  fs.mkdirSync(path.join(PWA, 'icons'), { recursive: true });
  // Ícones PNG (o iPad exige PNG na tela de início). Ficam versionados em icons/; só são redesenhados com `node build.js --icons`
  // (precisa do Playwright) — por exemplo, depois de mudar o desenho do ícone em ART acima.
  const icons = { 'apple-touch-icon.png': [ICON(1), 180], 'icon-192.png': [ICON(1), 192], 'icon-512.png': [ICON(1), 512], 'icon-maskable-512.png': [ICON(3), 512], 'favicon-64.png': [ICON(.6), 64] };
  fs.mkdirSync(ICONS, { recursive: true });
  if (process.argv.includes('--icons') || Object.keys(icons).some(n => !fs.existsSync(path.join(ICONS, n)))) {
    const { chromium } = require('playwright'); const b = await chromium.launch(), pg = await b.newPage();
    for (const [n, [svg, s]] of Object.entries(icons)) { await pg.setViewportSize({ width: s, height: s }); await pg.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`); fs.writeFileSync(path.join(ICONS, n), await pg.screenshot({ clip: { x: 0, y: 0, width: s, height: s } })); }
    await b.close();
  }
  const buf = {}; for (const n of Object.keys(icons)) { buf[n] = fs.readFileSync(path.join(ICONS, n)); fs.writeFileSync(path.join(PWA, 'icons', n), buf[n]); }
  const uri = (n) => 'data:image/png;base64,' + buf[n].toString('base64');
  if (eng.includes('</script')) throw new Error('engines contém </script');
  const common = (x) => x.replace('/*ENGINES*/', () => eng).replace('__LOGO_SVG__', LOGO).replace('__FAVICON__', uri('favicon-64.png')).replace('__APPLEICON__', uri('apple-touch-icon.png'));
  h = common(h); h2 = common(h2);
  // 1) arquivo único
  fs.writeFileSync(path.join(OUT, 'snapforge.html'), h.replace('<!--PWA_HEAD-->', ''));
  writePwa(h, PWA, 'snapforge', 'Snapforge — pixel art, sprites e tilemaps', 'Snapforge');
  // interface nova: arquivo único + PWA separado em dist/pwa-v2 (cache com outro prefixo para os dois service workers não apagarem o cache um do outro)
  fs.writeFileSync(path.join(OUT, 'snapforge-v2.html'), h2.replace('<!--PWA_HEAD-->', ''));
  const PWA2 = path.join(OUT, 'pwa-v2'); fs.mkdirSync(path.join(PWA2, 'icons'), { recursive: true }); for (const n of Object.keys(icons)) fs.writeFileSync(path.join(PWA2, 'icons', n), buf[n]);
  writePwa(h2, PWA2, 'snapforge2', 'Snapforge (nova interface)', 'Snapforge 2');
  console.log('ok v' + VERSION, 'single', fs.statSync(path.join(OUT, 'snapforge.html')).size, 'v2', fs.statSync(path.join(OUT, 'snapforge-v2.html')).size);
})();

// 2) PWA (GitHub Pages/Vercel): manifest + service worker para abrir offline como app no iPad
function writePwa(h, PWA, prefix, name, shortName) {
  const sw = `<link rel="manifest" href="manifest.webmanifest">
<script>
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const tinha = !!navigator.serviceWorker.controller; let rec = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (tinha && !rec) { rec = true; location.reload(); } });
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').then((reg) => { const c = () => reg.update().catch(() => {}); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') c(); }); setInterval(c, 30 * 60 * 1000); }).catch(() => {}); });
}
</script>`;
  const idx = h.replace('<!--PWA_HEAD-->', sw);
  const VERSION = (h.match(/const VERSION = '([^']+)'/) || [])[1];
  fs.writeFileSync(path.join(PWA, 'index.html'), idx);
  const hash = crypto.createHash('sha1').update(idx).digest('hex').slice(0, 10);
  fs.writeFileSync(path.join(PWA, 'sw.js'), `// Guarda o app no iPad para abrir sem internet. A versão muda a cada build.
const VERSAO = '${VERSION}-${hash}';
const CACHE = '${prefix}-' + VERSAO;
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('${prefix}-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Rede primeiro (pega a versão nova quando há internet), cache quando está offline. 
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});
`);
  fs.writeFileSync(path.join(PWA, 'manifest.webmanifest'), JSON.stringify({ name, short_name: shortName, description: 'Editor de pixel art e tilemaps, Pixel Snapper e normal maps.', lang: 'pt-BR', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#09090b', theme_color: '#09090b',
    icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 2));
  fs.writeFileSync(path.join(PWA, '.nojekyll'), '');
  fs.writeFileSync(path.join(PWA, 'README.md'), `# Snapforge — pixel art, sprites e tilemaps (v${VERSION})

Editor de pixel art com camadas e animação, editor de tilemap com autotile (exporta para o Tiled), Pixel Snapper e normal maps. HTML, CSS e JS puro, num arquivo só, sem dependências. Funciona offline.

## Instalar no iPad

1. Publique esta pasta (GitHub Pages ou Vercel) e abra o link no **Safari**.
2. Toque em **Compartilhar → Adicionar à Tela de Início**.
3. Abra pelo ícone: o app ocupa a tela inteira e funciona sem internet depois da primeira abertura.

Os projetos ficam salvos no próprio iPad. Use **Arquivo › Salvar projeto** de vez em quando como cópia de segurança.

## Arquivos

| Arquivo | O que é |
|---|---|
| \`index.html\` | O app pronto (gerado pelo build — não edite à mão) |
| \`sw.js\` | Service worker (modo offline); a versão do cache muda a cada build |
| \`manifest.webmanifest\`, \`icons/\` | Ícone e dados do app instalado |

## Créditos

Pixel Snapper e Sprite Normals: portes para JavaScript dos projetos open source da Sprite Fusion (MIT, © Hugo Duprez) — https://github.com/Hugo-Dz/spritefusion-pixel-snapper e https://github.com/Hugo-Dz/spritefusion-sprite-normals
`);
}
