/* spiral.js — the years as a helix rather than a closed ring.
 *
 * The wheel has to close: it is a circle, so day 365 lands back beside day 1.
 * Time doesn't do that. Day 365 hands off to the *next* cycle's day 1, a turn
 * further along, and the seam you can see on the wheel is exactly where that
 * hand-off is being folded flat. This view unrolls it: one turn per cycle,
 * advancing left to right, so the same instant that looks like a jump on the
 * wheel is simply the line carrying on into the next coil.
 *
 * Daylight here comes from the analytic hour-angle formula rather than a
 * rise/set search — the same quantity to within about a minute (verified
 * against the search at several latitudes), but cheap enough to sample several
 * years at once without a visible pause.
 */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ;
  var DEG = Math.PI / 180, RAD = 180 / Math.PI;

  /* Hours between sunrise and sunset for a given solar declination and
   * latitude, including the standard -0.833 deg refracted horizon. */
  function daylightHours(dec, lat) {
    var cosH = (Math.sin(-0.833 * DEG) - Math.sin(lat * DEG) * Math.sin(dec * DEG)) /
               (Math.cos(lat * DEG) * Math.cos(dec * DEG));
    if (cosH <= -1) return 24;      // midnight sun
    if (cosH >= 1) return 0;        // polar night
    return 2 * Math.acos(cosH) * RAD / 15;
  }

  /* Samples `span` cycles either side of centerYear.
   *
   * Length has to be counted in local civil days, exactly as the wheel counts
   * them — day 1 is the local date the solstice falls on, through to the day
   * before the next one. Measuring the raw solstice-to-solstice interval
   * instead would give 365.2422 every single time and round to 365 always,
   * which would quietly contradict the wheel on precisely the cycles that run
   * to 366. That difference is the whole point of this view. */
  function build(opts) {
    var lat = opts.lat, tz = opts.tz, span = opts.span == null ? 2 : opts.span;
    var southern = lat < 0 && opts.anchorMode !== 'december';
    var anchorLon = southern ? 90 : 270;
    var stepDays = opts.stepDays || 2;
    var turns = [];
    var DAY_MS = 86400000;

    function civilDay1(year) {
      var inst = A.dateFromJD(A.jdFromJDE(A.seasonalPointJDE(year, anchorLon)));
      var cp = TZ.civilParts(tz, inst);
      return TZ.startOfDay(tz, cp.year, cp.month, cp.day);
    }

    for (var y = opts.centerYear - span; y <= opts.centerYear + span; y++) {
      var day1 = civilDay1(y), nextDay1 = civilDay1(y + 1);
      var lengthDays = Math.round((nextDay1.getTime() - day1.getTime()) / DAY_MS);
      var startJD = A.jdFromDate(day1);
      var samples = [];
      for (var t = 0; t <= lengthDays; t += stepDays) {
        var dec = A.sunPosition(A.jdeFromJD(startJD + t + 0.5)).dec;   // local midday
        samples.push({
          f: t / lengthDays,                   // 0..1 through this cycle
          dec: dec,
          daylight: daylightHours(dec, lat)
        });
      }
      turns.push({
        year: y, startJD: startJD, endJD: startJD + lengthDays,
        days: lengthDays, samples: samples,
        isCenter: y === opts.centerYear
      });
    }
    return { turns: turns, lat: lat, southern: southern, centerYear: opts.centerYear };
  }

  var W = 900, H = 460;
  var GEO = { x0: 104, y0: 232, Ry: 104, Rx: 60, pitch: 146 };

  /* A point on the helix: `turnIndex` picks the coil, `f` the fraction round
   * it. Depth (toward/away from the viewer) is returned so the far half of
   * each coil can be drawn dimmer, which is what makes it read as 3D. */
  function point(turnIndex, f) {
    var theta = f * 2 * Math.PI;
    return {
      x: GEO.x0 + (turnIndex + f) * GEO.pitch + GEO.Rx * Math.sin(theta),
      // +cos, not -cos: the coil climbs toward the summer solstice at the top
      // and falls back to winter at the bottom, the same "gaining then losing
      // the light" reading the wheel has.
      y: GEO.y0 + GEO.Ry * Math.cos(theta),
      depth: Math.sin(theta)                  // +1 nearest viewer, -1 furthest
    };
  }

  function daylightColour(h) {
    // Same reading as the wheel: gold for long days, deep blue for long nights.
    var t = Math.max(0, Math.min(1, h / 24));
    return t > 0.5 ? 'var(--sun)' : 'var(--night-2)';
  }

  function render(data, opts) {
    var parts = [];
    var todayJD = opts && opts.todayJD;

    // Faint axis showing the direction time runs.
    var axisY = GEO.y0;
    parts.push('<line x1="' + (GEO.x0 - 40) + '" y1="' + axisY + '" x2="' +
               (GEO.x0 + (data.turns.length) * GEO.pitch + 40) + '" y2="' + axisY +
               '" stroke="var(--line-soft)" stroke-width="1" stroke-dasharray="4 6"/>');

    data.turns.forEach(function (turn, ti) {
      var dim = turn.isCenter ? 1 : 0.38;
      var segs = [];
      for (var i = 0; i < turn.samples.length - 1; i++) {
        var a = point(ti, turn.samples[i].f), b = point(ti, turn.samples[i + 1].f);
        // Far side of the coil recedes; near side comes forward.
        var depthOpacity = 0.35 + 0.65 * ((a.depth + 1) / 2);
        segs.push('<line x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) +
                  '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) +
                  '" stroke="' + daylightColour(turn.samples[i].daylight) +
                  '" stroke-width="' + (turn.isCenter ? 4 : 2.8) +
                  '" stroke-linecap="round" opacity="' +
                  (depthOpacity * dim).toFixed(2) + '"/>');
      }
      parts.push('<g>' + segs.join('') + '</g>');

      // Year label under each coil.
      var lab = point(ti, 0.5);
      parts.push('<text x="' + (GEO.x0 + (ti + 0.5) * GEO.pitch).toFixed(1) + '" y="' +
                 (GEO.y0 + GEO.Ry + 34) + '" text-anchor="middle" font-size="12" fill="var(--ink-' +
                 (turn.isCenter ? '2' : '3') + ')">' + turn.year + '</text>');
      parts.push('<text x="' + (GEO.x0 + (ti + 0.5) * GEO.pitch).toFixed(1) + '" y="' +
                 (GEO.y0 + GEO.Ry + 50) + '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' +
                 turn.days + ' days</text>');
    });

    // The four cardinal stations sit at the same fraction of every turn, so
    // joining them across coils shows the seasons recurring: the helix's
    // "vertical" structure, the thing a flat ring can't show.
    var STATIONS = [
      { f: 0.00, name: 'Winter solstice', colour: 'var(--solstice)', dy: 18 },
      { f: 0.25, name: 'Spring equinox', colour: 'var(--equinox)', dy: -10 },
      { f: 0.50, name: 'Summer solstice', colour: 'var(--solstice)', dy: -12 },
      { f: 0.75, name: 'Autumn equinox', colour: 'var(--equinox)', dy: 16 }
    ];
    STATIONS.forEach(function (st) {
      var pts = [];
      data.turns.forEach(function (turn, ti) {
        var p = point(ti, st.f);
        pts.push(p);
        parts.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
                   '" r="' + (turn.isCenter ? 4 : 2.8) + '" fill="' + st.colour +
                   '" opacity="' + (turn.isCenter ? 1 : .5) + '"/>');
      });
      parts.push('<path d="' + pts.map(function (p, i) {
        return (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
      }).join('') + '" fill="none" stroke="' + st.colour +
      '" stroke-width="1" stroke-dasharray="3 5" opacity=".45"/>');
      var last = pts[pts.length - 1];
      parts.push('<text x="' + (last.x + 12).toFixed(1) + '" y="' + (last.y + st.dy).toFixed(1) +
                 '" font-size="10.5" fill="' + st.colour + '" opacity=".9">' + st.name + '</text>');
    });

    // The hand-off itself: where one cycle ends and the next begins.
    data.turns.forEach(function (turn, ti) {
      if (ti === data.turns.length - 1) return;
      var p = point(ti, 1);
      parts.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
                 '" r="3" fill="none" stroke="var(--ink-2)" stroke-width="1" opacity=".55"/>');
    });

    // Where today falls on the helix.
    if (todayJD) {
      data.turns.forEach(function (turn, ti) {
        if (todayJD < turn.startJD || todayJD >= turn.endJD) return;
        var f = (todayJD - turn.startJD) / (turn.endJD - turn.startJD);
        var p = point(ti, f);
        parts.push('<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
                   '" r="5" fill="var(--today)"/>');
        parts.push('<text x="' + p.x.toFixed(1) + '" y="' + (p.y - 12).toFixed(1) +
                   '" text-anchor="middle" font-size="10.5" fill="var(--today)">today</text>');
      });
    }

    return { svg: parts.join(''), width: W, height: H };
  }

  global.Spiral = { build: build, render: render, daylightHours: daylightHours, W: W, H: H };
})(typeof window !== 'undefined' ? window : globalThis);
