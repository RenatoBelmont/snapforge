const { chromium } = require('playwright');
const path = require('path'), url = require('url');
const ROOT = path.join(__dirname, '..'), FIX = path.join(__dirname, 'fixtures'), SHOTS = path.join(__dirname, 'screenshots');
require('fs').mkdirSync(SHOTS, { recursive: true });
const fileUrl = (p) => url.pathToFileURL(path.join(ROOT, p)).href;

const fs = require('fs');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
  await p.goto(fileUrl('dist/snapforge.html')); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(600);
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
  ok(await p.evaluate(() => st.color.slice(0, 3).join()) === '26,28,44', 'soltar pega a cor sob o dedo');
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
  await p.click('#faixa [data-fx]:nth-child(5)'); ok(await p.evaluate(() => rgb2hex(...st.color.slice(0, 3))) === '#ef7d57', 'tocar na faixa escolhe a cor');
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
  ok(await p.evaluate(() => tsCols === 8 && tm.mw === 32), 'tilemap abre com tileset de exemplo');
  const tb = await p.locator('#tcv').boundingBox(); const tg = await p.evaluate(() => ({ z: ts.zoom, ox: ts.ox, oy: ts.oy, tw: tm.tw }));
  const tat = (x, y) => [tb.x + tg.ox + (x + .5) * tg.tw * tg.z, tb.y + tg.oy + (y + .5) * tg.tw * tg.z];
  const tc = () => p.evaluate(() => tm.layers[ts.layer].data.filter(v => v >= 0).length);
  await p.mouse.move(...tat(1, 1)); await p.mouse.down(); await p.mouse.move(...tat(6, 1), { steps: 6 }); await p.mouse.up();
  ok(await tc() === 6, 'pincel de tiles pinta uma linha de 6');
  await p.keyboard.press('Control+z'); ok(await tc() === 0, 'desfazer no tilemap');
  const tsb = await p.locator('#tsCv').boundingBox(); const tsw = tsb.width / 8;
  await p.mouse.move(tsb.x + tsw * 1.5, tsb.y + 5); await p.mouse.down(); await p.mouse.move(tsb.x + tsw * 2.5, tsb.y + 5, { steps: 3 }); await p.mouse.up();
  ok(await p.evaluate(() => ts.sel.w === 2 && ts.sel.x === 1), 'arrastar no tileset seleciona vários tiles');
  await p.mouse.click(...tat(10, 10)); ok(await p.evaluate(() => tm.layers[0].data[10 * tm.mw + 10] === 1 && tm.layers[0].data[10 * tm.mw + 11] === 2), 'carimbo de 2 tiles');
  await p.keyboard.press('g'); await p.mouse.click(...tat(20, 20)); ok(await tc() > 900, 'balde preenche o mapa');
  await p.keyboard.press('Control+z');
  await p.click('#tSide [data-tp=tAddAuto]'); ok(await p.evaluate(() => tm.layers[ts.layer].auto), 'camada de autotile');
  await p.mouse.move(tsb.x + tsw * 0.5, tsb.y + 5); await p.mouse.down(); await p.mouse.up();
  await p.click('#tSide [data-tp=autoFill]'); await p.click('#tSide [data-slot="0"]'); const tsb2 = await p.locator('#tsCv').boundingBox(); await p.mouse.click(tsb2.x + tsb2.width / 8 * 4.5, tsb2.y + 5);
  ok(await p.evaluate(() => tm.layers[ts.layer].rules[0] === 4 && tm.layers[ts.layer].rules[15] === 0), 'regra de autotile atribuída tocando no tileset');
  await p.keyboard.press('b'); await p.mouse.click(...tat(3, 25));
  ok(await p.evaluate(() => tileAt(tm.layers[ts.layer], 25 * tm.mw + 3)) === 4, 'célula sozinha usa a regra "sem vizinhos"');
  await p.mouse.move(...tat(3, 25)); await p.mouse.down(); await p.mouse.move(...tat(6, 25), { steps: 4 }); await p.mouse.up();
  ok(await p.evaluate(() => tileAt(tm.layers[ts.layer], 25 * tm.mw + 4)) === 0, 'autotile recalcula com vizinhos');
  await p.click('#tSide [data-ms="16"]'); ok(await p.evaluate(() => tm.mw) === 16, 'botão 16 muda o tamanho do mapa');
  await p.click('#tSide [data-ms="32"]');
  const dl = p.waitForEvent('download'); await p.click('[data-tf=export]'); await p.click('#mBox .btn.pri'); const d = await dl;
  const zp = await d.path(); const zb = fs.readFileSync(zp); ok(d.suggestedFilename().endsWith('_tiled.zip') && zb.includes(Buffer.from('"orthogonal"')) && zb.includes(Buffer.from('tileset.png')), 'exporta .zip do Tiled com .tmj e tileset');
  const t0i = zb.indexOf('{\n "compressionlevel"'), t1i = zb.indexOf(Buffer.from([0x50, 0x4b, 3, 4]), t0i); const tmj = JSON.parse(zb.slice(t0i, t1i).toString('utf8')); ok(tmj.layers.length === 2 && tmj.tilesets[0].columns === 8 && tmj.layers[0].data.length === 1024, '.tmj válido com as 2 camadas');
  await p.screenshot({ path: path.join(SHOTS, 'v3_tile.png') });
  await p.reload(); await sleep(500); const rs = await p.evaluate(() => [tm.layers.length, tm.layers.map(l => l.auto).join(), tsCols, tm.mw]); ok(rs[0] === 2 && rs[1] === 'false,true' && rs[2] === 8, 'mapa e tileset restaurados após recarregar ' + rs);
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
  ok(await p.evaluate(() => { const t0 = tm.tileset; setTileset(demoTileset(), 'outro', 16); return tm.tileset !== t0 && tHist[tHist.length - 1].tileset === t0; }), 'trocar o tileset entra no desfazer');
  await sleep(150); await p.keyboard.press('Control+z'); await sleep(200);
  ok(await p.evaluate(() => tm.tileset.name) === 'exemplo', 'desfazer volta ao tileset anterior');
  await p.click('[data-tf=new]'); await sleep(100); await p.click('#tmS [data-n="16"]'); ok(await p.evaluate(() => $('#tmS .on').dataset.n) === '16', 'botões de tamanho do "Novo mapa" respondem');
  await p.click('#mBox .btn.pri'); await sleep(200); ok(await p.evaluate(() => tm.mw) === 16, 'novo mapa sai com o tamanho escolhido');
  await p.keyboard.press('Control+z'); await sleep(100); ok(await p.evaluate(() => tm.mw) === 32, 'desfazer volta ao mapa anterior');
  // ---- tela única em todas as abas, deitado e em pé
  for (const [w, h] of [[1180, 820], [820, 1180], [1366, 768]]) { await p.setViewportSize({ width: w, height: h }); for (const v of ['editor', 'tile', 'snap', 'normal']) { await p.click(`.tab[data-v=${v}]`); await sleep(120); if (v === 'editor' || v === 'tile') { const bar = await p.evaluate((v) => { const b = document.querySelector(`#v-${v} .stage-bar`); return [b.offsetHeight, b.scrollWidth - b.clientWidth]; }, v); ok(bar[0] <= 48 && bar[1] <= 1, `barra do palco numa linha só, sem cortar (${v} ${w}×${h}: ${bar})`); } const sh = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight); ok(sh <= 0, `sem rolar a página: ${v} em ${w}×${h}`); } }
  await p.setViewportSize({ width: 1180, height: 820 }); await p.click('.tab[data-v=snap]');
  await p.click('.tab[data-v=normal]');
  const fc2 = p.waitForEvent('filechooser'); await p.click('#nDrop'); (await fc2).setFiles(path.join(FIX, 'sprite32.png'));
  await p.waitForSelector('#nDl:not([disabled])', { timeout: 10000 }); ok(await p.evaluate(() => nOut.width === 32), 'Normal map');
  await p.click('#themeBtn'); await sleep(150); await p.click('.tab[data-v=editor]'); await sleep(200); await p.screenshot({ path: path.join(SHOTS, 'v3_light.png') });
  await p.setViewportSize({ width: 820, height: 1180 }); await sleep(400); await p.screenshot({ path: path.join(SHOTS, 'v3_portrait.png') }); await p.click('.tab[data-v=tile]'); await sleep(300); await p.screenshot({ path: path.join(SHOTS, 'v3_tile_portrait.png') });
  const real = errs.filter(x => !x.includes('400 (Bad Request)')); ok(real.length === 0, 'sem erros de console (fora o 400 simulado de propósito): ' + real.join(' | '));
  // ---- versão PWA abre também
  const p2 = await ctx.newPage(); const e2 = []; p2.on('pageerror', e => e2.push(String(e)));
  await p2.goto(fileUrl('dist/pwa/index.html')); await sleep(400); ok(e2.length === 0 && (await p2.textContent('.brand span')) === 'Snapforge', 'index.html do PWA abre sem erro');
  await b.close(); console.log(fails ? fails + ' falha(s)' : 'TUDO OK'); process.exit(fails ? 1 : 0);
})();
