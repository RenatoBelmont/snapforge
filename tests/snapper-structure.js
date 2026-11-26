const { PNG } = require('pngjs'); const fs = require('fs'); const { execFileSync } = require('child_process');
const E = require('../src/engines.js');
const SN=(process.env.SF_REPOS || require('path').join(__dirname,'..','..','sf-repos'))+'/spritefusion-pixel-snapper/target/release/spritefusion-pixel-snapper';
const load=f=>{const p=PNG.sync.read(fs.readFileSync(f));return{width:p.width,height:p.height,data:new Uint8ClampedArray(p.data)}};
const pal=E.parsePaletteHex('1a1c2c,ef7d57,ffcd75,38b764,41a6f6,f4f4f4,ff00ff');
for (const [a,o] of [[['16'],{k_colors:16}],[['16','--pixel-size','10'],{k_colors:16,pixel_size_override:10}],[['4'],{k_colors:4}],[['32'],{k_colors:32}]]){
 execFileSync(SN,[require('path').join(__dirname,'fixtures','ai_like.png'),require('path').join(require('os').tmpdir(),'ref.png'),...a]);
 const r=E.applyPalette(load(require('path').join(require('os').tmpdir(),'ref.png')),pal), j=E.applyPalette(E.snapPixels(load(require('path').join(__dirname,'fixtures','ai_like.png')),o),pal);
 let s=0;for(let i=0;i<r.data.length;i+=4) if(r.data[i]==j.data[i]&&r.data[i+1]==j.data[i+1]&&r.data[i+2]==j.data[i+2]) s++;
 console.log(a.join(' '), r.width+'x'+r.height, j.width+'x'+j.height, (100*s/(r.data.length/4)).toFixed(1)+'% mesma cor-base');
}
