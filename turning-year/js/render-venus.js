/* render-venus.js — the rose drawn.
 *
 * The earth sits at the centre because this is the view from here. Every angle
 * is an ecliptic longitude, read against the same twelve signs the rest of the
 * site uses, so a petal tip pointing at Scorpio means Venus really is in
 * Scorpio at that moment. Every radius is a real distance in astronomical
 * units, marked at the half, the whole and the one and a half.
 *
 * The sun gets its own faint circle at one AU and its own marker, because the
 * whole story of Venus in the sky is her angle from the sun: nothing else
 * decides whether she is visible, when, or for how long. The wedge drawn
 * between the two sight-lines is that angle, and it never opens past about
 * forty-seven degrees.
 *
 * The straight lines joining the five petal tips are drawn in the order the
 * tips happen, which is what makes a star rather than a pentagon. They are the
 * only lines here that are not a measurement, and they are faint for that
 * reason: they are a way of pointing at the pattern, not part of it.
 */
(function (global) {
  'use strict';
  var A = global.Astro, V = global.VenusRose;
  if (!A || !V) return;

  var CX = 500, CY = 500;
  var RIM = 398;                       /* 1.74 AU lands here */
  var AU = RIM / V.FURTHEST;           /* pixels per astronomical unit */
  var RING_IN = 424, RING_OUT = 480;

  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra',
               'Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  var ABBR = ['ARI','TAU','GEM','CAN','LEO','VIR','LIB','SCO','SGR','CAP','AQR','PSC'];

  function f(n) { return Math.round(n * 10) / 10; }
  function norm360(d) { return ((d % 360) + 360) % 360; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* Longitude runs anticlockwise from the March equinox; every wheel on this
   * site runs clockwise from the top. Same convention as the orrery, so the
   * two views of the same sky agree. */
  function place(lon, au) {
    var t = (lon - 90) * Math.PI / 180;
    var r = au * AU;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function at(lon, px) {
    var t = (lon - 90) * Math.PI / 180;
    return [CX + px * Math.cos(t), CY + px * Math.sin(t)];
  }

  function arcPath(px, a1, a2) {
    var p1 = at(a1, px), p2 = at(a2, px);
    var sweep = norm360(a2 - a1) > 180 ? 0 : 1;
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + px + ' ' + px + ' 0 ' +
      (norm360(a2 - a1) > 180 ? 1 : 0) + ' ' + sweep + ' ' + f(p2[0]) + ' ' + f(p2[1]);
  }

  /* One short line of words for a marker's tooltip. */
  function tip(e) {
    var s = e.tropical;
    return e.label + ' · ' + e.iso + ' · ' +
      s.name + ' ' + Math.round(s.degree) + '° · ' +
      e.dist.toFixed(2) + ' AU';
  }

  var DOT = {
    inferior:          { r: 7,   cls: 'vr-tip' },
    superior:          { r: 5.5, cls: 'vr-far' },
    greatestEast:      { r: 4.5, cls: 'vr-ge' },
    greatestWest:      { r: 4.5, cls: 'vr-gw' },
    stationRetrograde: { r: 3.5, cls: 'vr-st' },
    stationDirect:     { r: 3.5, cls: 'vr-st' }
  };

  /* "2026-10-24" as "Oct 26": a month and a year is all the ring has room
   * for, and the panel carries the full date. */
  function vrShort(iso) {
    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var q = iso.split('-');
    return MON[+q[1] - 1] + ' ' + q[0].slice(2);
  }

  function render(fig, opts) {
    var p = [];
    opts = opts || {};
    /* The drawing follows whichever moment the rest of the site is showing, so
     * it must not say "now" while a date in 2019 is being read. */
    var nowLabel = opts.nowLabel || 'Venus now';

    /* -- the zodiac, so the angles mean something ----------------------- */
    for (var i = 0; i < 12; i++) {
      var a1 = i * 30, a2 = a1 + 30, mid = a1 + 15;
      var i1 = at(a1, RING_IN), o1 = at(a1, RING_OUT);
      p.push('<path class="vr-zsep" d="M' + f(i1[0]) + ' ' + f(i1[1]) +
             'L' + f(o1[0]) + ' ' + f(o1[1]) + '"/>');
      if (i % 2 === 0) {
        var ia = at(a1, RING_IN), ib = at(a2, RING_IN);
        var oa = at(a1, RING_OUT), ob = at(a2, RING_OUT);
        p.push('<path class="vr-zband" d="M' + f(ia[0]) + ' ' + f(ia[1]) +
               'A' + RING_IN + ' ' + RING_IN + ' 0 0 1 ' + f(ib[0]) + ' ' + f(ib[1]) +
               'L' + f(ob[0]) + ' ' + f(ob[1]) +
               'A' + RING_OUT + ' ' + RING_OUT + ' 0 0 0 ' + f(oa[0]) + ' ' + f(oa[1]) + 'Z"/>');
      }
      var lp = at(mid, (RING_IN + RING_OUT) / 2);
      p.push('<text class="vr-zname" x="' + f(lp[0]) + '" y="' + f(lp[1]) +
             '">' + ABBR[i] + '</text>');
    }
    p.push('<circle class="vr-zedge" cx="' + CX + '" cy="' + CY + '" r="' + RING_IN + '"/>');
    p.push('<circle class="vr-zedge" cx="' + CX + '" cy="' + CY + '" r="' + RING_OUT + '"/>');

    /* -- how far away, marked where it can be read ---------------------- */
    [0.5, 1.0, 1.5].forEach(function (d) {
      p.push('<circle class="vr-dist" cx="' + CX + '" cy="' + CY + '" r="' +
             f(d * AU) + '"/>');
      /* Labelled along the Aries-Libra line, where the curve is thinnest on
       * a five-petalled figure whose tips avoid it. */
      /* Laid along the line due east of the earth rather than straight up:
       * the vertical is where the sign divisions and the tip lines are
       * thickest. Haloed, because there is no empty ground anywhere on this
       * drawing to put a label on. */
      p.push('<text class="vr-distl" x="' + f(CX + d * AU) + '" y="' + (CY - 7) +
             '">' + d.toFixed(1) + ' AU</text>');
    });

    /* -- the sun's ring, and where the sun stands today ----------------- */
    var now = fig.now;
    p.push('<circle class="vr-sunring" cx="' + CX + '" cy="' + CY + '" r="' +
           f(now.sunDist ? now.sunDist * AU : AU) + '"/>');

    /* -- the rose -------------------------------------------------------- */
    var d = '', k;
    for (k = 0; k < fig.points.length; k++) {
      var xy = place(fig.points[k].lon, fig.points[k].dist);
      d += (k ? 'L' : 'M') + f(xy[0]) + ' ' + f(xy[1]);
    }
    p.push('<path class="vr-path" d="' + d + '"/>');

    /* The loop being travelled at the moment, picked out of the eight years
     * so there is something to follow rather than five identical petals. */
    var tips = fig.tips;
    var lo = null, hi = null;
    for (k = 0; k < tips.length; k++) {
      if (tips[k].jde <= now.jde) lo = tips[k];
      else if (hi === null) hi = tips[k];
    }
    if (lo && hi) {
      var dd = '', started = false;
      for (k = 0; k < fig.points.length; k++) {
        var s = fig.points[k];
        if (s.jde < lo.jde || s.jde > hi.jde) continue;
        var q = place(s.lon, s.dist);
        dd += (started ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
        started = true;
      }
      if (started) p.push('<path class="vr-path-now" d="' + dd + '"/>');
    }

    /* -- the pentagram --------------------------------------------------
     *
     * Drawn out at the ring, not between the tips themselves. The tips are all
     * within sixty pixels of the middle, so joining them there draws a star
     * the size of a thumbnail and hides the one thing worth seeing. What makes
     * the pattern is the five DIRECTIONS, and those are the same whether they
     * are read at 0.27 AU or at the edge of the zodiac. So each tip sends a
     * line out to the ring, and the ring ends are joined in the order the tips
     * happen. The path closes, because the fifth tip hands back to the first. */
    if (tips.length >= 2) {
      var STAR_R = RING_IN - 6;
      var sd = '';
      for (k = 0; k < tips.length; k++) {
        var t = at(tips[k].lon, STAR_R);
        sd += (k ? 'L' : 'M') + f(t[0]) + ' ' + f(t[1]);
      }
      p.push('<path class="vr-star" d="' + sd + 'Z"/>');
      tips.forEach(function (tp) {
        var a = at(tp.lon, tp.dist * AU), b = at(tp.lon, STAR_R);
        p.push('<path class="vr-tipline" d="M' + f(a[0]) + ' ' + f(a[1]) +
               'L' + f(b[0]) + ' ' + f(b[1]) + '"/>');
      });
    }

    /* -- every marked moment -------------------------------------------- */
    fig.events.forEach(function (e) {
      var spec = DOT[e.kind];
      if (!spec) return;
      var xy = place(e.lon, e.dist);
      var soon = (e === fig.next);
      p.push('<g class="vr-ev ' + spec.cls + (soon ? ' is-next' : '') + '">' +
        '<title>' + esc(tip(e)) + '</title>' +
        '<circle class="vr-ev-hit" cx="' + f(xy[0]) + '" cy="' + f(xy[1]) + '" r="11"/>' +
        '<circle class="vr-ev-dot" cx="' + f(xy[0]) + '" cy="' + f(xy[1]) +
          '" r="' + spec.r + '"/></g>');
    });

    /* The five tips numbered in time order, which is the order that draws the
     * star. The numbers go out at the ring rather than beside the tips: the
     * tips are all within sixty pixels of the middle, where the earth, the
     * sun's wedge and today's marker already are, and five numbers and five
     * dates on top of that is a knot. Out at the ring each number sits at the
     * end of its own line, in the sign that tip falls in, which is the thing
     * worth reading anyway. */
    tips.forEach(function (tp, n) {
      /* Number and date in one text rather than two stacked ones. Two of them
       * twenty pixels apart read fine where the line runs vertically and
       * overlap where it runs sideways, and one element cannot collide with
       * itself. */
      /* Far enough inside the ring that a tip label lying sideways clears
       * the sign name beyond it. The two were eighty pixels of text apart
       * across fifty-six pixels of gap, which overlaps wherever the tip's
       * line runs east or west. */
      var xy = at(tp.lon, RING_IN - 58);
      p.push('<text class="vr-tiplab" x="' + f(xy[0]) + '" y="' + f(xy[1]) + '">' +
             '<tspan class="vr-tipn">' + (n + 1) + '</tspan>' +
             '<tspan class="vr-tipy"> ' + esc(vrShort(tp.iso)) + '</tspan>' +
             '</text>');
    });

    /* -- today ----------------------------------------------------------- */
    var vnow = place(now.lon, now.dist);
    var snow = at(now.sunLon, (now.sunDist || 1) * AU);

    /* The two sight-lines, and the angle between them, which is the one number
     * that decides whether she can be seen at all. */
    p.push('<path class="vr-sight vr-sight-sun" d="M' + CX + ' ' + CY +
           'L' + f(snow[0]) + ' ' + f(snow[1]) + '"/>');
    p.push('<path class="vr-sight vr-sight-venus" d="M' + CX + ' ' + CY +
           'L' + f(vnow[0]) + ' ' + f(vnow[1]) + '"/>');
    var wedgeR = 148;
    p.push('<path class="vr-wedge" d="' +
           (now.east ? arcPath(wedgeR, now.sunLon, now.lon)
                     : arcPath(wedgeR, now.lon, now.sunLon)) + '"/>');
    var wl = at(now.sunLon + (now.east ? 1 : -1) * now.elongAbs / 2, wedgeR + 18);
    p.push('<text class="vr-wedgel" x="' + f(wl[0]) + '" y="' + f(wl[1]) + '">' +
           Math.round(now.elongAbs) + '° from the sun</text>');

    p.push('<g class="vr-sun"><title>The sun, ' +
           (now.sunDist || 1).toFixed(3) + ' AU away</title>' +
           '<circle cx="' + f(snow[0]) + '" cy="' + f(snow[1]) + '" r="11"/></g>');

    p.push('<g class="vr-now"><title>Venus now · ' +
           esc(now.tropical.name + ' ' + Math.round(now.tropical.degree) + '° · ' +
               now.dist.toFixed(3) + ' AU · ' + Math.round(now.lit * 100) + '% lit') +
           '</title>' +
           '<circle class="vr-now-halo" cx="' + f(vnow[0]) + '" cy="' + f(vnow[1]) + '" r="16"/>' +
           '<circle class="vr-now-dot" cx="' + f(vnow[0]) + '" cy="' + f(vnow[1]) + '" r="8"/>' +
           '</g>');
    var nl = at(now.lon, now.dist * AU + 34);
    p.push('<text class="vr-nowl" x="' + f(nl[0]) + '" y="' + f(nl[1]) +
           '">' + esc(nowLabel) + '</text>');

    /* -- the earth, standing still at the middle of its own picture ------ */
    p.push('<circle class="vr-earth" cx="' + CX + '" cy="' + CY + '" r="7"/>');
    p.push('<text class="vr-earthl" x="' + CX + '" y="' + (CY + 26) + '">earth</text>');

    return { svg: p.join('') };
  }

  global.VenusView = { render: render, AU: AU };
})(typeof window !== 'undefined' ? window : globalThis);
