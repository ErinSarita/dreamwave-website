/* register-sw.js — hands the app over to the service worker.
 *
 * Kept apart from app.js because it is not about the sky at all: it is about
 * the page surviving without a network, and it should be able to fail
 * entirely without taking the wheel down with it.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  /* Registered after load so it never competes with first paint. */
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      /* A new version arriving while a tab is open takes effect on the next
       * open rather than swapping files under a running page. */
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            document.documentElement.setAttribute('data-update-ready', '');
          }
        });
      });
    })['catch'](function () { /* no offline copy, everything else still works */ });
  });
})();
