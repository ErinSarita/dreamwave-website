/* render-wheel.js — the year ring, and the zoom into one season.
 * Geometry lives in a 1000x1000 viewBox with the wheel centred at (500, 500).
 * Angles run clockwise from the top, where day 1 (the winter solstice) sits.
 */
(function (global) {
  'use strict';
  var TZ = global.TZ, A = global.Astro, Stars = global.Stars;

  var CX = 500, CY = 500;
  var R = {
    stationLabel: 476, subDy: 15, subDy2: 27, stationGlyph: 456, stationTick0: 422, stationTick1: 444,
    skyClock: 600, skyClockR: 68,
    monthOut: 446, monthIn: 424, monthLabel: 435,
    bandOut: 418, bandIn: 262,
    moonRing: 246, moonR: 3.0,
    termOut: 192, termIn: 183, termLabel: 205,
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

  var STATION_GLYPH = {
    'winter-solstice': '☄', 'summer-solstice': '☀',
    'spring-equinox': '◑', 'autumn-equinox': '◐',
    imbolc: '✦', beltane: '✦', lughnasadh: '✦', samhain: '✦'
  };

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
          parts.push(rotLabel(ang, lp[0], lp[1],
            '<text class="term-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
            '" text-anchor="middle" dominant-baseline="middle" fill="var(--frost)">' + f[1] +
            ' ±' + FROST_WINDOW_DAYS + 'd</text>'));
        });
      }
    }

    /* -- moon ring -------------------------------------------------------- */
    if (opts.layers.moon) {
      var moons = [];
      parts.push('<circle cx="500" cy="500" r="' + R.moonRing + '" fill="none" ' +
                 'stroke="var(--line-soft)" stroke-width="' + (R.moonR * 2 + 4) + '" opacity=".5"/>');
      for (i = 0; i < N; i++) {
        var dd = cycle.days[i];
        var mp = polar(R.moonRing, dayAngle(cycle, dd.n));
        var lit = dd.moonIllumination;
        moons.push('<circle cx="' + fmt(mp[0]) + '" cy="' + fmt(mp[1]) + '" r="' + R.moonR +
                   '" fill="var(--moon)" fill-opacity="' + fmt(0.08 + 0.92 * lit) + '"/>');
        if (dd.moonEvent === 'Full Moon' || dd.moonEvent === 'New Moon') {
          moons.push('<circle cx="' + fmt(mp[0]) + '" cy="' + fmt(mp[1]) + '" r="' + (R.moonR + 3.2) +
                     '" fill="none" stroke="var(--moon)" stroke-width="1" opacity="' +
                     (dd.moonEvent === 'Full Moon' ? '.9' : '.45') + '"/>');
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
      cycle.terms.forEach(function (t) {
        if (!t.dayNumber) return;
        var ang = dayAngle(cycle, t.dayNumber);
        var t1 = polar(R.termIn, ang), t2 = polar(R.termOut, ang);
        parts.push('<path d="M' + fmt(t1[0]) + ' ' + fmt(t1[1]) + 'L' + fmt(t2[0]) + ' ' + fmt(t2[1]) +
                   '" stroke="var(--equinox)" stroke-width="1.2" opacity=".7"><title>' +
                   t.number + ' · ' + t.hanzi + ' ' + t.pinyin + '</title></path>');
        var lp = polar(R.termLabel, ang);
        parts.push(rotLabel(ang, lp[0], lp[1],
          '<text class="term-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' + t.number +
          '<title>' + t.hanzi + ' ' + t.pinyin + '</title></text>' +
          '<text class="term-sub" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1] + 11) +
          '" text-anchor="middle" dominant-baseline="middle">Day ' + t.dayNumber + '</text>'));
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
        var mid = (dayEdge(cycle, run.start) + dayEdge(cycle, run.end + 1)) / 2;
        if (run.end + 1 > N) mid = (dayEdge(cycle, run.start) + 360) / 2;
        var lp = polar(R.monthLabel, mid);
        parts.push(rotLabel(mid, lp[0], lp[1],
          '<text class="month-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
          '" text-anchor="middle" dominant-baseline="middle">' +
          TZ.MONTHS_SHORT[run.month - 1].toUpperCase() + '</text>'));
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

    /* -- the eight stations ------------------------------------------------ */
    cycle.stations.forEach(function (s) {
      if (!s.dayNumber) return;
      var ang = dayAngle(cycle, s.dayNumber);
      var colour = s.kind === 'solstice' ? 'var(--solstice)'
                 : s.kind === 'equinox' ? 'var(--equinox)' : 'var(--cross)';
      var l1 = polar(R.stationTick0, ang), l2 = polar(R.stationTick1, ang);
      parts.push('<path d="M' + fmt(l1[0]) + ' ' + fmt(l1[1]) + 'L' + fmt(l2[0]) + ' ' + fmt(l2[1]) +
                 '" stroke="' + colour + '" stroke-width="2"/>');
      // a spoke through the wheel at all eight stations, marking the season
      // quarters; the four cardinal points read a little stronger than the
      // four cross-quarter midpoints
      var s1 = polar(R.frostIn, ang), s2 = polar(R.bandOut, ang);
      parts.push('<path d="M' + fmt(s1[0]) + ' ' + fmt(s1[1]) + 'L' + fmt(s2[0]) + ' ' + fmt(s2[1]) +
                 '" stroke="' + colour + '" stroke-width="1" opacity="' + (s.offset % 90 === 0 ? '.35' : '.18') +
                 '" stroke-dasharray="3 4"/>');
      var g = polar(R.stationGlyph, ang);
      parts.push('<text x="' + fmt(g[0]) + '" y="' + fmt(g[1]) + '" text-anchor="middle" ' +
                 'dominant-baseline="central" font-size="15" fill="' + colour + '">' +
                 (STATION_GLYPH[s.key] || '✦') + '</text>');

      var lp = polar(R.stationLabel, ang);
      var subNames = s.alt + (s.term ? ' · ' + s.term.hanzi + ' ' + s.term.pinyin : '');
      var subDay = 'Day ' + s.dayNumber;
      parts.push(rotLabel(ang, lp[0], lp[1],
        '<text class="station-label" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1]) +
        '" text-anchor="middle" dominant-baseline="middle">' + esc(s.name) + '</text>' +
        '<text class="station-sub" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1] + R.subDy) +
        '" text-anchor="middle" dominant-baseline="middle">' + esc(subNames) + '</text>' +
        '<text class="station-sub" x="' + fmt(lp[0]) + '" y="' + fmt(lp[1] + R.subDy2) +
        '" text-anchor="middle" dominant-baseline="middle">' + esc(subDay) + '</text>'));

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
      var glyph = Stars.dipperGlyph(eveJD, cycle.lat, cycle.lon, R.skyClockR * 1.5);
      var cp = polar(R.skyClock, ang);
      if (glyph) {
        // Each star is three stacked circles — a wide soft halo, a tighter
        // brighter one, and a small solid core — which reads as a glow
        // without needing an SVG filter.
        var starDots = glyph.stars.map(function (st) {
          var x = st.x.toFixed(1), y = st.y.toFixed(1);
          return '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#fff" opacity=".16"/>' +
                 '<circle cx="' + x + '" cy="' + y + '" r="5" fill="#fff" opacity=".38"/>' +
                 '<circle cx="' + x + '" cy="' + y + '" r="2.3" fill="#fff"/>';
        }).join('');
        parts.push('<g transform="translate(' + fmt(cp[0]) + ' ' + fmt(cp[1]) + ')">' +
          '<circle r="' + R.skyClockR + '" fill="var(--sky-patch)" stroke="var(--line)" stroke-width="1"/>' +
          '<path d="' + glyph.bowl + '" fill="none" stroke="#dfe6ff" stroke-width="1.6" opacity=".8" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
          '<path d="' + glyph.handle + '" fill="none" stroke="#dfe6ff" stroke-width="1.6" opacity=".8" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
          starDots +
          '<title>The Big Dipper facing north at nightfall on this date, from this place. ' +
          (glyph.polarisUp ? 'Polaris is above the horizon too.' : '') + '</title>' +
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

  /* The transform that frames one season, or the identity for the whole year. */
  function transformFor(cycle, level, seasonIndex) {
    if (level !== 'season' || seasonIndex == null) return { transform: 'none', zoomed: false, rotation: 0 };
    var s = cycle.seasons[seasonIndex];
    var a1 = dayEdge(cycle, s.startDay);
    var a2 = s.endDay >= cycle.length ? 360 : dayEdge(cycle, s.endDay + 1);
    var span = ((a2 - a1) % 360 + 360) % 360 || 360;
    var mid = a1 + span / 2;
    var k = 2.0;
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
