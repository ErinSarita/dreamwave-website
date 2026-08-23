/* render-menses.js — the cycle wheel.
 *
 * Its own circle, the way the lunation has its own, because a cycle is its own
 * turning and deserves to be read on its own terms rather than as a stripe
 * across somebody else's calendar.
 *
 * The rings run inward to outward: the four phases, then the cycle's own day
 * count, then the three outside frames it can be compared against, the moon,
 * the solar day, and the ordinary date. The blueprint hangs day one on a new
 * moon so bleeding sits at the dark and ovulation near the full, which is the
 * old teaching picture. Whether a real cycle does that is the question the
 * wheel exists to let a woman answer for herself.
 */
(function (global) {
  'use strict';
  var TZ = global.TZ, MoonGlyph = global.MoonGlyph, Menses = global.Menses;
  var CX = 500, CY = 500;

  var R = {
    hub: 150,
    phaseIn: 158, phaseOut: 250, phaseLabel: 204,
    /* The hormones sit straight outside the phases, because they are what the
     * phases are. Four quantities in different units share one band, each
     * scaled to its own range: the shapes and their order are the reading, not
     * the heights. */
    hormIn: 258, hormOut: 392,
    dayIn: 400, dayOut: 448, dayNum: 424,
    moonIn: 456, moonOut: 512, moonGlyph: 484
  };

  var HORMONE_COLOUR = {
    oestrogen: '#c96a9a', progesterone: '#7a6bb0', lh: '#d8a13a', fsh: '#4f9ea8'
  };

  var COLOUR = {
    menstrual: '#b8455c', follicular: '#6b9e5a',
    ovulation: '#d8a13a', luteal: '#7a6bb0'
  };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sector(r1, r2, a1, a2) {
    if (a2 - a1 >= 359.99) {
      return 'M' + f(CX - r2) + ' ' + f(CY) +
        'a' + r2 + ' ' + r2 + ' 0 1 0 ' + (r2 * 2) + ' 0' +
        'a' + r2 + ' ' + r2 + ' 0 1 0 ' + (-r2 * 2) + ' 0' +
        'M' + f(CX - r1) + ' ' + f(CY) +
        'a' + r1 + ' ' + r1 + ' 0 1 1 ' + (r1 * 2) + ' 0' +
        'a' + r1 + ' ' + r1 + ' 0 1 1 ' + (-r1 * 2) + ' 0Z';
    }
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    var big = (a2 - a1) > 180 ? 1 : 0;
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) +
      'A' + r2 + ' ' + r2 + ' 0 ' + big + ' 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
      'L' + f(p3[0]) + ' ' + f(p3[1]) +
      'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }
  function tangent(a) { return (a > 90 && a < 270) ? a + 180 : a; }
  function rot(a, x, y) { return 'rotate(' + f(tangent(a)) + ' ' + f(x) + ' ' + f(y) + ')'; }

  /* opts: { length, days } where days[i] is the outside frame for cycle day
   * i+1: { date, moonAge, solarDay } or null when nothing is aligned yet. */
  function render(opts) {
    var n = opts.length || Menses.BLUEPRINT_DAYS;
    var frame = opts.days || [];
    var parts = [];
    var step = 360 / n;
    function edge(i) { return i * step; }
    function mid(i) { return (i + 0.5) * step; }

    /* -- the four phases -------------------------------------------------- */
    Menses.spans(n).forEach(function (s) {
      var a1 = edge(s.from - 1), a2 = edge(s.to);
      parts.push('<path class="mn-phase" data-phase="' + s.phase.key + '" d="' +
        sector(R.phaseIn, R.phaseOut, a1, a2) + '" fill="' + COLOUR[s.phase.key] +
        '" fill-opacity=".34" stroke="' + COLOUR[s.phase.key] +
        '" stroke-width="1" stroke-opacity=".7" style="cursor:pointer"><title>' +
        esc(s.phase.name) + ' · days ' + s.from + ' to ' + s.to +
        ' · tap to read it</title></path>');
      var c = (a1 + a2) / 2, lp = polar(R.phaseLabel, c);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="15" font-family="var(--serif)" ' +
        'fill="' + COLOUR[s.phase.key] + '" pointer-events="none" transform="' +
        rot(c, lp[0], lp[1]) + '">' + esc(s.phase.name) + '</text>');
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1] + 17) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10" fill="var(--ink-3)" ' +
        'pointer-events="none" transform="' + rot(c, lp[0], lp[1] + 17) + '">' +
        s.from + '–' + s.to + '</text>');
    });

    /* -- the hormones ------------------------------------------------------ */
    parts.push('<path d="' + sector(R.hormIn, R.hormOut, 0, 360) +
      '" fill="var(--bg-2)" fill-opacity=".4" stroke="var(--line-soft)" stroke-width=".8"/>');
    [0.25, 0.5, 0.75].forEach(function (fr) {
      var rr = R.hormIn + (R.hormOut - R.hormIn) * fr;
      parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + f(rr) + '" fill="none" ' +
        'stroke="var(--line-soft)" stroke-width=".4" opacity=".4" ' +
        'stroke-dasharray="2 5" pointer-events="none"/>');
    });
    Menses.CURVE_ORDER.forEach(function (key) {
      var d = '';
      for (var t = 0; t <= n * 4; t++) {
        var day = 1 + (t / 4);
        if (day > n + 1) break;
        var v = Math.max(0, Math.min(1, Menses.levelAt(key, Math.min(day, n), n)));
        var rr = R.hormIn + (R.hormOut - R.hormIn) * v;
        var q = polar(rr, ((day - 1) / n) * 360);
        d += (t ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
      }
      parts.push('<path d="' + d + '" fill="none" stroke="' + HORMONE_COLOUR[key] +
        '" stroke-width="2" opacity=".92" pointer-events="none"/>');
      /* A two-pixel line is nothing to aim at, so the target is a wide
       * invisible stroke laid over the same path. */
      parts.push('<path class="mn-horm" data-horm="' + key + '" d="' + d +
        '" fill="none" stroke="transparent" stroke-width="16" ' +
        'style="cursor:pointer"><title>' + esc(Menses.CURVE_LABEL[key]) +
        ' · tap to read it</title></path>');
    });

    /* -- the cycle's own days --------------------------------------------- */
    parts.push('<path d="' + sector(R.dayIn, R.dayOut, 0, 360) +
      '" fill="var(--bg-2)" fill-opacity=".5" stroke="var(--line-soft)" stroke-width=".8"/>');
    for (var i = 0; i < n; i++) {
      var a1 = edge(i), a2 = edge(i + 1), m = mid(i);
      parts.push('<path class="mn-day" data-day="' + (i + 1) + '" d="' +
        sector(R.dayIn, R.dayOut, a1, a2) + '" fill="transparent" ' +
        'stroke="var(--line-soft)" stroke-width=".5" style="cursor:pointer"/>');
      var q = polar(R.dayNum, m);
      parts.push('<text x="' + f(q[0]) + '" y="' + f(q[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="14" font-family="var(--serif)" ' +
        'fill="var(--ink)" pointer-events="none" transform="' + rot(m, q[0], q[1]) + '">' +
        (i + 1) + '</text>');
    }

    /* -- the moon it is being read against -------------------------------- */
    parts.push('<path d="' + sector(R.moonIn, R.moonOut, 0, 360) +
      '" fill="var(--panel)" fill-opacity=".45" stroke="var(--line-soft)" stroke-width=".8"/>');
    for (i = 0; i < n; i++) {
      var fr = frame[i];
      var age = fr && fr.moonAge !== undefined ? fr.moonAge : (360 * i / n);
      var mq = polar(R.moonGlyph, mid(i));
      var note = Menses.moonNoteAt(age);
      parts.push('<path class="mn-moon" data-moon="' + note.key + '" d="' +
        sector(R.moonIn, R.moonOut, edge(i), edge(i + 1)) + '" fill="transparent" ' +
        'style="cursor:pointer"><title>' + esc(note.name) +
        ' · tap to read the moon on its own</title></path>');
      parts.push('<g transform="translate(' + f(mq[0] - 11) + ' ' + f(mq[1] - 11) + ')" ' +
        'pointer-events="none">' + MoonGlyph.svg(age, 22) + '</g>');
    }

    /* No calendar rings. Real dates and solar days would make this look like
     * a record of somebody's cycle, and it is an example: a shape to read your
     * own against. They belong here once there are days logged to hang them on.
     */

    /* -- the middle -------------------------------------------------------- */
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R.hub +
      '" fill="var(--bg)" opacity=".82"/>');
    parts.push('<g id="mn-hub"></g>');
    parts.push('<path id="mn-sel" d="" fill="var(--ink)" fill-opacity=".13" ' +
      'stroke="var(--ink)" stroke-width="1" stroke-opacity=".55" opacity="0" ' +
      'pointer-events="none"/>');

    return { svg: parts.join(''), length: n };
  }

  /* The middle of the wheel, redrawn without rebuilding the rings. */
  function hub(lines) {
    var out = '', y = CY - 46;
    lines.forEach(function (l) {
      out += '<text x="' + CX + '" y="' + y + '" text-anchor="middle" ' +
        'font-size="' + l.size + '" ' +
        (l.serif ? 'font-family="var(--serif)" ' : '') +
        (l.mono ? 'font-family="var(--mono)" ' : '') +
        'fill="' + (l.colour || 'var(--ink-2)') + '">' + esc(l.text) + '</text>';
      y += l.gap || 24;
    });
    return out;
  }

  function highlight(root, day, n) {
    var el = root.querySelector('#mn-sel');
    if (!el) return;
    if (!day) { el.setAttribute('opacity', '0'); return; }
    var step = 360 / n;
    el.setAttribute('d', sector(R.phaseIn - 6, R.moonOut + 5, (day - 1) * step, day * step));
    el.setAttribute('opacity', '.9');
  }

  global.MensesView = { render: render, hub: hub, highlight: highlight,
    COLOUR: COLOUR, HORMONE_COLOUR: HORMONE_COLOUR, R: R };
})(typeof window !== 'undefined' ? window : globalThis);
