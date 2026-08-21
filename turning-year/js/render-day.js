/* render-day.js — the twenty-four hour clock for a single day.
 * Midnight sits at the top and the day runs clockwise. Angles come from the
 * real elapsed fraction of the local day, so a daylight-saving day of 23 or 25
 * hours still closes the circle honestly.
 */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Globe = global.Globe, Clock = global.Clock;
  var CX = 500, CY = 500;
  var R = {
    /* The day's own dial, outside everything: one turn is the whole span of
     * this date, so it closes exactly at midnight however many hours the date
     * actually ran. */
    cycleRing: 512,
    /* The planets' own band, in the clear space between the moon ring and the
     * reach of the altitude curves, which stop at 322. */
    planetOut: 356, planetLabel: 342, planetIn: 328,
    eventLabel: 486, hourNum: 462, tickOut: 454, tickIn: 444,
    sunOut: 440, sunIn: 402,
    moonOut: 394, moonIn: 362, moonLabel: 378,
    horizon: 252, altScale: 70,
    hub: 176, globe: 150
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
    if (a2 - a1 >= 359.999) {
      return 'M' + (CX - r2) + ' ' + CY + 'a' + r2 + ' ' + r2 + ' 0 1 1 ' + (2 * r2) + ' 0' +
             'a' + r2 + ' ' + r2 + ' 0 1 1 ' + (-2 * r2) + ' 0Z' +
             'M' + (CX - r1) + ' ' + CY + 'a' + r1 + ' ' + r1 + ' 0 1 0 ' + (2 * r1) + ' 0' +
             'a' + r1 + ' ' + r1 + ' 0 1 0 ' + (-2 * r1) + ' 0Z';
    }
    var laf = (a2 - a1) > 180 ? 1 : 0;
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + r2 + ' ' + r2 + ' 0 ' + laf + ' 1 ' +
           f(p2[0]) + ' ' + f(p2[1]) + 'L' + f(p3[0]) + ' ' + f(p3[1]) +
           'A' + r1 + ' ' + r1 + ' 0 ' + laf + ' 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }
  function tangent(a) { return (a > 90 && a < 270) ? a + 180 : a; }

  var TWILIGHT = [
    { key: 'day',  min: -0.833, fill: 'url(#dg-gold)',      label: 'Daylight' },
    { key: 'civil', min: -6,    fill: 'var(--twilight-1)',  label: 'Civil twilight' },
    { key: 'naut',  min: -12,   fill: 'var(--twilight-2)',  label: 'Nautical twilight' },
    { key: 'astro', min: -18,   fill: 'var(--twilight-3)',  label: 'Astronomical twilight' },
    { key: 'night', min: -91,   fill: 'var(--night)',       label: 'Night' }
  ];
  function bandFor(alt) {
    for (var i = 0; i < TWILIGHT.length; i++) if (alt >= TWILIGHT[i].min) return i;
    return TWILIGHT.length - 1;
  }

  /* Sample the sky across the day: altitudes every ~2 minutes. */
  /* The span of time the dial covers.
   *
   * With daylight saving on that is the calendar date as the wall clock draws
   * it, midnight to midnight, which twice a year runs 23 or 25 hours.
   *
   * With it off the date is bounded by standard midnights instead, so every
   * day of the year is exactly 24 hours and the hour ring is even. Keeping
   * the shifted clock's boundaries here would leave the autumn date running
   * from 23 round to 23 again, which is the wall clock's oddity showing
   * through a setting whose whole purpose is to remove it. */
  function dayWindow(cycle, day, useDST) {
    if (useDST) return { start: day.date, end: day.end };
    var p = TZ.civilParts(cycle.tz, day.date);
    var start = new Date(Date.UTC(p.year, p.month - 1, p.day) - cycle.standardOffsetMin * 60000);
    return { start: start, end: new Date(start.getTime() + 86400000) };
  }

  function sample(cycle, day, win) {
    var start = win.start.getTime(), end = win.end.getTime();
    var span = end - start;
    var steps = 720, out = [];
    for (var i = 0; i <= steps; i++) {
      var ms = start + span * (i / steps);
      var jd = A.jdFromDate(new Date(ms));
      var jde = A.jdeFromJD(jd);
      var s = A.sunPosition(jde), m = A.moonPosition(jde);
      out.push({
        t: ms, angle: 360 * i / steps,
        sunAlt: A.altitudeOf(s.ra, s.dec, jd, cycle.lat, cycle.lon),
        moonAlt: A.altitudeOf(m.ra, m.dec, jd, cycle.lat, cycle.lon),
        moonH0: 0.7275 * m.parallax - 0.5667
      });
    }
    return out;
  }

  function runsOf(samples, classify) {
    var runs = [], cur = null;
    for (var i = 0; i < samples.length; i++) {
      var k = classify(samples[i]);
      if (!cur || cur.key !== k) {
        cur = { key: k, a1: samples[i].angle, a2: samples[i].angle };
        runs.push(cur);
      } else cur.a2 = samples[i].angle;
    }
    // Close the last run onto 360 so the ring has no seam.
    if (runs.length) runs[runs.length - 1].a2 = 360;
    return runs;
  }

  function render(cycle, day, opts) {
    var useDST = opts.useDST !== false;
    var win = dayWindow(cycle, day, useDST);
    var s = sample(cycle, day, win);
    var parts = [];
    var angleOf = function (date) {
      if (!date) return null;
      var span = win.end.getTime() - win.start.getTime();
      return 360 * (date.getTime() - win.start.getTime()) / span;
    };

    parts.push('<defs>' +
      '<linearGradient id="dg-gold" x1="0" y1="1" x2="0" y2="0">' +
      '<stop offset="0%" stop-color="var(--sun)"/><stop offset="100%" stop-color="var(--sun-bright)"/>' +
      '</linearGradient></defs>');

    /* ---- sun band: day, three twilights, night --------------------------- */
    runsOf(s, function (p) { return bandFor(p.sunAlt); }).forEach(function (run) {
      var band = TWILIGHT[run.key];
      parts.push('<path d="' + sector(R.sunIn, R.sunOut, run.a1, run.a2) + '" fill="' + band.fill +
                 '"' + (band.key === 'day' ? ' opacity=".95"' : '') + ' fill-rule="evenodd"/>');
    });
    parts.push('<circle cx="500" cy="500" r="' + R.sunOut + '" fill="none" stroke="var(--line)" stroke-width="1"/>');
    parts.push('<circle cx="500" cy="500" r="' + R.sunIn + '" fill="none" stroke="var(--line)" stroke-width="1"/>');

    /* ---- moon band ------------------------------------------------------- */
    var anyMoon = false;
    parts.push('<path d="' + sector(R.moonIn, R.moonOut, 0, 360) + '" fill="var(--line-soft)" fill-rule="evenodd"/>');
    runsOf(s, function (p) { return p.moonAlt >= p.moonH0 ? 'up' : 'down'; }).forEach(function (run) {
      if (run.key !== 'up') return;
      anyMoon = true;
      parts.push('<path d="' + sector(R.moonIn, R.moonOut, run.a1, run.a2) +
                 '" fill="var(--moon)" fill-opacity="' + f(0.12 + 0.7 * day.moonIllumination) +
                 '" fill-rule="evenodd"/>');
    });
    parts.push('<circle cx="500" cy="500" r="' + R.moonOut + '" fill="none" stroke="var(--line-soft)" stroke-width="1"/>');

    /* ---- altitude plot ---------------------------------------------------- */
    var horizonR = R.horizon;
    parts.push('<circle cx="500" cy="500" r="' + horizonR + '" fill="none" stroke="var(--line)" ' +
               'stroke-width="1" stroke-dasharray="3 5"/>');
    [30, 60, 90].forEach(function (deg) {
      parts.push('<circle cx="500" cy="500" r="' + f(horizonR + deg / 90 * R.altScale) +
                 '" fill="none" stroke="var(--line-soft)" stroke-width=".7"/>');
      parts.push('<text x="500" y="' + f(CY - horizonR - deg / 90 * R.altScale - 3) +
                 '" text-anchor="middle" font-size="9" fill="var(--ink-3)">' + deg + '°</text>');
    });

    var altR = function (alt) { return horizonR + Math.max(-90, Math.min(90, alt)) / 90 * R.altScale; };
    var sunLine = [], moonLine = [];
    s.forEach(function (p, i) {
      var q = polar(altR(p.sunAlt), p.angle);
      sunLine.push((i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]));
      var r2 = polar(altR(p.moonAlt), p.angle);
      moonLine.push((i ? 'L' : 'M') + f(r2[0]) + ' ' + f(r2[1]));
    });
    // Fill between the sun curve and the horizon, gold above and dark below.
    var horizonCircle = 'M' + (CX - horizonR) + ' ' + CY +
      'a' + horizonR + ' ' + horizonR + ' 0 1 0 ' + (2 * horizonR) + ' 0' +
      'a' + horizonR + ' ' + horizonR + ' 0 1 0 ' + (-2 * horizonR) + ' 0Z';
    parts.push('<path d="' + sunLine.join('') + 'Z' + horizonCircle + '" fill-rule="evenodd" ' +
               'fill="var(--sun)" opacity=".22"/>');
    parts.push('<path d="' + sunLine.join('') + 'Z" fill="none" stroke="var(--sun-bright)" stroke-width="2"/>');
    parts.push('<path d="' + moonLine.join('') + 'Z" fill="none" stroke="var(--moon)" stroke-width="1.4" ' +
               'stroke-dasharray="5 4" opacity=".8"/>');
    parts.push('<text x="500" y="' + f(CY - horizonR - 4) + '" text-anchor="middle" font-size="10" ' +
               'fill="var(--ink-3)">horizon</text>');

    /* ---- hour ticks and numerals ------------------------------------------
     * Walk the day's real elapsed span in one-hour steps and label each mark
     * with whatever the chosen clock reads there. Asking instead for "hour 0
     * through 23" by name breaks on the changeover days: the vanished hour
     * resolves back onto its neighbour and gets drawn twice in one spot, and
     * the repeated hour is drawn only once.
     *
     * Stepping through real time draws what the clock actually did. With
     * daylight saving on, a spring-forward date has no mark where the lost
     * hour would be and an autumn date carries the repeated hour twice. With
     * it off the ring is even the whole year round. */
    var HOUR_MS = 3600000;
    for (var tms = win.start.getTime(); tms < win.end.getTime(); tms += HOUR_MS) {
      var inst = new Date(tms);
      var hv = Clock.hoursOf(cycle, inst, useDST);
      if (Math.abs(hv - Math.round(hv)) > 1 / 120) continue;   // half-hour zones
      var h = Math.round(hv) % 24;
      var a = angleOf(inst);
      var major = h % 6 === 0;
      var p1 = polar(major ? R.tickIn - 6 : R.tickIn, a), p2 = polar(R.tickOut, a);
      parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]) +
                 '" stroke="var(--line)" stroke-width="' + (major ? 1.6 : .8) + '"/>');
      var np = polar(R.hourNum, a);
      parts.push('<text x="' + f(np[0]) + '" y="' + f(np[1]) + '" text-anchor="middle" ' +
                 'dominant-baseline="middle" font-size="' + (major ? 14 : 10) + '" fill="var(--ink-' +
                 (major ? '2' : '3') + ')" transform="rotate(' + f(tangent(a)) + ' ' + f(np[0]) + ' ' +
                 f(np[1]) + ')">' + (opts.hour12 ? hour12(h) : (h === 0 ? 24 : h)) + '</text>');
    }

    /* ---- the clock changeover, when there is one ---------------------------
     * Only the wall clock jumps. With daylight saving off nothing happens at
     * this instant at all, so the mark would claim an event the dial does
     * not have. */
    if (useDST && day.clockShiftMinutes && day.clockShiftAt) {
      var ca = angleOf(day.clockShiftAt);
      if (ca !== null && ca >= 0 && ca <= 360) {
        var c1 = polar(R.sunIn - 8, ca), c2 = polar(R.sunOut + 10, ca);
        parts.push('<path d="M' + f(c1[0]) + ' ' + f(c1[1]) + 'L' + f(c2[0]) + ' ' + f(c2[1]) +
                   '" stroke="var(--cross)" stroke-width="2" stroke-dasharray="4 3"/>');
        var cl = polar(R.eventLabel, ca);
        parts.push('<text x="' + f(cl[0]) + '" y="' + f(cl[1]) + '" text-anchor="middle" ' +
                   'dominant-baseline="middle" font-size="11" fill="var(--cross)" transform="rotate(' +
                   f(tangent(ca)) + ' ' + f(cl[0]) + ' ' + f(cl[1]) + ')">clocks ' +
                   (day.clockShiftMinutes > 0 ? 'forward' : 'back') + '</text>');
      }
    }

    /* ---- which instants belong to this dial --------------------------------
     * Each mark is looked up across yesterday, today and tomorrow and kept if
     * it lands inside the window. With daylight saving on the window is the
     * calendar date and this changes nothing. With it off the window sits an
     * hour away from that date through the summer, and a peak darkness just
     * after civil midnight then belongs to the neighbouring date: taking the
     * marks from the date alone would drop it off the dial entirely. Exactly
     * one of each kind falls in any 24-hour span, so gathering three days
     * cannot produce a duplicate. */
    var neighbours = [cycle.days[day.n - 2], day, cycle.days[day.n]];
    function markFor(key, altKey) {
      for (var i = 0; i < neighbours.length; i++) {
        var nd = neighbours[i];
        if (!nd || !nd[key]) continue;
        if (nd[key] < win.start || nd[key] >= win.end) continue;
        return { t: nd[key], alt: altKey ? nd[altKey] : null };
      }
      return null;
    }

    /* Where no date supplies a transit, take it from the window's own curve.
     * The model keeps one transit per calendar date, which is right almost
     * always but cannot describe a 25-hour date holding two lower transits:
     * it records one and the other is lost, leaving a gap on the dial beside
     * it. The sampled curve spans exactly this window, so its extreme is by
     * construction the one wanted. An extreme sitting on the first or last
     * sample means the real turning point lies outside, and there is then
     * genuinely nothing here to mark. */
    function transitFromCurve(wantMax) {
      var bi = 0;
      for (var i = 1; i < s.length; i++) {
        if (wantMax ? s[i].sunAlt > s[bi].sunAlt : s[i].sunAlt < s[bi].sunAlt) bi = i;
      }
      if (bi === 0 || bi === s.length - 1) return null;
      function alt(ms) {
        var j = A.jdFromDate(new Date(ms)), sp = A.sunPosition(A.jdeFromJD(j));
        return A.altitudeOf(sp.ra, sp.dec, j, cycle.lat, cycle.lon);
      }
      var phi = 0.6180339887, lo = s[bi - 1].t, hi = s[bi + 1].t;
      var c = hi - phi * (hi - lo), e = lo + phi * (hi - lo);
      for (var k = 0; k < 60 && hi - lo > 500; k++) {
        var fc = wantMax ? alt(c) : -alt(c), fe = wantMax ? alt(e) : -alt(e);
        if (fc > fe) hi = e; else lo = c;
        c = hi - phi * (hi - lo); e = lo + phi * (hi - lo);
      }
      var mid = (lo + hi) / 2;
      return { t: new Date(mid), alt: alt(mid) };
    }

    var marks = {
      sunrise: markFor('sunrise'), sunset: markFor('sunset'),
      solarNoon: markFor('solarNoon', 'maxSunAltitude') || transitFromCurve(true),
      solarMidnight: markFor('solarMidnight', 'minSunAltitude') || transitFromCurve(false),
      moonrise: markFor('moonrise'), moonset: markFor('moonset')
    };

    /* ---- peaks: the sun's two meridian crossings ---------------------------
     * Peak sun is the upper transit, the moment it is highest; peak darkness
     * the lower transit, when it is furthest below. They are the maximum and
     * minimum of the altitude curve drawn above, so both are marked on the
     * curve itself as well as round the rim. The middle of the dark is shown
     * too, as a second reading of the same idea: it sits within a minute of
     * the lower transit at most latitudes. */
    var darkBracket = marks.solarMidnight
      ? A.darkBracket(A.jdFromDate(marks.solarMidnight.t), cycle.lat, cycle.lon) : null;
    var darkMidpoint = darkBracket
      ? A.dateFromJD((darkBracket.set + darkBracket.rise) / 2) : null;

    function markOnCurve(when, colour, r) {
      if (!when) return;
      var jd = A.jdFromDate(when), sp = A.sunPosition(A.jdeFromJD(jd));
      var altv = A.altitudeOf(sp.ra, sp.dec, jd, cycle.lat, cycle.lon);
      var q = polar(altR(altv), angleOf(when));
      parts.push('<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="' + r +
                 '" fill="' + colour + '" stroke="var(--bg)" stroke-width="1.2"/>');
    }
    markOnCurve(marks.solarNoon && marks.solarNoon.t, 'var(--sun-bright)', 5);
    markOnCurve(marks.solarMidnight && marks.solarMidnight.t, 'var(--equinox)', 5);

    if (darkMidpoint) {
      var dm = angleOf(darkMidpoint);
      if (dm !== null && dm >= 0 && dm <= 360) {
        var d1 = polar(R.horizon - R.altScale - 10, dm), d2 = polar(R.horizon + R.altScale + 10, dm);
        parts.push('<path d="M' + f(d1[0]) + ' ' + f(d1[1]) + 'L' + f(d2[0]) + ' ' + f(d2[1]) +
                   '" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="2 4" opacity=".7"/>');
      }
    }

    /* ---- where the moon stands ---------------------------------------------
     * The dial already samples the moon's altitude across the window, so its
     * high point falls out of that curve; the compass bearing is worked out
     * at the instant found. A high point sitting on the first or last sample
     * means the moon was still climbing or already falling the whole way
     * through, and this window holds no culmination. For today the present
     * position is the more useful of the two, so both are handed back. */
    function moonAt(when) {
      var jd = A.jdFromDate(when), m = A.moonPosition(A.jdeFromJD(jd));
      return { t: when,
               alt: A.altitudeOf(m.ra, m.dec, jd, cycle.lat, cycle.lon),
               az: A.azimuthOf(m.ra, m.dec, jd, cycle.lat, cycle.lon) };
    }
    var moonHigh = null, bm = 0;
    for (var mi = 1; mi < s.length; mi++) if (s[mi].moonAlt > s[bm].moonAlt) bm = mi;
    if (bm > 0 && bm < s.length - 1) moonHigh = moonAt(new Date(s[bm].t));
    var moonNow = (opts.now && opts.now >= win.start && opts.now < win.end)
      ? moonAt(opts.now) : null;

    /* ---- event markers ----------------------------------------------------- */
    var SPECS = [
      ['sunrise',       'Sunrise',       'var(--sun-bright)', 'sun'],
      ['sunset',        'Sunset',        'var(--sun-bright)', 'sun'],
      ['solarNoon',     'Peak sun',      'var(--sun-bright)', 'sun'],
      ['solarMidnight', 'Peak darkness', 'var(--equinox)',    'sun'],
      ['moonrise',      'Moonrise',      'var(--moon)',       'moon'],
      ['moonset',       'Moonset',       'var(--moon)',       'moon']
    ];
    var events = [];
    SPECS.forEach(function (sp) {
      var m = marks[sp[0]];
      if (!m) return;
      var moon = sp[3] === 'moon';
      events.push({ t: m.t, label: sp[1], colour: sp[2], group: sp[3],
                    r1: moon ? R.moonIn - 8 : R.sunIn - 8,
                    r2: moon ? R.moonOut + 8 : R.sunOut + 10 });
    });
    /* The planets get the same treatment the moon does: a tick across their
     * own band, a dot, and a label carrying the time. Ten of them would crowd
     * the sun's rim and bury the moon's, so they have a ring to themselves in
     * the clear space between the moon band and the altitude curves, and the
     * tiering below spreads any that fall within half an hour of each other.
     * The arrow says which way the planet is crossing. */
    if (opts.planets && global.Planets) {
      var PL = global.Planets;
      PL.ORDER.forEach(function (nm) {
        var rs = A.riseSet(nm, A.jdFromDate(win.start), 1, cycle.lat, cycle.lon);
        [['\u2191', rs && rs.rise], ['\u2193', rs && rs.set]].forEach(function (ev) {
          if (!ev[1]) return;
          events.push({ t: A.dateFromJD(ev[1]), group: 'planet',
                        label: PL.GLYPH[nm] + ev[0], colour: PLANET_COLOUR[nm],
                        full: nm + (ev[0] === '\u2191' ? ' rises' : ' sets'),
                        r1: R.planetIn, r2: R.planetOut });
        });
      });
    }

    /* The present moment, when the day on screen is today. It carries a time
     * like every other mark, and reads by whichever clock is set, so toggling
     * daylight saving moves the number here along with all the rest. It joins
     * the sun family so the tiering keeps it clear of sunrise and peak sun. */
    if (opts.now && opts.now >= win.start && opts.now < win.end) {
      events.push({ t: opts.now, label: 'Now', colour: 'var(--today)', group: 'sun',
                    r1: R.hub, r2: R.sunOut + 16 });
    }

    /* Sun labels ride the outer rim; moon labels sit down on the moon band
     * itself, on a dark pill so they stay readable over either half of it.
     * Keeping the two families on different rings is what stops a sunrise
     * and a moonrise at the same minute from writing over each other. Within
     * a family, anything still crowded gets nudged to a second tier. */
    events.forEach(function (e) { e.a = angleOf(e.t); });
    events = events.filter(function (e) { return e.a !== null && e.a >= 0 && e.a <= 360; });

    function angDist(x, y) { var d = Math.abs(x - y) % 360; return d > 180 ? 360 - d : d; }
    function assignTiers(group, baseR, stepR, minGap) {
      var gap = minGap || 26;
      var g = events.filter(function (e) { return e.group === group; })
                    .sort(function (x, y) { return x.a - y.a; });
      var placed = [];
      g.forEach(function (e) {
        var tier = 0;
        while (placed.some(function (o) { return o.tier === tier && angDist(o.a, e.a) < gap; })) tier++;
        e.labelR = baseR + tier * stepR;
        placed.push({ a: e.a, tier: tier });
      });
    }
    assignTiers('sun', R.eventLabel, 17);      // outward
    assignTiers('moon', R.moonLabel, -19);     // inward, into the clear gap
    assignTiers('planet', R.planetLabel, -17, 17);  // inward again, on their own ring

    events.forEach(function (e) {
      var p1 = polar(e.r1, e.a), p2 = polar(e.r2, e.a);
      parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]) +
                 '" stroke="' + e.colour + '" stroke-width="2"/>');
      var dot = polar(e.r2, e.a);
      parts.push('<circle cx="' + f(dot[0]) + '" cy="' + f(dot[1]) + '" r="3.4" fill="' + e.colour + '"/>');

      var lp = polar(e.labelR, e.a);
      var txt = e.label + ' ' + Clock.time(cycle, e.t, useDST, opts.hour12);
      var rot = 'rotate(' + f(tangent(e.a)) + ' ' + f(lp[0]) + ' ' + f(lp[1]) + ')';
      if (e.group === 'planet') {
        var pw = txt.length * 5.4 + 12;
        parts.push('<g transform="' + rot + '"><title>' + esc(e.full) + ' ' + txt + '</title>' +
          '<rect x="' + f(lp[0] - pw / 2) + '" y="' + f(lp[1] - 7.5) + '" width="' + f(pw) +
          '" height="15" rx="5" fill="var(--bg-2)" stroke="var(--line)" stroke-width=".6" opacity=".95"/>' +
          '<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="10.5" fill="' + e.colour + '">' + txt + '</text></g>');
      } else if (e.group === 'moon') {
        var w = txt.length * 5.7 + 12;
        parts.push('<g transform="' + rot + '">' +
          '<rect x="' + f(lp[0] - w / 2) + '" y="' + f(lp[1] - 8) + '" width="' + f(w) +
          '" height="16" rx="5" fill="var(--bg-2)" stroke="var(--line)" stroke-width=".6" opacity=".94"/>' +
          '<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="11" fill="' + e.colour + '">' + txt + '</text></g>');
      } else {
        parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
                   'dominant-baseline="middle" font-size="12" fill="' + e.colour + '" transform="' + rot + '">' +
                   txt + '</text>');
      }
    });

    /* ---- the other wanderers ------------------------------------------------
     * Same geometry as the sun and moon: angle is the hour, radius is height
     * above the horizon. Sampled every twentieth step rather than at all 720,
     * because a planet moves at most a degree and a half in a whole day and
     * the curve is smooth at that spacing. */
    /* ---- earth, centred on this place, at this moment ------------------------ */
    if (Globe && opts.globe !== false) {
      var globeInstant = (opts.now && opts.now >= win.start && opts.now < win.end) ? opts.now : day.solarNoon;
      if (globeInstant) {
        var gjd = A.jdFromDate(globeInstant), gjde = A.jdeFromJD(gjd);
        parts.push('<g transform="translate(500 500)">' +
          Globe.render(gjde, gjd, cycle.lat, cycle.lon, R.globe) + '</g>');
      }
    }

    /* Whose sky this is. It sits under the globe rather than across it, so
     * the dot marking this place at the centre stays uncovered. */
    var placeName = (opts.placeName || '').trim();
    if (placeName) {
      parts.push('<text x="500" y="' + (CY + 168) + '" text-anchor="middle" font-size="12.5" ' +
        'fill="var(--ink-2)">' + esc(placeName) + '</text>');
      parts.push('<text x="500" y="' + (CY + 184) + '" text-anchor="middle" font-size="10" ' +
        'font-family="var(--mono)" fill="var(--ink-3)">' +
        Math.abs(cycle.lat).toFixed(2) + '\u00B0' + (cycle.lat < 0 ? 'S' : 'N') + ' ' +
        Math.abs(cycle.lon).toFixed(2) + '\u00B0' + (cycle.lon < 0 ? 'W' : 'E') + '</text>');
    }

    /* Kept for the running ring, which redraws between renders. */
    global.DayView.frame = { start: win.start.getTime(), end: win.end.getTime() };

    return { svg: parts.join(''), samples: s, anyMoon: anyMoon,
             darkMidpoint: darkMidpoint, marks: marks,
             moonHigh: moonHigh, moonNow: moonNow };
  }

  function hour12(h) {
    var x = h % 12; if (x === 0) x = 12;
    return x + (h < 12 ? 'a' : 'p');
  }

  /* "8 h 42 m" from a count of hours. */
  function hm(hours) {
    if (!isFinite(hours)) return 'n/a';
    var total = Math.round(hours * 60);
    return Math.floor(total / 60) + ' h ' + TZ.pad(total % 60) + ' m';
  }

  /* Muted enough to sit under the sun and moon rather than compete with
   * them, and distinct enough to tell apart. Fixed rather than themed: these
   * five need to stay separable from each other in both palettes. */
  var PLANET_COLOUR = {
    Mercury: '#8fa3b8', Venus: '#c98fb9', Mars: '#d1685a',
    Jupiter: '#c9a24a', Saturn: '#8d8ab5'
  };

  var SEASON_CURVE = {
    'winter-solstice': { color: 'var(--solstice)', dash: '',      label: 'Winter Solstice' },
    'spring-equinox':  { color: 'var(--equinox)',  dash: '',      label: 'Spring Equinox' },
    'summer-solstice': { color: 'var(--solstice)', dash: '6 4',   label: 'Summer Solstice' },
    'autumn-equinox':  { color: 'var(--equinox)',  dash: '6 4',   label: 'Autumn Equinox' }
  };

  /* A small Cartesian chart overlaying the sun's altitude across the day for
   * each of the four cardinal stations, so their arcs can be compared
   * directly: how much higher and longer the summer arc runs than winter's,
   * and how the equinoxes split the difference. */
  function renderCompare(cycle) {
    var W = 640, H = 300, padL = 34, padR = 10, padT = 10, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var yMin = -30, yMax = 90;
    function yOf(alt) { return padT + (yMax - alt) / (yMax - yMin) * plotH; }
    function xOf(hourFrac) { return padL + hourFrac / 24 * plotW; }

    var parts = [];
    [0, 30, 60, 90].forEach(function (deg) {
      var y = yOf(deg);
      parts.push('<line x1="' + padL + '" y1="' + f(y) + '" x2="' + (padL + plotW) + '" y2="' + f(y) +
                 '" stroke="' + (deg === 0 ? 'var(--line)' : 'var(--line-soft)') + '" stroke-width="' +
                 (deg === 0 ? 1 : .6) + '"/>');
      parts.push('<text x="' + (padL - 5) + '" y="' + f(y) + '" text-anchor="end" dominant-baseline="middle" ' +
                 'font-size="9.5" fill="var(--ink-3)">' + deg + '°</text>');
    });
    for (var h = 0; h <= 24; h += 6) {
      var x = xOf(h);
      parts.push('<line x1="' + f(x) + '" y1="' + padT + '" x2="' + f(x) + '" y2="' + (padT + plotH) +
                 '" stroke="var(--line-soft)" stroke-width=".5"/>');
      parts.push('<text x="' + f(x) + '" y="' + (padT + plotH + 15) + '" text-anchor="middle" ' +
                 'font-size="9.5" fill="var(--ink-3)">' + h + '</text>');
    }

    var curves = [];
    cycle.stations.filter(function (s) { return s.offset % 90 === 0 && s.dayNumber; }).forEach(function (s) {
      var style = SEASON_CURVE[s.key];
      if (!style) return;
      var day = cycle.days[s.dayNumber - 1];
      /* Standard midnights for all four, so every curve spans exactly 24 hours
       * and the shared axis means the same thing on each. A daylight-saving
       * day would run 23 or 25 and make the comparison lie. */
      var samples = sample(cycle, day, dayWindow(cycle, day, false));
      var d = '';
      samples.forEach(function (p, i) {
        var hourFrac = p.angle / 360 * 24;
        var alt = Math.max(yMin, Math.min(yMax, p.sunAlt));
        d += (i ? 'L' : 'M') + f(xOf(hourFrac)) + ' ' + f(yOf(alt));
      });
      parts.push('<path d="' + d + '" fill="none" stroke="' + style.color + '" stroke-width="2.2"' +
                 (style.dash ? ' stroke-dasharray="' + style.dash + '"' : '') + '/>');
      curves.push({ key: s.key, label: style.label, color: style.color, dash: style.dash,
                    maxAlt: Math.round(day.maxSunAltitude), daylight: hm(day.daylightHours) });
    });

    return { svg: parts.join(''), width: W, height: H, curves: curves };
  }

  /* The day as one turn of a ring, filled behind and open ahead, drawn on the
   * same span the hour numerals are drawn on. On the two changeover days that
   * span is 23 or 25 hours, and the ring still closes exactly at midnight,
   * because it measures the date against itself rather than against 24. */
  function clock(nowMs) {
    var fr = global.DayView.frame;
    if (!fr || nowMs < fr.start || nowMs >= fr.end) return '';
    var frac = (nowMs - fr.start) / (fr.end - fr.start);
    var p = [];
    p.push('<circle cx="500" cy="500" r="' + R.cycleRing + '" fill="none" ' +
           'stroke="var(--line)" stroke-width="4" pointer-events="none"/>');
    if (frac > 0.0005) {
      var c0 = polar(R.cycleRing, 0), c1 = polar(R.cycleRing, frac * 360);
      p.push('<path d="M ' + f(c0[0]) + ' ' + f(c0[1]) + ' A ' + R.cycleRing + ' ' + R.cycleRing +
             ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + f(c1[0]) + ' ' + f(c1[1]) +
             '" fill="none" stroke="var(--sun)" stroke-width="4" stroke-linecap="round" ' +
             'pointer-events="none"/>');
      p.push('<circle cx="' + f(c1[0]) + '" cy="' + f(c1[1]) + '" r="5.5" ' +
             'fill="var(--today)" pointer-events="none"/>');
    }
    p.push('<circle cx="500" cy="' + (CY - R.cycleRing) + '" r="2.2" ' +
           'fill="var(--ink-3)" pointer-events="none"/>');
    return p.join('');
  }

  global.DayView = {
    clock: clock, frame: null, render: render, renderCompare: renderCompare, hm: hm, R: R };
})(typeof window !== 'undefined' ? window : globalThis);
