/* Service worker: приложение целиком лежит в кеше и работает без сети.
   Стратегия: отдаём из кеша сразу, а в фоне (если сеть есть) подтягиваем свежую
   версию файла — правки на GitHub появятся при следующем открытии приложения.
   Список схем берётся из data/cards.json, поэтому при добавлении карточек
   этот файл править не нужно. */
'use strict';
var CACHE = 'tochki-v6';
var CORE = [
  './',
  'index.html',
  'css/style.css',
  'js/body.js',
  'js/app.js',
  'data/cards.json',
  'data/doctor.json',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(CORE).then(function () {
        return fetch('data/cards.json', { cache: 'no-cache' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var svgs = (data.cards || []).map(function (c) { return c.svg; }).filter(Boolean);
            return cache.addAll(svgs);
          });
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (cached) {
        var fresh = fetch(req, { cache: 'no-cache' }).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          if (cached) return cached;
          if (req.mode === 'navigate') return cache.match('index.html');
          return new Response('', { status: 504, statusText: 'Нет сети' });
        });
        if (cached) { e.waitUntil(fresh); return cached; }
        return fresh;
      });
    })
  );
});
