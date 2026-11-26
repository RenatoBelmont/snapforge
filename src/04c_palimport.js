/* ======================= importar paletas (arquivo e Lospec) ======================= */
const toHex2 = (n) => clamp(n | 0, 0, 255).toString(16).padStart(2, '0');

/**
 * Lê um arquivo de paleta e devolve { name, colors: ['#rrggbb', ...] }.
 * Aceita: .hex (uma cor por linha, o do Lospec), .gpl (GIMP; o nome vem de "Name:" ou do "#Palette Name:" do Lospec),
 * .pal JASC (texto, o do Lospec) e .pal RIFF (binário do Windows). `bytes` é um Uint8Array; `fileName` dá o nome de reserva.
 */
function parsePaletteFile(bytes, fileName) {
  let name = String(fileName || 'Paleta').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Paleta';
  const colors = [];
  // RIFF PAL: "RIFF" .... "PAL " ... "data" [tam] [versão u16][quantidade u16] e entradas R G B flags
  if (bytes.length > 24 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'PAL ') {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let o = 12; o + 8 <= bytes.length;) {
      const id = String.fromCharCode(...bytes.subarray(o, o + 4)), size = dv.getUint32(o + 4, true);
      if (id === 'data') { const n = dv.getUint16(o + 10, true); for (let i = 0; i < n && o + 12 + i * 4 + 3 <= bytes.length; i++) { const p = o + 12 + i * 4; colors.push('#' + toHex2(bytes[p]) + toHex2(bytes[p + 1]) + toHex2(bytes[p + 2])); } break; }
      o += 8 + size + (size & 1);
    }
  } else {
    const lines = new TextDecoder().decode(bytes).split(/\r?\n/).map(l => l.trim());
    const first = (lines[0] || '').toUpperCase();
    if (first === 'GIMP PALETTE') {
      for (const l of lines.slice(1)) {
        const nm = l.match(/^#?\s*(?:Palette\s+)?Name:\s*(.+)$/i); if (nm) { name = nm[1].trim() || name; continue; }
        if (!l || l.startsWith('#') || /^Columns:/i.test(l)) continue;
        const m = l.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/); if (m) colors.push('#' + toHex2(+m[1]) + toHex2(+m[2]) + toHex2(+m[3]));
      }
    } else if (first === 'JASC-PAL') {
      for (const l of lines.slice(3)) { const m = l.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})/); if (m) colors.push('#' + toHex2(+m[1]) + toHex2(+m[2]) + toHex2(+m[3])); }
    } else {
      for (const l of lines) { const m = l.match(/^#?([0-9a-f]{6})\b/i); if (m) colors.push('#' + m[1].toLowerCase()); }
    }
  }
  const uniq = [...new Set(colors)];
  if (!uniq.length) throw new Error('Não achei cores nesse arquivo (aceito .hex, .gpl e .pal)');
  return { name: name.slice(0, 60), colors: uniq.slice(0, 256) };
}

/** "https://lospec.com/palette-list/resurrect-64", "resurrect-64.gpl", "Resurrect 64" → "resurrect-64" (ou '' se não der). */
function lospecSlug(input) {
  let s = String(input || '').trim();
  const m = s.match(/lospec\.com\/palette-list\/([^/?#\s]+)/i); if (m) s = m[1];
  s = s.replace(/\.(json|hex|gpl|pal|ase|txt|csv|png)$/i, '');
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/**
 * Única chamada de rede do app (exceção à regra 4, liberada pelo Renato na 1.6.0): só quando o usuário pede.
 * Busca https://lospec.com/palette-list/<slug>.json (o Lospec libera CORS) e devolve { name, author, colors }.
 */
async function fetchLospecPalette(input) {
  const slug = lospecSlug(input);
  if (!slug) throw new Error('Cole o link da paleta no Lospec ou o nome dela');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sem internet agora. Dá para baixar o .hex ou .gpl no Lospec e usar "Arquivo"');
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), 12000);
  const get = (s) => fetch(`https://lospec.com/palette-list/${s}.json`, { signal: ctl && ctl.signal, credentials: 'omit', cache: 'no-store' });
  let res;
  try { res = await get(slug); }
  catch (e) {
    if (e && e.name === 'AbortError') { clearTimeout(t); throw new Error('O Lospec demorou demais para responder. Tente de novo'); }
    // o 404 do Lospec vem sem CORS, então o navegador o enxerga como falha de rede: testa uma paleta que existe para separar "nome errado" de "sem conexão"
    let online = false; try { online = (await get('pico-8')).ok; } catch {}
    clearTimeout(t);
    throw new Error(online ? `Não achei "${slug}" no Lospec. Confira o nome no link da paleta` : 'Não consegui falar com o Lospec (sem internet?)');
  }
  clearTimeout(t);
  if (res.status === 404) throw new Error(`Não achei "${slug}" no Lospec. Confira o nome no link da paleta`);
  if (!res.ok) throw new Error(`O Lospec respondeu com erro ${res.status}. Tente de novo mais tarde`);
  let o; try { o = await res.json(); } catch { throw new Error('O Lospec mandou uma resposta que não entendi'); }
  const colors = [...new Set((Array.isArray(o && o.colors) ? o.colors : []).map(c => String(c).replace('#', '').toLowerCase()).filter(c => /^[0-9a-f]{6}$/.test(c)))].map(c => '#' + c);
  if (!colors.length) throw new Error('Essa paleta veio sem cores');
  return { name: String(o.name || slug).slice(0, 60), author: String(o.author || '').slice(0, 60), colors: colors.slice(0, 256) };
}

/** Guarda a paleta importada. Se as cores forem iguais às de uma paleta padrão, só seleciona a padrão. Devolve o nome usado. */
function adoptPalette(name, colors) {
  const key = colors.join(',');
  const same = Object.keys(PALETTES).find(n => palList(n).join(',') === key);
  if (same) { palName = same; LS.set('palName', palName); renderColor(); refreshAllPalPickers(); renderFaixa(); return { name: same, builtin: true }; }
  savePal(name, colors); return { name: palName, builtin: false };
}
