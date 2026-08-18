/* moon-glyph.js — a small inline SVG disc showing the actual lit shape of the
 * moon (crescent, quarter, gibbous, full) rather than just a percentage. The
 * terminator is drawn as two arcs: a fixed half-circle on the side that's
 * "anchored" (right while waxing, left while waning) and an ellipse arc whose
 * width tracks how far through that half-cycle the phase is.
 */
(function (global) {
  'use strict';

  /* Path for the lit region of a disc of radius r centred at (cx, cy), given
   * age in degrees (0 = new, 180 = full, 360 = new again). */
  function litPath(cx, cy, r, ageDeg) {
    var p = (((ageDeg % 360) + 360) % 360) / 360;      // 0..1 through the cycle
    var waxing = p < 0.5;
    var theta = (waxing ? p : p - 0.5) * 2 * Math.PI;   // 0..π within this half
    var a = r * Math.cos(theta);                        // +r..-r
    var top = cx + ' ' + (cy - r), bottom = cx + ' ' + (cy + r);
    var arc1Sweep = waxing ? 1 : 0;                      // fixed side: right if waxing
    var arc2Sweep = a >= 0 ? 0 : 1;                      // ellipse bulge: right if a>=0
    var rx = Math.abs(a);
    return 'M' + top +
           'A' + r + ' ' + r + ' 0 0 ' + arc1Sweep + ' ' + bottom +
           'A' + rx + ' ' + r + ' 0 0 ' + arc2Sweep + ' ' + top + 'Z';
  }

  /* Inline <svg> markup for a moon glyph, sized in CSS pixels. Colours are
   * left as CSS custom properties so it follows the active theme. */
  function svg(ageDeg, size, opts) {
    opts = opts || {};
    var r = 17, cx = 20, cy = 20;
    var lit = opts.lit || 'var(--moon)';
    var dark = opts.dark || 'var(--moon-dim)';
    var ring = opts.ring || 'var(--line)';
    return '<svg class="moon-glyph" width="' + size + '" height="' + size +
      '" viewBox="0 0 40 40" aria-hidden="true" style="vertical-align:-22%">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + dark + '"/>' +
      '<path d="' + litPath(cx, cy, r, ageDeg) + '" fill="' + lit + '"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + ring + '" stroke-width="1"/>' +
      '</svg>';
  }

  global.MoonGlyph = { svg: svg, litPath: litPath };
})(typeof window !== 'undefined' ? window : globalThis);
