/* ======================= paletas e cores recentes ======================= */
const PALETTES = {
  // do Renato (Cosmic Valley): as primeiras da lista; Pogo City é a paleta inicial.
  // Ordem por tonalidade: faixas de matiz (vermelho → laranja → amarelo → verde → ciano → azul → roxo → rosa), cada uma do escuro ao claro; neutros no fim.
  'Pogo City': '58272d,a05261,e0625b,eda0a2,a1572c,e75e23,f1a022,f09f60,f7dca1,5e5a24,9f9f1e,f1d622,f8db60,2394a5,22e5ec,5cecf1,9ee8f0,051326,186095,6492a4,5ca1d5,1f275e,655696,5c2ae0,a160d2,5a295f,97599e,e264d8,e99ddb,da2f9d,df63a2,999ca9,fafafb',
  'Apartment': 'e84d2e,ff8a2a,f5ab76,ffd166,fcf4bc,a8d463,1e7a55,2faa6e,bbe2cd,12a6bc,00e7ff,5aefe6,020d23,082947,1c3372,1c639f,00a3ff,252a6c,3b425c,707a9e,5c3e93,a163e6,c26cff,ff6ee7,c64e8e,adaba3,c5d0e3,e6ecf8',
  'Sweetie 16': '1a1c2c,5d275d,b13e53,ef7d57,ffcd75,a7f070,38b764,257179,29366f,3b5dc9,41a6f6,73eff7,f4f4f4,94b0c2,566c86,333c57',
  'PICO-8': '000000,1d2b53,7e2553,008751,ab5236,5f574f,c2c3c7,fff1e8,ff004d,ffa300,ffec27,00e436,29adff,83769c,ff77a8,ffccaa',
  'Endesga 32': 'be4a2f,d77643,ead4aa,e4a672,b86f50,733e39,3e2731,a22633,e43b44,f77622,feae34,fee761,63c74d,3e8948,265c42,193c3e,124e89,0099db,2ce8f5,ffffff,c0cbdc,8b9bb4,5a6988,3a4466,262b44,181425,ff0044,68386c,b55088,f6757a,e8b796,c28569',
  'Game Boy': '0f380f,306230,8bac0f,9bbc0f', '1-bit': '000000,ffffff',
  // do Lospec (lospec.com/palette-list), conferidas cor a cor com o JSON oficial na 1.5.0; o comentário é o autor
  'RETURN 20': '110f4e,6600aa,c800aa,f42a5c,ff8400,ffc400,fffc5c,fffdde,2e4ba3,008bd6,12dc63,a9ff47,731e58,b65f65,df7845,ffab87,f9e4b3,687fa3,89b5b1,b6dc98', // Patchy Moon
  'Minty chip': 'dff9f3,b0bdd8,8c9fb3,776d83,383e46,1c2232,1f396b,506ae0,3e9de6,92f0d9,f5fe73,9fdf47,75ae26,366823,203816,244d57,329980,5cdab4,f6e1b8,f3bbea,ea88e8,b05be2,812d8e,3c182e,5c3024,8f5b3e,bd7a53,ffb543,f37553,d64228', // Meson
  'CC-29': 'f2f0e5,b8b5b9,868188,646365,45444f,3a3858,212123,352b42,43436a,4b80ca,68c2d3,a2dcc7,ede19e,d3a068,b45252,6a536e,4b4158,80493a,a77b5b,e5ceb4,c2d368,8ab060,567b79,4e584a,7b7243,b2b47e,edc8c4,cf8acb,5f556a', // Alpha6
  'Resurrect 64': '2e222f,3e3546,625565,966c6c,ab947a,694f62,7f708a,9babb2,c7dcd0,ffffff,6e2727,b33831,ea4f36,f57d4a,ae2334,e83b3b,fb6b1d,f79617,f9c22b,7a3045,9e4539,cd683d,e6904e,fbb954,4c3e24,676633,a2a947,d5e04b,fbff86,165a4c,239063,1ebc73,91db69,cddf6c,313638,374e4a,547e64,92a984,b2ba90,0b5e65,0b8a8f,0eaf9b,30e1b9,8ff8e2,323353,484a77,4d65b4,4d9be6,8fd3ff,45293f,6b3e75,905ea9,a884f3,eaaded,753c54,a24b6f,cf657f,ed8099,831c5d,c32454,f04f78,f68181,fca790,fdcbb0', // Kerrie Lake
  'SLSO8': '0d2b45,203c56,544e68,8d697a,d08159,ffaa5e,ffd4a3,ffecd6', // Luis Miguel Maldonado
  'Lost Century': 'd1b187,c77b58,ae5d40,79444a,4b3d44,ba9158,927441,4d4539,77743b,b3a555,d2c9a5,8caba1,4b726e,574852,847875,ab9b8e', // SurrealEmber
  'Twilight 5': 'fbbbad,ee8695,4a7a96,333f58,292831', // Star
  'CafeArisuki': '49223f,cc2b46,f37e7e,e7a794,fbf1d1,f6cda3,ca833c,8a4646,538f5a,b4accc', // Arisuki
};
const FAVORITES = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#78716c', '#a8a29e', '#3f3f46', '#f5f5f4'];
const DEFAULT_PAL = 'Pogo City'; // paleta inicial (do Renato)
let userPals = LS.get('userPals', {}), palName = LS.get('palName', DEFAULT_PAL);
const allPals = () => Object.assign({}, PALETTES, userPals);
const palList = (n) => (allPals()[n] || PALETTES[DEFAULT_PAL]).split(',').filter(Boolean).map(h => '#' + h.toLowerCase());
let recent = LS.get('recentColors', []);
function pushRecent(hex) { hex = hex.toLowerCase(); recent = [hex, ...recent.filter(c => c !== hex)].slice(0, 10); LS.set('recentColors', recent); }

