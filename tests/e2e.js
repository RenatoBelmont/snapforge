const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const ROOT = path.join(__dirname, '..'), FIX = path.join(__dirname, 'fixtures'), SHOTS = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const fileUrl = (p) => url.pathToFileURL(path.join(ROOT, p)).href;
const APP = 'dist/snapforge.html', PWA_IDX = 'dist/pwa/index.html';

const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto(fileUrl(APP)); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
  const cdp = await ctx.newCDPSession(p);
  const PKGV = require('../package.json').version;
  ok((await p.textContent('#ver')) === 'v' + PKGV, 'versão v' + PKGV + ' (bate com package.json)');
  const geo = async () => { const box = await p.locator('#cv').boundingBox(); const s = await p.evaluate(() => ({ z: st.zoom, ox: st.ox, oy: st.oy })); return (x, y) => [box.x + s.ox + (x + .5) * s.z, box.y + s.oy + (y + .5) * s.z]; };
  const cnt = () => p.evaluate(() => { let n = 0; const a = doc.frames[cur.frame][cur.layer]; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; });
  const pix = (x, y) => p.evaluate(([x, y]) => doc.frames[cur.frame][cur.layer][(y * doc.w + x) * 4 + 3], [x, y]);
  let at = await geo();
  // ---- mouse: lápis, desfazer/refazer, pixel perfeito
  await p.mouse.move(...at(2, 2)); await p.mouse.down(); await p.mouse.move(...at(10, 2), { steps: 8 }); await p.mouse.up();
  ok(await cnt() === 9, 'lápis (mouse) linha de 9 px');
  await p.keyboard.press('Control+z'); ok(await cnt() === 0, 'desfazer ⌘Z');
  await p.keyboard.press('Control+Shift+z'); ok(await cnt() === 9, 'refazer ⇧⌘Z');
  await p.mouse.move(...at(5, 10)); await p.mouse.down(); await p.mouse.move(...at(6, 10)); await p.mouse.move(...at(6, 11)); await p.mouse.up();
  ok(await pix(5, 10) && await pix(6, 11) && !(await pix(6, 10)), 'pixel perfeito remove o canto em L');
  // ---- Apple Pencil: primeira caneta liga "Só Pencil"
  const pen = async (type, x, y, buttons = 1) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' && !buttons ? 'none' : 'left', buttons, clickCount: 1, pointerType: 'pen', force: .5 });
  ok(!(await p.evaluate(() => st.penOnly)), 'começa com o dedo pintando');
  let [x0, y0] = at(2, 20), [x1, y1] = at(8, 20);
  await pen('mousePressed', x0, y0); for (let i = 1; i <= 6; i++) await pen('mouseMoved', x0 + (x1 - x0) * i / 6, y0); await pen('mouseReleased', x1, y1, 0);
  ok(await p.evaluate(() => st.penOnly), 'Pencil detectada liga "Só Pencil" automaticamente');
  ok(await pix(2, 20) && await pix(8, 20), 'Pencil desenha');
  ok((await p.textContent('#penTxt')).includes('Só Pencil'), 'botão mostra "Só Pencil"');
  // ---- dedo agora só move (não pinta)
  const before = await cnt(), ox0 = await p.evaluate(() => st.ox);
  const T = (pts) => pts.map((q, i) => ({ x: q[0], y: q[1], id: i + 1 }));
  [x0, y0] = at(20, 25);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0]]) });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[x0 + i * 20, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await cnt() === before && (await p.evaluate(() => st.ox)) > ox0 + 50, 'com Só Pencil, um dedo arrasta a vista sem pintar');
  await p.evaluate(() => fit()); await sleep(100); at = await geo();
  // ---- toque com dois dedos desfaz, três refaz
  const c0 = await cnt(); [x0, y0] = at(16, 16);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0], [x0 + 60, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const c1 = await cnt(); ok(c1 < c0, `toque com dois dedos desfaz (${c0}→${c1})`);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0], [x0 + 60, y0], [x0 + 120, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await cnt() === c0, 'toque com três dedos refaz');
  // ---- pinça
  const z0 = await p.evaluate(() => st.zoom); const cxm = x0, cym = y0;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[cxm - 40, cym], [cxm + 40, cym]]) });
  for (let d = 40; d <= 130; d += 10) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[cxm - d, cym], [cxm + d, cym]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await p.evaluate(() => st.zoom) > z0 && await cnt() === c0, 'pinça dá zoom e não desfaz nem pinta');
  await p.evaluate(() => fit()); await sleep(100); at = await geo();
  // ---- segurar o dedo: conta-gotas com lupa
  await p.evaluate(() => setColor([255, 0, 0, 255])); [x0, y0] = at(2, 2);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0]]) }); await sleep(600);
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#lupa')).display === 'block'), 'segurar o dedo abre a lupa');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await p.evaluate(() => st.color.slice(0, 3).join() === hex2rgb(palList(DEFAULT_PAL)[0]).join()), 'soltar pega a cor sob o dedo (a 1ª cor da paleta inicial, usada no desenho)');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#lupa')).display === 'none'), 'lupa fecha');
  // ---- desligar Só Pencil: dedo pinta; segundo dedo cancela o traço
  await p.evaluate(() => setPenOnly(false)); const c2 = await cnt(); [x0, y0] = at(2, 28);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0]]) });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[x0 + i * at(1, 0)[0] - i * at(0, 0)[0], y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const c3 = await cnt(); ok(c3 > c2, 'sem Só Pencil, o dedo pinta');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0 - 40]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[x0 + 30, y0 - 40]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0 + 30, y0 - 40], [x0 + 200, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await cnt() === c3, 'segundo dedo durante o traço cancela o traço');
  // ---- balde no toque só preenche ao soltar; pinça não preenche
  await p.keyboard.press('g'); [x0, y0] = at(20, 5); const c4 = await cnt();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0], [x0 + 80, y0]]) });
  for (let d = 0; d <= 60; d += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[x0 - d, y0], [x0 + 80 + d, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await cnt() === c4, 'balde não preenche quando vira pinça');
  await p.evaluate(() => fit()); await sleep(100); at = await geo(); [x0, y0] = at(20, 5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[x0, y0]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  ok(await cnt() > c4 + 100, 'balde com toque preenche ao soltar');
  await p.keyboard.press('Control+z');
  // ---- camadas: nova, travar, arrastar
    await p.click('[data-pc=layAdd]'); ok(await p.evaluate(() => doc.layers.length) === 2, 'nova camada');
  await p.click('[data-lock="1"]'); await p.keyboard.press('b'); at = await geo();
  await p.mouse.click(...at(30, 30)); ok(!(await pix(30, 30)) && (await p.textContent('#toast')).includes('travada'), 'camada travada não recebe tinta');
  await p.click('[data-lock="1"]');
  const g = await p.locator('[data-grip="1"]').boundingBox(), g0 = await p.locator('[data-grip="0"]').boundingBox();
  await p.mouse.move(g.x + 10, g.y + 10); await p.mouse.down(); await p.mouse.move(g0.x + 10, g0.y + 20, { steps: 6 }); await p.mouse.up();
  ok(await p.evaluate(() => doc.layers[0].name) === 'Camada 2', 'arrastar pela alça reordena camadas');
  await p.keyboard.press('Control+z'); ok(await p.evaluate(() => doc.layers[1].name) === 'Camada 2', 'desfazer reordenação');
  await p.evaluate(() => { cur.layer = 0; fullRefresh(); });
  // ---- seleção: copiar, colar, setas
  await p.keyboard.press('s'); at = await geo();
  await p.mouse.move(...at(2, 2)); await p.mouse.down(); await p.mouse.move(...at(10, 2), { steps: 4 }); await p.mouse.up();
  ok(await p.evaluate(() => selRect && selRect.w === 9 && selRect.h === 1), 'seleção retangular');
  await p.keyboard.press('Control+c'); await p.keyboard.press('ArrowDown');
  ok(await pix(2, 3) && !(await pix(2, 2)), 'seta move os pixels selecionados');
  await p.keyboard.press('Control+v'); ok(await p.evaluate(() => st.tool) === 'move', 'colar troca para Mover');
  await p.keyboard.press('Escape'); ok(await p.evaluate(() => selRect) === null, 'Esc limpa a seleção');
  // ---- seletor de cor (padrão Waypoint) com arraste
  await p.click('#curColor'); await sleep(150);
  const sq = await p.locator('.cp-sq').boundingBox(); await p.mouse.move(sq.x + sq.width * .9, sq.y + sq.height * .1); await p.mouse.down(); await p.mouse.move(sq.x + sq.width * .95, sq.y + sq.height * .05); await p.mouse.up();
  const col = await p.evaluate(() => st.color.join()); ok(col !== '26,28,44,255', 'arrastar no quadrado muda a cor: ' + col);
  await p.mouse.click(300, 40); ok(!(await p.$('.cp')) && (await p.evaluate(() => recent.length)) > 0, 'fechar seletor guarda em Recentes');
  // ---- tela cheia + faixa de cores
  await p.keyboard.press('f'); await sleep(200);
  ok(await p.evaluate(() => document.body.classList.contains('foco') && getComputedStyle(faixa).display === 'flex' && getComputedStyle(side).display === 'none'), 'F entra em tela cheia com faixa de cores');
  await p.screenshot({ path: path.join(SHOTS, 't_full.png') });
  await p.click('#faixa [data-fx]:nth-child(5)'); ok(await p.evaluate(() => rgb2hex(...st.color.slice(0, 3)) === palList(palName)[3]), 'tocar na faixa escolhe a cor (4ª da paleta, depois da borracha)');
  await p.keyboard.press('Escape'); ok(!(await p.evaluate(() => document.body.classList.contains('foco'))), 'Esc sai da tela cheia');
  // ---- menus da barra
  await p.click('#rail [data-tool=ellipse]'); ok(await p.evaluate(() => st.tool) === 'ellipse', 'trilho de ferramentas');
  // ---- seletor de paleta com prévia
  await p.click('#palPickHost .pp-btn'); ok(await p.locator('.pp-pop .pp-item .cells i').count() > 40, 'menu de paletas mostra as cores de cada uma');
  await p.click('.pp-pop .pp-item[data-v="PICO-8"]'); ok(await p.evaluate(() => palName) === 'PICO-8' && await p.locator('#cb-cor .sw').count() === 16, 'escolher paleta troca as amostras');
  ok((await p.innerHTML('#palPickHost .strip')).includes('rgb(0, 0, 0)') || (await p.innerHTML('#palPickHost .strip')).includes('#000000'), 'botão da paleta mostra a faixa de cores');
  // ---- botões de tamanho do canvas
  await p.evaluate(() => { if (document.querySelector('[data-card=canvas]').classList.contains('closed')) document.querySelector('[data-toggle=canvas]').click(); });
  await p.click('#cb-canvas [data-size="64"]'); ok(await p.evaluate(() => doc.w + 'x' + doc.h) === '64x64', 'botão 64 muda o canvas');
  ok(await p.locator('#cb-canvas [data-size]').count() === 9, 'botões 16 a 128');
  await p.keyboard.press('Control+z'); ok(await p.evaluate(() => doc.w) === 32, 'desfazer tamanho');
  // ---- autosave + reload
  await sleep(900); ok((await p.textContent('#status')).includes('Salvo'), 'autosave');
  const sig = await p.evaluate(() => doc.layers.length + ':' + doc.frames[0][0].reduce((a, b) => a + b, 0));
  await p.reload(); await sleep(500);
  ok(await p.evaluate(() => doc.layers.length + ':' + doc.frames[0][0].reduce((a, b) => a + b, 0)) === sig, 'restaura após recarregar');
  ok(await p.evaluate(() => st.penOnly) === false && await p.evaluate(() => st.penSeen), 'preferência da Pencil persiste');
  // ---- Snapper + Normal
  await p.evaluate(() => { window.__busySeen = false; new MutationObserver(() => { if (busy && document.querySelector('#busy').classList.contains('on')) window.__busySeen = true; }).observe(document.querySelector('#busy'), { attributes: true }); }); await p.click('.tab[data-v=snap]');
  const fc = p.waitForEvent('filechooser'); await p.click('#sDrop'); (await fc).setFiles(path.join(FIX, 'ai_like.png'));
  await sleep(300); await p.click('#sGo'); await p.waitForSelector('#sToEd:not([disabled])', { timeout: 20000 });
  ok(await p.evaluate(() => snapOut.width === 24 && snapOut.height === 24), 'Snapper 24×24');
  ok(await p.evaluate(() => window.__busySeen), 'card de carregamento apareceu durante o processamento');
  const pn = await p.locator('#sCmp .pane').first().boundingBox(); await p.mouse.move(pn.x + pn.width * .5, pn.y + pn.height * .5);
  ok(await p.evaluate(() => [...document.querySelectorAll('#sCmp .loupe')].every(l => l.style.display === 'block')), 'lupa aparece sincronizada nos dois painéis');
  await p.screenshot({ path: path.join(SHOTS, 'v3_loupe.png') });
  await p.click('#sLoupe [data-m="0"]'); await p.mouse.move(pn.x + pn.width * .4, pn.y + pn.height * .4); ok(await p.evaluate(() => [...document.querySelectorAll('#sCmp .loupe')].every(l => l.style.display !== 'block')), 'lupa desliga');
  await p.click('#sLoupe [data-m="8"]');
  await p.click('#sFit [data-n="32"]'); await p.click('#sGo'); await sleep(1200); ok(await p.evaluate(() => snapOut.width) === 32, 'botão de tamanho final 32');
  await p.click('#sPrompt'); await sleep(150); await p.click('#pSize [data-n="64"]'); ok((await p.textContent('#pPre')).includes('64x64') && (await p.evaluate(() => sFitN)) === 64, 'prompt para o ChatGPT (sem API) e tamanho sincronizado'); await p.click('#mBox .row .btn:not(.pri)');
  ok(!(await p.evaluate(() => /generativelanguage|groq|openai/.test(document.documentElement.innerHTML))), 'nenhuma chamada de API de IA no app');
  // ---- Tilemap
  await p.click('.tab[data-v=tile]'); await sleep(400);
  ok(await p.evaluate(() => tsCols === 11 && tsRows === 7 && tm.tileset.name === 'Sprout Lands · Grama' && tm.mw === 32), 'tilemap abre com a Grama do Sprout Lands');
  const tb = await p.locator('#tcv').boundingBox(); const tg = await p.evaluate(() => ({ z: ts.zoom, ox: ts.ox, oy: ts.oy, tw: tm.tw }));
  const tat = (x, y) => [tb.x + tg.ox + (x + .5) * tg.tw * tg.z, tb.y + tg.oy + (y + .5) * tg.tw * tg.z];
  const tc = () => p.evaluate(() => tm.layers[ts.layer].data.filter(v => v >= 0).length);
  await p.mouse.move(...tat(1, 1)); await p.mouse.down(); await p.mouse.move(...tat(6, 1), { steps: 6 }); await p.mouse.up();
  ok(await tc() === 6, 'pincel de tiles pinta uma linha de 6');
  await p.keyboard.press('Control+z'); ok(await tc() === 0, 'desfazer no tilemap');
  const tsb = await p.locator('#tsCv').boundingBox(); const tsw = tsb.width / await p.evaluate(() => tsCols);
  await p.mouse.move(tsb.x + tsw * 1.5, tsb.y + 5); await p.mouse.down(); await p.mouse.move(tsb.x + tsw * 2.5, tsb.y + 5, { steps: 3 }); await p.mouse.up();
  ok(await p.evaluate(() => ts.sel.w === 2 && ts.sel.x === 1), 'arrastar no tileset seleciona vários tiles');
  await p.mouse.click(...tat(10, 10)); ok(await p.evaluate(() => tm.layers[0].data[10 * tm.mw + 10] === 1 && tm.layers[0].data[10 * tm.mw + 11] === 2), 'carimbo de 2 tiles');
  const tcAntes = await tc(); await p.keyboard.press('g'); await p.mouse.click(...tat(20, 20)); ok(await tc() > 900, 'balde preenche o mapa');
  await p.keyboard.press('Control+z'); await sleep(100); ok(await tc() === tcAntes && tcAntes === 2, `desfazer tira só o balde e mantém o carimbo (${tcAntes} → ${await tc()})`);
  // sequência relatada: balde → tile no tileset → clique no mapa, com o mapa já redesenhado antes (nada mais força o redesenho)
  await p.click('#tRail [data-tt=fill]'); { const sb = await p.locator('#tsCv').boundingBox(); const [cs_, rs_] = await p.evaluate(() => [tsCols, tsRows]); await p.mouse.click(sb.x + sb.width * (2.5 / cs_), sb.y + sb.height / rs_ / 2); } await sleep(150);
  ok(await p.evaluate(() => !mapDirty && ts.tool === 'fill'), 'mapa redesenhado e balde ainda selecionado antes do clique');
  await p.mouse.click(...tat(30, 30)); await sleep(150);
  ok(await p.evaluate(() => mapOff.getContext('2d').getImageData(30 * tm.tw + 8, 30 * tm.th + 8, 1, 1).data[3] > 0 && tm.layers[0].data[30 * tm.mw + 30] === 2), 'balde aparece na tela no mesmo clique (não só nos dados)');
  await p.keyboard.press('Control+z');
  await p.click('#tSide [data-tp=tAddAuto]'); ok(await p.evaluate(() => tm.layers[ts.layer].auto), 'camada de autotile');
  await p.mouse.move(tsb.x + tsw * 0.5, tsb.y + 5); await p.mouse.down(); await p.mouse.up();
  await p.click('#tSide [data-tp=autoFill]'); await p.click('#tSide [data-slot="0"]'); const tsb2 = await p.locator('#tsCv').boundingBox(); await p.mouse.click(tsb2.x + tsb2.width / await p.evaluate(() => tsCols) * 4.5, tsb2.y + 5);
  ok(await p.evaluate(() => tm.layers[ts.layer].rules[0] === 4 && tm.layers[ts.layer].rules[15] === 0), 'regra de autotile atribuída tocando no tileset');
  await p.keyboard.press('b'); await p.mouse.click(...tat(3, 25));
  ok(await p.evaluate(() => tileAt(tm.layers[ts.layer], 25 * tm.mw + 3)) === 4, 'célula sozinha usa a regra "sem vizinhos"');
  await p.mouse.move(...tat(3, 25)); await p.mouse.down(); await p.mouse.move(...tat(6, 25), { steps: 4 }); await p.mouse.up();
  ok(await p.evaluate(() => tileAt(tm.layers[ts.layer], 25 * tm.mw + 4)) === 0, 'autotile recalcula com vizinhos');
  await p.click('#tSide [data-ms="16"]'); ok(await p.evaluate(() => tm.mw) === 16, 'botão 16 muda o tamanho do mapa');
  await p.click('#tSide [data-ms="32"]');
  const dl = p.waitForEvent('download'); await p.click('[data-tf=export]'); await p.click('#mBox .btn.pri'); const d = await dl;
  const zp = await d.path(); const zb = fs.readFileSync(zp); ok(d.suggestedFilename().endsWith('_tiled.zip') && zb.includes(Buffer.from('"orthogonal"')) && zb.includes(Buffer.from('tileset.png')), 'exporta .zip do Tiled com .tmj e tileset');
  const t0i = zb.indexOf('{\n "compressionlevel"'), t1i = zb.indexOf(Buffer.from([0x50, 0x4b, 3, 4]), t0i); const tmj = JSON.parse(zb.slice(t0i, t1i).toString('utf8')); ok(tmj.layers.length === 2 && tmj.tilesets[0].columns === 11 && tmj.tilesets[0].tilecount === 77 && tmj.tilesets[0].tilewidth === 16 && tmj.layers[0].data.length === 1024, '.tmj válido com as 2 camadas');
  await p.screenshot({ path: path.join(SHOTS, 'v3_tile.png') });
  await p.reload(); await sleep(500); const rs = await p.evaluate(() => [tm.layers.length, tm.layers.map(l => l.auto).join(), tsCols, tm.mw]); ok(rs[0] === 2 && rs[1] === 'false,true' && rs[2] === 11, 'mapa e tileset restaurados após recarregar ' + rs);
  // ---- paletas do Renato (1.10.0): primeiras da lista e Pogo City como inicial
  ok(await p.evaluate(() => Object.keys(PALETTES).slice(0, 2).join() === 'Pogo City,Apartment' && palList('Pogo City').length === 33 && palList('Apartment').length === 28 && DEFAULT_PAL === 'Pogo City'), 'Pogo City (33 cores) e Apartment (28) são as primeiras paletas e a Pogo City é a inicial');
  // ---- paletas do Lospec (1.5.0)
  ok(await p.evaluate(() => [['RETURN 20', 20], ['Minty chip', 30], ['CC-29', 29], ['Resurrect 64', 64], ['SLSO8', 8], ['Lost Century', 16], ['Twilight 5', 5], ['CafeArisuki', 10]].every(([n, k]) => PALETTES[n] && palList(n).length === k && palList(n).every(c => /^#[0-9a-f]{6}$/.test(c)))), 'paletas do Lospec embutidas com o número certo de cores');
  ok(await p.evaluate(() => { const pv = palName; palName = 'Resurrect 64'; renderColor(); renderFaixa(); const n = [document.querySelectorAll('#cb-cor .sw').length, document.querySelectorAll('#pRow button.c').length]; palName = pv; renderColor(); renderFaixa(); return n.join(); }) === '64,64', 'Resurrect 64 aparece inteira no painel e na fileira de paleta');
  // ---- importar paletas (1.6.0): arquivo e Lospec (Lospec simulado: o teste não depende de internet)
  ok(await p.evaluate(() => { const enc = (s) => new TextEncoder().encode(s);
    const hex = parsePaletteFile(enc('fbbbad\r\nee8695\r\n4a7a96\r\n'), 'twilight-5.hex');
    const gplL = parsePaletteFile(enc('GIMP Palette\r\n#Palette Name: Twilight 5\r\n#Colors: 2\r\n251\t187\t173\tfbbbad\r\n238\t134\t149\tee8695\r\n'), 'x.gpl');
    const gplG = parsePaletteFile(enc('GIMP Palette\nName: Minha\nColumns: 4\n#\n  0   0   0\tPreto\n255 255 255\tBranco\n'), 'y.gpl');
    const jasc = parsePaletteFile(enc('JASC-PAL\r\n0100\r\n2\r\n251 187 173\r\n41 40 49\r\n'), 'z.pal');
    const riff = new Uint8Array(24 + 8); const dv = new DataView(riff.buffer); riff.set(enc('RIFF'), 0); dv.setUint32(4, 24, true); riff.set(enc('PAL data'), 8); dv.setUint32(16, 12, true); dv.setUint16(20, 0x300, true); dv.setUint16(22, 2, true); riff.set([255, 0, 0, 0, 0, 128, 255, 0], 24);
    const rp = parsePaletteFile(riff, 'win.pal');
    return hex.colors.join() === '#fbbbad,#ee8695,#4a7a96' && hex.name === 'twilight 5' && gplL.name === 'Twilight 5' && gplL.colors.length === 2 && gplG.name === 'Minha' && gplG.colors.join() === '#000000,#ffffff'
      && jasc.colors.join() === '#fbbbad,#292831' && rp.colors.join() === '#ff0000,#0080ff'; }), 'lê paletas .hex, .gpl (Lospec e GIMP), .pal JASC e .pal RIFF');
  ok(await p.evaluate(() => { try { parsePaletteFile(new TextEncoder().encode('isso não é paleta'), 'a.txt'); return false; } catch (e) { return /Não achei cores/.test(e.message); } }), 'arquivo sem cores dá erro claro');
  ok(await p.evaluate(() => ['https://lospec.com/palette-list/resurrect-64', 'lospec.com/palette-list/resurrect-64.gpl', 'Resurrect 64', ' resurrect-64 '].every(s => lospecSlug(s) === 'resurrect-64')), 'link, arquivo ou nome viram o mesmo slug do Lospec');
  const errsAntesLospec = errs.length;
  await p.route('https://lospec.com/palette-list/**', (route) => { const u = route.request().url();
    if (u.endsWith('/minha-teste.json')) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ name: 'Minha Teste', author: 'Fulano', colors: ['112233', '445566', 'zzzzzz'] }) });
    if (u.endsWith('/pico-8.json')) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: JSON.stringify({ name: 'PICO-8', colors: ['000000'] }) });
    return route.abort(); }); // o 404 real do Lospec vem sem CORS: o navegador o vê como falha de rede
  await p.click('.tab[data-v=editor]'); await sleep(150);
  await p.click('[data-pc=palLospec]'); await p.fill('#lsIn', 'https://lospec.com/palette-list/minha-teste'); await p.click('#mBox .btn.pri'); await sleep(600);
  ok(await p.evaluate(() => palName === 'Minha Teste' && palList('Minha Teste').join() === '#112233,#445566') && (await p.textContent('#toast')).includes('Fulano'), 'importa do Lospec pelo link, ignora cor inválida e credita o autor');
  ok(await p.evaluate(async () => { try { await fetchLospecPalette('nao-existe'); return false; } catch (e) { return /Não achei "nao-existe"/.test(e.message); } }), 'paleta inexistente no Lospec: mensagem de nome errado (não de "sem internet")');
  ok(await p.evaluate(async () => { const r = adoptPalette('Qualquer', palList('SLSO8')); return r.builtin && palName === 'SLSO8'; }), 'importar uma paleta que já é padrão só seleciona a padrão');
  await p.unroute('https://lospec.com/palette-list/**');
  { const novos = errs.splice(errsAntesLospec); ok(novos.every(x => x.includes('net::ERR_FAILED')), 'a única mensagem no console durante o Lospec simulado é a falha de rede provocada de propósito'); }
  // ---- pincéis (1.6.0)
  ok(await p.evaluate(() => { const n = () => { const a = px(); let k = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) k++; return k; }; const L = doc.layers[cur.layer]; L.locked = false; L.visible = true;
    const r = []; for (const [s, sh] of [[8, 'round'], [8, 'square'], [16, 'square']]) { px().fill(0); setBrush(s); st.brushShape = sh; setTool('pencil'); beginStroke(16, 16); endStroke(); r.push(n()); }
    setBrush(1); st.brushShape = 'round'; return r.join(); }) === '52,64,256', 'pincel de 8 redondo, 8 quadrado e 16 quadrado');
  await p.click('#cb-pincel [data-b="10"]'); await p.keyboard.press(']'); const b12 = await p.evaluate(() => st.brush); await p.keyboard.press('['); await p.keyboard.press('[');
  ok(b12 === 12 && await p.evaluate(() => st.brush === 8 && localStorage.getItem('snapforge.brush') === '8'), 'botões de tamanho e teclas [ ] percorrem 1–16 e o tamanho fica salvo');
  await p.evaluate(() => setBrush(1));
  // ---- tilemap: pincel e seleção (1.7.0)
  await p.click('.tab[data-v=tile]'); await sleep(300);
  await p.evaluate(() => { tm.layers.forEach(L => { L.data.fill(-1); if (L.cells) L.cells.fill(0); }); ts.layer = 0; tm.layers[0].visible = true; ts.random = false; ts.sel = { x: 1, y: 0, w: 1, h: 1 }; ts.msel = null; mapDirty = true; tFit(); });
  await sleep(150);
  const tb3b = await p.locator('#tcv').boundingBox(), tg3b = await p.evaluate(() => ({ z: ts.zoom, ox: ts.ox, oy: ts.oy, tw: tm.tw }));
  const tat3 = (x, y) => [tb3b.x + tg3b.ox + (x + .5) * tg3b.tw * tg3b.z, tb3b.y + tg3b.oy + (y + .5) * tg3b.tw * tg3b.z];
  const tcnt = () => p.evaluate(() => tm.layers[0].data.filter(v => v >= 0).length);
  await p.click('#tSide [data-tbr="3"]'); await p.keyboard.press('b'); await p.mouse.click(...tat3(5, 5));
  ok(await tcnt() === 9 && await p.evaluate(() => tm.layers[0].data[4 * tm.mw + 4] === 1 && tm.layers[0].data[6 * tm.mw + 6] === 1 && localStorage.getItem('snapforge.tBrush') === '3'), 'pincel 3×3 do mapa pinta 9 células centradas e fica salvo');
  await p.keyboard.press('e'); await p.keyboard.press('['); await p.keyboard.press('['); await p.mouse.click(...tat3(5, 5));
  ok(await tcnt() === 8 && await p.evaluate(() => ts.brush === 1), 'teclas [ ] trocam o pincel do mapa; borracha 1×1 apaga só o centro');
  await p.evaluate(() => { ts.sel = { x: 1, y: 0, w: 2, h: 1 }; setTBrush(3); }); await p.keyboard.press('b'); await p.mouse.click(...tat3(20, 20));
  ok(await p.evaluate(() => tm.layers[0].data[20 * tm.mw + 20] === 1 && tm.layers[0].data[20 * tm.mw + 21] === 2 && tm.layers[0].data[21 * tm.mw + 20] === -1), 'carimbo de vários tiles ignora o pincel e usa o próprio tamanho');
  await p.evaluate(() => { tm.layers[0].data[20 * tm.mw + 20] = -1; tm.layers[0].data[20 * tm.mw + 21] = -1; setTBrush(1); ts.sel = { x: 1, y: 0, w: 1, h: 1 }; mapDirty = true; });
  await p.keyboard.press('s'); await p.mouse.move(...tat3(4, 4)); await p.mouse.down(); await p.mouse.move(...tat3(6, 6), { steps: 4 }); await p.mouse.up();
  ok(await p.evaluate(() => JSON.stringify(ts.msel)) === '{"x":4,"y":4,"w":3,"h":3}' && await p.locator('#tSelBar button').count() === 5, 'arrastar com a Seleção marca a área e mostra a barra (copiar, recortar, colar, apagar, tirar)');
  const hist0 = await p.evaluate(() => tHist.length);
  await p.mouse.move(...tat3(4, 4)); await p.mouse.down(); await p.mouse.move(...tat3(14, 9), { steps: 6 }); await p.mouse.up();
  ok(await p.evaluate(() => tm.layers[0].data[9 * tm.mw + 14] === 1 && tm.layers[0].data[4 * tm.mw + 4] === -1 && ts.msel.x === 14 && ts.msel.y === 9) && await tcnt() === 8 && await p.evaluate(() => tHist.length) === hist0 + 1, 'arrastar dentro da seleção move o conteúdo (um passo de desfazer)');
  await p.keyboard.press('Control+z'); await sleep(50);
  ok(await p.evaluate(() => tm.layers[0].data[4 * tm.mw + 4] === 1 && ts.msel.x === 4), 'desfazer o movimento volta o conteúdo e a seleção');
  await p.keyboard.press('Control+c'); await p.evaluate(() => { ts.msel = { x: 24, y: 24, w: 1, h: 1 }; }); await p.keyboard.press('Control+v');
  ok(await tcnt() === 16 && await p.evaluate(() => tm.layers[0].data[24 * tm.mw + 24] === 1 && ts.tool === 'select' && ts.msel.w === 3), 'copiar e colar no mapa (colado vira seleção para posicionar)');
  await p.keyboard.press('Delete'); ok(await tcnt() === 8, 'Delete apaga a área selecionada');
  await p.click('#tSelBar [data-tsb=desel]'); ok(await p.evaluate(() => ts.msel === null), 'botão tira a seleção');
  await p.keyboard.press('Control+a'); await p.keyboard.press('Escape'); ok(await p.evaluate(() => ts.msel === null), '⌘A seleciona tudo e Esc tira');
  ok(await p.evaluate(() => { const L = tm.layers[0], base = L.data.slice(); tShiftSel(L, base, { x: 30, y: 30, w: 2, h: 2 }, 5, 0); const ok1 = ts.msel.x === 35 && tSelClip() === null; L.data.set(base); ts.msel = null; return ok1; }), 'seleção que sai pela borda não quebra (parte fora do mapa é ignorada)');
  await p.evaluate(() => { ts.msel = { x: 1, y: 1, w: 3, h: 3 }; renderTSelBar(); });
  ok(await p.evaluate(() => { const b = document.querySelector('#v-tile .stage-bar'), f = $('#tSelBar').getBoundingClientRect(), a = $('#tArea').getBoundingClientRect(); return b.scrollWidth <= b.clientWidth && f.width > 0 && f.left >= a.left && f.right <= a.right; }), 'com seleção no mapa a barra de comandos continua numa linha (a de seleção flutua sobre a tela)');
  await p.evaluate(() => tDeselect());
  await p.click('.tab[data-v=editor]'); await sleep(150);
  await p.evaluate(() => { selRect = { x: 1, y: 1, w: 3, h: 3 }; updateBar(); });
  ok(await p.evaluate(() => { const b = $('#bar'), f = $('#selBar').getBoundingClientRect(), a = $('#area').getBoundingClientRect(); return b.scrollWidth <= b.clientWidth && f.width > 0 && f.left >= a.left && f.right <= a.right; }), 'com seleção no editor a barra de comandos continua numa linha (antes transbordava 162 px)');
  await p.evaluate(() => { selRect = null; updateBar(); render(); });
  // ---- toques com 2/3 dedos como no Procreate (1.7.1): dedos chegando em tempos diferentes, com "Dedo pinta"
  {
    const tap = async (pts, gap = 40, hold = 80) => { for (let i = 1; i <= pts.length; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T(pts.slice(0, i)) }); await sleep(gap); } await sleep(hold); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(120); };
    const prep = () => p.evaluate(() => { setPenOnly(false); newDoc(32, 32); fit(); fullRefresh(); setTool('pencil'); for (let i = 0; i < 6; i++) { pushHist(); plotRaw(px(), i, 0, [255, 0, 0, 255]); } fullRefresh(); });
    const npx = () => p.evaluate(() => { let n = 0; const a = px(); for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; });
    const bx = await p.locator('#cv').boundingBox(), cx0 = bx.x + bx.width / 2, cy0 = bx.y + bx.height / 2;
    await prep(); const v0 = await p.evaluate(() => [st.zoom, st.ox, st.oy].join());
    await tap([[cx0, cy0], [cx0 + 70, cy0 + 6]]);
    ok(await npx() === 5 && await p.evaluate(() => [st.zoom, st.ox, st.oy].join()) === v0, 'dois dedos (um depois do outro) com "Dedo pinta" desfazem, sem deixar ponto nem mexer a vista');
    await tap([[cx0, cy0], [cx0 + 70, cy0], [cx0 + 140, cy0]]);
    ok(await npx() === 6, 'três dedos (um depois do outro) refazem');
    await tap([[cx0, cy0], [cx0 + 70, cy0]], 40, 1500);
    const n2 = await npx(); ok(n2 <= 2, `segurar dois dedos desfaz em sequência, acelerando (6 → ${n2})`);
    await tap([[cx0, cy0], [cx0 + 70, cy0], [cx0 + 140, cy0]], 40, 1500);
    const n3 = await npx(); ok(n3 >= 5, `segurar três dedos refaz em sequência (${n2} → ${n3})`);
    // desenhar de verdade com o dedo e então pôr o segundo dedo = pinça: o traço é cancelado e nada é desfeito
    await prep(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[cx0, cy0]]) });
    for (let i = 1; i <= 4; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[cx0 + i * 15, cy0]]) }); await sleep(80); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[cx0 + 60, cy0], [cx0 + 160, cy0]]) }); await sleep(60);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(120);
    ok(await npx() === 6, 'pinça depois de desenhar com o dedo cancela o traço e não desfaz nada');
    // Tilemap: mesma coisa
    await p.click('.tab[data-v=tile]'); await sleep(300);
    await p.evaluate(() => { tm.layers.forEach(L => { L.data.fill(-1); if (L.cells) L.cells.fill(0); }); ts.layer = 0; tm.layers[0].visible = true; setTBrush(1); ts.sel = { x: 1, y: 0, w: 1, h: 1 }; setTTool('stamp'); for (let i = 0; i < 4; i++) { tPush(); tm.layers[0].data[i] = 1; } mapDirty = true; tFit(); });
    await sleep(120); const tbx = await p.locator('#tcv').boundingBox(), tcx0 = tbx.x + tbx.width / 2, tcy0 = tbx.y + tbx.height / 2, tc4 = () => p.evaluate(() => tm.layers[0].data.filter(v => v >= 0).length);
    await tap([[tcx0, tcy0], [tcx0 + 70, tcy0]]);
    ok(await tc4() === 3, 'Tilemap: dois dedos (um depois do outro) desfazem sem deixar tile');
    await tap([[tcx0, tcy0], [tcx0 + 70, tcy0], [tcx0 + 140, tcy0]]);
    ok(await tc4() === 4, 'Tilemap: três dedos refazem');
    await p.click('.tab[data-v=editor]'); await sleep(150);
  }
  // ---- ajustes de interface (1.8.0)
  ok(await p.evaluate(() => [...document.querySelectorAll('#side .card')].map(c => c.dataset.card).join() === 'cor,canvas,pincel,camadas,animacao'), 'Canvas é o segundo módulo do painel');
  ok(await p.evaluate(() => { const c = document.querySelector('#side [data-card=camadas]'); c.classList.add('closed'); const acts = [...c.querySelectorAll('.acts svg')]; const r = acts.length > 0 && acts.every(s => getComputedStyle(s).transform === 'none') && getComputedStyle(c.querySelector('.card-h > svg.cv')).transform !== 'none'; c.classList.remove('closed'); return r; }), 'ao fechar um módulo só a seta gira; os ícones dos botões não "deitam"');
  ok(await p.evaluate(() => { const c = document.querySelector('#side [data-card=canvas]'); const was = c.classList.contains('closed'); c.classList.remove('closed'); const bs = [...c.querySelectorAll('[data-rm]')]; const r = bs.length === 2 && bs.every(b => b.getBoundingClientRect().height <= 36); if (was) c.classList.add('closed'); return r; }), '"Manter desenho" e "Redimensionar" ficam numa linha cada');
  ok(await p.evaluate(() => { const n = $('#docName'), keep = doc.name; doc.name = 'Um nome de projeto bem comprido para apertar a barra de comandos'; renderSubtitle(); const b = $('#bar'), f = $('#focoBtn').getBoundingClientRect(), r = b.getBoundingClientRect(), ok_ = b.scrollWidth <= b.clientWidth && f.right <= r.right + .5 && n.getBoundingClientRect().width < 210; doc.name = keep; renderSubtitle(); return ok_; }), 'nome comprido encolhe com "…" e o botão de tela cheia continua inteiro na barra');
  ok(await p.evaluate(() => { const s = getComputedStyle(document.querySelector('.brand svg')); return s.backgroundColor !== 'rgba(0, 0, 0, 0)'; }), 'a bigorna fica sobre uma placa (visível no tema claro)');
  // ---- correções da 1.2.1
  await p.click('.tab[data-v=snap]'); await sleep(150);
  const nl0 = await p.evaluate(() => doc.layers.length);
  await p.evaluate(() => { snapOut = { width: 8, height: 8, data: new Uint8ClampedArray(256).fill(255) }; $('#sToLayer').disabled = false; }); await p.click('#sToLayer'); await sleep(150);
  ok(await p.evaluate(() => doc.layers.length) === nl0 + 1 && await p.evaluate(() => viewOn('editor')), 'Snapper → "Adicionar como camada" funciona (antes dava ReferenceError)');
  ok(await p.evaluate(() => { const a = px(); let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n; }) === 64, 'imagem menor que o canvas entra no tamanho real, sem distorcer');
  await p.evaluate(() => { for (let i = 0; i < 30; i++) setColor([i, 9, 9, 255]); }); ok(await p.evaluate(() => ppPickers.length) <= 3, 'seletores de paleta não se acumulam a cada troca de cor');
  ok(await p.evaluate(() => { setTool('pencil'); beginStroke(1, 1); endStroke(); undo(); const f = future.length; setTool('select'); beginStroke(0, 0); moveStroke(3, 3); endStroke(); return f === 1 && future.length === 1 && selRect.w === 4; }), 'fazer uma seleção não apaga o refazer');
  ok(await p.evaluate(() => { toast(''); doc.layers[cur.layer].locked = true; setTool('select'); beginStroke(0, 0); moveStroke(2, 2); endStroke(); doc.layers[cur.layer].locked = false; return $('#toast').textContent === '' && !!selRect; }), 'seleção funciona em camada travada, sem aviso');
  ok(await p.evaluate(() => { selRect = null; setTool('fill'); const c = st.color.slice(); px().fill(0); for (let i = 0; i < px().length; i += 4) px().set(c, i); const h = hist.length; beginStroke(0, 0); return hist.length === h; }), 'balde que não muda nada não cria passo de desfazer');
  await p.evaluate(() => { setTool('pencil'); selRect = null; fullRefresh(); });
  // abrir um arquivo inválido não pode comer um passo de desfazer
  const bad = path.join(SHOTS, 'invalido.json'); fs.writeFileSync(bad, '{ isso não é json');
  const h0 = await p.evaluate(() => hist.length); const fcb = p.waitForEvent('filechooser'); await p.click('[data-f=open]'); (await fcb).setFiles(bad); await sleep(300);
  ok(await p.evaluate(() => hist.length) === h0, 'abrir JSON inválido mantém o histórico');
  // tilemap
  await p.click('.tab[data-v=tile]'); await sleep(300);
  const tSaved = await p.evaluate(() => JSON.stringify(tSerialize()));
  await p.evaluate(() => { setPenOnly(false); setTTool('fill'); tm.layers.forEach(L => { L.data.fill(-1); if (L.cells) L.cells.fill(0); }); ts.layer = 0; mapDirty = true; tFit(); }); await sleep(100);
  const tb2 = await p.locator('#tcv').boundingBox(), tg2 = await p.evaluate(() => ({ z: ts.zoom, ox: ts.ox, oy: ts.oy, tw: tm.tw }));
  const tat2 = (x, y) => [tb2.x + tg2.ox + (x + .5) * tg2.tw * tg2.z, tb2.y + tg2.oy + (y + .5) * tg2.tw * tg2.z];
  const filled = () => p.evaluate(() => tm.layers[0].data.filter(v => v >= 0).length);
  let [fx, fy] = tat2(5, 5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[fx, fy]]) }); await sleep(30);
  ok(await filled() === 0, 'balde do tilemap no toque não preenche ao encostar');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[fx, fy], [fx + 80, fy]]) });
  for (let i = 1; i <= 4; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: T([[fx - i * 10, fy], [fx + 80 + i * 10, fy]]) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(50);
  ok(await filled() === 0, 'pinça que começa com o balde não preenche o mapa');
  await p.evaluate(() => tFit()); await sleep(50); const tg3 = await p.evaluate(() => ({ z: ts.zoom, ox: ts.ox, oy: ts.oy, tw: tm.tw })); [fx, fy] = [tb2.x + tg3.ox + 5.5 * tg3.tw * tg3.z, tb2.y + tg3.oy + 5.5 * tg3.tw * tg3.z];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: T([[fx, fy]]) }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(50);
  ok(await filled() > 900, 'toque simples com o balde preenche ao soltar');
  ok(await p.evaluate(() => { tDeserialize({ app: 'snapforge-tilemap', mw: 4, mh: 4, tw: 16, th: 16, tileset: { url: 'https://example.com/x.png' }, layers: [{ data: [] }] }); return tm.tileset === null; }), 'tileset com URL de rede é recusado (só data:image)');
  await p.evaluate((j) => { tDeserialize(JSON.parse(j)); loadTsImage(() => { renderTSide(); tFit(); }); }, tSaved); await sleep(200);
  ok(await p.evaluate(async () => { const t0 = tm.tileset; await loadLibTileset('Water.png', 'Água'); await new Promise(r => setTimeout(r, 100)); return tm.tileset !== t0 && tm.tileset.name === 'Sprout Lands · Água' && tsCols === 4 && tHist[tHist.length - 1].tileset === t0; }), 'trocar o tileset (pela biblioteca) entra no desfazer');
  await sleep(150); await p.keyboard.press('Control+z'); await sleep(200);
  ok(await p.evaluate(() => tm.tileset.name) === 'Sprout Lands · Grama', 'desfazer volta ao tileset anterior');
  // biblioteca de tilesets (1.8.0)
  await p.click('#tSide [data-tp=tsLib]'); await sleep(200);
  ok(await p.evaluate(() => [...document.querySelectorAll('.ts-lib .pp-group')].map(g => g.textContent).join('|')) === 'Terreno|Terra arada|Construções|Natureza e objetos'
    && await p.locator('.ts-lib [data-tsf]').count() === 17 && await p.evaluate(() => [...document.querySelectorAll('.ts-lib img')].every(i => i.naturalWidth > 0))
    && (await p.textContent('.ts-lib .pp-credit')).includes('Cup Nooble'), 'biblioteca separada em 4 listas, 17 tilesets com imagem e crédito do autor');
  await p.click('.ts-lib [data-tsf="Fences.png"]'); await sleep(400);
  ok(await p.evaluate(() => tm.tileset.name === 'Sprout Lands · Cercas' && tm.tw === 16 && tsCols === 4 && tsRows === 4 && !document.querySelector('.ts-lib')), 'escolher na lista troca o tileset (tiles de 16 px) e fecha o menu');
  await p.keyboard.press('Control+z'); await sleep(200);
  ok(await p.evaluate(() => typeof demoTileset === 'undefined' && Object.keys(TILESET_FILES).length === 17), 'o tileset de exemplo antigo saiu; os 17 do pacote estão embutidos');
  // xadrez do fundo preso ao mapa: a casa tem o tamanho de meio tile na tela (acompanha o zoom)
  ok(await p.evaluate(async () => {
    tm.layers.forEach(L => { L.data.fill(-1); if (L.cells) L.cells.fill(0); }); mapDirty = true; // mapa vazio: só o xadrez aparece
    const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    // cor do xadrez em pontos fixos do MAPA (em tiles), lida do canvas
    const pts = [[3.3, 2.6], [3.8, 2.6], [5.1, 7.7], [6.6, 7.2]];
    const sample = () => { const d = devicePixelRatio || 1, x = tcx; return pts.map(([u, v]) => [...x.getImageData(Math.round((ts.ox + u * tm.tw * ts.zoom) * d), Math.round((ts.oy + v * tm.th * ts.zoom) * d), 1, 1).data].slice(0, 3).join()).join('|'); };
    ts.zoom = 2; ts.ox = 40; ts.oy = 30; tRender(); await frame(); const a = sample();
    ts.zoom = 3.5; ts.ox = 13; ts.oy = -7; tRender(); await frame(); const b = sample();
    return a === b && new Set(a.split('|')).size > 1; }), 'xadrez do fundo do mapa fica preso ao mapa no zoom e no movimento');
  await p.evaluate(() => tFit());
  // ---- vários tilesets no mesmo mapa (1.9.0): trocar o tileset não muda o que já foi pintado
  {
    const cor = (x, y) => p.evaluate(([x, y]) => { rebuildMap(); return [...mapOff.getContext('2d').getImageData(x * tm.tw + 8, y * tm.th + 8, 1, 1).data].join(); }, [x, y]);
    await p.evaluate(() => { tm.layers.forEach(L => { L.data.fill(-1); if (L.cells) L.cells.fill(0); }); ts.layer = 0; tm.layers[0].visible = true; ts.random = false; setTBrush(1); ts.sel = { x: 1, y: 1, w: 1, h: 1 }; setTTool('stamp'); tBegin(2, 2, 1); tEnd(); });
    const grama = await cor(2, 2);
    await p.click('#tSide [data-tp=tsLib]'); await p.click('.ts-lib [data-tsf="Water.png"]'); await sleep(400);
    await p.evaluate(() => { ts.sel = { x: 0, y: 0, w: 1, h: 1 }; tBegin(5, 5, 1); tEnd(); });
    ok(await cor(2, 2) === grama && await cor(5, 5) !== grama && await p.evaluate(() => tm.tilesets.length === 2 && tm.ts === 1 && tm.layers[0].data[5 * tm.mw + 5] === 65536), 'trocar o tileset não muda o que já foi pintado (cada célula lembra o tileset)');
    ok(await p.locator('#tSide #tSets button').count() === 2, 'lista "Tilesets deste mapa" aparece com os dois');
    await p.click('#tSide [data-tp=tsLib]'); await p.click('.ts-lib [data-tsf="Fences.png"]'); await sleep(400);
    await p.click('#tSide [data-tp=tsLib]'); await p.click('.ts-lib [data-tsf="Hills.png"]'); await sleep(400);
    ok(await p.evaluate(() => tm.tilesets.map(s => s.name.replace('Sprout Lands · ', '')).join()) === 'Grama,Água,Morros', 'tileset escolhido e não usado sai da lista ao trocar de novo (Cercas)');
    await p.click('#tSide [data-tset="0"]'); await sleep(300);
    ok(await p.evaluate(() => tm.tileset.name === 'Sprout Lands · Grama' && tm.tilesets.length === 2) && await cor(5, 5) !== grama, 'tocar num tileset da lista volta a pintar com ele (Morros, sem uso, sai)');
    await p.evaluate(() => { setTTool('pick'); tBegin(5, 5, 1); }); await sleep(300);
    ok(await p.evaluate(() => tm.tileset.name === 'Sprout Lands · Água' && ts.tool === 'stamp' && ts.sel.x === 0 && ts.sel.y === 0), 'conta-gotas no mapa troca para o tileset do tile pego');
    // exportar para o Tiled com dois tilesets: duas imagens e firstgid em sequência
    const dl2 = p.waitForEvent('download'); await p.click('[data-tf=export]'); await p.click('#mBox .btn.pri'); const d2 = await dl2; const zb2 = fs.readFileSync(await d2.path());
    const a0 = zb2.indexOf('{\n "compressionlevel"'), a1 = zb2.indexOf(Buffer.from([0x50, 0x4b, 3, 4]), a0), tmj2 = JSON.parse(zb2.slice(a0, a1).toString('utf8'));
    ok(tmj2.tilesets.length === 2 && tmj2.tilesets[0].firstgid === 1 && tmj2.tilesets[1].firstgid === 78 && tmj2.layers[0].data[2 * 32 + 2] === 13 && tmj2.layers[0].data[5 * 32 + 5] === 78
      && zb2.includes(Buffer.from('tileset-1.png')) && zb2.includes(Buffer.from('tileset-2.png')), '.tmj com dois tilesets: firstgid 1 e 78, uma imagem para cada');
    // mapa salvo no formato antigo (schema 1, um tileset só) abre igual
    ok(await p.evaluate(() => { tDeserialize({ app: 'snapforge-tilemap', schema: 1, mw: 4, mh: 1, tw: 16, th: 16, tileset: { name: 'antigo', url: TILESET_FILES['Grass.png'], w: 176, h: 112 }, layers: [{ name: 'Chão', data: [1, 2, -1, 12] }] });
      return tm.tilesets.length === 1 && tm.ts === 0 && tm.tileset.name === 'antigo' && Array.from(tm.layers[0].data).join() === '1,2,-1,12' && tSerialize().schema === 2; }), 'mapa do schema 1 abre igual e passa a salvar no schema 2');
    // recomeça com um mapa limpo só com a Grama, como os testes seguintes esperam
    await p.evaluate(() => new Promise(r => { newMap(32, 32, 16, 16, 'Mapa'); tm.tilesets = [{ name: libTilesetName('Grama'), url: TILESET_FILES['Grass.png'], w: 0, h: 0 }]; tm.ts = 0; loadTsImage(() => { renderTSide(); tFit(); r(); }); }));
  }
  await p.click('[data-tf=new]'); await sleep(100); await p.click('#tmS [data-n="16"]'); ok(await p.evaluate(() => $('#tmS .on').dataset.n) === '16', 'botões de tamanho do "Novo mapa" respondem');
  await p.click('#mBox .btn.pri'); await sleep(200); ok(await p.evaluate(() => tm.mw) === 16, 'novo mapa sai com o tamanho escolhido');
  await p.keyboard.press('Control+z'); await sleep(100); ok(await p.evaluate(() => tm.mw) === 32, 'desfazer volta ao mapa anterior');
  // ---- 1.12.0: cor principal (botão esquerdo) e secundária (botão direito)
  await p.click('.tab[data-v=editor]'); await sleep(150);
  await p.evaluate(() => { newDoc(16, 16, 'Cores'); setTool('pencil'); fit(); fullRefresh(); }); await sleep(150); at = await geo();
  const palC = await p.evaluate(() => palList(palName).slice(0, 3));
  await p.click(`#pRow [data-pc2="${palC[0]}"]`); await p.click(`#pRow [data-pc2="${palC[1]}"]`);
  ok(await p.evaluate((pc) => rgb2hex(...st.color.slice(0, 3)) === pc[1] && rgb2hex(...st.color2.slice(0, 3)) === pc[0], palC), 'trocar a cor manda a anterior para a secundária');
  await p.mouse.move(...at(2, 2)); await p.mouse.down({ button: 'right' }); await p.mouse.move(...at(6, 2), { steps: 5 }); await p.mouse.up({ button: 'right' }); await sleep(80);
  await p.mouse.move(...at(2, 5)); await p.mouse.down(); await p.mouse.move(...at(6, 5), { steps: 5 }); await p.mouse.up(); await sleep(80);
  ok(await p.evaluate((pc) => { const a = doc.frames[cur.frame][cur.layer], hx = (x, y) => { const o = (y * doc.w + x) * 4; return a[o + 3] ? rgb2hex(a[o], a[o + 1], a[o + 2]) : null; }; return hx(2, 2) === pc[0] && hx(6, 2) === pc[0] && hx(2, 5) === pc[1] && hx(6, 5) === pc[1]; }, palC), 'botão direito pinta com a secundária, esquerdo com a principal');
  await p.keyboard.press('Control+z'); await p.keyboard.press('Control+z'); await sleep(80); ok((await cnt()) === 0, 'traço do botão direito entra no desfazer'); await p.keyboard.press('Control+Shift+z'); await p.keyboard.press('Control+Shift+z');
  await p.click('#pRow [data-pr="swap"]'); ok(await p.evaluate((pc) => rgb2hex(...st.color.slice(0, 3)) === pc[0] && rgb2hex(...st.color2.slice(0, 3)) === pc[1], palC), 'tocar na secundária troca as duas (iPad)');
  await p.keyboard.press('w'); ok(await p.evaluate((pc) => rgb2hex(...st.color.slice(0, 3)) === pc[1] && rgb2hex(...st.color2.slice(0, 3)) === pc[0], palC), 'tecla W troca as cores');
  await p.click(`#pRow [data-pc2="${palC[2]}"]`, { button: 'right' });
  ok(await p.evaluate((pc) => rgb2hex(...st.color.slice(0, 3)) === pc[1] && rgb2hex(...st.color2.slice(0, 3)) === pc[2], palC), 'botão direito numa cor da paleta escolhe a secundária sem mexer na principal');
  ok(await p.evaluate(() => { const c0 = st.color.slice(); setColor([10, 20, 30, 255], true); setColor([40, 50, 60, 255], true); setColor([70, 80, 90, 255], true); commitColor(); return st.color2.every((v, i) => v === c0[i]) && st.color[0] === 70; }), 'ajuste ao vivo (seletor/hex) conta como uma troca só');
  await p.evaluate(() => { const a = doc.frames[cur.frame][cur.layer]; a.fill(0); a.set([1, 2, 3, 255], (8 * 16 + 8) * 4); render(); }); at = await geo();
  await p.keyboard.down('Alt'); await p.mouse.move(...at(8, 8)); await p.mouse.down({ button: 'right' }); await p.mouse.up({ button: 'right' }); await p.keyboard.up('Alt'); await sleep(80);
  ok(await p.evaluate(() => st.color2.slice(0, 3).join() === '1,2,3' && st.color[0] === 70), 'Alt + botão direito pega a cor para a secundária');
  ok(await p.evaluate(() => $$('.duo .cur2').length >= 2), 'secundária aparece no módulo Cor e na fileira de paleta');
  // ---- 1.11.0: aba VFX (efeitos animados em pixel art)
  await p.click('.tab[data-v=vfx]'); await sleep(300);
  ok(await p.evaluate(() => vRes && vRes.frames.length === vDef().frames && $$('#xStrip canvas').length === vRes.frames.length), 'VFX abre com o efeito renderizado e a tira de quadros');
  const vAll = await p.evaluate(() => { const bad = []; for (const d of VFX) for (const size of [32, 64]) { const r = vfxRender(d, { size, frames: d.frames, seed: 3, dens: 1, glow: .6, scale: 1 }); const px = r.frames.reduce((a, f) => { let q = 0; for (let i = 3; i < f.data.length; i += 4) if (f.data[i]) q++; return a + q; }, 0); if (px < 10 || r.frames[0].width !== size) bad.push(d.id + '@' + size); } return [VFX.length, new Set(VFX.map(d => d.cat)).size, bad]; });
  ok(vAll[0] >= 60 && vAll[1] === 10 && vAll[2].length === 0, `todos os ${vAll[0]} efeitos desenham algo em 32 e 64 px (${vAll[1]} categorias) ${vAll[2]}`);
  ok(await p.evaluate(() => { const d = VFX.find(x => x.id === 'blast'), o = { size: 48, frames: 10, seed: 42, dens: 1, glow: .6, scale: 1 }, a = vfxRender(d, o), b = vfxRender(d, o), c = vfxRender(d, { ...o, seed: 43 }); const same = a.frames.every((f, i) => f.data.every((v, j) => v === b.frames[i].data[j])), diff = a.frames.some((f, i) => f.data.some((v, j) => v !== c.frames[i].data[j])); return same && diff; }), 'mesma variação = mesmo efeito; outra variação muda');
  ok(await p.evaluate(() => { const d = VFX.find(x => x.id === 'flame'), r = vfxRender(d, { size: 64, frames: 10, seed: 1, dens: 1, glow: .6, scale: 1, hard: true }); return r.frames.every(f => { for (let i = 3; i < f.data.length; i += 4) if (f.data[i] && f.data[i] !== 255) return false; return true; }); }), 'alfa duro: nenhum pixel semitransparente');
  ok(await p.evaluate(() => { const d = VFX.find(x => x.id === 'portal'), pal = palList(palName).map(hex2rgb), set = new Set(pal.map(c => c.join())), r = vfxRender(d, { size: 64, frames: 6, seed: 1, dens: 1, glow: .6, scale: 1, pal }); return r.frames.every(f => { for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3] && !set.has(`${f.data[i]},${f.data[i + 1]},${f.data[i + 2]}`)) return false; return true; }); }), 'usar a paleta do editor: só cores da paleta');
  ok(await p.evaluate(() => { const d = VFX.find(x => x.id === 'slash'), o = { size: 32, frames: 4, seed: 1, dens: 1, glow: .6, scale: 1 }, a = vfxRender(d, o).frames[1], b = vfxRender(d, { ...o, flipH: true }).frames[1]; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) for (let q = 0; q < 4; q++) if (a.data[(y * 32 + x) * 4 + q] !== b.data[(y * 32 + 31 - x) * 4 + q]) return false; return true; }), 'espelhar na horizontal');
  ok(await p.evaluate(() => { const d = VFX.find(x => x.id === 'smoke'), r = vfxRender(d, { size: 32, frames: 12, seed: 5, dens: 1, glow: .6, scale: 1 }), r2 = vfxRender(d, { size: 32, frames: 24, seed: 5, dens: 1, glow: .6, scale: 1 }); return r2.frames[0].data.every((v, i) => v === r.frames[0].data[i]) && r2.frames[2].data.every((v, i) => v === r.frames[1].data[i]); }), 'efeito em laço: mais quadros só amostram mais fino o mesmo movimento');
  await p.click('#xCats [data-cat="Magia"]'); await p.click('#xList [data-fx="portal"]'); await sleep(200);
  ok(await p.evaluate(() => VX.id === 'portal' && $('#xName').textContent === 'Portal' && $('#xList .on')?.dataset.fx === 'portal'), 'escolher efeito pela lista');
  await p.click('#xSize [data-s="48"]'); await p.evaluate(() => { const r = $('[data-xk=frames]'); r.value = 6; r.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(200);
  ok(await p.evaluate(() => vRes.frames.length === 6 && vRes.frames[0].width === 48 && $('#xCv').width === 48), 'tamanho e quadros mudam a prévia');
  await p.click('#xCols [data-slot="0"] [data-ramp="Fogo"]'); await sleep(150);
  ok(await p.evaluate(() => { const f = vRes.frames[0], fogo = new Set(VFX_RAMPS['Fogo'].map(h => hex2rgb(h).join())); let n = 0; for (let i = 0; i < f.data.length; i += 4) if (f.data[i + 3] === 255 && fogo.has(`${f.data[i]},${f.data[i + 1]},${f.data[i + 2]}`)) n++; return n > 20 && VX.ramps.portal[0] === 'Fogo'; }), 'trocar a rampa de cor');
  const seed0 = await p.evaluate(() => VX.seed); await p.click('#xVar'); await sleep(150); ok(await p.evaluate((s) => VX.seed !== s && +$('#xSeed').value === VX.seed, seed0), 'Variação sorteia outro número');
  await p.keyboard.press(' '); await sleep(50); const fr0 = await p.evaluate(() => [vPlaying, vCur]); await p.keyboard.press('ArrowRight'); await sleep(50);
  ok(!fr0[0] && await p.evaluate((c) => vCur === (c + 1) % vRes.frames.length, fr0[1]), 'espaço pausa e → avança um quadro');
  // exportar: tira, GIF (lido pelo navegador), Godot, categoria
  const vdl = async (fmt, sc = 1) => { const dl = p.waitForEvent('download'); await p.click('#xExport'); await p.selectOption('#xeF', fmt); await p.click(`#xeS [data-n="${sc}"]`); await p.click('#mBox .btn.pri'); const d = await dl; return [d.suggestedFilename(), fs.readFileSync(await d.path())]; };
  const [sn, sb] = await vdl('strip', 2); ok(/portal_48_2x_tira\.png$/.test(sn) && sb.readUInt32BE(16) === 48 * 2 * 6 && sb.readUInt32BE(20) === 96, 'tira PNG ampliada 2× (' + sn + ')');
  const [gn, gb] = await vdl('gif'); const gif = await p.evaluate(async (b64) => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const dec = new ImageDecoder({ data: u, type: 'image/gif' }); await dec.tracks.ready; const fr = await dec.decode({ frameIndex: 2 }); const c = new OffscreenCanvas(48, 48), x = c.getContext('2d'); x.drawImage(fr.image, 0, 0); const d = x.getImageData(0, 0, 48, 48).data, ref = vRes.frames[2].data; let diff = 0; for (let i = 0; i < d.length; i += 4) { const on = ref[i + 3] >= 128; if (on !== (d[i + 3] > 0) || (on && Math.abs(d[i] - ref[i]) + Math.abs(d[i + 1] - ref[i + 1]) + Math.abs(d[i + 2] - ref[i + 2]) > 6)) diff++; } return [dec.tracks.selectedTrack.frameCount, fr.image.displayWidth, diff]; }, gb.toString('base64'));
  ok(gn.endsWith('.gif') && gif[0] === 6 && gif[1] === 48 && gif[2] === 0, `GIF animado válido: ${gif[0]} quadros, ${gif[1]} px, ${gif[2]} pixels diferentes`);
  const [zn, xzb] = await vdl('godot'); const ztxt = xzb.toString('latin1');
  ok(zn === 'portal_godot.zip' && ztxt.includes('portal.png') && ztxt.includes('[gd_resource type="SpriteFrames"') && (ztxt.match(/region = Rect2\(/g) || []).length === 6 && ztxt.includes('"loop": true'), 'Godot 4: PNG + SpriteFrames .tres com 6 regiões');
  const [cn, cb] = await vdl('cat'); ok(cn === 'magia_48.zip' && (cb.toString('latin1').match(/\.json/g) || []).length >= 2 * (await p.evaluate(() => VFX.filter(d => d.cat === 'Magia').length)), 'toda a categoria num .zip (' + cn + ')');
  // abrir no editor
  const xBefore = await p.evaluate(() => [doc.w, doc.frames.length]);
  await p.click('#xToEd'); await sleep(300);
  ok(await p.evaluate(() => viewOn('editor') && doc.w === 48 && doc.h === 48 && doc.frames.length === 6 && doc.fps === vRes.fps && doc.frames[2][0].every((v, i) => v === vRes.frames[2].data[i])), 'Abrir no editor: um quadro da animação para cada quadro do efeito, mesmo fps');
  await p.keyboard.press('Control+z'); await sleep(150); ok(await p.evaluate((b) => doc.w === b[0] && doc.frames.length === b[1], xBefore), 'desfazer volta ao desenho anterior');
  await p.reload(); await sleep(400); await p.click('.tab[data-v=vfx]'); await sleep(250); ok(await p.evaluate(() => VX.id === 'portal' && VX.size === 48 && vRes.frames.length === 6), 'ajustes do VFX ficam salvos no aparelho');
  await p.click('.tab[data-v=editor]');
  // ---- tela única em todas as abas, deitado e em pé
  for (const [w, h] of [[1180, 820], [820, 1180], [1366, 768]]) { await p.setViewportSize({ width: w, height: h }); for (const v of ['editor', 'tile', 'snap', 'normal', 'vfx']) { await p.click(`.tab[data-v=${v}]`); await sleep(120); if (v === 'editor' || v === 'tile') { const bar = await p.evaluate((v) => { const b = document.querySelector(`#v-${v} .stage-bar`); return [b.offsetHeight, b.scrollWidth - b.clientWidth]; }, v); ok(bar[0] <= 48 && bar[1] <= 1, `barra do palco numa linha só, sem cortar (${v} ${w}×${h}: ${bar})`); } const sh = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); ok(sh <= 0, `sem rolar a página: ${v} em ${w}×${h}`); } }
  await p.setViewportSize({ width: 1180, height: 820 }); await p.click('.tab[data-v=snap]');
  await p.click('.tab[data-v=normal]');
  const fc2 = p.waitForEvent('filechooser'); await p.click('#nDrop'); (await fc2).setFiles(path.join(FIX, 'sprite32.png'));
  await p.waitForSelector('#nDl:not([disabled])', { timeout: 10000 }); ok(await p.evaluate(() => nOut.width === 32), 'Normal map');
  await p.click('#themeBtn'); await sleep(150); await p.click('.tab[data-v=editor]'); await sleep(200); await p.screenshot({ path: path.join(SHOTS, 'v3_light.png') });
  await p.setViewportSize({ width: 820, height: 1180 }); await sleep(400); await p.screenshot({ path: path.join(SHOTS, 'v3_portrait.png') }); await p.click('.tab[data-v=tile]'); await sleep(300); await p.screenshot({ path: path.join(SHOTS, 'v3_tile_portrait.png') });
  const real = errs.filter(x => !x.includes('400 (Bad Request)')); ok(real.length === 0, 'sem erros de console (fora o 400 simulado de propósito): ' + real.join(' | '));
  // ---- versão PWA abre também
  const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e)));
  await p2.goto(fileUrl(PWA_IDX)); await sleep(400); ok(e2.length === 0 && (await p2.textContent('.brand span')) === 'Snapforge', 'index.html do PWA abre sem erro');
  await b.close(); console.log(fails ? fails + ' falha(s)' : 'TUDO OK'); process.exit(fails ? 1 : 0);
})();
