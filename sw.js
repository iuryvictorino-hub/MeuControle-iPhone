/* Meu Controle — interface local, sem envio de dados financeiros ao servidor. */
'use strict';
const CACHE = 'meu-controle-web-v3.4.0-1';
const ASSETS = [
  './', './index.html', './style.css', './app.js', './finance-core.js',
  './pwa.js', './manifest.webmanifest', './icons/icon-192.png',
  './icons/icon-512.png', './icons/apple-touch-icon.png'
];
const URLS = new Set(ASSETS.map(p => new URL(p, self.registration.scope).pathname));
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('meu-controle-web-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  // Update metadata must not come from the offline cache.
  if(url.pathname.endsWith('/version.json'))return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const cached=await cache.match(new URL('./index.html',self.registration.scope));
      return cached || fetch(req);
    })());
    return;
  }
  if(!URLS.has(url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(req, {ignoreSearch:true}) || fetch(req);
  })());
});
