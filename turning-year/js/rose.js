/* rose.js — the figure a planet draws around the earth over many years.
 *
 * WHAT IS BEING PLOTTED, exactly, because this is the part every pretty
 * version of this picture leaves out:
 *
 *   For each moment, take the vector from the earth to the planet. Its
 *   DIRECTION is the planet's ecliptic longitude, the degree of the zodiac you
 *   would point at to find it. Its LENGTH is how far away it is. Draw that
 *   vector from a fixed centre and let the end of it trail a line for years.
 *
 *   So the angle is a real place in the sky, the same angle the zodiac ring
 *   uses everywhere else on this site, and the radius is real distance.
 *   Nothing is stylised and nothing is fitted to make the figure close.
 *
 * WHY IT MAKES PETALS. The earth laps the planet every synodic period, and
 * each lap draws one loop. The loops come back to nearly the same place when
 * some whole number of synodic periods is nearly a whole number of years, and
 * that near miss is what decides how many petals there are and how badly the
 * figure fails to close.
 *
 * THE TWO KINDS OF PLANET, which is most of the reason this file is shaped the
 * way it is:
 *
 *   An INFERIOR planet is inside the earth's orbit. It can never be opposite
 *   the sun, so it is only ever seen near dawn or dusk. Its near point is an
 *   INFERIOR CONJUNCTION, passing between us and the sun; its far point is a
 *   SUPERIOR CONJUNCTION, passing behind it. The best it manages is its
 *   GREATEST ELONGATION, which for Venus is about 47 degrees.
 *
 *   A SUPERIOR planet is outside it. It has only one conjunction, behind the
 *   sun, and its near point is an OPPOSITION, with the earth between it and
 *   the sun, at midnight and at its brightest. It passes every elongation on
 *   the way, so "greatest elongation" means nothing for it; the marked angle
 *   instead is QUADRATURE, square to the sun at ninety degrees.
 *
 * Both kinds run backwards through the stars around their near point, and both
 * put their petal tips there.
 *
 * Positions come from the same Keplerian elements the rest of the site uses.
 * Light time is not removed, because this is a picture of where the two
 * planets ARE rather than of when we see it; the difference moves no date here
 * by as much as a day.
 */
(function (global) {
  'use strict';
  var A = global.Astro, P = global.Planets;
  if (!A || !P) return;

  var R2D = 180 / Math.PI;

  /* One entry per planet this view knows how to draw.
   *
   *   synodic   mean days from one near point to the next, used only to decide
   *             how wide a net to cast before the real dates are solved for
   *   petals    how many loops to draw, which is the count that nearly closes
   *   nearest,
   *   furthest  the extremes of distance, which set the drawing's scale
   *   rings     which distances to mark with a circle
   *   step      days per sample along the path; chosen so no step turns the
   *             curve by more than about two degrees
   *   window    days either side of the near point to hunt for stations in */
  var CONF = {
    Venus: {
      name: 'Venus', glyph: '♀', order: 'inferior',
      synodic: 583.92, petals: 5,
      nearest: 0.27, furthest: 1.74, rings: [0.5, 1.0, 1.5],
      step: 1.5, window: 46,
      closes: 'Five loops is 2,919.6 days, which is 2.4 days short of eight ' +
              'years, so the figure very nearly joins up and the five petals ' +
              'come out nearly the same size. Venus’s orbit is the ' +
              'roundest of any planet’s, which is why they are so alike.'
    },
    Mars: {
      name: 'Mars', glyph: '♂', order: 'superior',
      synodic: 779.94, petals: 7,
      nearest: 0.37, furthest: 2.70, rings: [0.5, 1.0, 1.5, 2.0, 2.5],
      step: 2.5, window: 62,
      closes: 'Seven loops is a fortnight under fifteen years, and it lands ' +
              'well short of a full turn, so this figure visibly fails to ' +
              'close where Venus’s very nearly does. The petals are ' +
              'markedly unequal too: Mars’s orbit is a good deal off ' +
              'round, so an opposition at its near end brings it inside 0.4 ' +
              'AU and one at its far end only to about 0.68, and the tips ' +
              'reach in by visibly different amounts.'
    }
  };

  function norm360(d) { return ((d % 360) + 360) % 360; }
  function signed180(d) { return ((d % 360) + 540) % 360 - 180; }

  /* ------------------------------------------------------------ one moment */

  /* Everything about the earth-to-planet line at one instant. `jde` is
   * dynamical time, as everywhere else in this codebase. */
  function at(planet, jde) {
    var T = (jde - 2451545) / 36525;
    var e = P.helio('Earth', T);
    var v = P.helio(planet, T);

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
     * positive when the planet is east of the sun and so sets after it, an
     * evening object; negative when west of it and so rises before it. */
    var c = (x * sx + y * sy + z * sz) / (dist * sunDist);
    var el = Math.acos(Math.max(-1, Math.min(1, c))) * R2D;
    var d = signed180(lon - sunLon);

    /* How much of the disc is lit, from the triangle sun-planet-earth. A
     * superior planet never shows less than about a gibbous face; an inferior
     * one runs the whole way from full to a thread. */
    var r = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    var ci = (r * r + dist * dist - sunDist * sunDist) / (2 * r * dist);
    ci = Math.max(-1, Math.min(1, ci));

    return {
      jde: jde, T: T,
      dist: dist, sunDist: sunDist, orbitAU: r,
      lon: lon, lonJ2000: lonJ2000, lat: lat, sunLon: sunLon,
      /* `d` is the difference in longitude and `elong` the true angle. They
       * agree to a degree or two. The solvers use `d`, because it passes
       * smoothly through zero and through a half turn and so can be handed to
       * a root finder; the readouts use `elong`, because it is the real
       * angle a protractor would measure. */
      d: d, elong: d >= 0 ? el : -el, elongAbs: el, east: d >= 0,
      lit: (1 + ci) / 2
    };
  }

  /* --------------------------------------------------------- solving dates */

  function bisect(f, a, b, tol) {
    var fa = f(a);
    for (var i = 0; i < 60; i++) {
      if (b - a < tol) break;
      var m = (a + b) / 2, fm = f(m);
      if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
    }
    return (a + b) / 2;
  }

  /* Walk a span looking for sign changes in `f`, and solve each one.
   *
   * `guard` throws away crossings that are the wrong kind. Longitude
   * difference wraps at a half turn, so the step from +179 to -179 looks
   * exactly like the step from +1 to -1 and is the opposite event; the guard
   * is what tells conjunction from opposition. */
  function crossings(f, from, to, step, guard) {
    var out = [], prev = f(from), t;
    for (t = from + step; t <= to; t += step) {
      var cur = f(t);
      if ((prev < 0) !== (cur < 0) && (!guard || guard(t - step, t))) {
        out.push(bisect(f, t - step, t, 1e-4));
      }
      prev = cur;
    }
    return out;
  }

  /* Conjunction: the planet and the sun at the same longitude.
   * Opposition: half a turn apart. Both are zero crossings once the angle is
   * measured from the right place. */
  function nearFar(smp, conf, from, to) {
    var dOf = function (t) { return smp(t).d; };
    var oppOf = function (t) { return signed180(smp(t).d - 180); };
    var small = function (a, b) {
      return Math.abs(smp(a).d) < 90 && Math.abs(smp(b).d) < 90;
    };
    var big = function (a, b) {
      return Math.abs(smp(a).d) > 90 && Math.abs(smp(b).d) > 90;
    };

    var out = [];
    crossings(dOf, from, to, 2, small).forEach(function (jde) {
      var s = smp(jde);
      /* For an inferior planet a conjunction is either side of the sun and
       * the distance says which; a superior planet has only the far one, and
       * calling it "superior conjunction" when there is no other kind is
       * pedantry, so it is just the conjunction. */
      var kind = conf.order === 'inferior'
        ? (s.dist < 1 ? 'inferior' : 'superior')
        : 'conjunction';
      out.push(mark(s, kind, conf));
    });
    if (conf.order === 'superior') {
      crossings(oppOf, from, to, 2, big).forEach(function (jde) {
        out.push(mark(smp(jde), 'opposition', conf));
      });
    }
    return out.sort(function (a, b) { return a.jde - b.jde; });
  }

  /* The marked angle between one near point and the next.
   *
   * For an inferior planet that is the greatest elongation: the angle rises
   * from nothing to its greatest and falls back with no second hump, so a
   * ternary search on the magnitude finds the peak without a derivative.
   *
   * For a superior planet the angle sweeps the whole half turn and has no
   * peak, so the marked angle is quadrature instead: the two moments it sits
   * square to the sun. Those are crossings, not peaks. */
  function angles(smp, conf, cj, from, to) {
    var out = [], i;
    if (conf.order === 'inferior') {
      for (i = 1; i < cj.length; i++) {
        var lo = cj[i - 1].jde + 1, hi = cj[i].jde - 1;
        for (var k = 0; k < 100 && hi - lo > 1e-3; k++) {
          var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
          if (smp(m1).elongAbs < smp(m2).elongAbs) lo = m1; else hi = m2;
        }
        var s = smp((lo + hi) / 2);
        out.push(mark(s, s.east ? 'greatestEast' : 'greatestWest', conf));
      }
    } else {
      var q = function (t) { return smp(t).elongAbs - 90; };
      crossings(q, from, to, 2).forEach(function (jde) {
        var t = smp(jde);
        out.push(mark(t, t.east ? 'quadratureEast' : 'quadratureWest', conf));
      });
    }
    return out;
  }

  /* Apparent motion through the stars, degrees of longitude per day. */
  function stations(smp, conf, tips) {
    var rate = function (jde) {
      return signed180(smp(jde + 0.5).lon - smp(jde - 0.5).lon);
    };
    var out = [], w = conf.window;
    tips.forEach(function (c) {
      var prev = rate(c.jde - w), t;
      for (t = c.jde - w + 2; t <= c.jde + w; t += 2) {
        var cur = rate(t);
        if ((prev < 0) !== (cur < 0)) {
          var jde = bisect(rate, t - 2, t, 1e-3);
          out.push(mark(smp(jde), jde < c.jde ? 'stationRetrograde' : 'stationDirect', conf));
        }
        prev = cur;
      }
    });
    return out;
  }

  /* ------------------------------------------------------------- labelling */

  var KINDS = {
    inferior: {
      label: 'Inferior conjunction', short: 'Petal tip',
      note: 'Passes between us and the sun, nearest the earth it comes. The ' +
            'evening star becomes the morning star. Lost in the glare for a ' +
            'week or two either side of it.'
    },
    superior: {
      label: 'Superior conjunction', short: 'Far point',
      note: 'Passes behind the sun, furthest from the earth it goes. The ' +
            'morning star becomes the evening star.'
    },
    conjunction: {
      label: 'Conjunction', short: 'Far point',
      note: 'Behind the sun and furthest from the earth, rising and setting ' +
            'with it and so out of sight for weeks. This is where the petal ' +
            'reaches its full length.'
    },
    opposition: {
      label: 'Opposition', short: 'Petal tip',
      note: 'The earth passes between it and the sun, so it is nearest, ' +
            'brightest, and up all night: it rises as the sun sets and stands ' +
            'highest at midnight. The best weeks there are for looking at it.'
    },
    greatestEast: {
      label: 'Greatest elongation east', short: 'Highest evening star',
      note: 'As far east of the sun as it gets, so it sets as long after it ' +
            'as it ever will. The best of the evening apparition.'
    },
    greatestWest: {
      label: 'Greatest elongation west', short: 'Highest morning star',
      note: 'As far west of the sun as it gets, so it rises as long before ' +
            'it as it ever will. The best of the morning apparition.'
    },
    quadratureEast: {
      label: 'Eastern quadrature', short: 'Square to the sun, evening',
      note: 'A quarter turn east of the sun: it stands due south at sunset ' +
            'and sets around midnight. This is where a telescope shows the ' +
            'most shadow along the terminator, and the disc looks least full.'
    },
    quadratureWest: {
      label: 'Western quadrature', short: 'Square to the sun, morning',
      note: 'A quarter turn west of the sun: it rises around midnight and ' +
            'stands due south at sunrise. The morning half of the same ' +
            'geometry.'
    },
    stationRetrograde: {
      label: 'Turns retrograde', short: 'Starts going backwards',
      note: 'Its drift through the stars stops and reverses. It runs ' +
            'backwards from here to the next station, and the backwards ' +
            'stretch is the petal tip.'
    },
    stationDirect: {
      label: 'Turns direct', short: 'Stops going backwards',
      note: 'Its drift through the stars stops and resumes its usual ' +
            'direction. The retrograde stretch ends here.'
    }
  };

  /* Which mark is the near point, and so which one is a petal tip. */
  var TIP = { inferior: 'inferior', superior: 'opposition' };

  function isoOf(jde) {
    return A.dateFromJD(A.jdFromJDE(jde)).toISOString().slice(0, 10);
  }

  function mark(s, kind, conf) {
    var k = KINDS[kind];
    return {
      kind: kind, planet: conf.name,
      label: k.label, short: k.short, note: k.note,
      jde: s.jde, iso: isoOf(s.jde),
      lon: s.lon, lonJ2000: s.lonJ2000, dist: s.dist,
      /* The sun's own direction and distance travel with every mark. The
       * drawing needs them to put the sun where it stood and to open the
       * elongation wedge between the two sight-lines. */
      sunLon: s.sunLon, sunDist: s.sunDist,
      elong: s.elong, elongAbs: s.elongAbs, east: s.east, lit: s.lit,
      tropical: P.signOf(s.lon, 0),
      sidereal: P.siderealSignOf(s.lon, s.T, 0),
      constellation: P.constellationOf(s.lonJ2000)
    };
  }

  /* ------------------------------------------------------------- the curve */

  /* A fixed step, with the solved event moments dropped in, so a petal tip is
   * an actual vertex of the drawn path rather than something the line happens
   * to pass near. The step is small enough that no segment turns the curve by
   * two degrees, which at the widest part of the figure is a chord a few
   * pixels long: smooth, without carrying ten thousand points. */
  function path(smp, from, to, step, extraJdes) {
    var times = [], t;
    for (t = from; t < to; t += step) times.push(t);
    times.push(to);
    (extraJdes || []).forEach(function (j) {
      if (j > from && j < to) times.push(j);
    });
    times.sort(function (a, b) { return a - b; });
    return times.map(smp);
  }

  /* --------------------------------------------------------------- the lot */

  /* One call for the whole view: the petals with today inside them, every
   * marked moment in that span, and where the planet stands now.
   *
   * The span is cut at near points rather than at round dates so the figure
   * closes on itself as well as it is ever going to. Today sits in the middle
   * petal. */
  function figure(planet, jdeNow) {
    var conf = CONF[planet];
    if (!conf) return null;
    var smp = function (t) { return at(planet, t); };
    var tipKind = TIP[conf.order];
    var half = conf.petals + 3;

    /* Cast a wide net, solve the near points, then choose the window. */
    var wide = nearFar(smp, conf, jdeNow - half * conf.synodic,
                                  jdeNow + half * conf.synodic)
      .filter(function (c) { return c.kind === tipKind; });

    var i = 0;
    for (var n = 0; n < wide.length; n++) if (wide[n].jde <= jdeNow) i = n;
    var back = Math.floor(conf.petals / 2);
    var startIdx = Math.max(0, Math.min(i - back, wide.length - conf.petals - 1));
    var from = wide[startIdx].jde;
    var to = wide[Math.min(startIdx + conf.petals, wide.length - 1)].jde;

    /* Hunt a few days wider than the span and trim afterwards. The solver
     * walks a two-day grid, and the grid only lands astride the crossing at
     * the very end of the span by luck: for both planets it missed, and the
     * closing near point went unfound. Nothing downstream noticed, because a
     * missing last tip just looks like a shorter list. */
    var pad = 5;
    var cj = nearFar(smp, conf, from - pad, to + pad);
    var inSpan = function (e) { return e.jde >= from - 1 && e.jde <= to + 1; };

    /* One more than the petal count comes back, because both ends of the span
     * are near points and the last is the first come round again. Drawing it
     * would put a petal on top of a petal and number it one too many, so only
     * the first `petals` are drawn. The extra one is kept, though: it is the
     * only thing that can say how far the figure misses closing by. */
    var allTips = cj.filter(function (c) { return c.kind === tipKind; })
                    .filter(inSpan);
    var tips = allTips.slice(0, conf.petals);
    var events = cj
      .concat(angles(smp, conf, cj, from - pad, to + pad))
      .concat(stations(smp, conf, tips))
      .filter(inSpan)
      .sort(function (a, b) { return a.jde - b.jde; });

    var pts = path(smp, from, to, conf.step,
                   events.map(function (e) { return e.jde; }));

    /* The turn from one tip to the next, which is the whole pattern in one
     * number. Measured, not quoted.
     *
     * Taken over `allTips`, so there are as many steps as there are petals.
     * Averaging the drawn tips alone leaves the closing step out, and for a
     * planet whose steps are as uneven as Mars's -- thirty-four degrees to
     * seventy-seven, because its orbit is a good deal off round -- dropping
     * the last one moved the mean two degrees off the truth.
     *
     * The steps then add up to a whole number of turns plus a remainder, and
     * that remainder is how far the figure fails to close: a degree or two
     * for Venus, the better part of twenty for Mars. */
    var steps = [];
    for (var j = 1; j < allTips.length; j++) {
      steps.push(norm360(allTips[j].lon - allTips[j - 1].lon));
    }
    var total = steps.reduce(function (a, b) { return a + b; }, 0);
    var shortBy = signed180(-total);

    var s = smp(jdeNow);
    var now = mark(s, tipKind, conf);
    delete now.kind; delete now.label; delete now.short; delete now.note;
    /* What it is doing in the sky at the moment, in the words that fit its
     * kind: an inferior planet is one star or the other, a superior planet is
     * simply up in the evening or up before dawn. */
    now.phase = conf.order === 'inferior'
      ? (s.east ? 'Evening star' : 'Morning star')
      : (s.elongAbs > 150 ? 'Up all night'
         : s.elongAbs < 20 ? 'Lost in the sun’s glare'
         : s.east ? 'In the evening sky' : 'In the morning sky');

    var next = null, prev = null;
    events.forEach(function (e) {
      if (e.jde <= jdeNow) prev = e;
      else if (!next) next = e;
    });

    return {
      planet: conf.name, glyph: conf.glyph, order: conf.order, conf: conf,
      from: from, to: to, fromIso: isoOf(from), toIso: isoOf(to),
      years: (to - from) / 365.2422,
      points: pts, events: events, tips: tips, tipSteps: steps,
      meanTipStep: steps.length ? total / steps.length : null,
      minTipStep: steps.length ? Math.min.apply(null, steps) : null,
      maxTipStep: steps.length ? Math.max.apply(null, steps) : null,
      /* Positive means the figure comes up short of a whole number of turns
       * and so drifts forward each time round; negative means it overshoots. */
      shortBy: steps.length ? shortBy : null,
      now: now, previous: prev, next: next,
      nearest: conf.nearest, furthest: conf.furthest, rings: conf.rings
    };
  }

  global.Rose = {
    CONF: CONF, KINDS: KINDS, TIP: TIP,
    at: at, figure: figure, isoOf: isoOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
