/* planets.js — where the other wanderers are, and where the ecliptic meets
 * this place's horizon and meridian.
 *
 * Positions come from the standard low-precision Keplerian elements with
 * their secular rates (Standish, JPL). Over 1800 to 2050 that is good to
 * about 20 arcseconds for the inner planets and 10 arcminutes for Saturn,
 * which is a third of the moon's width: far below anything this site draws,
 * and far below the width of a constellation boundary. It is stated in the
 * About rather than left implied.
 *
 * Two things here are computed rather than assumed:
 *
 * The tropical sign is the ecliptic longitude of date cut into twelve equal
 * parts from the equinox. The constellation is the actual region of sky the
 * body stands in front of, from the IAU boundaries. They disagree by about a
 * whole sign, because the signs were named around 130 BCE and the equinox has
 * since precessed 30 degrees away from them. Both are given, because the
 * disagreement is the interesting part.
 *
 * The Ascendant and Midheaven are real geometry: the points where the ecliptic
 * crosses the eastern horizon and the meridian. They sweep the whole zodiac in
 * a day, which is what makes them the only part of a chart that belongs on a
 * 24-hour dial. House cusps between them are convention, and are not here.
 */
(function (global) {
  'use strict';
  var A = global.Astro;
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function sin(d) { return Math.sin(d * D2R); }
  function cos(d) { return Math.cos(d * D2R); }
  function norm360(d) { return ((d % 360) + 360) % 360; }

  /* a, e, I, L, longitude of perihelion, longitude of ascending node,
   * each as [value at J2000, change per Julian century]. */
  var ELEMENTS = {
    Mercury: { a:[0.38709927, 0.00000037], e:[0.20563593, 0.00001906],
               I:[7.00497902,-0.00594749], L:[252.25032350,149472.67411175],
               w:[77.45779628, 0.16047689], N:[48.33076593,-0.12534081] },
    Venus:   { a:[0.72333566, 0.00000390], e:[0.00677672,-0.00004107],
               I:[3.39467605,-0.00078890], L:[181.97909950, 58517.81538729],
               w:[131.60246718,0.00268329], N:[76.67984255,-0.27769418] },
    Earth:   { a:[1.00000261, 0.00000562], e:[0.01671123,-0.00004392],
               I:[-0.00001531,-0.01294668],L:[100.46457166, 35999.37244981],
               w:[102.93768193,0.32327364], N:[0.0, 0.0] },
    Mars:    { a:[1.52371034, 0.00001847], e:[0.09339410, 0.00007882],
               I:[1.84969142,-0.00813131], L:[-4.55343205, 19140.30268499],
               w:[-23.94362959,0.44441088],N:[49.55953891,-0.29257343] },
    Jupiter: { a:[5.20288700,-0.00011607], e:[0.04838624,-0.00013253],
               I:[1.30439695,-0.00183714], L:[34.39644051, 3034.74612775],
               w:[14.72847983, 0.21252668], N:[100.47390909,0.20469106] },
    Saturn:  { a:[9.53667594,-0.00125060], e:[0.05386179,-0.00050991],
               I:[2.48599187, 0.00193609], L:[49.95424423, 1222.49362201],
               w:[92.59887831,-0.41897216], N:[113.66242448,-0.28867794] }
  };

  var ORDER = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  var GLYPH = { Mercury:'☿', Venus:'♀', Mars:'♂',
                Jupiter:'♃', Saturn:'♄', Sun:'☉', Moon:'☽' };

  /* Heliocentric rectangular coordinates in the J2000 ecliptic frame. */
  function helio(name, T) {
    var E = ELEMENTS[name];
    var a = E.a[0] + E.a[1] * T, e = E.e[0] + E.e[1] * T;
    var I = E.I[0] + E.I[1] * T, L = E.L[0] + E.L[1] * T;
    var w = E.w[0] + E.w[1] * T, N = E.N[0] + E.N[1] * T;
    var argPeri = w - N;
    var M = L - w;
    M = ((M % 360) + 540) % 360 - 180;                 // into -180..180
    var eStar = R2D * e, Ecc = M + eStar * sin(M);
    for (var i = 0; i < 12; i++) {
      var dM = M - (Ecc - eStar * sin(Ecc));
      var dE = dM / (1 - e * cos(Ecc));
      Ecc += dE;
      if (Math.abs(dE) < 1e-9) break;
    }
    var xp = a * (cos(Ecc) - e);
    var yp = a * Math.sqrt(1 - e * e) * sin(Ecc);
    var cw = cos(argPeri), sw = sin(argPeri);
    var cN = cos(N), sN = sin(N), cI = cos(I), sI = sin(I);
    return [
      (cw * cN - sw * sN * cI) * xp + (-sw * cN - cw * sN * cI) * yp,
      (cw * sN + sw * cN * cI) * xp + (-sw * sN + cw * cN * cI) * yp,
      (sw * sI) * xp + (cw * sI) * yp
    ];
  }

  /* General precession in ecliptic longitude from J2000 to the date. */
  function precession(T) { return (5029.0966 * T + 1.11113 * T * T) / 3600; }

  /* Geocentric position of a planet, corrected for the time its light took
   * to reach us: at Saturn's distance that is over an hour, and the planet
   * moves visibly in it. */
  function position(name, jde) {
    var T = (jde - 2451545) / 36525;
    var earth = helio('Earth', T);
    var p = helio(name, T), dx, dy, dz, dist = 0;
    for (var pass = 0; pass < 3; pass++) {
      dx = p[0] - earth[0]; dy = p[1] - earth[1]; dz = p[2] - earth[2];
      dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      p = helio(name, T - (dist * 0.0057755183) / 36525);   // light time, days
    }
    var lonJ2000 = norm360(Math.atan2(dy, dx) * R2D);
    var lat = Math.asin(dz / dist) * R2D;
    var lonOfDate = norm360(lonJ2000 + precession(T));
    var eps = A.sunPosition(jde).obliquity;
    var sl = sin(lonOfDate), cl = cos(lonOfDate), sb = sin(lat), cb = cos(lat);
    var ra = norm360(Math.atan2(sl * cos(eps) - (sb / cb) * sin(eps), cl) * R2D);
    var dec = Math.asin(sb * cos(eps) + cb * sin(eps) * sl) * R2D;
    return { name: name, glyph: GLYPH[name], lonJ2000: lonJ2000,
             longitude: lonOfDate, latitude: lat, distanceAU: dist,
             ra: ra, dec: dec };
  }

  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra',
               'Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  /* The degree is rounded here rather than at the point of display, because
   * a longitude of 89.999999 is genuinely the last instant of Gemini but
   * rounds to "30.00", and a sign that runs to thirty degrees reads as a
   * mistake. Rounding first and carrying into the next sign keeps the label
   * and the number telling the same story. */
  function signOf(lonOfDate, places) {
    var l = norm360(lonOfDate);
    var i = Math.floor(l / 30), d = l % 30;
    var f = Math.pow(10, places === undefined ? 2 : places);
    if (Math.round(d * f) / f >= 30) { d = 0; i = (i + 1) % 12; }
    return { name: SIGNS[i], degree: d, index: i };
  }

  /* Where the IAU boundaries cut the ecliptic, in J2000 longitude. Thirteen
   * constellations touch it, and they are nothing like equal: the sun spends
   * six weeks in front of Virgo and one week in front of Scorpius. */
  var BANDS = [
    [351.6, 'Pisces'], [28.7, 'Aries'], [53.4, 'Taurus'], [90.4, 'Gemini'],
    [118.0, 'Cancer'], [138.0, 'Leo'], [174.0, 'Virgo'], [217.8, 'Libra'],
    [241.1, 'Scorpius'], [247.7, 'Ophiuchus'], [266.6, 'Sagittarius'],
    [299.7, 'Capricornus'], [327.6, 'Aquarius']
  ];
  function constellationOf(lonJ2000) {
    var l = norm360(lonJ2000), best = BANDS[0][1], bestGap = 999;
    for (var i = 0; i < BANDS.length; i++) {
      var start = BANDS[i][0];
      var gap = norm360(l - start);
      if (gap < bestGap) { bestGap = gap; best = BANDS[i][1]; }
    }
    return best;
  }

  /* The two angles that actually move on a 24-hour dial. The Ascendant is the
   * ecliptic point rising in the east; the Midheaven is the point crossing the
   * meridian. Both follow from the local sidereal time and the latitude. */
  function angles(jd, jde, lat, lon) {
    var eps = A.sunPosition(jde).obliquity;
    var lst = norm360(A.greenwichSiderealTime(jd) + lon);
    var mc = norm360(Math.atan2(sin(lst), cos(lst) * cos(eps)) * R2D);
    var y = -cos(lst);
    var x = sin(lst) * cos(eps) + Math.tan(lat * D2R) * sin(eps);
    var asc = norm360(Math.atan2(y, x) * R2D);
    /* The rising point is always a quarter turn or so ahead of the meridian;
     * the arctangent gives the setting point half the time. */
    if (norm360(asc - mc) > 180) asc = norm360(asc + 180);
    return { ascendant: asc, midheaven: mc, lst: lst };
  }

  /* An ecliptic point as a place on the sky, so the Ascendant and Midheaven
   * can be pointed at like anything else. */
  function toEquatorial(lonOfDate, latEcl, eps) {
    var sl = sin(lonOfDate), cl = cos(lonOfDate);
    var b = latEcl || 0, sb = sin(b), cb = cos(b);
    return {
      ra: norm360(Math.atan2(sl * cos(eps) - (sb / cb) * sin(eps), cl) * R2D),
      dec: Math.asin(sb * cos(eps) + cb * sin(eps) * sl) * R2D
    };
  }

  var POINTS = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW'];

  /* Which way to face, and how far up. The dial can say when a body is up and
   * how high it climbs, because its angle is spent on the hour and its radius
   * on the altitude. It has no room left to say north or west. This does. */
  function lookAt(ra, dec, jd, lat, lon) {
    var alt = A.altitudeOf(ra, dec, jd, lat, lon);
    var az = A.azimuthOf(ra, dec, jd, lat, lon);
    return { altitude: alt, azimuth: az, up: alt > 0,
             compass: POINTS[Math.round(norm360(az) / 22.5) % 16] };
  }

  function all(jde) {
    return ORDER.map(function (n) { return position(n, jde); });
  }

  global.Planets = {
    ORDER: ORDER, GLYPH: GLYPH, position: position, all: all,
    signOf: signOf, constellationOf: constellationOf, angles: angles,
    lookAt: lookAt, toEquatorial: toEquatorial,
    helio: helio,
    precession: precession
  };
})(typeof window !== 'undefined' ? window : globalThis);
