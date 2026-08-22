/* render-month.js — one calendar month, opened out of the year wheel.
 *
 * A month is a slice of the year's pie, so this draws it as one: the apex at
 * the bottom, the days fanning up and out, and the same layers the year wheel
 * carries stacked in the same order, clipped to the month and rescaled so
 * thirty-one days get the room three hundred and sixty-five cannot.
 *
 * The month itself is the one ring here that owes nothing to the sky. Its
 * edges fall where they fall. Everything else in the fan, the terms, the
 * lunations, the seasons, the frost, is astronomical and cuts across the
 * month wherever it likes, which is the point of looking: you can see how
 * badly the calendar's boxes line up with anything the sun or moon is doing.
 */
(function (global) {
  'use strict';
  var TZ = global.TZ, MoonGlyph = global.MoonGlyph;

  var CX = 600, CY = 762, HALF = 65;          // degrees either side of vertical
  var R = {
    growIn: 236, growOut: 288,
    seasonIn: 300, seasonOut: 372, seasonLabel: 336,
    termIn: 384, termOut: 458, termLabel: 421,
    moonIn: 470, moonOut: 552, moonGlyph: 500, moonLabel: 538,
    dayIn: 566, dayOut: 648, solarNum: 588, dateNum: 622
  };

  function polar(r, a) {
    var t = a * Math.PI / 180;
    return [CX + r * Math.sin(t), CY - r * Math.cos(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sector(r1, r2, a1, a2) {
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) +
           'A' + r2 + ' ' + r2 + ' 0 0 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
           'L' + f(p3[0]) + ' ' + f(p3[1]) +
           'A' + r1 + ' ' + r1 + ' 0 0 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }
  /* Upright where the fan is steep, tilted with the ring where it is not. */
  function tilt(a, x, y) { return 'rotate(' + f(a) + ' ' + f(x) + ' ' + f(y) + ')'; }

  function render(cycle, run, opts) {
    var days = cycle.days.slice(run.start - 1, run.end);
    var N = days.length;
    var parts = [];
    var span = HALF * 2;
    function edge(i) { return -HALF + span * (i / N); }        // day i's leading edge
    function mid(i) { return -HALF + span * ((i + 0.5) / N); }

    /* -- the days ------------------------------------------------------- */
    days.forEach(function (d, i) {
      var a1 = edge(i), a2 = edge(i + 1);
      parts.push('<path class="mv-day" data-day="' + d.n + '" d="' +
        sector(R.dayIn, R.dayOut, a1, a2) + '" fill="var(--bg-2)" fill-opacity="' +
        (i % 2 ? '.75' : '.4') + '" stroke="var(--line-soft)" stroke-width=".7" ' +
        'style="cursor:pointer"><title>' + esc(TZ.formatDate(cycle.tz, d.date)) +
        ' · solar day ' + d.n + ' of ' + cycle.length + ' · tap to open</title></path>');
      var m = mid(i);
      var dp = polar(R.dateNum, m), sp = polar(R.solarNum, m);
      parts.push('<text x="' + f(dp[0]) + '" y="' + f(dp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="19" font-family="var(--serif)" ' +
        'fill="var(--ink)" pointer-events="none" transform="' + tilt(m, dp[0], dp[1]) + '">' +
        d.day + '</text>');
      parts.push('<text x="' + f(sp[0]) + '" y="' + f(sp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10" font-family="var(--mono)" ' +
        'fill="var(--ink-3)" pointer-events="none" transform="' + tilt(m, sp[0], sp[1]) + '">' +
        d.n + '</text>');
    });

    /* -- the moon: a face a day, and the lunations they belong to -------- */
    parts.push('<path d="' + sector(R.moonIn, R.moonOut, -HALF, HALF) +
      '" fill="var(--panel)" fill-opacity=".5" stroke="var(--line-soft)" stroke-width=".7"/>');
    days.forEach(function (d, i) {
      var m = mid(i), q = polar(R.moonGlyph, m);
      parts.push('<g transform="translate(' + f(q[0] - 11) + ' ' + f(q[1] - 11) + ')" ' +
        'pointer-events="none">' + MoonGlyph.svg(d.moonAge, 22) + '</g>');
      if (d.moonEvent) {
        var lp = polar(R.moonLabel, m);
        parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="8.5" fill="var(--moon)" ' +
          'pointer-events="none" transform="' + tilt(m, lp[0], lp[1]) + '">' +
          esc(d.moonEvent.replace(' Moon', '')) + '</text>');
      }
    });
    runsOf(days, function (d) { return d.lunation ? d.lunation.startDay : null; })
      .forEach(function (r) {
        var a1 = edge(r.from), a2 = edge(r.to + 1);
        if (a2 - a1 < 7) return;
        var e1 = polar(R.moonIn, a1), e2 = polar(R.moonOut, a1);
        parts.push('<path d="M' + f(e1[0]) + ' ' + f(e1[1]) + 'L' + f(e2[0]) + ' ' +
          f(e2[1]) + '" stroke="var(--moon)" stroke-width="1.2" opacity=".7"/>');
        var d0 = days[r.from];
        var lab = (d0.lunation && d0.lunation.yearLabel) ||
          (d0.lunation && d0.lunation.yearMoonNumber
            ? 'Lunation ' + d0.lunation.yearMoonNumber : 'lunation');
        var mp = polar(R.moonIn + 9, (a1 + a2) / 2);
        parts.push('<text x="' + f(mp[0]) + '" y="' + f(mp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="10" fill="var(--moon)" ' +
          'pointer-events="none" transform="' + tilt((a1 + a2) / 2, mp[0], mp[1]) + '">' +
          esc(lab) + '</text>');
      });

    /* -- the solar terms crossing the month ------------------------------ */
    parts.push('<path d="' + sector(R.termIn, R.termOut, -HALF, HALF) +
      '" fill="var(--bg-2)" fill-opacity=".45" stroke="var(--line-soft)" stroke-width=".7"/>');
    runsOf(days, function (d) { return d.inTerm ? d.inTerm.number : null; })
      .forEach(function (r) {
        var a1 = edge(r.from), a2 = edge(r.to + 1);
        var t = days[r.from].inTerm;
        var e1 = polar(R.termIn, a1), e2 = polar(R.termOut, a1);
        parts.push('<path d="M' + f(e1[0]) + ' ' + f(e1[1]) + 'L' + f(e2[0]) + ' ' +
          f(e2[1]) + '" stroke="var(--line)" stroke-width="1"/>');
        var c = (a1 + a2) / 2, lp = polar(R.termLabel, c);
        var wide = (a2 - a1) > 18;
        parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="' + (wide ? 12 : 10) + '" ' +
          'fill="var(--ink-2)" pointer-events="none" transform="' +
          tilt(c, lp[0], lp[1]) + '">' + esc(t.english) + '</text>');
        parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1] + 15) + '" text-anchor="middle" ' +
          'dominant-baseline="middle" font-size="9" fill="var(--ink-3)" ' +
          'pointer-events="none" transform="' + tilt(c, lp[0], lp[1] + 15) + '">' +
          'term ' + t.number + ' of 24 · ' + (r.to - r.from + 1) + ' of its ' +
          t.days + ' days</text>');
      });

    /* -- season and midpoint --------------------------------------------- */
    runsOf(days, function (d) { return d.season; }).forEach(function (r) {
      var a1 = edge(r.from), a2 = edge(r.to + 1);
      var s = cycle.stations[days[r.from].season * 2] || cycle.stations[0];
      parts.push('<path d="' + sector(R.seasonIn, R.seasonOut, a1, a2) +
        '" fill="var(--bg-2)" fill-opacity=".6" stroke="var(--line-soft)" stroke-width=".7"/>');
      var c = (a1 + a2) / 2, lp = polar(R.seasonLabel, c);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="15" font-family="var(--serif)" ' +
        'fill="var(--sun-bright)" pointer-events="none" transform="' +
        tilt(c, lp[0], lp[1]) + '">' + esc(SEASONS[days[r.from].season]) + '</text>');
    });
    /* any station falling inside the month gets its own mark */
    days.forEach(function (d, i) {
      if (!d.station) return;
      var c = mid(i);
      var e1 = polar(R.seasonIn - 8, c), e2 = polar(R.seasonOut + 8, c);
      parts.push('<path d="M' + f(e1[0]) + ' ' + f(e1[1]) + 'L' + f(e2[0]) + ' ' +
        f(e2[1]) + '" stroke="var(--sun)" stroke-width="2"/>');
      var lp = polar(R.seasonOut + 20, c);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10" fill="var(--sun)" ' +
        'pointer-events="none" transform="' + tilt(c, lp[0], lp[1]) + '">' +
        esc(d.station.name) + '</text>');
    });

    /* -- growing season --------------------------------------------------- */
    var grow = growingRun(cycle, days);
    parts.push('<path d="' + sector(R.growIn, R.growOut, -HALF, HALF) +
      '" fill="var(--bg-2)" fill-opacity=".35" stroke="var(--line-soft)" stroke-width=".7"/>');
    if (grow) {
      parts.push('<path d="' + sector(R.growIn, R.growOut, edge(grow.from), edge(grow.to + 1)) +
        '" fill="var(--grow, #6b9e5a)" fill-opacity=".45"/>');
      var gc = (edge(grow.from) + edge(grow.to + 1)) / 2, gp = polar(R.growIn + 26, gc);
      parts.push('<text x="' + f(gp[0]) + '" y="' + f(gp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="11" fill="var(--ink-2)" ' +
        'pointer-events="none" transform="' + tilt(gc, gp[0], gp[1]) + '">' +
        esc(grow.label) + '</text>');
    }

    /* -- the apex --------------------------------------------------------- */
    parts.push('<text x="' + CX + '" y="' + (CY - 150) + '" text-anchor="middle" ' +
      'font-size="34" font-family="var(--serif)" fill="var(--ink)">' +
      esc(TZ.MONTHS[run.month - 1]) + ' <tspan font-size="20" fill="var(--ink-3)">' +
      run.year + '</tspan></text>');
    parts.push('<text x="' + CX + '" y="' + (CY - 122) + '" text-anchor="middle" ' +
      'font-size="12" fill="var(--ink-3)">' + N + ' days · solar days ' +
      days[0].n + ' to ' + days[N - 1].n + ' of ' + cycle.length + '</text>');

    return { svg: parts.join(''), days: days };
  }

  var SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];

  /* Contiguous runs of days sharing a key, as indices into the slice. */
  function runsOf(days, keyOf) {
    var out = [], cur = null;
    days.forEach(function (d, i) {
      var k = keyOf(d);
      if (k === null || k === undefined) { cur = null; return; }
      if (!cur || cur.key !== k) { cur = { key: k, from: i, to: i }; out.push(cur); }
      else cur.to = i;
    });
    return out;
  }

  /* How much of this month sits inside the growing season. */
  function growingRun(cycle, days) {
    var fr = cycle.frost;
    if (!fr) return null;
    if (fr.none) return { from: 0, to: days.length - 1, label: 'growing season, all year' };
    var last = fr.last ? fr.last.dayNumber : null;
    var first = fr.first ? fr.first.dayNumber : null;
    if (last === null || first === null) return null;
    var from = null, to = null;
    days.forEach(function (d, i) {
      var inside = first >= last ? (d.n > last && d.n < first) : (d.n > last || d.n < first);
      if (inside) { if (from === null) from = i; to = i; }
    });
    if (from === null) return null;
    var whole = from === 0 && to === days.length - 1;
    return { from: from, to: to,
             label: whole ? 'growing season' : 'growing season' +
               (from > 0 ? ' opens' : ' closes') };
  }

  global.MonthView = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
