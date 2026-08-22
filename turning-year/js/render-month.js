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

  var CX = 600, CY = 762, HALF = 57;          // degrees either side of vertical
  /* Inner to outer, the same order the year wheel stacks them: the slow things
   * near the apex, the fast ones out at the rim.
   *
   * The light and dark band sits outside the moon, and it is given far more
   * depth than the rest because it carries a whole axis rather than a value:
   * midnight at its inner edge, midnight again at its outer, and the day's
   * real hours laid out between. The season and term bands were shortened to
   * pay for it, since a word and a number each need much less room. */
  var R = {
    growIn: 128, growOut: 158,
    seasonIn: 166, seasonOut: 202, seasonLabel: 184,
    termIn: 210, termOut: 262, termLabel: 243, termDayNum: 219,
    /* The hour band takes the middle and most of the depth, being the only
     * ring that carries a whole axis. The moon rides outside it, where the arc
     * is long enough for a face a day without crowding. */
    lightIn: 272, lightOut: 552,
    moonIn: 562, moonOut: 632, moonGlyph: 590, moonLabel: 623,
    dayIn: 642, dayOut: 700, solarNum: 657, dateNum: 685
  };
  var HOUR_SPAN = 24;

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
    parts.push('<defs><linearGradient id="mv-gold" x1="0" y1="1" x2="0" y2="0">' +
      '<stop offset="0%" stop-color="var(--sun-deep)"/>' +
      '<stop offset="100%" stop-color="var(--sun-bright)"/></linearGradient></defs>');
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

    /* -- light and dark, as an actual clock -------------------------------
     * The band is a twenty-four hour axis: midnight at the inner edge,
     * midnight again at the outer, noon in the middle. Each day's column is
     * dark until its sunrise, gold until its sunset, dark again after, so the
     * block of daylight is drawn where it really falls rather than merely how
     * long it lasts. Across a month you can watch sunrise sliding later and
     * sunset earlier, and the gold narrowing from both ends at once.
     */
    var hourR = function (h) {
      return R.lightIn + (R.lightOut - R.lightIn) * Math.max(0, Math.min(HOUR_SPAN, h)) / HOUR_SPAN;
    };
    function arcPath(r, a1, a2) {
      var p1 = polar(r, a1), p2 = polar(r, a2);
      return 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + r + ' ' + r + ' 0 0 1 ' +
             f(p2[0]) + ' ' + f(p2[1]);
    }

    parts.push('<path d="' + sector(R.lightIn, R.lightOut, -HALF, HALF) +
      '" fill="var(--night, #232845)" fill-opacity=".55"/>');

    days.forEach(function (d, i) {
      var a1 = edge(i), a2 = edge(i + 1);
      var lit = null;
      if (d.sunAlwaysUp) lit = [0, HOUR_SPAN];
      else if (d.sunAlwaysDown) lit = null;
      else if (d.sunrise && d.sunset) {
        var sr = TZ.hoursIntoDay(cycle.tz, d.sunrise);
        var ss = TZ.hoursIntoDay(cycle.tz, d.sunset);
        if (ss > sr) lit = [sr, ss];
      }
      if (!lit) return;
      parts.push('<path d="' + sector(hourR(lit[0]), hourR(lit[1]), a1, a2) +
        '" fill="url(#mv-gold)" opacity=".92"/>');
    });

    /* the hours themselves, so the block can be read against a clock */
    for (var hh = 0; hh <= HOUR_SPAN; hh += 1) {
      var major = hh % 6 === 0;
      parts.push('<path d="' + arcPath(hourR(hh), -HALF, HALF) + '" fill="none" ' +
        'stroke="var(--line-soft)" stroke-width="' + (major ? '.9' : '.45') +
        '" opacity="' + (major ? '.8' : '.3') + '" pointer-events="none"/>');
      var qh = polar(hourR(hh), -HALF);
      parts.push('<text x="' + f(qh[0] - 8) + '" y="' + f(qh[1]) + '" text-anchor="end" ' +
        'dominant-baseline="middle" font-size="' + (major ? '10.5' : '8.5') + '" ' +
        'font-family="var(--mono)" fill="var(--ink-' + (major ? '2' : '3') + ')" ' +
        'pointer-events="none" transform="' + tilt(-HALF, qh[0] - 8, qh[1]) + '">' +
        hh + '</text>');
    }
    /* where the clock stands right now, on today's own column */
    parts.push('<g id="mv-now"></g>');
    /* sunrise and sunset written on once a week, where the eye can catch them */
    days.forEach(function (d, i) {
      if (i % 7 || !d.sunrise || !d.sunset) return;
      var m = mid(i);
      [[d.sunrise, 'rise'], [d.sunset, 'set']].forEach(function (ev) {
        var h = TZ.hoursIntoDay(cycle.tz, ev[0]);
        var q = polar(hourR(h), m);
        parts.push('<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="2.4" ' +
          'fill="var(--ink)" opacity=".65" pointer-events="none"/>');
      });
    });
    parts.push('<path d="' + sector(R.lightIn, R.lightOut, -HALF, HALF) +
      '" fill="none" stroke="var(--line)" stroke-width=".8"/>');

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
          t.days + ' days here</text>');
      });

    /* Which day of its own term each day is. The year wheel combs the term
     * ring by day at a size where only the ticks show; here there is room for
     * the numbers themselves, so a term can be watched counting up and
     * starting over mid-month. */
    days.forEach(function (d, i) {
      if (!d.inTerm || !d.dayInTerm) return;
      var m = mid(i), q = polar(R.termDayNum, m);
      parts.push('<text x="' + f(q[0]) + '" y="' + f(q[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="9.5" font-family="var(--mono)" ' +
        'fill="' + (d.dayInTerm === 1 ? 'var(--sun)' : 'var(--ink-3)') + '" ' +
        'pointer-events="none" transform="' + tilt(m, q[0], q[1]) + '">' +
        d.dayInTerm + '</text>');
    });

    /* -- season and midpoint --------------------------------------------- */
    runsOf(days, function (d) { return d.season; }).forEach(function (r) {
      var a1 = edge(r.from), a2 = edge(r.to + 1);
      var s = cycle.stations[days[r.from].season * 2] || cycle.stations[0];
      parts.push('<path d="' + sector(R.seasonIn, R.seasonOut, a1, a2) +
        '" fill="var(--bg-2)" fill-opacity=".6" stroke="var(--line-soft)" ' +
        'stroke-width=".7" pointer-events="none"/>');
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
        '" fill="var(--grow, #6b9e5a)" fill-opacity=".45" pointer-events="none"/>');
      var gc = (edge(grow.from) + edge(grow.to + 1)) / 2, gp = polar(R.growIn + 26, gc);
      parts.push('<text x="' + f(gp[0]) + '" y="' + f(gp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="11" fill="var(--ink-2)" ' +
        'pointer-events="none" transform="' + tilt(gc, gp[0], gp[1]) + '">' +
        esc(grow.label) + '</text>');
    }

    /* No caption at the apex. The title bar above the fan already carries the
     * month and its span, and clearing the middle is what lets the rings reach
     * inward far enough to give the hour band real depth. */

    /* One radial marker cutting the whole stack, the same way the year wheel
     * marks a day: everything that shares this day lights at once, because the
     * spoke passes through all of it. Drawn last so it sits over the lot. */
    parts.push('<path id="mv-sel" d="" fill="var(--ink)" fill-opacity=".12" ' +
      'stroke="none" opacity="0" pointer-events="none"/>');
    /* The two dividers bounding the day, drawn the whole depth of the stack so
     * the eye can run straight down them from the date to the growing band and
     * see what the day sits inside at every level. */
    parts.push('<path id="mv-sel-edge" d="" fill="none" stroke="var(--ink)" ' +
      'stroke-width="1.4" stroke-opacity=".8" opacity="0" pointer-events="none"/>');

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

  /* The current hour, ticked on today's column. Exported so it can be redrawn
   * on a timer without rebuilding the fan underneath it. */
  function nowMark(cycle, run, when) {
    var days = cycle.days.slice(run.start - 1, run.end);
    var N = days.length, span = HALF * 2;
    for (var i = 0; i < N; i++) {
      if (days[i].iso !== isoOf(cycle, when)) continue;
      var a1 = -HALF + span * (i / N), a2 = -HALF + span * ((i + 1) / N);
      var h = TZ.hoursIntoDay(cycle.tz, when);
      var r = R.lightIn + (R.lightOut - R.lightIn) * Math.max(0, Math.min(24, h)) / 24;
      var p1 = polar(r, a1), p2 = polar(r, a2);
      var mid = (a1 + a2) / 2, q = polar(r, mid);
      return '<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + r + ' ' + r +
        ' 0 0 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
        '" fill="none" stroke="var(--today)" stroke-width="3"/>' +
        '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="4" fill="var(--today)"/>';
    }
    return '';
  }
  function isoOf(cycle, when) {
    var p = TZ.civilParts(cycle.tz, when);
    return p.year + '-' + (p.month < 10 ? '0' : '') + p.month +
           '-' + (p.day < 10 ? '0' : '') + p.day;
  }

  /* Move the marker onto one day of this month. */
  function highlight(root, cycle, run, dayNumber) {
    var el = root.querySelector('#mv-sel');
    if (!el) return;
    var i = dayNumber - run.start;
    var N = run.end - run.start + 1;
    if (i < 0 || i >= N) {
      el.setAttribute('opacity', '0');
      var off = root.querySelector('#mv-sel-edge');
      if (off) off.setAttribute('opacity', '0');
      return;
    }
    var span = HALF * 2;
    var a1 = -HALF + span * (i / N), a2 = -HALF + span * ((i + 1) / N);
    var rIn = R.growIn - 8, rOut = R.dayOut + 4;
    el.setAttribute('d', sector(rIn, rOut, a1, a2));
    el.setAttribute('opacity', '.9');
    var edgeEl = root.querySelector('#mv-sel-edge');
    if (edgeEl) {
      var d = '';
      [a1, a2].forEach(function (a) {
        var p1 = polar(rIn, a), p2 = polar(rOut, a);
        d += 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' + f(p2[1]);
      });
      edgeEl.setAttribute('d', d);
      edgeEl.setAttribute('opacity', '.9');
    }
  }

  global.MonthView = { render: render, nowMark: nowMark, highlight: highlight };
})(typeof window !== 'undefined' ? window : globalThis);
