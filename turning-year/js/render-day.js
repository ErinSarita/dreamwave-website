/* render-day.js — the twenty-four hour clock for a single day.
 * Midnight sits at the top and the day runs clockwise. Angles come from the
 * real elapsed fraction of the local day, so a daylight-saving day of 23 or 25
 * hours still closes the circle honestly.
 */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Globe = global.Globe;
  var CX = 500, CY = 500;
  var R = {
    eventLabel: 486, hourNum: 462, tickOut: 454, tickIn: 444,
    sunOut: 440, sunIn: 402,
    moonOut: 394, moonIn: 362,
    horizon: 252, altScale: 70,
    hub: 176, globe: 150
  };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
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
  function sample(cycle, day) {
    var start = day.date.getTime(), end = day.end.getTime();
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
    var s = sample(cycle, day);
    var parts = [];
    var angleOf = function (date) {
      if (!date) return null;
      var span = day.end.getTime() - day.date.getTime();
      return 360 * (date.getTime() - day.date.getTime()) / span;
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

    /* ---- hour ticks and numerals ------------------------------------------ */
    for (var h = 0; h < 24; h++) {
      var inst = TZ.instantFromCivil(cycle.tz, day.year, day.month, day.day, h, 0, 0);
      if (inst < day.date || inst >= day.end) continue;          // skipped by a DST jump
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

    /* ---- event markers ----------------------------------------------------- */
    var events = [];
    if (day.sunrise) events.push({ t: day.sunrise, label: 'Sunrise', colour: 'var(--sun-bright)', r1: R.sunIn - 8, r2: R.sunOut + 10 });
    if (day.sunset)  events.push({ t: day.sunset,  label: 'Sunset',  colour: 'var(--sun-bright)', r1: R.sunIn - 8, r2: R.sunOut + 10 });
    if (day.solarNoon) events.push({ t: day.solarNoon, label: 'Solar noon', colour: 'var(--sun)', r1: R.sunIn, r2: R.sunOut, thin: true });
    if (day.moonrise) events.push({ t: day.moonrise, label: 'Moonrise', colour: 'var(--moon)', r1: R.moonIn - 8, r2: R.moonOut + 8 });
    if (day.moonset)  events.push({ t: day.moonset,  label: 'Moonset',  colour: 'var(--moon)', r1: R.moonIn - 8, r2: R.moonOut + 8 });

    events.forEach(function (e) {
      var a = angleOf(e.t);
      if (a === null || a < 0 || a > 360) return;
      var p1 = polar(e.r1, a), p2 = polar(e.r2, a);
      parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]) +
                 '" stroke="' + e.colour + '" stroke-width="' + (e.thin ? 1 : 2) + '"' +
                 (e.thin ? ' stroke-dasharray="2 3"' : '') + '/>');
      if (e.thin) return;
      var dot = polar(e.r2, a);
      parts.push('<circle cx="' + f(dot[0]) + '" cy="' + f(dot[1]) + '" r="3.4" fill="' + e.colour + '"/>');
      var lp = polar(R.eventLabel, a);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
                 'dominant-baseline="middle" font-size="12" fill="' + e.colour + '" transform="rotate(' +
                 f(tangent(a)) + ' ' + f(lp[0]) + ' ' + f(lp[1]) + ')">' +
                 e.label + ' ' + TZ.formatTime(cycle.tz, e.t, opts.hour12) + '</text>');
    });

    /* ---- earth, centred on this place, at this moment ------------------------ */
    if (Globe && opts.globe !== false) {
      var globeInstant = (opts.now && opts.now >= day.date && opts.now < day.end) ? opts.now : day.solarNoon;
      if (globeInstant) {
        var gjd = A.jdFromDate(globeInstant), gjde = A.jdeFromJD(gjd);
        parts.push('<g transform="translate(500 500)">' +
          Globe.render(gjde, gjd, cycle.lat, cycle.lon, R.globe) + '</g>');
      }
    }

    /* ---- now ---------------------------------------------------------------- */
    if (opts.now && opts.now >= day.date && opts.now < day.end) {
      var na = angleOf(opts.now);
      var n1 = polar(R.hub, na), n2 = polar(R.sunOut + 16, na);
      parts.push('<path d="M' + f(n1[0]) + ' ' + f(n1[1]) + 'L' + f(n2[0]) + ' ' + f(n2[1]) +
                 '" stroke="var(--today)" stroke-width="1.6"/>');
      var np2 = polar(R.sunOut + 16, na);
      parts.push('<circle cx="' + f(np2[0]) + '" cy="' + f(np2[1]) + '" r="4" fill="var(--today)"/>');
    }

    return { svg: parts.join(''), samples: s, anyMoon: anyMoon };
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
      var samples = sample(cycle, day);
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

  global.DayView = { render: render, renderCompare: renderCompare, hm: hm, R: R };
})(typeof window !== 'undefined' ? window : globalThis);
