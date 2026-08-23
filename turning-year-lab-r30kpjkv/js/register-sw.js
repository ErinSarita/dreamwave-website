/* register-sw.js — hands the app over to the service worker.
 *
 * Kept apart from app.js because it is not about the sky at all: it is about
 * the page surviving without a network, and it should be able to fail
 * entirely without taking the wheel down with it.
 *
 * It also has to answer for the awkward side of working offline. Once a copy
 * of the app is on the device, that copy is what opens, and a new version
 * published this morning is invisible until something goes and looks for it.
 * Silently serving yesterday's app to someone who is watching for a change is
 * a bad way to behave, so this checks for one and, when there is one, says so
 * and offers to take it.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  var reg = null;
  var told = false;

  function announce() {
    if (told) return;
    told = true;
    document.documentElement.setAttribute('data-update-ready', '');

    var bar = document.createElement('button');
    bar.className = 'sw-update';
    bar.type = 'button';
    bar.textContent = 'A newer version is ready · tap to load it';
    bar.addEventListener('click', function () {
      /* Tell the waiting worker to take over, then come back on the new copy.
       * Reloading without this would just serve the old files again. */
      if (reg && reg.waiting) reg.waiting.postMessage('skip-waiting');
      setTimeout(function () { location.reload(); }, 120);
    });
    document.body.appendChild(bar);
  }

  function watch(sw) {
    if (!sw) return;
    sw.addEventListener('statechange', function () {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) announce();
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (r) {
      reg = r;
      /* Already waiting from a previous visit. */
      if (r.waiting && navigator.serviceWorker.controller) announce();
      watch(r.installing);
      r.addEventListener('updatefound', function () { watch(r.installing); });

      /* Look for a new version when the app is brought back to the front,
       * which on a phone is the moment someone is most likely to be waiting
       * to see a change they were told about. */
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) r.update()['catch'](function () {});
      });
      /* And once an hour for a window left open all day. */
      setInterval(function () { r.update()['catch'](function () {}); }, 3600000);
    })['catch'](function () { /* no offline copy, everything else still works */ });
  });
})();
