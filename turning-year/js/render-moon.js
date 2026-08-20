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
  var MoonGlyph = global.MoonGlyph, TZ = global.TZ, A = global.Astro;
  var CX = 500, CY = 500;
  var R = {
    /* Outermost is the solar reckoning, since it is the frame the rest is
     * being compared against: the day of the year on the rim, the ordinary
     * date beneath it, in one banded ring divided at every local midnight. */
    solarOut: 500, solarNum: 487, solarIn: 475,
    dateOut: 473, dateLabel: 461, dateIn: 449,
    /* Then the lunar reckoning: its number, and how long that lunar day runs. */
    lunNum: 436, lunHours: 418,
    hitOut: 448, hitIn: 196,
    /* The face rides in and out with the moon's distance as well as swelling,
     * the way the year wheel's moon ring does. */
    glyphBase: 370, glyphSwing: 17,
    illumOut: 330, illumIn: 250,
    eventTick: 244, eventLabel: 228,
    hub: 200
  };
  /* How far the glyph is allowed to swell and shrink with distance. The real
   * change in the moon's apparent width between perigee and apogee is about
   * 14 per cent, which at this size is a pixel and a half and invisible, so
   * it is drawn at roughly four times that. Stated in the About, because an
   * exaggerated scale that is not declared is just a wrong one. */
  var GLYPH_MIN = 12, GLYPH_MAX = 20;
  var PERIGEE = 356500, APOGEE = 406700;

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

    /* Angle carries elapsed time, not elongation. A lunar day is always the
     * same twelve degrees of the moon's travel, but it takes anywhere from 20
     * to 27 hours to cross them, because the moon runs faster when it is
     * nearer the Earth. Drawing the segments equal hid that entirely. Drawn
     * to their real durations, a short lunar day is visibly pinched and a
     * long one broad, and the ring becomes a clock of the whole lunation. */
    var t0 = days[0].startJD, span = days[N - 1].endJD - t0;
    function angAt(jd) { return 360 * (jd - t0) / span; }
    /* Kept for the running clock, which redraws its hand between renders and
     * needs the same mapping from an instant to an angle on this wheel. */
    global.MoonView.frame = { t0: t0, span: span, k: month.k };
    function edgeIn(i)  { return angAt(days[i].startJD); }
    function edgeOut(i) { return angAt(days[i].endJD); }
    function angleOf(i) { return (edgeIn(i) + edgeOut(i)) / 2; }

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

    /* -- the calendar ring, laid against the lunar one ---------------------
     * The whole point of the view is that the two reckonings do not divide
     * into one another, so both are drawn on the same clock face and left to
     * disagree. This outer band is the ordinary calendar: a tick at every
     * local midnight, with the date sitting in the middle of its own day.
     * Because both rings are drawn to real elapsed time they line up exactly
     * in the only way they can, by the clock, and the sliding is visible.
     *
     * A short lunar day that opens and closes without crossing a midnight is
     * the kshaya case, and here you can see it happen. */
    var mids = [];
    (function () {
      var p0 = TZ.civilParts(tz, A.dateFromJD(t0));
      var cur = TZ.startOfDay(tz, p0.year, p0.month, p0.day);
      var guard = 0;
      while (A.jdFromDate(cur) < t0 && guard++ < 40) {
        var cp = TZ.civilParts(tz, cur);
        cur = TZ.startOfDay(tz, cp.year, cp.month, cp.day + 1);
      }
      guard = 0;
      while (A.jdFromDate(cur) < t0 + span && guard++ < 40) {
        mids.push(cur);
        var c2 = TZ.civilParts(tz, cur);
        cur = TZ.startOfDay(tz, c2.year, c2.month, c2.day + 1);
      }
    })();

    /* Two bands, each one flat colour with its own dividers, rather than one
     * band with alternating wedges: a wash that changes every segment reads as
     * data when it is only striping. The solar day and the ordinary date do
     * always fall on the same midnights, being the same civil day counted two
     * ways, so their dividers coincide exactly. Drawing them as separate rings
     * shows that agreement rather than assuming it, and leaves the lunar band
     * below as the only one that slides. */
    parts.push('<path class="solar-band" d="' + annulus(R.solarIn, R.solarOut) +
               '" fill-rule="evenodd"/>');
    parts.push('<path class="date-band" d="' + annulus(R.dateIn, R.dateOut) +
               '" fill-rule="evenodd"/>');

    for (var mi = 0; mi <= mids.length; mi++) {
      var from = mi === 0 ? 0 : angAt(A.jdFromDate(mids[mi - 1]));
      var to = mi === mids.length ? 360 : angAt(A.jdFromDate(mids[mi]));
      if (to - from < 4) continue;                 // no room to write in
      var when = mi === 0 ? A.dateFromJD(t0) : mids[mi - 1];
      var cp2 = TZ.civilParts(tz, when);
      var iso2 = TZ.formatDate(tz, when, 'iso');
      var mid = (from + to) / 2;

      var sn = opts.solarDayFor ? opts.solarDayFor(iso2) : null;
      if (sn) {
        var sp3 = polar(R.solarNum, mid);
        parts.push('<text class="cal-solar" x="' + f(sp3[0]) + '" y="' + f(sp3[1]) +
          '" text-anchor="middle" dominant-baseline="middle" transform="rotate(' +
          f(tangent(mid)) + ' ' + f(sp3[0]) + ' ' + f(sp3[1]) + ')">' + sn + '</text>');
      }
      var txt = (mi === 0 || cp2.day === 1)
        ? TZ.MONTHS_SHORT[cp2.month - 1] + ' ' + cp2.day : String(cp2.day);
      var lp2 = polar(R.dateLabel, mid);
      parts.push('<text class="cal-date" x="' + f(lp2[0]) + '" y="' + f(lp2[1]) +
        '" text-anchor="middle" dominant-baseline="middle" transform="rotate(' +
        f(tangent(mid)) + ' ' + f(lp2[0]) + ' ' + f(lp2[1]) + ')">' + esc(txt) + '</text>');
    }
    // each band keeps its own dividers, drawn in its own colour
    mids.forEach(function (m) {
      var a = angAt(A.jdFromDate(m));
      var s1 = polar(R.solarIn, a), s2 = polar(R.solarOut, a);
      parts.push('<path class="solar-tick" d="M' + f(s1[0]) + ' ' + f(s1[1]) +
                 'L' + f(s2[0]) + ' ' + f(s2[1]) + '"/>');
      var d1 = polar(R.dateIn, a), d2 = polar(R.dateOut, a);
      parts.push('<path class="date-tick" d="M' + f(d1[0]) + ' ' + f(d1[1]) +
                 'L' + f(d2[0]) + ' ' + f(d2[1]) + '"/>');
    });

    /* -- one day at a time ------------------------------------------------ */
    days.forEach(function (d, i) {
      var a = angleOf(i);
      var isSel = opts.selectedISO === d.iso;
      var isToday = opts.todayISO === d.iso;

      /* Light the day's own arc of the ring. Running it all the way to the
       * centre as well would put a wash across the hub, where the big face
       * and its caption sit. */
      if (isSel || isToday) {
        parts.push('<path d="' + sector(R.illumIn - 12, R.hitOut, edgeIn(i), edgeOut(i)) +
                   '" fill="' + (isSel ? 'var(--sun)' : 'var(--today)') + '" opacity="' +
                   (isSel ? '.16' : '.10') + '"/>');
        var eR = isSel ? 'var(--sun-bright)' : 'var(--today)';
        var b1 = polar(R.illumIn - 12, edgeIn(i)), b2 = polar(R.hitOut, edgeIn(i));
        var b3 = polar(R.illumIn - 12, edgeOut(i)), b4 = polar(R.hitOut, edgeOut(i));
        parts.push('<path d="M' + f(b1[0]) + ' ' + f(b1[1]) + 'L' + f(b2[0]) + ' ' + f(b2[1]) +
                   'M' + f(b3[0]) + ' ' + f(b3[1]) + 'L' + f(b4[0]) + ' ' + f(b4[1]) +
                   '" stroke="' + eR + '" stroke-width="1" opacity=".5"/>');
      }

      /* The face is drawn at a size that follows the moon's distance, near
       * and large at perigee, far and small at apogee. It is the same
       * quantity that makes this lunar day short or long, so cause and effect
       * sit side by side: the widest segments carry the smallest faces. */
      var near = Math.max(0, Math.min(1, (APOGEE - (d.moonDistanceKm || 384400)) / (APOGEE - PERIGEE)));
      var gr = GLYPH_MIN + near * (GLYPH_MAX - GLYPH_MIN);
      /* Nearer the Earth is drawn nearer the centre, the same way the year
       * wheel draws it, so the face swings in and out over the month as well
       * as swelling. Two readings of one quantity, which is what makes an
       * eight-pixel change legible at a glance. */
      var g = polar(R.glyphBase + (0.5 - near) * 2 * R.glyphSwing, a);
      parts.push('<g transform="translate(' + f(g[0] - gr) + ' ' + f(g[1] - gr) + ')">' +
        '<circle cx="' + f(gr) + '" cy="' + f(gr) + '" r="' + f(gr) + '" fill="var(--moon-shadow)"/>' +
        '<path d="' + MoonGlyph.litPath(gr, gr, gr, d.moonAge) + '" fill="var(--moon-lit)"/>' +
        '<circle cx="' + f(gr) + '" cy="' + f(gr) + '" r="' + f(gr) +
          '" fill="none" stroke="var(--line)" stroke-width="1"/></g>');

      /* The date is no longer written per lunar day: it lives on the calendar
       * ring outside, at its own real position, which is the whole point of
       * drawing the two against each other. */
      // a divider at each lunar day boundary, so the segments read as wedges
      var v1 = polar(R.hitIn + 6, edgeIn(i)), v2 = polar(R.hitOut, edgeIn(i));
      parts.push('<path class="lun-tick" d="M' + f(v1[0]) + ' ' + f(v1[1]) +
                 'L' + f(v2[0]) + ' ' + f(v2[1]) + '"/>');

      // how long this lunar day runs, which is the thing the width is showing
      if (d.hours) {
        var hp = polar(R.lunHours, a);
        parts.push('<text class="lun-hours" x="' + f(hp[0]) + '" y="' + f(hp[1]) +
          '" text-anchor="middle" dominant-baseline="middle" transform="rotate(' +
          f(tangent(a)) + ' ' + f(hp[0]) + ' ' + f(hp[1]) + ')">' +
          d.hours.toFixed(1) + 'h</text>');
      }

      // where this lunar day sits in the lunation
      var np = polar(R.lunNum, a);
      parts.push('<text x="' + f(np[0]) + '" y="' + f(np[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10.5" fill="var(--ink-3)" ' +
        'transform="rotate(' + f(tangent(a)) + ' ' + f(np[0]) + ' ' + f(np[1]) + ')">' +
        d.dayInMonth + '</text>');

    });

    /* -- the eight phases -------------------------------------------------
     * Four instants and four stretches. New, the two quarters and full are
     * moments the moon passes through, and are marked where they truly fall
     * rather than at the centre of whichever lunar day holds them, which for
     * new and full was half a day out. The crescents and gibbous are not
     * instants at all: each is marked at the middle of its own stretch, where
     * the moon looks most like the thing it is named for. */
    (opts.phaseMarks || []).forEach(function (pm) {
      var pa = angAt(pm.jd);
      if (pa < 0 || pa > 360) return;
      var t1 = polar(R.eventTick, pa), t2 = polar(R.eventTick + (pm.turning ? 18 : 11), pa);
      parts.push('<path class="ph-tick' + (pm.turning ? ' is-turn' : '') + '" d="M' +
                 f(t1[0]) + ' ' + f(t1[1]) + 'L' + f(t2[0]) + ' ' + f(t2[1]) + '"/>');
      var lp = polar(R.eventLabel, pa);
      parts.push('<text class="ph-label' + (pm.turning ? ' is-turn' : '') + '" x="' + f(lp[0]) +
        '" y="' + f(lp[1]) + '" text-anchor="middle" dominant-baseline="middle" ' +
        'transform="rotate(' + f(tangent(pa)) + ' ' + f(lp[0]) + ' ' + f(lp[1]) + ')">' +
        esc(pm.label) + '</text>');
    });

    /* -- nearest and furthest --------------------------------------------
     * Marked on the face ring, because that ring is already carrying distance
     * in its size and its orbit; these name the two turning points of it. They
     * sit wherever they fall, which is not the same phase each month: the
     * distance cycle is the anomalistic month of 27.55 days and the lunation
     * is 29.53, so the pair walks backwards through the month. */
    (opts.apsides || []).forEach(function (ap) {
      var aa = angAt(ap.jd);
      if (aa < 0 || aa > 360) return;
      var near = ap.kind === 'perigee';
      var r0 = R.glyphBase - R.glyphSwing - 22, r1 = R.glyphBase + R.glyphSwing + 22;
      var m1 = polar(r0, aa), m2 = polar(r1, aa);
      parts.push('<path class="apsis-tick' + (near ? ' is-near' : '') + '" d="M' +
                 f(m1[0]) + ' ' + f(m1[1]) + 'L' + f(m2[0]) + ' ' + f(m2[1]) + '"/>');
      var lp3 = polar(r0 - 12, aa);
      parts.push('<text class="apsis-label' + (near ? ' is-near' : '') + '" x="' + f(lp3[0]) +
        '" y="' + f(lp3[1]) + '" text-anchor="middle" dominant-baseline="middle" ' +
        'transform="rotate(' + f(tangent(aa)) + ' ' + f(lp3[0]) + ' ' + f(lp3[1]) + ')">' +
        ap.kind + ' ' + Math.round(ap.km).toLocaleString() + ' km</text>');
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
      ' &#183; lunar day ' + focus.dayInMonth + ' of ' + N + '</text>');

    parts.push('<g id="moon-clock"></g>');

    /* -- doors back to the day view ---------------------------------------- */
    days.forEach(function (d, i) {
      var a = angleOf(i);
      parts.push('<path class="moon-day-hit" data-iso="' + d.iso + '" d="' +
                 sector(R.hitIn, R.hitOut, edgeIn(i), edgeOut(i)) +
                 '" fill="transparent" style="cursor:pointer"><title>' +
                 'Lunar day ' + d.dayInMonth + ' of ' + N + ' (tithi) · opens ' +
                 esc(TZ.formatDate(tz, d.date)) + ' · ' +
                 Math.round(d.moonIllumination * 100) + '% lit</title></path>');
    });

    return parts.join('');
  }

  /* The running clock in the hub, and the hand out on the wheel.
   *
   * The hand only appears when this instant falls inside the lunation on
   * screen, since a hand pointing at a moment the wheel does not cover would
   * be pointing at nothing. The countdown shows regardless: it is a clock, and
   * a clock tells you the time wherever you happen to be looking. */
  function clock(info, opts) {
    var p = [], frac = Math.max(0, Math.min(1, info.fraction));
    /* Counting up by default. An uneven day argues for a countdown, since
     * five hours in reads differently in a 20-hour day than a 27-hour one,
     * but a clock that counts down is a timer. Time is read as it gathers. */
    var elapsed = Math.max(0, info.hours * 3600000 - info.msRemaining);
    var ms = opts.countdown ? Math.max(0, info.msRemaining) : elapsed;
    var ss = Math.floor(ms / 1000);
    var hh = Math.floor(ss / 3600), mm = Math.floor(ss % 3600 / 60);
    function pad(v) { return (v < 10 ? '0' : '') + v; }
    var count = pad(hh) + ':' + pad(mm) + ':' + pad(ss % 60);
    var word = opts.countdown ? 'left of' : 'into';

    if (opts.onThisWheel) {
      var a = opts.angle;
      var q1 = polar(R.hub + 5, a), q2 = polar(R.hitOut, a);
      p.push('<line x1="' + f(q1[0]) + '" y1="' + f(q1[1]) + '" x2="' + f(q2[0]) +
             '" y2="' + f(q2[1]) + '" stroke="var(--today)" stroke-width="2" ' +
             'stroke-linecap="round" opacity=".85"/>');
      p.push('<circle cx="' + f(q2[0]) + '" cy="' + f(q2[1]) + '" r="4.5" fill="var(--today)"/>');
    }

    p.push('<rect id="moon-clock-hit" x="' + (CX - 92) + '" y="' + (CY + 122) + '" width="184" ' +
           'height="66" fill="transparent" style="cursor:pointer"><title>' +
           (opts.countdown ? 'Counting down to the next lunar day. Click to count up.'
                           : 'Counting up from the start of this lunar day. Click to count down.') +
           '</title></rect>');
    p.push('<line x1="' + (CX - 84) + '" y1="' + (CY + 114) + '" x2="' + (CX + 84) +
           '" y2="' + (CY + 114) + '" stroke="var(--line-soft)" stroke-width="1"/>');
    p.push('<text x="' + CX + '" y="' + (CY + 144) + '" text-anchor="middle" font-size="24" ' +
           'font-family="var(--mono)" fill="var(--moon)">' + count + '</text>');
    p.push('<text x="' + CX + '" y="' + (CY + 166) + '" text-anchor="middle" font-size="11" ' +
           'fill="var(--ink-3)">' + word + ' lunar day ' + info.n + ' of 30</text>');

    if (opts.onThisWheel) {
      p.push('<rect x="' + (CX - 70) + '" y="' + (CY + 177) + '" width="140" height="3" ' +
             'rx="1.5" fill="var(--line)"/>');
      p.push('<rect x="' + (CX - 70) + '" y="' + (CY + 177) + '" width="' + f(140 * frac) +
             '" height="3" rx="1.5" fill="var(--moon)"/>');
    } else {
      p.push('<text x="' + CX + '" y="' + (CY + 184) + '" text-anchor="middle" font-size="10.5" ' +
             'fill="var(--ink-3)" opacity=".8">now falls outside this lunation</text>');
    }
    return p.join('');
  }

  global.MoonView = { render: render, clock: clock, frame: null };
})(typeof window !== 'undefined' ? window : globalThis);
