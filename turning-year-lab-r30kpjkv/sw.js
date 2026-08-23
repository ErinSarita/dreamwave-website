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
var VERSION = '20260823-233208';
var PREFIX = 'ty-lab';          /* deploy.sh rewrites this for the lab */
var CACHE = PREFIX + '-' + VERSION;

var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "js/app.js",
  "js/astro-moon.js",
  "js/astro-riseset.js",
  "js/astro-sun.js",
  "js/astro.js",
  "js/body.js",
  "js/clock.js",
  "js/cycle.js",
  "js/features.js",
  "js/globe.js",
  "js/lunar.js",
  "js/menses.js",
  "js/moon-glyph.js",
  "js/orrery.js",
  "js/places.js",
  "js/planets.js",
  "js/pregnancy.js",
  "js/register-sw.js",
  "js/render-day.js",
  "js/render-menses.js",
  "js/render-month.js",
  "js/render-moon.js",
  "js/render-pregnancy.js",
  "js/render-wheel.js",
  "js/spiral.js",
  "js/stars.js",
  "js/timezone.js",
  "js/zodiac.js",
  "js/zoompan.js"
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
