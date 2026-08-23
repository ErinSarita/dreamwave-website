/* zoompan.js — pinch/scroll/drag zoom for the wheel and day-clock svgs,
 * layered on top of (not replacing) the existing year/season/day framing.
 * That framing lives on the #wheel group's own transform; this controller
 * owns a separate transform on the <svg> element itself, so the two never
 * fight over the same style property.
 */
(function (global) {
  'use strict';

  var MIN = 1, MAX = 4;

  /* Attaches zoom/pan to `svgEl` (gestures captured on `hostEl`, normally the
   * same element or an ancestor that won't get replaced by re-renders).
   * Returns { zoomIn, zoomOut, reset, refresh, destroy }. `refresh()` should
   * be called after the svg's content is rebuilt, since a fresh render
   * doesn't itself reset the user's zoom — only navigating away does. */
  function attach(svgEl, hostEl) {
    var scale = 1, tx = 0, ty = 0;
    var pointers = {};             // active pointer id -> {x, y}
    var pinchStartDist = null, pinchStartScale = null;
    var dragLast = null;

    function apply() {
      svgEl.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) +
        'px) scale(' + scale.toFixed(3) + ')';
      hostEl.classList.toggle('is-zoomed', scale > 1.01);
    }

    function clampPan() {
      var rect = svgEl.getBoundingClientRect();
      var slack = Math.max(rect.width, rect.height) * (scale - 1) / 2 + 20;
      tx = Math.max(-slack, Math.min(slack, tx));
      ty = Math.max(-slack, Math.min(slack, ty));
    }

    function zoomAt(factor, cx, cy) {
      var rect = svgEl.getBoundingClientRect();
      var mx = cx - (rect.left + rect.width / 2), my = cy - (rect.top + rect.height / 2);
      var next = Math.max(MIN, Math.min(MAX, scale * factor));
      var actual = next / scale;
      // Keep the point under the cursor/fingers visually fixed while scaling.
      tx = mx - (mx - tx) * actual;
      ty = my - (my - ty) * actual;
      scale = next;
      if (scale <= MIN) { scale = MIN; tx = 0; ty = 0; }
      clampPan();
      apply();
    }

    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function onWheel(e) {
      e.preventDefault();
      var factor = Math.pow(1.0018, -e.deltaY);
      zoomAt(factor, e.clientX, e.clientY);
    }
    function onPointerDown(e) {
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        // Starting a pinch: capture both fingers so the gesture survives a
        // finger sliding past the element's edge.
        ids.forEach(function (id) { try { hostEl.setPointerCapture(+id); } catch (err) {} });
        pinchStartDist = dist(pointers[ids[0]], pointers[ids[1]]);
        pinchStartScale = scale;
      } else if (ids.length === 1 && scale > 1.01) {
        // Panning an already-zoomed view: capture so the drag continues
        // smoothly even if the finger moves past the element's edge.
        try { hostEl.setPointerCapture(e.pointerId); } catch (err) {}
        dragLast = { x: e.clientX, y: e.clientY };
      }
      // A plain single-finger touch on the unzoomed view is left uncaptured
      // entirely, so it can still become a normal tap/click on whatever is
      // underneath — a day sector, the note button — instead of being
      // swallowed by capture before it gets there. This was the actual bug:
      // capturing on every touch broke tapping to select a day on iOS Safari.
    }
    function onPointerMove(e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinchStartDist) {
        e.preventDefault();      // stop iOS from also trying to zoom the page underneath
        var d = dist(pointers[ids[0]], pointers[ids[1]]);
        var mid = { x: (pointers[ids[0]].x + pointers[ids[1]].x) / 2,
                    y: (pointers[ids[0]].y + pointers[ids[1]].y) / 2 };
        var target = pinchStartScale * (d / pinchStartDist);
        zoomAt(target / scale, mid.x, mid.y);
      } else if (ids.length === 1 && dragLast) {
        e.preventDefault();      // stop the page from scrolling under the drag
        tx += e.clientX - dragLast.x;
        ty += e.clientY - dragLast.y;
        dragLast = { x: e.clientX, y: e.clientY };
        clampPan();
        apply();
      }
    }
    function onPointerUp(e) {
      delete pointers[e.pointerId];
      var ids = Object.keys(pointers);
      if (ids.length < 2) pinchStartDist = null;
      if (ids.length === 1) dragLast = { x: pointers[ids[0]].x, y: pointers[ids[0]].y };
      else dragLast = null;
    }
    function onDblClick(e) {
      if (scale > 1.01) { scale = 1; tx = 0; ty = 0; apply(); }
      else zoomAt(2, e.clientX, e.clientY);
    }
    // Safari (uniquely) recognises a two-finger pinch as its own proprietary
    // gesture and, on top of whatever Pointer Events fire, may still try to
    // zoom the whole page with it unless these are explicitly blocked —
    // touch-action: none alone doesn't reliably stop it. Harmless no-ops in
    // every other browser, which never fires these events at all.
    function preventGesture(e) { e.preventDefault(); }

    hostEl.addEventListener('wheel', onWheel, { passive: false });
    hostEl.addEventListener('pointerdown', onPointerDown, { passive: false });
    hostEl.addEventListener('pointermove', onPointerMove, { passive: false });
    hostEl.addEventListener('pointerup', onPointerUp);
    hostEl.addEventListener('pointercancel', onPointerUp);
    hostEl.addEventListener('dblclick', onDblClick);
    hostEl.addEventListener('gesturestart', preventGesture);
    hostEl.addEventListener('gesturechange', preventGesture);

    return {
      zoomIn: function () { var r = svgEl.getBoundingClientRect();
        zoomAt(1.4, r.left + r.width / 2, r.top + r.height / 2); },
      zoomOut: function () { var r = svgEl.getBoundingClientRect();
        zoomAt(1 / 1.4, r.left + r.width / 2, r.top + r.height / 2); },
      reset: function () { scale = 1; tx = 0; ty = 0; apply(); },
      refresh: apply,
      isZoomed: function () { return scale > 1.01; },
      destroy: function () {
        hostEl.removeEventListener('wheel', onWheel);
        hostEl.removeEventListener('pointerdown', onPointerDown);
        hostEl.removeEventListener('pointermove', onPointerMove);
        hostEl.removeEventListener('pointerup', onPointerUp);
        hostEl.removeEventListener('pointercancel', onPointerUp);
        hostEl.removeEventListener('dblclick', onDblClick);
        hostEl.removeEventListener('gesturestart', preventGesture);
        hostEl.removeEventListener('gesturechange', preventGesture);
      }
    };
  }

  global.ZoomPan = { attach: attach };
})(typeof window !== 'undefined' ? window : globalThis);
