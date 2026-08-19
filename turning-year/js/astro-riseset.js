/* astro-riseset.js — horizon crossings for the Sun and Moon.
 * Altitudes are sampled across the day and each sign change is refined by
 * bisection, which keeps polar "never sets" / "never rises" days honest
 * instead of silently returning a wrong time.
 */
(function (A) {
  'use strict';
  var sin = A.sinDeg, cos = A.cosDeg, RAD = A.RAD, norm360 = A.norm360;

  /* Apparent sidereal time at Greenwich, degrees, from JD (UT). */
  function greenwichSiderealTime(jd) {
    var T = (jd - A.J2000) / 36525;
    var theta = 280.46061837 + 360.98564736629 * (jd - A.J2000)
      + 0.000387933 * T * T - T * T * T / 38710000;
    var nut = A.nutation(T);
    return norm360(theta + nut.dpsi * cos(A.meanObliquity(T) + nut.deps));
  }

  /* Altitude of an equatorial position, degrees.  lon is east-positive. */
  function altitudeOf(ra, dec, jd, lat, lon) {
    var H = greenwichSiderealTime(jd) + lon - ra;
    return Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * RAD;
  }

  /* Azimuth measured from north through east, degrees. */
  function azimuthOf(ra, dec, jd, lat, lon) {
    var H = greenwichSiderealTime(jd) + lon - ra;
    var az = Math.atan2(-sin(H), cos(lat) * (sin(dec) / cos(dec)) - sin(lat) * cos(H)) * RAD;
    return norm360(az);
  }

  // Body adapters: given JD(UT), return {ra, dec, h0} where h0 is the
  // standard altitude of the horizon crossing for that body.
  var BODIES = {
    sun: function (jd, h0) {
      var p = A.sunPosition(A.jdeFromJD(jd));
      return { ra: p.ra, dec: p.dec, h0: h0 === undefined ? -0.8333 : h0, pos: p };
    },
    moon: function (jd, h0) {
      var p = A.moonPosition(A.jdeFromJD(jd));
      return { ra: p.ra, dec: p.dec, h0: h0 === undefined ? (0.7275 * p.parallax - 0.5667) : h0, pos: p };
    }
  };

  function altAt(body, jd, lat, lon, h0) {
    var b = BODIES[body](jd, h0);
    return altitudeOf(b.ra, b.dec, jd, lat, lon) - b.h0;
  }

  /* Rise/set events for `body` in the JD(UT) window [jdStart, jdStart + span).
   * Returns { rise, set, alwaysUp, alwaysDown, transit, maxAlt, minAlt }.
   * Times are JD (UT) or null. */
  function riseSet(body, jdStart, span, lat, lon, h0) {
    span = span || 1;
    var h0used = BODIES[body](jdStart, h0).h0;
    var steps = Math.max(24, Math.round(span * 24));
    var dt = span / steps;
    var rise = null, set = null, maxAlt = -Infinity, minAlt = Infinity;
    var transit = null, antiTransit = null;
    var prevT = jdStart, prevY = altAt(body, prevT, lat, lon, h0);
    if (prevY > maxAlt) { maxAlt = prevY; transit = prevT; }
    if (prevY < minAlt) { minAlt = prevY; antiTransit = prevT; }

    for (var i = 1; i <= steps; i++) {
      var t = jdStart + i * dt;
      var y = altAt(body, t, lat, lon, h0);
      if (y > maxAlt) { maxAlt = y; transit = t; }
      if (y < minAlt) { minAlt = y; antiTransit = t; }
      if (prevY < 0 && y >= 0 && rise === null) rise = refine(body, prevT, t, lat, lon, h0);
      if (prevY >= 0 && y < 0 && set === null) set = refine(body, prevT, t, lat, lon, h0);
      prevT = t; prevY = y;
    }

    // Sharpen both culminations, then take the altitude AT those refined
    // moments. Reading it off the coarse hourly samples instead understates
    // the peak by however far the sample fell from the true culmination:
    // up to about a degree at mid-latitudes, and varying day to day, which
    // is exactly the quantity "how high did the sun actually get" needs.
    var maxAltitude, minAltitude;
    if (transit !== null) {
      transit = refineExtreme(body, transit - dt, transit + dt, lat, lon, h0, 1);
      maxAltitude = altAt(body, transit, lat, lon, h0) + h0used;
    } else maxAltitude = maxAlt + h0used;
    if (antiTransit !== null) {
      antiTransit = refineExtreme(body, antiTransit - dt, antiTransit + dt, lat, lon, h0, -1);
      minAltitude = altAt(body, antiTransit, lat, lon, h0) + h0used;
    } else minAltitude = minAlt + h0used;

    return {
      rise: rise, set: set, transit: transit, antiTransit: antiTransit,
      alwaysUp: rise === null && set === null && minAlt >= 0,
      alwaysDown: rise === null && set === null && maxAlt < 0,
      maxAltitude: maxAltitude,
      minAltitude: minAltitude,
      standardAltitude: h0used
    };
  }

  function refine(body, lo, hi, lat, lon, h0) {
    var ylo = altAt(body, lo, lat, lon, h0);
    for (var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      var ymid = altAt(body, mid, lat, lon, h0);
      if ((ylo < 0) === (ymid < 0)) { lo = mid; ylo = ymid; } else { hi = mid; }
      if (hi - lo < 1e-7) break;                 // ~0.01 s
    }
    return (lo + hi) / 2;
  }

  /* Golden-section search for a culmination. sign = +1 finds the highest
   * point (upper transit), -1 the lowest (lower transit). */
  function refineExtreme(body, lo, hi, lat, lon, h0, sign) {
    var phi = 0.6180339887;
    var c = hi - phi * (hi - lo), d = lo + phi * (hi - lo);
    for (var i = 0; i < 40; i++) {
      var fc = sign * altAt(body, c, lat, lon, h0);
      var fd = sign * altAt(body, d, lat, lon, h0);
      if (fc > fd) { hi = d; } else { lo = c; }
      c = hi - phi * (hi - lo); d = lo + phi * (hi - lo);
      if (hi - lo < 1e-7) break;
    }
    return (lo + hi) / 2;
  }
  function refineTransit(body, lo, hi, lat, lon, h0) {
    return refineExtreme(body, lo, hi, lat, lon, h0, 1);
  }

  /* The sunset and sunrise that actually bracket a given instant, found by
   * searching outward from it rather than by reading a day's recorded
   * rise/set. That distinction matters near the solstice at high latitude,
   * where the sun can set twice within one civil day (just after midnight and
   * again just before it) and a per-day record keeps only the first, leaving
   * the crossing you need missing entirely.
   *
   * Returns { set, rise } as JD, or null if the sun is already up at that
   * instant (no dark) or never resurfaces within the search window. */
  function darkBracket(jd, lat, lon, h0) {
    function f(t) { return altAt('sun', t, lat, lon, h0); }
    if (f(jd) >= 0) return null;
    var step = 1 / 48;            // 30 minutes; dark spans are hours long
    var limit = 0.75;             // give up beyond 18 hours either side
    var a = jd, b = jd;
    while (jd - a < limit && f(a) < 0) a -= step;
    while (b - jd < limit && f(b) < 0) b += step;
    if (f(a) < 0 || f(b) < 0) return null;
    return {
      set: refine('sun', a, a + step, lat, lon, h0),
      rise: refine('sun', b - step, b, lat, lon, h0)
    };
  }

  A.darkBracket = darkBracket;
  A.greenwichSiderealTime = greenwichSiderealTime;
  A.altitudeOf = altitudeOf;
  A.azimuthOf = azimuthOf;
  A.altAt = altAt;
  A.riseSet = riseSet;
  A.refineExtreme = refineExtreme;
})(typeof window !== 'undefined' ? window.Astro : globalThis.Astro);
