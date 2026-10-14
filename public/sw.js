const CACHE="arranjos-offline-v1";const BASE=["/","/painel","/plano","/prestacao","/favicon.svg","/manifest.webmanifest"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/","/favicon.svg","/manifest.webmanifest"])).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==location.origin||url.pathname.startsWith("/api/"))return;
 if(req.mode==="navigate"){event.respondWith(fetch(req).then(res=>{const copia=res.clone();caches.open(CACHE).then(cache=>cache.put(req,copia));return res;}).catch(async()=>await caches.match(req)||await caches.match("/painel")||await caches.match("/")));return;}
 event.respondWith(caches.match(req).then(cache=>cache||fetch(req).then(res=>{if(res.ok)caches.open(CACHE).then(c=>c.put(req,res.clone()));return res;})));
});
