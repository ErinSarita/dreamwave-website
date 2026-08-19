/* lunar.js — the moon's own chain, running free of the solar year.
 *
 * A lunation is 29 or 30 days and a solar cycle is 365 or 366. Twelve of the
 * one falls eleven days short of the other, thirteen overshoots by eighteen,
 * and no amount of arranging fixes that: the two are incommensurable, which
 * is the oldest problem in calendar-making and the reason every culture that
 * tried to run both at once ended up inventing something to paper over the
 * difference.
 *
 * So this does not try. The chain of months is computed on its own terms,
 * new moon to new moon, unbounded in both directions, and the solar year is
 * consulted only afterwards to give each month a name. Nothing is clipped to
 * a solstice and nothing can be lost at a year boundary, because as far as
 * this file is concerned year boundaries do not exist.
 *
 * The spine is an absolute index: lunation 0 is the new moon of 6 January
 * 2000, the epoch Meeus uses in chapter 49. Going back a month is k-1 and
 * forward is k+1, for any k, forever.
 */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ;

  var SYNODIC = 29.530588861;          // mean synodic month, days
  var K0 = 2451550.09766;              // JDE of the new moon of 2000 January 6
  var ELONG_PER_DAY = 12.190749;       // mean growth of the moon's elongation

  /* The instant the moon's elongation from the sun reaches `target`, found by
   * Newton steps from the mean estimate. Elongation climbs about 12.19 deg a
   * day and never reverses, so this converges in a handful of passes. */
  function elongationAt(jde, target) {
    var jd = jde;
    for (var i = 0; i < 40; i++) {
      var d = A.norm180(A.moonPhase(jd).age - target);
      if (Math.abs(d) < 1e-7) break;
      jd -= d / ELONG_PER_DAY;
    }
    return jd;
  }

  var nmCache = {}, fmCache = {};
  function newMoonJD(k) {
    if (nmCache[k] === undefined) nmCache[k] = A.jdFromJDE(elongationAt(K0 + SYNODIC * k, 0));
    return nmCache[k];
  }
  function fullMoonJD(k) {
    if (fmCache[k] === undefined) {
      fmCache[k] = A.jdFromJDE(elongationAt(K0 + SYNODIC * (k + 0.5), 180));
    }
    return fmCache[k];
  }

  /* Which lunation holds this instant. The mean estimate can be a day out
   * either way near a boundary, so it is walked into place. */
  function kAt(jd) {
    var k = Math.floor((A.jdeFromJD(jd) - K0) / SYNODIC);
    var guard = 0;
    while (newMoonJD(k + 1) <= jd && guard++ < 4) k++;
    guard = 0;
    while (newMoonJD(k) > jd && guard++ < 4) k--;
    return k;
  }

  /* ------------------------------------------------------------- the year
   * A month belongs to the solar cycle holding its full moon. Every lunation
   * has exactly one full moon and every full moon falls in exactly one cycle,
   * so this hands out every month to exactly one year with none left over:
   * the property that makes "after Moon 12 comes Moon 1 of the next year"
   * true rather than merely convenient. */
  function anchorLongitudeFor(lat, mode) {
    return (lat < 0 && mode !== 'december') ? 90 : 270;
  }
  var solCache = {};
  function solsticeJD(year, alon) {
    var key = year + ':' + alon;
    if (solCache[key] === undefined) solCache[key] = A.jdFromJDE(A.seasonalPointJDE(year, alon));
    return solCache[key];
  }

  /* The cycle containing `jd`, as its opening year. The label the app shows
   * is the closing year, since that is the calendar year the cycle mostly
   * occupies: 21 Dec 2025 to 20 Dec 2026 reads as 2026. */
  function cycleOf(jd, alon) {
    var y = new Date((jd - 2440587.5) * 86400000).getUTCFullYear();
    var guard = 0;
    while (solsticeJD(y, alon) > jd && guard++ < 4) y--;
    guard = 0;
    while (solsticeJD(y + 1, alon) <= jd && guard++ < 4) y++;
    return y;
  }

  var SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];

  /* Every full moon of one cycle, in order, with its season. Walking k from a
   * safe distance before the opening solstice to a safe distance after the
   * closing one catches all twelve or thirteen without assuming how many. */
  function fullMoonsOfCycle(openYear, alon) {
    var from = solsticeJD(openYear, alon), to = solsticeJD(openYear + 1, alon);
    var k = kAt(from) - 2, out = [];
    for (var i = 0; i < 18; i++, k++) {
      var fm = fullMoonJD(k);
      if (fm < from) continue;
      if (fm >= to) break;
      // which quarter of the cycle it lands in
      var si = 0;
      for (var q = 3; q >= 1; q--) {
        if (fm >= A.jdFromJDE(A.seasonalPointJDE(
              openYear + (A.norm360(alon + q * 90) < alon ? 1 : 0),
              A.norm360(alon + q * 90)))) { si = q; break; }
      }
      out.push({ k: k, jd: fm, season: si });
    }
    return out;
  }

  /* Everything the views need to name and draw one month. */
  function month(k, ctx) {
    var alon = anchorLongitudeFor(ctx.lat, ctx.anchorMode);
    var startJD = newMoonJD(k), endJD = newMoonJD(k + 1);
    var fullJD = fullMoonJD(k);

    var openYear = cycleOf(fullJD, alon);
    var siblings = fullMoonsOfCycle(openYear, alon);
    var idx = -1;
    for (var i = 0; i < siblings.length; i++) if (siblings[i].k === k) { idx = i; break; }
    var seasonIdx = idx >= 0 ? siblings[idx].season : 0;
    var inSeason = siblings.filter(function (s) { return s.season === seasonIdx; });
    var seasonRank = 0;
    for (var j = 0; j < inSeason.length; j++) if (inSeason[j].k === k) { seasonRank = j + 1; break; }

    return {
      k: k,
      startJD: startJD, endJD: endJD, fullJD: fullJD,
      newMoon: A.dateFromJD(startJD), fullMoon: A.dateFromJD(fullJD),
      yearLabel: openYear + 1,                 // the calendar year it mostly occupies
      openYear: openYear,
      number: idx + 1, count: siblings.length,
      seasonName: SEASONS[seasonIdx],
      seasonRank: seasonRank, seasonOf: inSeason.length,
      /* Counts full moons inside the season, not lunations: a lunation can
       * straddle a season boundary, so "Summer Moon 3" names the third full
       * moon of summer and not the third turn of the moon. */
      shortLabel: SEASONS[seasonIdx] + ' Moon ' + seasonRank,
      // the third of four full moons in one season, in the older sense
      isBlue: inSeason.length === 4 && seasonRank === 3
    };
  }

  /* The moon reaches a quarter at a fixed fraction of its month, so the mean
   * estimate for any of the four is the same arithmetic as for the new moon
   * with that fraction added. */
  function quarterJD(k, target) {
    return A.jdFromJDE(elongationAt(K0 + SYNODIC * (k + target / 360), target));
  }

  /* The month laid out a day at a time, from the civil day holding the new
   * moon to the day before the next one. Phase is read at each day's midpoint,
   * matching how the solar cycle samples its own days, so the two never
   * disagree about what the moon looked like on a given date.
   *
   * These days are not looked up in any solar cycle. A month that straddles a
   * solstice would have to be fetched from two of them, and clipping it to one
   * is exactly the thing this file exists to avoid. */
  function daysOf(k, ctx) {
    var tz = ctx.tz;
    var startJD = newMoonJD(k), endJD = newMoonJD(k + 1);
    var p0 = TZ.civilParts(tz, A.dateFromJD(startJD));
    var p1 = TZ.civilParts(tz, A.dateFromJD(endJD));
    var cur = TZ.startOfDay(tz, p0.year, p0.month, p0.day);
    var stop = TZ.startOfDay(tz, p1.year, p1.month, p1.day);   // next month's day one
    var out = [], i = 0;
    while (cur.getTime() < stop.getTime() && i < 33) {
      var cp = TZ.civilParts(tz, cur);
      var nxt = TZ.startOfDay(tz, cp.year, cp.month, cp.day + 1);
      var mid = new Date((cur.getTime() + nxt.getTime()) / 2);
      var ph = A.moonPhase(A.jdeFromJD(A.jdFromDate(mid)));
      out.push({
        date: cur, end: nxt, iso: TZ.formatDate(tz, cur, 'iso'),
        dayInMonth: i + 1,
        moonIllumination: ph.illumination, moonAge: ph.age,
        moonPhaseName: ph.name, moonEvent: null
      });
      cur = nxt; i++;
    }
    /* Each turning point lands on the day that contains its instant, rather
     * than on whichever day is nearest to it. Day one therefore always holds
     * the new moon, which is what makes the month's first day mean something. */
    [[0, 'New Moon'], [90, 'First Quarter'], [180, 'Full Moon'], [270, 'Last Quarter']]
      .forEach(function (q) {
        var jd = q[0] === 0 ? startJD : (q[0] === 180 ? fullMoonJD(k) : quarterJD(k, q[0]));
        for (var j = 0; j < out.length; j++) {
          if (jd >= A.jdFromDate(out[j].date) && jd < A.jdFromDate(out[j].end)) {
            out[j].moonEvent = q[1]; return;
          }
        }
      });
    return out;
  }

  global.Lunar = {
    SYNODIC: SYNODIC, newMoonJD: newMoonJD, fullMoonJD: fullMoonJD,
    kAt: kAt, month: month, cycleOf: cycleOf, daysOf: daysOf, quarterJD: quarterJD,
    anchorLongitudeFor: anchorLongitudeFor, SEASONS: SEASONS
  };
})(typeof window !== 'undefined' ? window : globalThis);
