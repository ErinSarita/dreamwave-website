/* render-moon.js — one lunar month as a circle.
 *
 * A lunation runs new moon to new moon, twenty-nine or thirty days, and it
 * does not divide the solar year evenly: that is the whole reason the two
 * calendars have argued for as long as there have been calendars. Drawn on
 * its own the month reads plainly. Day one sits at the top, dark, and the
 * days run clockwise; the lit fraction swells to the full moon at the bottom
 * and drains back to the top again, so the shape of the ring is the shape of
 * the month.
 *
 * The circle is a set of segments, one per day, and each is a door back into
 * the day view.
 */
(function (global) {
  'use strict';
  var MoonGlyph = global.MoonGlyph, TZ = global.TZ;
  var CX = 500, CY = 500;
  var R = {
    hitOut: 486, hitIn: 210,
    dateLabel: 464, dayNum: 430,
    glyph: 390, glyphR: 17,
    illumOut: 352, illumIn: 268,
    eventTick: 262, eventLabel: 246,
    hub: 214
  };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* Keep tangential text the right way up on the lower half of the ring. */
  function tangent(a) { return (a > 90 && a < 270) ? a + 180 : a; }

  function annulus(r1, r2) {
    return 'M' + (CX - r2) + ' ' + CY + 'a' + r2 + ' ' + r2 + ' 0 1 1 ' + (2 * r2) + ' 0' +
           'a' + r2 + ' ' + r2 + ' 0 1 1 ' + (-2 * r2) + ' 0Z' +
           'M' + (CX - r1) + ' ' + CY + 'a' + r1 + ' ' + r1 + ' 0 1 0 ' + (2 * r1) + ' 0' +
           'a' + r1 + ' ' + r1 + ' 0 1 0 ' + (-2 * r1) + ' 0Z';
  }
  function sector(r1, r2, a1, a2) {
    var laf = (a2 - a1) > 180 ? 1 : 0;
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + r2 + ' ' + r2 + ' 0 ' + laf + ' 1 ' +
           f(p2[0]) + ' ' + f(p2[1]) + 'L' + f(p3[0]) + ' ' + f(p3[1]) +
           'A' + r1 + ' ' + r1 + ' 0 ' + laf + ' 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }

  var EVENT_SHORT = {
    'New Moon': 'new', 'First Quarter': 'first quarter',
    'Full Moon': 'full', 'Last Quarter': 'last quarter'
  };

  /* `month` and `days` come from the lunar chain, which knows nothing of
   * solstices, so a month straddling one arrives whole. Days are keyed by date
   * rather than by a solar-cycle day number, since the two ends of such a
   * month sit in different cycles and their numbering is not comparable. */
  function render(month, days, opts) {
    opts = opts || {};
    var tz = opts.tz, N = days.length;
    if (!N) return '';
    var parts = [];
    var step = 360 / N;
    function angleOf(i) { return (i + 0.5) * step; }   // centre of the i-th day

    /* -- ground ---------------------------------------------------------- */
    /* Coloured from CSS rather than inline, because the relationship has to
     * survive both themes: the swell means more light, so it must always read
     * lighter than the ring behind it. Taking the fill from --moon broke that
     * in daylight, where --moon is a dark navy, and the fullest part of the
     * month came out darkest. */
    parts.push('<path class="mb-bg" d="' + annulus(R.illumIn - 6, R.illumOut + 6) +
               '" fill-rule="evenodd"/>');
    /* A baseline at nothing-lit, so the swell is read against something. */
    parts.push('<circle class="mb-base" cx="500" cy="500" r="' + R.illumIn + '" fill="none"/>');

    /* -- the lit fraction, swelling to full and draining back -------------
     * Radius carries illumination, so the band is widest at the full moon.
     * The curve closes through the inner circle so the fill reads as one
     * body of light rather than a stroked line. */
    var wave = [];
    days.forEach(function (d, i) {
      var r = R.illumIn + Math.max(0, Math.min(1, d.moonIllumination)) * (R.illumOut - R.illumIn);
      var p = polar(r, angleOf(i));
      wave.push((i === 0 ? 'M' : 'L') + f(p[0]) + ' ' + f(p[1]));
    });
    var innerRing = 'M' + (CX - R.illumIn) + ' ' + CY +
      'a' + R.illumIn + ' ' + R.illumIn + ' 0 1 0 ' + (2 * R.illumIn) + ' 0' +
      'a' + R.illumIn + ' ' + R.illumIn + ' 0 1 0 ' + (-2 * R.illumIn) + ' 0Z';
    parts.push('<path class="mb-fill" d="' + wave.join('') + 'Z' + innerRing +
               '" fill-rule="evenodd"/>');
    parts.push('<path class="mb-line" d="' + wave.join('') + 'Z" fill="none" ' +
               'stroke-width="1.4" stroke-linejoin="round"/>');

    /* -- one day at a time ------------------------------------------------ */
    days.forEach(function (d, i) {
      var a = angleOf(i);
      var isSel = opts.selectedISO === d.iso;
      var isToday = opts.todayISO === d.iso;

      /* Light the day's own arc of the ring. Running it all the way to the
       * centre as well would put a wash across the hub, where the big face
       * and its caption sit. */
      if (isSel || isToday) {
        parts.push('<path d="' + sector(R.illumIn - 12, R.hitOut, a - step / 2, a + step / 2) +
                   '" fill="' + (isSel ? 'var(--sun)' : 'var(--today)') + '" opacity="' +
                   (isSel ? '.16' : '.10') + '"/>');
        var eR = isSel ? 'var(--sun-bright)' : 'var(--today)';
        var b1 = polar(R.illumIn - 12, a - step / 2), b2 = polar(R.hitOut, a - step / 2);
        var b3 = polar(R.illumIn - 12, a + step / 2), b4 = polar(R.hitOut, a + step / 2);
        parts.push('<path d="M' + f(b1[0]) + ' ' + f(b1[1]) + 'L' + f(b2[0]) + ' ' + f(b2[1]) +
                   'M' + f(b3[0]) + ' ' + f(b3[1]) + 'L' + f(b4[0]) + ' ' + f(b4[1]) +
                   '" stroke="' + eR + '" stroke-width="1" opacity=".5"/>');
      }

      // the face itself
      var g = polar(R.glyph, a);
      parts.push('<g transform="translate(' + f(g[0] - R.glyphR) + ' ' + f(g[1] - R.glyphR) + ')">' +
        '<circle cx="' + R.glyphR + '" cy="' + R.glyphR + '" r="' + R.glyphR +
          '" fill="var(--moon-shadow)"/>' +
        '<path d="' + MoonGlyph.litPath(R.glyphR, R.glyphR, R.glyphR, d.moonAge) +
          '" fill="var(--moon-lit)"/>' +
        '<circle cx="' + R.glyphR + '" cy="' + R.glyphR + '" r="' + R.glyphR +
          '" fill="none" stroke="var(--line)" stroke-width="1"/></g>');

      // calendar date, with the month named only where it turns over
      var cp = TZ.civilParts(tz, d.date);
      var dateTxt = (i === 0 || cp.day === 1)
        ? TZ.MONTHS_SHORT[cp.month - 1] + ' ' + cp.day : String(cp.day);
      var dp = polar(R.dateLabel, a);
      parts.push('<text x="' + f(dp[0]) + '" y="' + f(dp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="12" fill="var(--ink-' + (isSel ? '1' : '2') + ')" ' +
        'transform="rotate(' + f(tangent(a)) + ' ' + f(dp[0]) + ' ' + f(dp[1]) + ')">' +
        esc(dateTxt) + '</text>');

      // where this day sits inside the month
      var np = polar(R.dayNum, a);
      parts.push('<text x="' + f(np[0]) + '" y="' + f(np[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10.5" fill="var(--ink-3)" ' +
        'transform="rotate(' + f(tangent(a)) + ' ' + f(np[0]) + ' ' + f(np[1]) + ')">' +
        d.dayInMonth + '</text>');

      // the four turning points of the month
      if (d.moonEvent) {
        var t1 = polar(R.eventTick, a), t2 = polar(R.eventTick + 16, a);
        parts.push('<path d="M' + f(t1[0]) + ' ' + f(t1[1]) + 'L' + f(t2[0]) + ' ' + f(t2[1]) +
                   '" stroke="var(--sun-bright)" stroke-width="1.6"/>');
        var lp = polar(R.eventLabel, a);
        parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="10.5" fill="var(--sun-bright)" ' +
          'transform="rotate(' + f(tangent(a)) + ' ' + f(lp[0]) + ' ' + f(lp[1]) + ')">' +
          esc(EVENT_SHORT[d.moonEvent] || d.moonEvent) + '</text>');
      }
    });

    /* -- the middle: whichever day is in hand ------------------------------ */
    var focus = null;
    for (var i = 0; i < N; i++) if (days[i].iso === opts.selectedISO) { focus = days[i]; break; }
    if (!focus) for (var j = 0; j < N; j++) if (days[j].iso === opts.todayISO) { focus = days[j]; break; }
    if (!focus) focus = days[Math.floor(N / 2)];

    parts.push('<circle cx="500" cy="500" r="' + R.hub + '" fill="var(--bg)" opacity=".72"/>');
    var BIG = 62;
    parts.push('<g transform="translate(' + (CX - BIG) + ' ' + (CY - BIG - 46) + ')">' +
      '<circle cx="' + BIG + '" cy="' + BIG + '" r="' + BIG + '" fill="var(--moon-shadow)"/>' +
      '<path d="' + MoonGlyph.litPath(BIG, BIG, BIG, focus.moonAge) + '" fill="var(--moon-lit)"/>' +
      '<circle cx="' + BIG + '" cy="' + BIG + '" r="' + BIG +
        '" fill="none" stroke="var(--line)" stroke-width="1.5"/></g>');
    parts.push('<text x="500" y="' + (CY + 46) + '" text-anchor="middle" font-size="26" ' +
      'font-family="var(--mono)" fill="var(--moon)">' +
      Math.round(focus.moonIllumination * 100) + '% lit</text>');
    parts.push('<text x="500" y="' + (CY + 72) + '" text-anchor="middle" font-size="14" ' +
      'fill="var(--ink-2)">' + esc(focus.moonPhaseName) + '</text>');
    parts.push('<text x="500" y="' + (CY + 98) + '" text-anchor="middle" font-size="12" ' +
      'fill="var(--ink-3)">' + esc(TZ.formatDate(tz, focus.date, 'short')) +
      ' &#183; day ' + focus.dayInMonth + ' of ' + N + '</text>');

    /* -- doors back to the day view ---------------------------------------- */
    days.forEach(function (d, i) {
      var a = angleOf(i);
      parts.push('<path class="moon-day-hit" data-iso="' + d.iso + '" d="' +
                 sector(R.hitIn, R.hitOut, a - step / 2, a + step / 2) +
                 '" fill="transparent" style="cursor:pointer"><title>' +
                 esc(TZ.formatDate(tz, d.date)) + ' · ' +
                 Math.round(d.moonIllumination * 100) + '% lit</title></path>');
    });

    return parts.join('');
  }

  global.MoonView = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
