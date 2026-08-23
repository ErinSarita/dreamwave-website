/* astro-sun.js — truncated VSOP87D for the Earth, giving the Sun's apparent
 * geocentric position.  Tables are [A, B, C]; each series is summed as
 * A * cos(B + C * tau) with tau in Julian millennia from J2000 (TT).
 */
(function (A) {
  'use strict';
  var sin = A.sinDeg, cos = A.cosDeg, DEG = A.DEG, RAD = A.RAD, norm360 = A.norm360;

  var EARTH_L0 = [
    [175347046,0,0],[3341656,4.6692568,6283.07585],[34894,4.6261,12566.1517],
    [3497,2.7441,5753.3849],[3418,2.8289,3.5231],[3136,3.6277,77713.7715],
    [2676,4.4181,7860.4194],[2343,6.1352,3930.2097],[1324,0.7425,11506.7698],
    [1273,2.0371,529.691],[1199,1.1096,1577.3435],[990,5.233,5884.927],
    [902,2.045,26.298],[857,3.508,398.149],[780,1.179,5223.694],
    [753,2.533,5507.553],[505,4.583,18849.228],[492,4.205,775.523],
    [357,2.92,0.067],[317,5.849,11790.629],[284,1.899,796.298],
    [271,0.315,10977.079],[243,0.345,5486.778],[206,4.806,2544.314],
    [205,1.869,5573.143],[202,2.458,6069.777],[156,0.833,213.299],
    [132,3.411,2942.463],[126,1.083,20.775],[115,0.645,0.98],
    [103,0.636,4694.003],[102,0.976,15720.839],[102,4.267,7.114],
    [99,6.21,2146.17],[98,0.68,155.42],[86,5.98,161000.69],
    [85,1.3,6275.96],[85,3.67,71430.7],[80,1.81,17260.15],
    [79,3.04,12036.46],[75,1.76,5088.63],[74,3.5,3154.69],
    [74,4.68,801.82],[70,0.83,9437.76],[62,3.98,8827.39],
    [61,1.82,7084.9],[57,2.78,6286.6],[56,4.39,14143.5],
    [56,3.47,6279.55],[52,0.19,12139.55],[52,1.33,1748.02],
    [51,0.28,5856.48],[49,0.49,1194.45],[41,5.37,8429.24],
    [41,2.4,19651.05],[39,6.17,10447.39],[37,6.04,10213.29],
    [37,2.57,1059.38],[36,1.71,2352.87],[36,1.78,6812.77],
    [33,0.59,17789.85],[30,0.44,83996.85],[30,2.74,1349.87],[25,3.16,4690.48]
  ];
  var EARTH_L1 = [
    [628331966747,0,0],[206059,2.678235,6283.07585],[4303,2.6351,12566.1517],
    [425,1.59,3.523],[119,5.796,26.298],[109,2.966,1577.344],
    [93,2.59,18849.23],[72,1.14,529.69],[68,1.87,398.15],
    [67,4.41,5507.55],[59,2.89,5223.69],[56,2.17,155.42],
    [45,0.4,796.3],[36,0.47,775.52],[29,2.65,7.11],
    [21,5.34,0.98],[19,1.85,5486.78],[19,4.97,213.3],
    [17,2.99,6275.96],[16,0.03,2544.31],[16,1.43,2146.17],
    [15,1.21,10977.08],[12,2.83,1748.02],[12,3.26,5088.63],
    [12,5.27,1194.45],[12,2.08,4694],[11,0.77,553.57],
    [10,1.3,6286.6],[10,4.24,1349.87],[9,2.7,242.73],
    [9,5.64,951.72],[8,5.3,2352.87],[6,2.65,9437.76],[6,4.67,4690.48]
  ];
  var EARTH_L2 = [
    [52919,0,0],[8720,1.0721,6283.0758],[309,0.867,12566.152],
    [27,0.05,3.52],[16,5.19,26.3],[16,3.68,155.42],[10,0.76,18849.23],
    [9,2.06,77713.77],[7,0.83,775.52],[5,4.66,1577.34],[4,1.03,7.11],
    [4,3.44,5573.14],[3,5.14,796.3],[3,6.05,5507.55],[3,1.19,242.73],
    [3,6.12,529.69],[3,0.31,398.15],[3,2.28,553.57],[2,4.38,5223.69],[2,3.75,0.98]
  ];
  var EARTH_L3 = [
    [289,5.844,6283.076],[35,0,0],[17,5.49,12566.15],[3,5.2,155.42],
    [1,4.72,3.52],[1,5.3,18849.23],[1,5.97,242.73]
  ];
  var EARTH_L4 = [[114,3.142,0],[8,4.13,6283.08],[1,3.84,12566.15]];
  var EARTH_L5 = [[1,3.14,0]];

  var EARTH_B0 = [[280,3.199,84334.662],[102,5.422,5507.553],[80,3.88,5223.69],
                  [44,3.7,2352.87],[32,4,1577.34]];
  var EARTH_B1 = [[9,3.9,5507.55],[6,1.73,5223.69]];

  var EARTH_R0 = [
    [100013989,0,0],[1670700,3.0984635,6283.07585],[13956,3.05525,12566.1517],
    [3084,5.1985,77713.7715],[1628,1.1739,5753.3849],[1576,2.8469,7860.4194],
    [925,5.453,11506.77],[542,4.564,3930.21],[472,3.661,5884.927],
    [346,0.964,5507.553],[329,5.9,5223.694],[307,0.299,5573.143],
    [243,4.273,11790.629],[212,5.847,1577.344],[186,5.022,10977.079],
    [175,3.012,18849.228],[110,5.055,5486.778],[98,0.89,6069.78],
    [86,5.69,15720.84],[86,1.27,161000.69],[65,0.27,17260.15],
    [63,0.92,529.69],[57,2.01,83996.85],[56,5.24,71430.7],
    [49,3.25,2544.31],[47,2.58,775.52],[45,5.54,9437.76],
    [43,6.01,6275.96],[39,5.36,4694],[38,2.39,8827.39],
    [37,0.83,19651.05],[37,4.9,12139.55],[36,1.67,12036.46],
    [35,1.84,2942.46],[33,0.24,7084.9],[32,0.18,5088.63],
    [32,1.78,398.15],[28,1.21,6286.6],[28,1.9,6279.55],[26,4.59,10447.39]
  ];
  var EARTH_R1 = [
    [103019,1.10749,6283.07585],[1721,1.0644,12566.1517],[702,3.142,0],
    [32,1.02,18849.23],[31,2.84,5507.55],[25,1.32,5223.69],[18,1.42,1577.34],
    [10,5.91,10977.08],[9,1.42,6275.96],[9,0.27,5486.78]
  ];
  var EARTH_R2 = [[4359,5.7846,6283.0758],[124,5.579,12566.152],[12,3.14,0],
                  [9,3.63,77713.77],[6,1.87,5573.14],[3,5.47,18849.23]];
  var EARTH_R3 = [[145,4.273,6283.076],[7,3.92,12566.15]];
  var EARTH_R4 = [[4,2.56,6283.08]];

  function series(terms, tau) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) s += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * tau);
    return s;
  }
  function poly(tables, tau) {
    var s = 0;
    for (var i = tables.length - 1; i >= 0; i--) s = s * tau + series(tables[i], tau);
    return s / 1e8;
  }

  /* Sun's apparent geocentric position for a given JDE (TT). */
  function sunPosition(jde) {
    var T = (jde - A.J2000) / 36525;
    var tau = T / 10;

    var L = poly([EARTH_L0, EARTH_L1, EARTH_L2, EARTH_L3, EARTH_L4, EARTH_L5], tau) * RAD;
    var B = poly([EARTH_B0, EARTH_B1], tau) * RAD;
    var R = poly([EARTH_R0, EARTH_R1, EARTH_R2, EARTH_R3, EARTH_R4], tau);

    // Heliocentric Earth -> geocentric Sun.
    var theta = norm360(L + 180);
    var beta = -B;

    // VSOP87 (dynamical J2000) -> FK5.
    var Lp = theta - 1.397 * T - 0.00031 * T * T;
    theta += (-0.09033 / 3600);
    beta += (0.03916 / 3600) * (Math.cos(Lp * DEG) - Math.sin(Lp * DEG));

    var nut = A.nutation(T);
    var aberration = -20.4898 / 3600 / R;      // annual aberration
    var lambda = norm360(theta + nut.dpsi + aberration);
    var eps = A.meanObliquity(T) + nut.deps;

    var sl = sin(lambda), cl = cos(lambda), sb = sin(beta), cb = cos(beta);
    var se = sin(eps), ce = cos(eps);
    var ra = norm360(Math.atan2(sl * ce - (sb / cb) * se, cl) * RAD);
    var dec = Math.asin(sb * ce + cb * se * sl) * RAD;

    return {
      longitude: lambda, latitude: beta, distanceAU: R,
      ra: ra, dec: dec, obliquity: eps, dpsi: nut.dpsi,
      // apparent semidiameter, degrees
      semidiameter: 0.2665685 / R
    };
  }

  /* Instant (JDE) at which the Sun's apparent longitude equals `target`
   * degrees, searching outward from `guessJDE`. */
  function solarLongitudeJDE(target, guessJDE) {
    var jde = guessJDE;
    for (var i = 0; i < 12; i++) {
      var diff = A.norm180(target - sunPosition(jde).longitude);
      if (Math.abs(diff) < 1e-7) break;
      jde += diff * 365.2425 / 360;           // ~0.9856 deg/day
    }
    return jde;
  }

  /* The instant of a cardinal point in a given Gregorian year.
   * target: 0 = March equinox, 90 = June solstice, 180 = Sept equinox,
   *         270 = December solstice, and any value between for cross-quarters. */
  function seasonalPointJDE(year, target) {
    // Rough starting point: the Sun gains ~0.9856 deg/day from the March equinox.
    var marchEq = A.jdFromUTC(year, 3, 20.5);
    return solarLongitudeJDE(A.norm360(target), marchEq + A.norm360(target) * 365.2425 / 360);
  }

  /* First instant at or after `afterJDE` when the Sun reaches `target` degrees.
   * This is what the wheel needs: stations are wanted in cycle order, not in
   * calendar-year order, so a cross-quarter may legitimately fall in the
   * following January or February. */
  function solarLongitudeAfterJDE(target, afterJDE) {
    target = A.norm360(target);
    var ahead = A.norm360(target - sunPosition(afterJDE).longitude);
    var jde = solarLongitudeJDE(target, afterJDE + ahead * 365.2425 / 360);
    // Guard against landing just before the requested instant.
    if (jde < afterJDE - 1e-6) jde = solarLongitudeJDE(target, jde + 365.2425);
    return jde;
  }

  A.sunPosition = sunPosition;
  A.solarLongitudeJDE = solarLongitudeJDE;
  A.seasonalPointJDE = seasonalPointJDE;
  A.solarLongitudeAfterJDE = solarLongitudeAfterJDE;
})(typeof window !== 'undefined' ? window.Astro : globalThis.Astro);
