// Aposentado na 1.10.1: apaga o cache da interface em teste, desinstala-se e leva as abas abertas para o app oficial.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('snapforge2-')).map((k) => caches.delete(k))))
  .then(() => self.registration.unregister()).then(() => self.clients.matchAll({ type: 'window' })).then((cs) => cs.forEach((c) => c.navigate('../pwa/')))); });
