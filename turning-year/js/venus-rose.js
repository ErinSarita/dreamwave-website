/* venus-rose.js — the five-petalled figure Venus draws around the earth.
 *
 * WHAT IS BEING PLOTTED, exactly, because this is the part every pretty
 * version of this picture leaves out:
 *
 *   For each moment, take the vector from the earth to Venus. Its DIRECTION is
 *   Venus's ecliptic longitude, the degree of the zodiac you would point at to
 *   find her. Its LENGTH is how far away she is, from 0.27 AU at her nearest
 *   to 1.72 AU at her furthest. Draw that vector from a fixed centre and let
 *   the end of it trail a line for eight years.
 *
 *   So the angle on this figure is a real place in the sky, the same angle the
 *   zodiac ring uses everywhere else on this site, and the radius is real
 *   distance. Nothing is stylised and nothing is fitted to make it close. The
 *   rose is what the measurements do.
 *
 * WHY FIVE PETALS. Earth laps Venus every 583.92 days, and five of those is
 * 2919.6 days, which is 2.4 days short of eight years. So after five loops
 * Venus is back at very nearly the same distance in very nearly the same
 * direction, and the figure closes. It does not close exactly: each eight
 * years the whole rose creeps about two degrees, and in a couple of thousand
 * years it will have walked right round.
 *
 * WHY A PENTAGRAM. The petal tips are the moments Venus passes between us and
 * the sun. Each one falls 215.6 degrees further round the zodiac than the
 * last, which is the same as 144.4 degrees BACK. Five steps of 144 degrees is
 * 720 degrees, two whole turns, so the five tips land evenly spaced and the
 * order in which they are visited skips every other one. Joining them in time
 * order draws the star; joining them in longitude order draws the pentagon.
 * That is the whole of the famous business, and it is arithmetic.
 *
 * WHAT THE MARKED POINTS MEAN:
 *
 *   Inferior conjunction (a petal tip) — Venus between earth and sun, nearest
 *     to us, and the hinge where she stops being the evening star and becomes
 *     the morning star. Lost in the glare for a week or two either side.
 *   Superior conjunction (the far arc) — Venus behind the sun, furthest from
 *     us, morning star turning back into evening star.
 *   Greatest elongation — as far from the sun as she ever gets, about 46
 *     degrees. This is the high point of an apparition: the evening one sets
 *     latest after the sun, the morning one rises earliest before it.
 *   Stations — where her apparent motion through the stars reverses. Venus
 *     goes backwards for about six weeks, centred on the petal tip, and the
 *     backwards stretch is the tip.
 *
 * Positions come from the same Keplerian elements the rest of the site uses,
 * good to a fraction of a minute of arc here. Light time is not removed,
 * because this is a picture of where the two planets ARE rather than of when
 * we see it; the difference is about two minutes of arc at conjunction and it
 * moves no date by as much as a day.
 */
(function (global) {
  'use strict';
  var A = global.Astro, P = global.Planets;
  if (!A || !P) return;

  var R2D = 180 / Math.PI;

  /* The mean interval between one inferior conjunction and the next. Used only
   * to decide how wide a net to cast before the real dates are solved for. */
  var SYNODIC = 583.92;

  var NEAREST = 0.27, FURTHEST = 1.74;   /* AU, for scaling the drawing */

  function norm360(d) { return ((d % 360) + 360) % 360; }
  function signed180(d) { return ((d % 360) + 540) % 360 - 180; }

  /* ------------------------------------------------------------ one moment */

  /* Everything about the earth-Venus line at one instant. `jde` is dynamical
   * time, as everywhere else in this codebase. */
  function at(jde) {
    var T = (jde - 2451545) / 36525;
    var e = P.helio('Earth', T);
    var v = P.helio('Venus', T);

    var x = v[0] - e[0], y = v[1] - e[1], z = v[2] - e[2];
    var dist = Math.sqrt(x * x + y * y + z * z);

    /* Longitude of date, not of J2000, so that the angle here is the same
     * angle the zodiac rings elsewhere on the site are drawn at and a tip's
     * stated degree matches where the tip is actually drawn. */
    var pre = P.precession(T);
    var lonJ2000 = norm360(Math.atan2(y, x) * R2D);
    var lon = norm360(lonJ2000 + pre);
    var lat = Math.asin(z / dist) * R2D;

    /* The sun as seen from earth is the earth's own vector reversed. */
    var sx = -e[0], sy = -e[1], sz = -e[2];
    var sunDist = Math.sqrt(sx * sx + sy * sy + sz * sz);
    var sunLon = norm360(Math.atan2(sy, sx) * R2D + pre);

    /* Elongation as the true angle between the two sight lines, then signed:
     * positive when Venus is east of the sun and therefore sets after it, the
     * evening star; negative when she is west of it and rises before it. */
    var c = (x * sx + y * sy + z * sz) / (dist * sunDist);
    var el = Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
    var east = signed180(lon - sunLon) >= 0;

    /* How much of her disc is lit, from the triangle sun-Venus-earth. */
    var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    var ci = (r * r + dist * dist - sunDist * sunDist) / (2 * r * dist);
    ci = Math.max(-1, Math.min(1, ci));

    return {
      jde: jde, T: T,
      dist: dist, sunDist: sunDist, orbitAU: r,
      lon: lon, lonJ2000: lonJ2000, lat: lat, sunLon: sunLon,
      elong: east ? el : -el, elongAbs: el, east: east,
      lit: (1 + ci) / 2
    };
  }

  /* --------------------------------------------------------- solving dates */

  /* Bisection on a function that changes sign across the answer. Sixty halvings
   * of a two-day bracket is far past the precision of the elements; the loop
   * stops on the tolerance long before that. */
  function bisect(f, a, b, tol) {
    var fa = f(a);
    for (var i = 0; i < 60; i++) {
      if (b - a < tol) break;
      var m = (a + b) / 2, fm = f(m);
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
    }
    return (a + b) / 2;
  }

  function elongAt(jde) { return at(jde).elong; }

  /* Conjunctions are where the signed elongation passes through zero: from
   * east to west at an inferior conjunction, west to east at a superior one.
   * Which is which is settled by the distance, not by the direction of the
   * crossing, because the distance is unambiguous: 0.27 AU against 1.72. */
  function conjunctions(from, to) {
    var out = [], step = 2;
    var prev = elongAt(from), t;
    for (t = from + step; t <= to; t += step) {
      var cur = elongAt(t);
      if ((prev < 0) !== (cur < 0)) {
        var jde = bisect(elongAt, t - step, t, 1e-4);
        var s = at(jde);
        out.push(mark(s, s.dist < 1 ? 'inferior' : 'superior'));
      }
      prev = cur;
    }
    return out;
  }

  /* Between one conjunction and the next the elongation rises from nothing to
   * its greatest and falls back, with no second hump, so a ternary search on
   * the magnitude finds the peak without needing a derivative. */
  function greatestElongations(cj) {
    var out = [];
    for (var i = 1; i < cj.length; i++) {
      var lo = cj[i - 1].jde + 1, hi = cj[i].jde - 1;
      for (var k = 0; k < 100 && hi - lo > 1e-3; k++) {
        var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (at(m1).elongAbs < at(m2).elongAbs) lo = m1; else hi = m2;
      }
      var s = at((lo + hi) / 2);
      out.push(mark(s, s.east ? 'greatestEast' : 'greatestWest'));
    }
    return out;
  }

  /* Apparent motion through the stars, degrees of longitude per day. Direct
   * motion runs about +1.2, retrograde about -0.6. */
  function rateAt(jde) { return signed180(at(jde + 0.5).lon - at(jde - 0.5).lon); }

  /* The two stations sit either side of each inferior conjunction and nowhere
   * else: Venus only ever goes backwards while she is overtaking us on the
   * inside. Forty-five days either side comfortably contains the six weeks. */
  function stations(cj) {
    var out = [];
    cj.forEach(function (c) {
      if (c.kind !== 'inferior') return;
      var prev = rateAt(c.jde - 46), t;
      for (t = c.jde - 44; t <= c.jde + 46; t += 2) {
        var cur = rateAt(t);
        if ((prev < 0) !== (cur < 0)) {
          var jde = bisect(rateAt, t - 2, t, 1e-3);
          var s = at(jde);
          out.push(mark(s, s.jde < c.jde ? 'stationRetrograde' : 'stationDirect'));
        }
        prev = cur;
      }
    });
    return out;
  }

  /* ------------------------------------------------------------- labelling */

  var KINDS = {
    inferior: {
      label: 'Inferior conjunction',
      short: 'Petal tip',
      note: 'Venus passes between us and the sun, nearest the earth she comes. ' +
            'The evening star becomes the morning star. Lost in the glare for ' +
            'a week or two either side of it.'
    },
    superior: {
      label: 'Superior conjunction',
      short: 'Far point',
      note: 'Venus passes behind the sun, furthest from the earth she goes. ' +
            'The morning star becomes the evening star.'
    },
    greatestEast: {
      label: 'Greatest elongation east',
      short: 'Highest evening star',
      note: 'As far east of the sun as she gets, so she sets as long after it ' +
            'as she ever will. The best of the evening apparition.'
    },
    greatestWest: {
      label: 'Greatest elongation west',
      short: 'Highest morning star',
      note: 'As far west of the sun as she gets, so she rises as long before ' +
            'it as she ever will. The best of the morning apparition.'
    },
    stationRetrograde: {
      label: 'Turns retrograde',
      short: 'Starts going backwards',
      note: 'Her drift through the stars stops and reverses. She runs ' +
            'backwards from here to the next station, about six weeks, and ' +
            'the backwards stretch is the petal tip.'
    },
    stationDirect: {
      label: 'Turns direct',
      short: 'Stops going backwards',
      note: 'Her drift through the stars stops and resumes its usual ' +
            'direction. The retrograde stretch ends here.'
    }
  };

  var ORDER = ['inferior', 'stationRetrograde', 'stationDirect',
               'greatestEast', 'greatestWest', 'superior'];

  function isoOf(jde) {
    return A.dateFromJD(A.jdFromJDE(jde)).toISOString().slice(0, 10);
  }

  function mark(s, kind) {
    var k = KINDS[kind];
    var trop = P.signOf(s.lon, 0);
    var sid = P.siderealSignOf(s.lon, s.T, 0);
    return {
      kind: kind,
      label: k.label, short: k.short, note: k.note,
      jde: s.jde, iso: isoOf(s.jde),
      lon: s.lon, lonJ2000: s.lonJ2000, dist: s.dist,
      /* The sun's own direction and distance travel with every mark. The
       * drawing needs them to put the sun where it stood and to open the
       * elongation wedge between the two sight-lines, and a mark that carried
       * the angle from the sun without carrying the sun was how the wedge
       * came to be computed from an undefined and drawn at the origin. */
      sunLon: s.sunLon, sunDist: s.sunDist,
      elong: s.elong, elongAbs: s.elongAbs, east: s.east, lit: s.lit,
      tropical: trop, sidereal: sid,
      constellation: P.constellationOf(s.lonJ2000)
    };
  }

  /* ------------------------------------------------------------- the curve */

  /* An eight-year walk at a day and a half a step. Venus's longitude moves at
   * most about 1.3 degrees a day, so no step turns the curve by two degrees,
   * and at the widest part of the figure that is a chord of a twentieth of an
   * AU: on a dial three hundred pixels across, four pixels, joined by a
   * straight line whose sag from the true curve is a small fraction of one
   * pixel. Smooth, in other words, without carrying ten thousand points.
   *
   * The solved event moments are dropped into the walk as well, so a petal tip
   * is an actual vertex of the drawn path rather than something the line
   * happens to pass near. */
  function path(from, to, extraJdes) {
    var STEP = 1.5;
    var times = [], t;
    for (t = from; t < to; t += STEP) times.push(t);
    times.push(to);
    (extraJdes || []).forEach(function (j) {
      if (j > from && j < to) times.push(j);
    });
    times.sort(function (a, b) { return a - b; });
    return times.map(at);
  }

  /* --------------------------------------------------------------- the lot */

  /* One call for the whole view: five petals with today inside them, every
   * marked moment in that span, and where Venus stands right now.
   *
   * The span is cut at inferior conjunctions rather than at round dates so the
   * figure closes on itself. Two petals back and three forward from the last
   * tip puts today in the middle of the drawing. */
  function figure(jdeNow) {
    /* Cast a wide net, solve the tips, then choose the window. */
    var wide = conjunctions(jdeNow - 6 * SYNODIC, jdeNow + 6 * SYNODIC);
    var tips = wide.filter(function (c) { return c.kind === 'inferior'; });

    var i = 0;
    for (var n = 0; n < tips.length; n++) if (tips[n].jde <= jdeNow) i = n;
    var startIdx = Math.max(0, Math.min(i - 2, tips.length - 6));
    var from = tips[startIdx].jde;
    var to = tips[Math.min(startIdx + 5, tips.length - 1)].jde;

    var cj = conjunctions(from - 1, to + 1);
    var ge = greatestElongations(cj);
    var st = stations(cj);
    var events = cj.concat(ge, st).sort(function (a, b) { return a.jde - b.jde; });

    var pts = path(from, to, events.map(function (e) { return e.jde; }));

    /* The turn from one tip to the next, which is the pentagram itself. */
    /* Five, not six. The span runs from one tip to the tip five synodic
     * periods later, so both ends are inferior conjunctions and the last is
     * the first one come round again, two and a bit degrees along. Keeping it
     * would draw a sixth petal on top of the first and number it 6. */
    var petalTips = cj.filter(function (c) { return c.kind === 'inferior'; }).slice(0, 5);
    var steps = [];
    for (var j = 1; j < petalTips.length; j++) {
      steps.push(norm360(petalTips[j].lon - petalTips[j - 1].lon));
    }

    var now = at(jdeNow);
    var nowMark = mark(now, 'inferior');     /* borrowed only for its labelling */
    delete nowMark.kind; delete nowMark.label;
    delete nowMark.short; delete nowMark.note;
    nowMark.phase = now.east ? 'Evening star' : 'Morning star';

    var next = null, prev = null;
    events.forEach(function (e) {
      if (e.jde <= jdeNow) prev = e;
      else if (!next) next = e;
    });

    return {
      from: from, to: to,
      fromIso: isoOf(from), toIso: isoOf(to),
      years: (to - from) / 365.2422,
      points: pts,
      events: events,
      tips: petalTips,
      tipSteps: steps,
      meanTipStep: steps.length
        ? steps.reduce(function (a, b) { return a + b; }, 0) / steps.length
        : null,
      now: nowMark,
      previous: prev,
      next: next,
      nearest: NEAREST, furthest: FURTHEST
    };
  }

  global.VenusRose = {
    SYNODIC: SYNODIC, NEAREST: NEAREST, FURTHEST: FURTHEST,
    KINDS: KINDS, ORDER: ORDER,
    at: at, figure: figure, path: path,
    conjunctions: conjunctions, greatestElongations: greatestElongations,
    stations: stations, isoOf: isoOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
