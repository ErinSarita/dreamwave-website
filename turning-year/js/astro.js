/* astro.js — solar and lunar ephemeris for the Wheel of the Year.
 *
 * Sun:  truncated VSOP87D (Earth L, B, R) -> geocentric apparent longitude.
 *       Accuracy ~0.001 deg, so solar-term instants land within ~1-2 minutes.
 * Moon: Meeus "Astronomical Algorithms" ch. 47 series (truncated).
 *       Accuracy ~10 arcsec in longitude, ~4 arcsec in latitude.
 * Everything is plain functions on a global `Astro` object so the site works
 * from file:// without a server.
 */
(function (global) {
  'use strict';

  var DEG = Math.PI / 180, RAD = 180 / Math.PI;
  var J2000 = 2451545.0;

  function sin(d) { return Math.sin(d * DEG); }
  function cos(d) { return Math.cos(d * DEG); }
  function norm360(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  function norm180(d) { d = norm360(d); return d > 180 ? d - 360 : d; }

  /* ---------------------------------------------------------------- time -- */

  // Julian Day from a JS Date, using its UTC fields.
  function jdFromDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }
  function dateFromJD(jd) {
    return new Date(Math.round((jd - 2440587.5) * 86400000));
  }
  // Calendar (UTC) -> JD.  month is 1-12, day may be fractional.
  function jdFromUTC(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var a = Math.floor(y / 100);
    var b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
  }

  // Espenak & Meeus polynomial expressions for Delta-T (TT - UT1), seconds.
  function deltaT(year) {
    var u, t;
    if (year < -500) { u = (year - 1820) / 100; return -20 + 32 * u * u; }
    if (year < 500) { u = year / 100;
      return 10583.6 - 1014.41 * u + 33.78311 * u * u - 5.952053 * Math.pow(u, 3)
        - 0.1798452 * Math.pow(u, 4) + 0.022174192 * Math.pow(u, 5) + 0.0090316521 * Math.pow(u, 6); }
    if (year < 1600) { u = (year - 1000) / 100;
      return 1574.2 - 556.01 * u + 71.23472 * u * u + 0.319781 * Math.pow(u, 3)
        - 0.8503463 * Math.pow(u, 4) - 0.005050998 * Math.pow(u, 5) + 0.0083572073 * Math.pow(u, 6); }
    if (year < 1700) { t = year - 1600;
      return 120 - 0.9808 * t - 0.01532 * t * t + t * t * t / 7129; }
    if (year < 1800) { t = year - 1700;
      return 8.83 + 0.1603 * t - 0.0059285 * t * t + 0.00013336 * Math.pow(t, 3) - Math.pow(t, 4) / 1174000; }
    if (year < 1860) { t = year - 1800;
      return 13.72 - 0.332447 * t + 0.0068612 * t * t + 0.0041116 * Math.pow(t, 3)
        - 0.00037436 * Math.pow(t, 4) + 0.0000121272 * Math.pow(t, 5)
        - 0.0000001699 * Math.pow(t, 6) + 0.000000000875 * Math.pow(t, 7); }
    if (year < 1900) { t = year - 1860;
      return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * Math.pow(t, 3)
        - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174; }
    if (year < 1920) { t = year - 1900;
      return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * Math.pow(t, 3) - 0.000197 * Math.pow(t, 4); }
    if (year < 1941) { t = year - 1920;
      return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * Math.pow(t, 3); }
    if (year < 1961) { t = year - 1950;
      return 29.07 + 0.407 * t - t * t / 233 + Math.pow(t, 3) / 2547; }
    if (year < 1986) { t = year - 1975;
      return 45.45 + 1.067 * t - t * t / 260 - Math.pow(t, 3) / 718; }
    if (year < 2005) { t = year - 2000;
      return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * Math.pow(t, 3)
        + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (year < 2050) { t = year - 2000;
      return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (year < 2150) {
      return -20 + 32 * Math.pow((year - 1820) / 100, 2) - 0.5628 * (2150 - year); }
    u = (year - 1820) / 100; return -20 + 32 * u * u;
  }

  function yearOfJD(jd) { return (jd - J2000) / 365.25 + 2000; }
  // JD(UT) -> JDE(TT)
  function jdeFromJD(jd) { return jd + deltaT(yearOfJD(jd)) / 86400; }
  function jdFromJDE(jde) { return jde - deltaT(yearOfJD(jde)) / 86400; }

  /* ----------------------------------------------------- nutation, epsilon -- */

  // Abbreviated IAU 1980 nutation, accurate to ~0.5".
  function nutation(T) {
    var om = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000;
    var L = 280.4665 + 36000.7698 * T;
    var Lp = 218.3165 + 481267.8813 * T;
    var dpsi = (-17.20 * sin(om) - 1.32 * sin(2 * L) - 0.23 * sin(2 * Lp) + 0.21 * sin(2 * om)) / 3600;
    var deps = (9.20 * cos(om) + 0.57 * cos(2 * L) + 0.10 * cos(2 * Lp) - 0.09 * cos(2 * om)) / 3600;
    return { dpsi: dpsi, deps: deps };
  }
  // Mean obliquity (Laskar), degrees.
  function meanObliquity(T) {
    var U = T / 100;
    return 23.43929111 + (-4680.93 * U - 1.55 * U * U + 1999.25 * Math.pow(U, 3)
      - 51.38 * Math.pow(U, 4) - 249.67 * Math.pow(U, 5) - 39.05 * Math.pow(U, 6)
      + 7.12 * Math.pow(U, 7) + 27.87 * Math.pow(U, 8) + 5.79 * Math.pow(U, 9)
      + 2.45 * Math.pow(U, 10)) / 3600;
  }

  global.Astro = {
    DEG: DEG, RAD: RAD, J2000: J2000,
    sinDeg: sin, cosDeg: cos, norm360: norm360, norm180: norm180,
    jdFromDate: jdFromDate, dateFromJD: dateFromJD, jdFromUTC: jdFromUTC,
    deltaT: deltaT, jdeFromJD: jdeFromJD, jdFromJDE: jdFromJDE,
    nutation: nutation, meanObliquity: meanObliquity
  };
})(typeof window !== 'undefined' ? window : globalThis);
