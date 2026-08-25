/* sw.js — the service worker, which is what makes this an app.
 *
 * On the first visit every file is copied onto the device. From then on the
 * page opens from that copy, so it starts instantly and works with no signal
 * at all: on a plane, down a lane, in a field at dusk, which is rather the
 * point of a calendar built round the sun.
 *
 * The whole app is a few hundred kilobytes of text and it computes the sky
 * from formulas rather than fetching it, so there is nothing here that needs
 * a network. The one exception is looking up a city by name, which is left
 * alone to reach the network or fail quietly, exactly as it does now.
 *
 * VERSION is stamped by deploy.sh at publish time. When it changes, the old
 * cache is thrown away and the new files are taken. Without that, visitors
 * would sit on a stale copy forever, which is the classic way these go wrong.
 */
var VERSION = '20260825-043203';
var PREFIX = 'ty-public';          /* deploy.sh rewrites this for the lab */
var CACHE = PREFIX + '-' + VERSION;

var SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "styles.css?v=20260825-043203",
  "js/app.js?v=20260825-043203",
  "js/astro-moon.js?v=20260825-043203",
  "js/astro-riseset.js?v=20260825-043203",
  "js/astro-sun.js?v=20260825-043203",
  "js/astro.js?v=20260825-043203",
  "js/body.js?v=20260825-043203",
  "js/clock.js?v=20260825-043203",
  "js/cycle.js?v=20260825-043203",
  "js/features.js?v=20260825-043203",
  "js/globe.js?v=20260825-043203",
  "js/lunar.js?v=20260825-043203",
  "js/moon-glyph.js?v=20260825-043203",
  "js/orrery.js?v=20260825-043203",
  "js/places.js?v=20260825-043203",
  "js/planets.js?v=20260825-043203",
  "js/register-sw.js?v=20260825-043203",
  "js/render-day.js?v=20260825-043203",
  "js/render-month.js?v=20260825-043203",
  "js/render-moon.js?v=20260825-043203",
  "js/render-wheel.js?v=20260825-043203",
  "js/spiral.js?v=20260825-043203",
  "js/stars.js?v=20260825-043203",
  "js/timezone.js?v=20260825-043203",
  "js/zodiac-stars.js?v=20260825-043203",
  "js/zodiac.js?v=20260825-043203",
  "js/zoompan.js?v=20260825-043203"
];

/* Each file is taken separately rather than in one lot. addAll is all or
 * nothing: a single missing file fails the whole install, the worker never
 * activates, and the visitor is left on whatever stale copy they already had
 * with no way of knowing why. One bad file should cost one bad file. */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (url) {
        return c.add(new Request(url, { cache: 'reload' }))['catch'](function () {
          /* Left out of the copy; the network can still answer for it. */
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

/* Take over open tabs at once, and sweep away every older version's cache. */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf(PREFIX + '-') === 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  /* The city lookup and anything else off this origin is none of our
   * business: let it go to the network and fail on its own terms. */
  if (url.origin !== self.location.origin) return;

  /* A navigation with no network still has to land somewhere, so it lands on
   * the cached page. This is what makes the app open in airplane mode. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)['catch'](function () {
        return caches.match('index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  /* Everything else: serve the copy, and quietly refresh it for next time. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      var live = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      })['catch'](function () { return hit; });
      return hit || live;
    })
  );
});

/* Lets the page tell a waiting worker to take over straight away. */
self.addEventListener('message', function (e) {
  if (e.data === 'skip-waiting') self.skipWaiting();
});
