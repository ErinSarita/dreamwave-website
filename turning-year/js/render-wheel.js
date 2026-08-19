/* render-wheel.js — the year ring, and the zoom into one season.
 * Geometry lives in a 1000x1000 viewBox with the wheel centred at (500, 500).
 * Angles run clockwise from the top, where day 1 (the winter solstice) sits.
 */
(function (global) {
  'use strict';
  var TZ = global.TZ, A = global.Astro, Stars = global.Stars, MoonGlyph = global.MoonGlyph;

  var CX = 500, CY = 500;
  var R = {
    /* The eight-wedge ring outside everything: one piece per span from a
     * station to the next, carrying that station's wording. It has to stop
     * short of 532, where the Dipper glyphs begin. */
    ringOut: 530, ringIn: 484,
    /* Pulled in from 493/509/523: a long tangential label bulges outward at
     * its corners, roughly w squared over 8R, which for the two-hundred-pixel
     * sub line is another ten on top of its own height. That was carrying it
     * to 541, under the Dipper glyphs at 532. */
    stationDay: 488, stationLabel: 502, subDy: 13, stationGlyph: 458, stationTick0: 422, stationTick1: 444,
    skyClock: 600, skyClockR: 68,
    /* The calendar months sit directly outside the lunar ones, so the two
     * kinds of month can be read against each other: twelve of ours, ruled
     * off at arbitrary lengths, against twelve or thirteen of the moon's,
     * ruled off by the moon. Neither divides the year and they never agree.
     *
     * Further out, the twenty-four solar terms and then the eight seasons,
     * which belong together because both cut the year by the sun's own
     * longitude, one finer than the other. */
    termOut: 446, termIn: 420, termNum: 437, termName: 427,
    monthOut: 282, monthIn: 260, monthLabel: 271,
    /* Tall enough to hold the station marks as well as its own wording: the
     * glyph sits at 458 and the season name at 464, so the band has to span
     * roughly 449 to 472 before either touches a rim. The station names sit
     * outside at 492 and still clear the Dipper glyphs at 532. */
    seasonOut: 476, seasonIn: 447, seasonLabel: 463,
    bandOut: 418, bandIn: 284,
    moonRing: 240, moonR: 1.95, moonSwing: 11,
    moonPieIn: 224, moonPieOut: 257, moonNumR: 217, moonSeasonR: 205,
    /* The moon band's reach for a tap, which has to be wider than the band it
     * draws. Its two labels hang below the wedge, "Moon 1" centred at 217 and
     * the seasonal line at 205, so between them they occupy about 201 to 223:
     * entirely outside the drawn wedge, and therefore over the day sector,
     * which was catching every tap aimed at a moon's own name. Reaching down
     * to 199 covers both while staying clear of the solar-term labels at 197. */
    moonHitIn: 199,
    decOut: 138, decZero: 100, decIn: 62,
    frostOut: 175, frostIn: 165,
    noteMark: 157,
    hitIn: 150, hitOut: 462
  };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function fmt(n) { return Math.round(n * 100) / 100; }
  function arcSweep(a1, a2) { return (a2 - a1) % 360 > 180 ? 1 : 0; }

  /* Annular sector path. */
  function sector(r1, r2, a1, a2) {
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    var laf = arcSweep(a1, a2);
    return 'M' + fmt(p1[0]) + ' ' + fmt(p1[1]) +
           'A' + r2 + ' ' + r2 + ' 0 ' + laf + ' 1 ' + fmt(p2[0]) + ' ' + fmt(p2[1]) +
           'L' + fmt(p3[0]) + ' ' + fmt(p3[1]) +
           'A' + r1 + ' ' + r1 + ' 0 ' + laf + ' 0 ' + fmt(p4[0]) + ' ' + fmt(p4[1]) + 'Z';
  }
  /* Open arc path along a radius. */
  function arc(r, a1, a2) {
    var p1 = polar(r, a1), p2 = polar(r, a2);
    return 'M' + fmt(p1[0]) + ' ' + fmt(p1[1]) +
           'A' + r + ' ' + r + ' 0 ' + arcSweep(a1, a2) + ' 1 ' + fmt(p2[0]) + ' ' + fmt(p2[1]);
  }
  /* Full annulus, as two circles with evenodd fill. */
  function annulus(r1, r2) {
    function circ(r, dir) {
      return 'M' + (CX - r) + ' ' + CY +
             'a' + r + ' ' + r + ' 0 1 ' + dir + ' ' + (2 * r) + ' 0' +
             'a' + r + ' ' + r + ' 0 1 ' + dir + ' ' + (-2 * r) + ' 0Z';
    }
    return circ(r2, 1) + circ(r1, 0);
  }
  /* A full circle as closed path data, for fills and clip paths. */
  function circlePath(r) {
    return 'M' + (CX - r) + ' ' + CY +
           'a' + r + ' ' + r + ' 0 1 0 ' + (2 * r) + ' 0' +
           'a' + r + ' ' + r + ' 0 1 0 ' + (-2 * r) + ' 0Z';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Text that rides the ring. The outer group places it; the inner group is
   * flipped by the app when the wheel's rotation would leave it upside down. */
  function rotLabel(ang, x, y, inner) {
    return '<g transform="rotate(' + fmt(ang) + ' ' + fmt(x) + ' ' + fmt(y) + ')">' +
           '<g class="rot" data-ang="' + fmt(ang) + '" style="transform-origin:' +
           fmt(x) + 'px ' + fmt(y) + 'px">' + inner + '</g></g>';
  }

  /* The wheel is rotated so day 1 (the winter solstice) sits at the west
   * point rather than the top: read clockwise, the half from west up to the
   * top is the sun gaining light on the way to the summer solstice, and the
   * half from the top back down to west is it losing that light again. */
  var WHEEL_ROTATION = 270;

  /* Angle at the centre of day n, and the leading edge of day n. */
  function dayAngle(cycle, n) { return (n - 0.5) / cycle.length * 360 + WHEEL_ROTATION; }
  function dayEdge(cycle, n) { return (n - 1) / cycle.length * 360 + WHEEL_ROTATION; }

  /* Frost dates are never exact. Each one gets a roughly month-wide window
   * (this many days either side) that fades out from the given date, rather
   * than one hard line — or a band spanning the whole gap between the two. */
  var FROST_WINDOW_DAYS = 15;

  /* The four cardinal points of the ecliptic, by their own signs. These are
   * the real astronomical markers: the spring equinox is the first point of
   * Aries and the autumn one the first point of Libra, and the tropics of
   * Cancer and Capricorn are named for the solstices they mark.
   *
   * Chosen by longitude rather than by name, so a southern cycle gets the
   * right symbol: its winter solstice is the June one, at longitude 90, which
   * is Cancer whatever the season is called locally.
   *
   * The half-filled circles that were here before meant "half light, half
   * dark", which is what an equinox is, but on a wheel carrying thirteen
   * months of real moon phases they simply read as moons. */
  /* Drawn rather than typed. Characters for these were at the mercy of
   * whatever font the reader has, and the zodiac signs in particular arrive
   * as colour emoji on a good many systems, which is not the register of the
   * rest of the wheel. Three shapes, each meaning what it looks like: a solid
   * disc for a solstice, when the sun stands at its turn; an open ring for an
   * equinox, when day and night balance; a small diamond for the midpoint
   * between them. */
  function stationMark(s, x, y, colour) {
    var kind = s.kind;
    if (kind === 'solstice') {
      return '<circle cx="' + fmt(x) + '" cy="' + fmt(y) + '" r="5.5" fill="' + colour + '"/>';
    }
    if (kind === 'equinox') {
      return '<circle cx="' + fmt(x) + '" cy="' + fmt(y) + '" r="4.8" fill="none" stroke="' +
             colour + '" stroke-width="2.2"/>';
    }
    return '<path d="M' + fmt(x) + ' ' + fmt(y - 5.2) + 'L' + fmt(x + 5.2) + ' ' + fmt(y) +
           'L' + fmt(x) + ' ' + fmt(y + 5.2) + 'L' + fmt(x - 5.2) + ' ' + fmt(y) +
           'Z" fill="' + colour + '"/>';
  }

  function render(cycle, opts) {
    var parts = [];
    var N = cycle.length;
    var step = 360 / N;

    /* -- night backdrop for the whole daylight band ---------------------- */
    parts.push('<path d="' + annulus(R.bandIn, R.bandOut) + '" fill-rule="evenodd" ' +
               'fill="var(--night)" stroke="none"/>');

    /* -- gold daylight wave ---------------------------------------------- */
    var wave = [], curve = [];
    for (var i = 0; i < N; i++) {
      var d = cycle.days[i];
      var frac = Math.max(0, Math.min(1, d.daylightHours / 24));
      var r = R.bandIn + frac * (R.bandOut - R.bandIn);
      var p = polar(r, dayAngle(cycle, d.n));
      wave.push((i === 0 ? 'M' : 'L') + fmt(p[0]) + ' ' + fmt(p[1]));
      curve.push([p[0], p[1]]);
    }
    var inner = 'M' + (CX - R.bandIn) + ' ' + CY +
      'a' + R.bandIn + ' ' + R.bandIn + ' 0 1 0 ' + (2 * R.bandIn) + ' 0' +
      'a' + R.bandIn + ' ' + R.bandIn + ' 0 1 0 ' + (-2 * R.bandIn) + ' 0Z';
    parts.push('<path d="' + wave.join('') + 'Z' + inner + '" fill-rule="evenodd" ' +
               'fill="url(#g-gold)" opacity=".92"/>');
    parts.push('<path d="' + wave.join('') + 'Z" fill="none" stroke="var(--sun-bright)" ' +
               'stroke-width="1.4" stroke-linejoin="round" opacity=".85"/>');

    /* -- daily separators, faint until zoomed ---------------------------- */
    var seps = [];
    for (i = 0; i < N; i++) {
      var a = dayEdge(cycle, i + 1);
      var q1 = polar(R.bandIn, a), q2 = polar(R.bandOut, a);
      seps.push('M' + fmt(q1[0]) + ' ' + fmt(q1[1]) + 'L' + fmt(q2[0]) + ' ' + fmt(q2[1]));
    }
    parts.push('<path class="day-seps" d="' + seps.join('') + '" stroke="var(--void)" ' +
               'stroke-width=".5" opacity=".28" fill="none"/>');

    /* -- band guide rings ------------------------------------------------ */
    parts.push('<circle cx="500" cy="500" r="' + R.bandIn + '" fill="none" ' +
               'stroke="var(--line)" stroke-width="1"/>');
    parts.push('<circle cx="500" cy="500" r="' + R.bandOut + '" fill="none" ' +
               'stroke="var(--line-soft)" stroke-width="1"/>');
    // 6-hour and 12-hour daylight references
    [6, 12, 18].forEach(function (h) {
      var rr = R.bandIn + h / 24 * (R.bandOut - R.bandIn);
      parts.push('<circle cx="500" cy="500" r="' + fmt(rr) + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width=".8" stroke-dasharray="2 6"/>');
    });

    /* -- frost and the growing season between the two dates ---------------- */
    if (opts.layers.frost && cycle.frost) {
      var midR = (R.frostIn + R.frostOut) / 2, thick = R.frostOut - R.frostIn;
      var coreOpacity = .55, peakOpacity = .30;   // dark solid core, lighter fading edges
      var halfWindowDeg = FROST_WINDOW_DAYS / cycle.length * 360;

      if (cycle.frost.none) {
        // No frost expected at all: the growing season is the whole year, so
        // the whole band is filled solid, no fading edges to draw.
        parts.push('<path d="' + annulus(R.frostIn, R.frostOut) + '" fill-rule="evenodd" ' +
                   'fill="var(--grow)" opacity="' + fmt(coreOpacity) + '"/>');
      } else if (cycle.frost.last && cycle.frost.first) {
        var aLast = dayAngle(cycle, cycle.frost.last.dayNumber);
        var aFirst = dayAngle(cycle, cycle.frost.first.dayNumber);

        // The solid core: everywhere safely between the two dates, sweeping
        // the short way from last frost forward to first frost.
        var coreSpan = ((aFirst - aLast) % 360 + 360) % 360;
        var coreBig = coreSpan > 180 ? 1 : 0;
        var pa = polar(midR, aLast), pb = polar(midR, aFirst);
        parts.push('<path d="M' + fmt(pa[0]) + ' ' + fmt(pa[1]) + 'A' + midR + ' ' + midR + ' 0 ' + coreBig +
                   ' 1 ' + fmt(pb[0]) + ' ' + fmt(pb[1]) + '" fill="none" stroke="var(--grow)" ' +
                   'stroke-width="' + thick + '" opacity="' + fmt(coreOpacity) + '" stroke-linecap="butt"/>');

        // Each fading slice is always small (a fraction of the half-window),
        // so it never needs the large-arc flag; only the sweep direction can
        // flip, depending on which side of the date it falls.
        function arcSeg(a1, a2, opacity) {
          var sweep = a2 >= a1 ? 1 : 0;
          var p1 = polar(midR, a1), p2 = polar(midR, a2);
          return '<path d="M' + fmt(p1[0]) + ' ' + fmt(p1[1]) + 'A' + midR + ' ' + midR + ' 0 0 ' + sweep +
                 ' ' + fmt(p2[0]) + ' ' + fmt(p2[1]) + '" fill="none" stroke="var(--grow)" ' +
                 'stroke-width="' + thick + '" opacity="' + fmt(opacity) + '" stroke-linecap="butt"/>';
        }
        // A symmetric dome over the solid core: full light-green right at the
        // given date (where it blends into the dark core underneath), fading
        // to nothing a half-window out on either side, into open sky.
        function dome(centerAngle) {
          var steps = 16;
          for (var side = -1; side <= 1; side += 2) {
            for (var i = 0; i < steps; i++) {
              var t0 = i / steps, t1 = (i + 1) / steps;
              var op = peakOpacity * Math.cos((t0 + t1) / 2 * Math.PI / 2);
              parts.push(arcSeg(centerAngle + side * halfWindowDeg * t0, centerAngle + side * halfWindowDeg * t1, op));
            }
          }
        }
        [[cycle.frost.last, 'Last frost'], [cycle.frost.first, 'First frost']].forEach(function (f) {
          var ang = dayAngle(cycle, f[0].dayNumber);
          dome(ang);
          var m1 = polar(R.frostIn + 2, ang), m2 = polar(R.frostOut - 2, ang);
          parts.push('<path d="M' + fmt(m1[0]) + ' ' + fmt(m1[1]) + 'L' + fmt(m2[0]) + ' ' + fmt(m2[1]) +
                     '" stroke="var(--frost)" stroke-width="1.4" opacity=".85"/>');
          var lp = polar(R.frostIn - 14, ang);
          /* Its own class. It had been borrowing the solar terms' purely for
           * the font, which quietly coupled the two: restyling the terms
           * restyled the frost marks with them. */
          parts.push(rotLabel(ang, lp[0], lp[1],
            '<text class="frost-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
            '" text-anchor="middle" dominant-baseline="middle" fill="var(--frost)">' + f[1] +
            ' ±' + FROST_WINDOW_DAYS + 'd</text>'));
        });
      }
    }

    /* -- the Sun's declination: what actually defines these four days ------
     * Declination is how far north (+) or south (-) of the celestial equator
     * the Sun stands. The equinoxes are exactly where it crosses zero and the
     * solstices exactly where it bottoms out at -23.4 and peaks at +23.4, so
     * drawing it against a zero-circle shows the definition rather than
     * asserting it: the crossings line up with the equinox spokes on their
     * own. Warm fill = Sun north of the equator, cool = south. */
    if (opts.layers.declination) {
      var TILT = 23.44;
      var decR = function (dec) {
        return R.decZero + Math.max(-TILT, Math.min(TILT, dec)) * (R.decOut - R.decZero) / TILT;
      };
      var decPts = [];
      for (i = 0; i < N; i++) {
        var dp = polar(decR(cycle.days[i].sunDeclination), dayAngle(cycle, cycle.days[i].n));
        decPts.push((i ? 'L' : 'M') + fmt(dp[0]) + ' ' + fmt(dp[1]));
      }
      var decCurve = decPts.join('') + 'Z';
      var zeroCircle = circlePath(R.decZero);

      /* No fill either side of the equator any more. It was gold for north
       * and blue for south, which is a real distinction, but gold and blue on
       * a calendar read as day and night rather than as two sides of a line,
       * and the curve's own position against the dashed circle already says
       * which side the sun is on. One curve, three labelled circles. */
      parts.push('<path d="' + zeroCircle + '" fill="none" stroke="var(--ink-3)" ' +
                 'stroke-width="1" stroke-dasharray="3 4" opacity=".9"/>');
      parts.push('<circle cx="500" cy="500" r="' + R.decOut + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width=".7" stroke-dasharray="2 5"/>');
      parts.push('<circle cx="500" cy="500" r="' + R.decIn + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width=".7" stroke-dasharray="2 5"/>');
      parts.push('<path d="' + decCurve + '" fill="none" stroke="var(--sun-bright)" stroke-width="1.6"/>');
      parts.push('<text x="500" y="' + (CY - R.decZero - 4) + '" text-anchor="middle" ' +
                 'font-size="9" fill="var(--ink-3)">celestial equator · 0°</text>');

      /* The sun's reach north and south, written where it actually gets
       * there rather than as a legend elsewhere. Zero is already marked on
       * the equator; these are the two turns it makes around it. */
      var hiD = cycle.days[0], loD = cycle.days[0];
      cycle.days.forEach(function (d) {
        if (d.sunDeclination > hiD.sunDeclination) hiD = d;
        if (d.sunDeclination < loD.sunDeclination) loD = d;
      });
      [[hiD, 13], [loD, -13]].forEach(function (pr) {
        var dd = pr[0], push = pr[1];
        var aa = dayAngle(cycle, dd.n);
        var q = polar(decR(dd.sunDeclination) + push, aa);
        var sign = dd.sunDeclination >= 0 ? '+' : '\u2212';
        parts.push(rotLabel(aa, q[0], q[1],
          '<text class="dec-mark" x="' + fmt(q[0]) + '" y="' + fmt(q[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' + sign +
          Math.abs(dd.sunDeclination).toFixed(1) + '\u00B0</text>'));
      });
    }

    /* -- moon ring: real phase shapes, on an orbit that breathes ----------
     * Each day gets the Moon's actual lit shape rather than a dimmed dot,
     * and the ring's radius tracks its real distance from Earth — nearer at
     * perigee, further at apogee — so the ~27.5-day in-and-out of the orbit
     * shows up as a visible wave, about 13 of them around the year. */
    if (opts.layers.moon) {
      var moons = [];

      /* -- lunation pies: one wedge per new-moon-to-new-moon cycle --------
       * The Moon's cycle does not divide the Sun's, so these wedges do not
       * line up with anything solar and the year opens and closes part-way
       * through one. Both partial ends are drawn dimmer and left unnumbered
       * rather than rounded into whole moons. */
      if (cycle.lunations && cycle.lunations.length) {
        var pieMid = (R.moonPieIn + R.moonPieOut) / 2;
        var pieHits = [];
        cycle.lunations.forEach(function (L, li) {
          var a1 = dayEdge(cycle, L.startDay);
          var a2 = L.endDay >= N ? dayEdge(cycle, N) + step : dayEdge(cycle, L.endDay + 1);
          // Alternating wash so neighbouring moons read apart at a glance.
          parts.push('<path d="' + sector(R.moonPieIn, R.moonPieOut, a1, a2) +
                     '" fill="var(--moon)" opacity="' +
                     (L.complete ? (li % 2 ? '.05' : '.10') : '.03') + '"/>');
          // Divider on the new moon itself.
          var b1 = polar(R.moonPieIn, a1), b2 = polar(R.moonPieOut, a1);
          parts.push('<path d="M' + fmt(b1[0]) + ' ' + fmt(b1[1]) + 'L' + fmt(b2[0]) + ' ' + fmt(b2[1]) +
                     '" stroke="var(--moon)" stroke-width="' + (L.complete ? 1.1 : .7) +
                     '" opacity="' + (L.complete ? '.65' : '.35') + '"/>');
          // Named by the full moon inside it, which is how these are actually
          // spoken of: "the second full moon of spring". A wedge with no full
          // moon inside is a cut-off end and stays unlabelled.
          // Two lines: the running year count leads, since that is the moon's
          // name for the whole turn, with its position inside the season as
          // the smaller supporting line beneath.
          var arcDeg = ((a2 - a1) % 360 + 360) % 360;
          /* A partial wedge at either end of the cycle belongs to the
           * neighbouring year's count, and is often too narrow for the full
           * two-line label. It gets a compact one instead, so there is
           * something to aim at rather than a stretch of bare ring. */
          if (!L.shortLabel && L.edgeNumber && arcDeg >= 6) {
            var emid = a1 + arcDeg / 2;
            var ep = polar(R.moonNumR, emid);
            parts.push(rotLabel(emid, ep[0], ep[1],
              '<text class="moon-num is-edge" x="' + fmt(ep[0]) + '" y="' + fmt(ep[1]) +
              '" text-anchor="middle" dominant-baseline="middle">' +
              L.edgeNumber + ' \u203A</text>'));
            var eyp = polar(R.moonSeasonR, emid);
            parts.push(rotLabel(emid, eyp[0], eyp[1],
              '<text class="moon-season is-edge" x="' + fmt(eyp[0]) + '" y="' + fmt(eyp[1]) +
              '" text-anchor="middle" dominant-baseline="middle">' + L.edgeYear + '</text>'));
          }
          if (L.shortLabel) {
            var mid = a1 + arcDeg / 2;
            var np = polar(R.moonNumR, mid);
            var sp2 = polar(R.moonSeasonR, mid);
            parts.push(rotLabel(mid, np[0], np[1],
              '<text class="moon-num' + (L.isBlue ? ' is-blue' : '') + '" x="' + fmt(np[0]) +
              '" y="' + fmt(np[1]) + '" text-anchor="middle" dominant-baseline="middle">' +
              'Lunation ' + L.yearMoonNumber + (L.isBlue ? ' \u2022' : '') + '</text>'));
            parts.push(rotLabel(mid, sp2[0], sp2[1],
              '<text class="moon-season" x="' + fmt(sp2[0]) + '" y="' + fmt(sp2[1]) +
              '" text-anchor="middle" dominant-baseline="middle">' + esc(L.shortLabel) + '</text>'));
          }
          pieHits.push('<path class="moon-hit" data-lunation="' + li + '" d="' +
                       sector(R.moonHitIn, R.moonPieOut, a1, a2) + '"><title>' +
                       (L.shortLabel
                          ? esc('Lunation ' + L.yearMoonNumber + ' of the year \u00B7 ' +
                                (L.longLabel || L.shortLabel))
                          : L.edgeNumber
                            ? esc('Lunation ' + L.edgeNumber + ' of ' + L.edgeYear +
                                  ' \u00B7 ' + L.edgeLabel + ', running through this solstice')
                            : 'Lunar month') + '</title></path>');
        });
        // Closing divider at the very end of the last segment.
        var lastA = dayEdge(cycle, N) + step;
        var e1 = polar(R.moonPieIn, lastA), e2 = polar(R.moonPieOut, lastA);
        parts.push('<path d="M' + fmt(e1[0]) + ' ' + fmt(e1[1]) + 'L' + fmt(e2[0]) + ' ' + fmt(e2[1]) +
                   '" stroke="var(--moon)" stroke-width=".7" opacity=".35"/>');
        cycle._pieHits = pieHits.join('');
      }
      var near = cycle.moonNearestKm, far = cycle.moonFurthestKm;
      var spanKm = (far - near) || 1;
      function moonRadiusFor(d) {
        // 0 at perigee (closest, drawn nearest the centre), 1 at apogee.
        var t = (d.moonDistanceKm - near) / spanKm;
        return R.moonRing - R.moonSwing + t * (R.moonSwing * 2);
      }
      // A faint guide at the mean distance, so the wave reads against it.
      parts.push('<circle cx="500" cy="500" r="' + R.moonRing + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width="1" opacity=".8" stroke-dasharray="2 5"/>');

      // The orbit path itself, traced through every day's distance.
      var orbit = [];
      for (i = 0; i < N; i++) {
        var od = cycle.days[i];
        var op = polar(moonRadiusFor(od), dayAngle(cycle, od.n));
        orbit.push((i ? 'L' : 'M') + fmt(op[0]) + ' ' + fmt(op[1]));
      }
      // Deliberately NOT closed: day 365 and day 1 are a whole year apart in
      // the Moon's own cycle, so joining them would draw a jump that isn't
      // real. The seam left at the solstice is the honest picture — the wheel
      // closes because a circle must, but the Moon's rhythm carries on into
      // the next turn. The spiral view is where that continuation is shown.
      parts.push('<path d="' + orbit.join('') + '" fill="none" stroke="var(--moon)" ' +
                 'stroke-width="1" opacity=".5"/>');

      for (i = 0; i < N; i++) {
        var dd = cycle.days[i];
        var rr = moonRadiusFor(dd);
        var mp = polar(rr, dayAngle(cycle, dd.n));
        var isEvent = dd.moonEvent === 'Full Moon' || dd.moonEvent === 'New Moon' ||
                      dd.moonEvent === 'First Quarter' || dd.moonEvent === 'Last Quarter';
        var gr = isEvent ? R.moonR + 1.7 : R.moonR;
        // Dark disc, then the real lit shape on top (same geometry the day
        // view's larger glyph uses), so a crescent looks like a crescent.
        moons.push('<circle cx="' + fmt(mp[0]) + '" cy="' + fmt(mp[1]) + '" r="' + fmt(gr) +
                   '" fill="var(--moon-shadow)" opacity=".9"/>' +
                   '<path d="' + MoonGlyph.litPath(mp[0], mp[1], gr, dd.moonAge) +
                   '" fill="var(--moon-lit)"/>');
        if (isEvent) {
          moons.push('<circle cx="' + fmt(mp[0]) + '" cy="' + fmt(mp[1]) + '" r="' + fmt(gr + 2.6) +
                     '" fill="none" stroke="var(--moon)" stroke-width=".9" opacity="' +
                     (dd.moonEvent === 'Full Moon' ? '.85' : '.4') + '"/>');
        }
      }
      parts.push(moons.join(''));
    }

    /* -- 24 solar terms: numbered, not translated. The traditional English
     * glosses ("Grain Rain", "Frost Descends"...) describe a climate that
     * doesn't travel with the longitude line they're tied to, so the wheel
     * only claims the division, not the weather. Hover a tick for the
     * traditional Chinese name, kept as a name rather than a forecast. ---- */
    if (opts.layers.terms) {
      parts.push('<circle cx="500" cy="500" r="' + ((R.termIn + R.termOut) / 2) +
                 '" fill="none" class="term-band" stroke-width="' + (R.termOut - R.termIn) + '"/>');
      /* A day comb along the ring's inner edge, one dash per day, so a term's
       * width can be counted as well as read. They line up with the day
       * sectors everything else on the wheel is built from. */
      for (var dt = 1; dt <= N; dt++) {
        var da = dayEdge(cycle, dt);
        var c1 = polar(R.termIn, da), c2 = polar(R.termIn + 4, da);
        parts.push('<path class="term-day" d="M' + fmt(c1[0]) + ' ' + fmt(c1[1]) +
                   'L' + fmt(c2[0]) + ' ' + fmt(c2[1]) + '"/>');
      }

      var termsSorted = cycle.terms.filter(function (t) { return t.dayNumber; });
      termsSorted.forEach(function (t, ti) {
        var ang = dayEdge(cycle, t.dayNumber);
        var t1 = polar(R.termIn, ang), t2 = polar(R.termOut, ang);
        parts.push('<path class="term-cut" d="M' + fmt(t1[0]) + ' ' + fmt(t1[1]) +
                   'L' + fmt(t2[0]) + ' ' + fmt(t2[1]) + '"/>');

        /* Named in its own span, the way a month is: the cut opens the term
         * and the wording belongs to the stretch that follows it. */
        /* The last term closes at the end of the cycle, which on a wheel
         * turned 270 degrees is dayEdge(N+1) and not 360. Using the bare 360
         * put term 24's midpoint about a third of the way round the wheel,
         * where it landed on top of term 3. */
        var nxt = termsSorted[(ti + 1) % termsSorted.length];
        var a2 = (ti + 1 < termsSorted.length)
          ? dayEdge(cycle, nxt.dayNumber) : dayEdge(cycle, N + 1);
        var sweep = ((a2 - ang) % 360 + 360) % 360;
        if (sweep < 1) sweep = 15;
        var mid = ang + sweep / 2;

        var np = polar(R.termNum, mid);
        parts.push(rotLabel(mid, np[0], np[1],
          '<text class="term-label" x="' + fmt(np[0]) + '" y="' + fmt(np[1]) +
          '" text-anchor="middle" dominant-baseline="middle">Solar term ' + t.number +
          '<title>' + esc('Solar term ' + t.number + ' of 24, ' + t.days + ' days') +
          '</title></text>'));
        /* How long this term runs, since the ring is drawn to real time and
         * the widths differ: fourteen days near perihelion, sixteen near
         * aphelion. The traditional names are left off, here and everywhere
         * else on the wheel; they describe one region's weather, not yours. */
        var sp = polar(R.termName, mid);
        parts.push(rotLabel(mid, sp[0], sp[1],
          '<text class="term-sub" x="' + fmt(sp[0]) + '" y="' + fmt(sp[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' + t.days + ' days</text>'));
      });
    }

    /* -- month ring -------------------------------------------------------- */
    if (opts.layers.months) {
      parts.push('<circle cx="500" cy="500" r="' + ((R.monthIn + R.monthOut) / 2) + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width="' + (R.monthOut - R.monthIn) + '" opacity=".6"/>');
      var runs = monthRuns(cycle);
      runs.forEach(function (run) {
        var aStart = dayEdge(cycle, run.start);
        var e1 = polar(R.monthIn, aStart), e2 = polar(R.monthOut, aStart);
        parts.push('<path d="M' + fmt(e1[0]) + ' ' + fmt(e1[1]) + 'L' + fmt(e2[0]) + ' ' + fmt(e2[1]) +
                   '" stroke="var(--line)" stroke-width="1"/>');
        /* Same wrap as the terms: the closing run ends at dayEdge(N+1), not
         * at 360. A cycle that opens and closes in the same month, which every
         * one of them does, had its second December thrown into the middle of
         * the wheel and so appeared to have no label at all. */
        var mid = (dayEdge(cycle, run.start) +
                   dayEdge(cycle, Math.min(run.end + 1, N + 1))) / 2;
        var lp = polar(R.monthLabel, mid);
        parts.push(rotLabel(mid, lp[0], lp[1],
          '<text class="month-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' +
          TZ.MONTHS_SHORT[run.month - 1].toUpperCase() + '</text>'));
      });
    }

    /* -- the seasons, and the midpoint inside each -------------------------
     * A ring above the months dividing the year the way the sky does rather
     * than the way the calendar does: at the four solstices and equinoxes,
     * and again halfway between each pair. Those midpoints are the
     * cross-quarter days, the oldest festival dates in the northern year, and
     * they fall where they fall rather than on any month's edge, which is
     * exactly why they want a layer of their own to be seen against. */
    if (opts.layers.seasons) {
      parts.push('<circle cx="500" cy="500" r="' + ((R.seasonIn + R.seasonOut) / 2) +
                 '" fill="none" class="season-band" stroke-width="' +
                 (R.seasonOut - R.seasonIn) + '"/>');
      cycle.stations.forEach(function (st) {
        if (!st.dayNumber) return;
        var a = dayEdge(cycle, st.dayNumber);
        /* Eight cuts of equal weight, so the ring reads as eight sections. A
         * season's midpoint opens the second half of it just as the solstice
         * opens the first, and the wheel should not imply one matters less.
         * Each takes its own station's colour, so a cut and the mark standing
         * on it read as one thing. */
        var tc = 'var(--st-' + st.offset + ')';
        var p1 = polar(R.seasonIn, a), p2 = polar(R.seasonOut, a);
        parts.push('<path class="season-tick" stroke="' + tc + '" d="M' + fmt(p1[0]) +
                   ' ' + fmt(p1[1]) + 'L' + fmt(p2[0]) + ' ' + fmt(p2[1]) + '"/>');
      });
      // the season's own name sits across its quarter, between two cardinals
      var cards = cycle.stations.filter(function (st) {
        return st.dayNumber && (st.kind === 'solstice' || st.kind === 'equinox');
      });
      cards.forEach(function (st, i) {
        var a1 = dayEdge(cycle, st.dayNumber);
        var nxt = cards[(i + 1) % cards.length];
        var a2 = (i + 1 < cards.length) ? dayEdge(cycle, nxt.dayNumber) : a1 + 90;
        var sweep = ((a2 - a1) % 360 + 360) % 360;
        var mid = a1 + sweep / 2;
        var lp = polar(R.seasonLabel, mid);
        parts.push(rotLabel(mid, lp[0], lp[1],
          '<text class="season-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' +
          esc((st.name.split(' ')[0] || '').toUpperCase()) + '</text>'));
      });
    }

    /* -- days with a note on them, a quiet dot in the otherwise empty ring
     * just inside the frost band ------------------------------------------- */
    if (opts.notedDays) {
      cycle.days.forEach(function (d) {
        if (!opts.notedDays[d.iso]) return;
        var p = polar(R.noteMark, dayAngle(cycle, d.n));
        parts.push('<circle cx="' + fmt(p[0]) + '" cy="' + fmt(p[1]) + '" r="2.8" ' +
                   'fill="var(--sun-bright)" opacity=".85"/>');
      });
    }

    /* -- the two days the clocks step -------------------------------------
     * A tick across the daylight band on each changeover date, with the
     * direction written beside it. These are the only two marks on the wheel
     * that record something people did rather than something the sky did, so
     * they are drawn in the crossing colour and vanish with the setting that
     * causes them. Most zones have none at all. */
    if (opts.useDST && cycle.shiftsClocks) {
      cycle.days.forEach(function (d) {
        if (!d.clockShiftMinutes) return;
        var ang = dayAngle(cycle, d.n);
        var m1 = polar(R.bandIn, ang), m2 = polar(R.bandOut, ang);
        parts.push('<path d="M' + fmt(m1[0]) + ' ' + fmt(m1[1]) + 'L' + fmt(m2[0]) + ' ' + fmt(m2[1]) +
                   '" stroke="var(--cross)" stroke-width="1.6" stroke-dasharray="3 3" opacity=".9"/>');
        var lp = polar(R.bandOut + 13, ang);
        parts.push(rotLabel(ang, lp[0], lp[1],
          '<text class="clock-step" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) + '" ' +
          'text-anchor="middle" dominant-baseline="middle" font-size="9" ' +
          'fill="var(--cross)">clocks ' +
          (d.clockShiftMinutes > 0 ? 'forward' : 'back') + '</text>'));
      });
    }

    /* -- the eight stations ------------------------------------------------ */
    var stationsInOrder = cycle.stations.filter(function (x) { return x.dayNumber; });
    stationsInOrder.forEach(function (s, si) {
      var ang = dayAngle(cycle, s.dayNumber);
      /* Each station has its own colour rather than one per kind, running the
       * spectrum round the year. Keyed by offset from the local winter
       * solstice, so the southern hemisphere gets midsummer's yellow in
       * December where its midsummer actually is. */
      var colour = 'var(--st-' + s.offset + ')';
      var l1 = polar(R.stationTick0, ang), l2 = polar(R.stationTick1, ang);
      parts.push('<path d="M' + fmt(l1[0]) + ' ' + fmt(l1[1]) + 'L' + fmt(l2[0]) + ' ' + fmt(l2[1]) +
                 '" stroke="' + colour + '" stroke-width="2"/>');
      // a spoke through the wheel at all eight stations, marking the season
      // quarters; the four cardinal points read a little stronger than the
      // four cross-quarter midpoints
      // Cardinal spokes reach all the way in through the declination ring, so
      // the curve's zero crossing can be checked against the equinox line
      // rather than taken on trust. Without that the two sit in rings far
      // apart with nothing joining them, and the alignment looks unverifiable.
      var innerReach = (opts.layers.declination && s.offset % 90 === 0)
        ? R.decIn - 8 : R.frostIn;
      var s1 = polar(innerReach, ang), s2 = polar(R.bandOut, ang);
      parts.push('<path d="M' + fmt(s1[0]) + ' ' + fmt(s1[1]) + 'L' + fmt(s2[0]) + ' ' + fmt(s2[1]) +
                 '" stroke="' + colour + '" stroke-width="1" opacity="' + (s.offset % 90 === 0 ? '.35' : '.18') +
                 '" stroke-dasharray="3 4"/>');
      var g = polar(R.stationGlyph, ang);
      parts.push(stationMark(s, g[0], g[1], colour));

      /* The wording sits in its own wedge, running from this station to the
       * next, the way a month's name sits inside its month. So the eight
       * spans of the year each become a piece of one ring, named for the
       * station that opens it, while the tick and the glyph stay back on the
       * exact day at the wedge's leading edge.
       *
       * Each line takes its own radius. Offsetting in y and rotating sends
       * the offset inward on half the wheel, which is what used to drag the
       * day numbers in over the season band. */
      /* No shading and no line of its own out here. The season band below
       * already carries the divider for this station, so the wording simply
       * sits above it on the same angle: centred on the line rather than
       * crossed by it. A station is a day, and this is that day's own column,
       * read outward from the mark. */
      var subNames = s.alt;
      var lines = [
        { r: R.stationDay, cls: 'station-day', txt: String(s.dayNumber), colour: colour },
        { r: R.stationLabel, cls: 'station-label', txt: s.name },
        { r: R.stationLabel + R.subDy, cls: 'station-sub', txt: subNames }
      ];
      lines.forEach(function (ln) {
        var q = polar(ln.r, ang);
        parts.push(rotLabel(ang, q[0], q[1],
          '<text class="' + ln.cls + '" x="' + fmt(q[0]) + '" y="' + fmt(q[1]) +
          '" text-anchor="middle" dominant-baseline="middle"' +
          (ln.colour ? ' fill="' + ln.colour + '"' : '') + '>' + esc(ln.txt) + '</text>'));
      });

      if (opts.layers.traditional && s.traditional) {
        var ta = dayAngle(cycle, s.traditional.dayNumber);
        var t1 = polar(R.stationTick0 + 6, ta), t2 = polar(R.stationTick1 - 6, ta);
        parts.push('<path d="M' + fmt(t1[0]) + ' ' + fmt(t1[1]) + 'L' + fmt(t2[0]) + ' ' + fmt(t2[1]) +
                   '" stroke="' + colour + '" stroke-width="1.6" stroke-dasharray="3 3" opacity=".8"/>');
      }
    });

    /* -- today -------------------------------------------------------------- */
    if (opts.todayN) {
      var ta2 = dayAngle(cycle, opts.todayN);
      var y1 = polar(R.frostIn - 8, ta2), y2 = polar(R.bandOut + 14, ta2);
      parts.push('<path d="M' + fmt(y1[0]) + ' ' + fmt(y1[1]) + 'L' + fmt(y2[0]) + ' ' + fmt(y2[1]) +
                 '" stroke="var(--today)" stroke-width="1.6" opacity=".9"/>');
      var tp = polar(R.bandOut + 22, ta2);
      parts.push('<circle cx="' + fmt(tp[0]) + '" cy="' + fmt(tp[1]) + '" r="4" fill="var(--today)"/>');
    }

    /* -- selection highlight -------------------------------------------------*/
    parts.push('<path id="sel-day" d="" fill="var(--ink)" fill-opacity=".14" ' +
               'stroke="var(--ink)" stroke-width=".8" stroke-opacity=".5" opacity="0"/>');

    /* -- hit targets ---------------------------------------------------------*/
    var hits = [];
    for (i = 1; i <= N; i++) {
      hits.push('<path class="hit" data-day="' + i + '" d="' +
                sector(R.hitIn, R.hitOut, dayEdge(cycle, i), dayEdge(cycle, i) + step) + '"/>');
    }
    parts.push('<g id="hits">' + hits.join('') + '</g>');
    if (cycle._pieHits) {
      parts.push('<g id="moon-hits">' + cycle._pieHits + '</g>');
      cycle._pieHits = null;
    }

    return parts.join('');
  }

  /* Flip every ring label whose angle, once the wheel's own rotation is taken
   * into account, would leave it reading upside down. */
  function applyRotation(svg, wheelRotationDeg) {
    var labels = svg.querySelectorAll('.rot');
    for (var i = 0; i < labels.length; i++) {
      var eff = ((+labels[i].getAttribute('data-ang') + wheelRotationDeg) % 360 + 360) % 360;
      labels[i].classList.toggle('flip', eff > 90 && eff < 270);
    }
  }

  /* Contiguous runs of calendar months across the cycle. */
  function monthRuns(cycle) {
    var runs = [], cur = null;
    cycle.days.forEach(function (d) {
      if (!cur || cur.month !== d.month) {
        cur = { month: d.month, year: d.year, start: d.n, end: d.n };
        runs.push(cur);
      } else cur.end = d.n;
    });
    return runs;
  }

  /* The Big Dipper as it actually appears facing north at nightfall on each
   * station's date, from this place — a real sky reference, not a symbol:
   * dots for the seven stars, lines connecting them the way the bowl and
   * handle actually run. Rendered separately from the main wheel so it can
   * be painted into a layer on top of the vignette that fades the wheel's
   * own edge, instead of getting faded out along with it. */
  function renderSky(cycle, opts) {
    if (!opts.layers.skyClock || !Stars) return '';
    var parts = [];
    cycle.stations.forEach(function (s) {
      if (!s.dayNumber) return;
      var ang = dayAngle(cycle, s.dayNumber);
      var dayObj = cycle.days[s.dayNumber - 1];
      var eveJD = Stars.eveningInstant(A.jdFromDate(dayObj.date), cycle.lat, cycle.lon);
      var glyph = Stars.dipperGlyph(eveJD, cycle.lat, cycle.lon, R.skyClockR * 1.65);
      var cp = polar(R.skyClock, ang);
      if (glyph) {
        // Each star is three stacked circles — a wide soft halo, a tighter
        // brighter one, and a small solid core — which reads as a glow
        // without needing an SVG filter.
        var starDots = glyph.stars.map(function (st) {
          var x = st.x.toFixed(1), y = st.y.toFixed(1);
          return '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#fff" opacity=".14"/>' +
                 '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#fff" opacity=".34"/>' +
                 '<circle cx="' + x + '" cy="' + y + '" r="2" fill="#fff"/>';
        }).join('');
        // Polaris gets a bigger, cooler glow and four diffraction spikes, so
        // the one fixed point in the picture is unmistakable against the
        // seven that swing around it.
        var px = glyph.polaris.x, py = glyph.polaris.y;
        var sp = 11;
        var polarisMark =
          '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="12" fill="#bcd4ff" opacity=".18"/>' +
          '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6.5" fill="#d8e6ff" opacity=".45"/>' +
          '<path d="M' + (px - sp).toFixed(1) + ' ' + py.toFixed(1) + 'L' + (px + sp).toFixed(1) + ' ' + py.toFixed(1) +
          'M' + px.toFixed(1) + ' ' + (py - sp).toFixed(1) + 'L' + px.toFixed(1) + ' ' + (py + sp).toFixed(1) +
          '" stroke="#eaf2ff" stroke-width="1.1" opacity=".75" stroke-linecap="round"/>' +
          '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3" fill="#fff"/>';
        parts.push('<g transform="translate(' + fmt(cp[0]) + ' ' + fmt(cp[1]) + ')">' +
          '<circle r="' + R.skyClockR + '" fill="var(--sky-patch)" stroke="var(--line)" stroke-width="1"/>' +
          // the pointer stars' sightline, Merak through Dubhe on to Polaris
          '<path d="' + glyph.pointer + '" fill="none" stroke="#9fb4e8" stroke-width="1" ' +
          'stroke-dasharray="3 3" opacity=".45" stroke-linecap="round"/>' +
          '<path d="' + glyph.bowl + '" fill="none" stroke="#dfe6ff" stroke-width="1.5" opacity=".8" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
          '<path d="' + glyph.handle + '" fill="none" stroke="#dfe6ff" stroke-width="1.5" opacity=".8" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
          starDots + polarisMark +
          '<title>The Big Dipper facing north at nightfall on this date, from this place. ' +
          'The bright cross is Polaris: the two stars on the bowl\'s outer edge point straight at it, ' +
          'and it holds still all year while the Dipper swings around it.</title>' +
          '</g>');
      } else {
        parts.push('<g transform="translate(' + fmt(cp[0]) + ' ' + fmt(cp[1]) + ')">' +
          '<circle r="' + R.skyClockR + '" fill="var(--sky-patch)" stroke="var(--line)" stroke-width="1" opacity=".6"/>' +
          '<text text-anchor="middle" dominant-baseline="middle" font-size="10" fill="var(--ink-3)">below horizon</text>' +
          '<title>The Big Dipper is below the horizon from this place at nightfall on this date.</title>' +
          '</g>');
      }
    });
    return parts.join('');
  }

  /* Highlight one day with a radial marker. */
  function highlight(svg, cycle, n) {
    var el = svg.querySelector('#sel-day');
    if (!el) return;
    if (!n) { el.setAttribute('opacity', '0'); return; }
    var step = 360 / cycle.length;
    el.setAttribute('d', sector(R.moonRing - 12, R.bandOut + 6, dayEdge(cycle, n), dayEdge(cycle, n) + step));
    el.setAttribute('opacity', '.85');
  }

  /* The transform that frames one span of days, or the identity for the whole
   * year. Seasons and lunations use the same framing maths; only the span
   * differs, which is the point — a moon is just a different set of days. */
  function transformFor(cycle, level, seasonIndex, lunationIndex) {
    if (level === 'lunation' && lunationIndex != null && cycle.lunations) {
      var L = cycle.lunations[lunationIndex];
      if (L) return frameSpan(cycle, L.startDay, L.endDay);
    }
    if (level !== 'season' || seasonIndex == null) return { transform: 'none', zoomed: false, rotation: 0 };
    var s = cycle.seasons[seasonIndex];
    return frameSpan(cycle, s.startDay, s.endDay);
  }

  /* Frame days [startDay..endDay] across the top of the view. Zoom is scaled
   * to the span so a 30-day moon fills the frame as a 91-day season does. */
  function frameSpan(cycle, startDay, endDay) {
    var a1 = dayEdge(cycle, startDay);
    var a2 = endDay >= cycle.length ? dayEdge(cycle, cycle.length) + 360 / cycle.length
                                    : dayEdge(cycle, endDay + 1);
    var span = ((a2 - a1) % 360 + 360) % 360 || 360;
    var mid = a1 + span / 2;
    // A quarter-year fills the frame at 2x. Scaling a 30-day moon to fill the
    // frame identically works out near 5.5x, which is technically right and
    // visually useless: the ring swamps the view and the surrounding year
    // disappears. Damping by a square root keeps a moon clearly zoomed while
    // leaving the seasons either side of it in frame.
    var k = Math.max(2.0, Math.min(3.4, 2.0 * Math.sqrt(90 / span)));
    var ty = 128 - (CY - k * (R.stationLabel + 22));
    return {
      transform: 'translate(0px,' + Math.round(ty) + 'px) scale(' + k + ') rotate(' + (-mid) + 'deg)',
      zoomed: true, mid: mid, span: span, rotation: -mid
    };
  }

  function seasonOfDay(cycle, n) {
    var d = cycle.days[n - 1];
    return d ? d.season : 0;
  }

  global.WheelView = {
    render: render, renderSky: renderSky, highlight: highlight, transformFor: transformFor,
    applyRotation: applyRotation, seasonOfDay: seasonOfDay, dayAngle: dayAngle, R: R, polar: polar
  };
})(typeof window !== 'undefined' ? window : globalThis);
