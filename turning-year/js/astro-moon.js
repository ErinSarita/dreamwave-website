/* astro-moon.js — lunar position from Meeus, "Astronomical Algorithms", ch. 47.
 * Rows are [D, M, M', F, coefficient].  Longitude/distance and latitude use
 * separate tables.  Terms containing M are scaled by E (eccentricity drift).
 */
(function (A) {
  'use strict';
  var sin = A.sinDeg, cos = A.cosDeg, RAD = A.RAD, norm360 = A.norm360;

  // [D, M, M', F, sin coeff (1e-6 deg), cos coeff (1e-3 km)]
  var LR = [
    [0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],
    [0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],
    [2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],
    [2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],
    [0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],
    [0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],
    [4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],
    [1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],
    [2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],
    [0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],
    [1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],
    [0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],
    [2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],
    [3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],
    [0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354],[2,1,-2,0,691,0],
    [2,-1,0,-2,596,0],[4,0,2,0,549,0],[0,0,4,0,537,0],
    [4,-1,0,0,520,-1423],[1,0,-2,0,-487,-1117],[2,1,0,-2,-399,0],
    [0,0,2,-2,-381,-4421],[1,1,1,0,351,0],[3,0,-2,0,-340,0],
    [4,0,-3,0,330,0],[2,-1,2,0,327,0],[0,2,1,0,-323,1165],
    [1,1,-1,0,299,0],[2,0,3,0,294,0],[2,0,-1,-2,0,8752]
  ];

  // [D, M, M', F, sin coeff (1e-6 deg)]
  var B = [
    [0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],
    [2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],
    [2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],
    [2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],
    [2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],
    [0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],
    [0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],
    [4,0,0,-1,1021],[4,0,-1,1,833],[0,0,1,-3,777],[4,0,-2,1,671],
    [2,0,0,-3,607],[2,0,2,-1,596],[2,-1,1,-1,491],[2,0,-2,1,-451],
    [0,0,3,-1,439],[2,0,2,1,422],[2,0,-3,-1,421],[2,1,-1,1,-366],
    [2,1,0,1,-351],[4,0,0,1,331],[2,-1,1,1,315],[2,-2,0,-1,302],
    [0,0,1,3,-283],[2,1,1,-1,-229],[1,1,0,-1,223],[1,1,0,1,223],
    [0,1,-2,-1,-220],[2,1,-1,-1,-220],[1,0,1,1,-185],[2,-1,-2,-1,181],
    [0,1,2,1,-177],[4,0,-2,-1,176],[4,-1,-1,-1,166],[1,0,1,-1,-164],
    [4,0,1,-1,132],[1,0,-1,-1,-119],[4,-1,0,-1,115],[2,-2,0,1,107]
  ];

  /* Geocentric apparent position of the Moon for a JDE (TT). */
  function moonPosition(jde) {
    var T = (jde - A.J2000) / 36525;
    var T2 = T * T, T3 = T2 * T, T4 = T3 * T;

    var Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
    var D  = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000);
    var M  = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000);
    var Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000);
    var F  = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000);

    var A1 = norm360(119.75 + 131.849 * T);
    var A2 = norm360(53.09 + 479264.290 * T);
    var A3 = norm360(313.45 + 481266.484 * T);
    var E = 1 - 0.002516 * T - 0.0000074 * T2;

    var sumL = 0, sumR = 0, sumB = 0, i, t, arg, e;
    for (i = 0; i < LR.length; i++) {
      t = LR[i];
      arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      e = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
      sumL += t[4] * e * sin(arg);
      sumR += t[5] * e * cos(arg);
    }
    for (i = 0; i < B.length; i++) {
      t = B[i];
      arg = t[0] * D + t[1] * M + t[2] * Mp + t[3] * F;
      e = t[1] === 0 ? 1 : (Math.abs(t[1]) === 1 ? E : E * E);
      sumB += t[4] * e * sin(arg);
    }

    sumL += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
    sumB += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F)
          + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);

    var lambda = norm360(Lp + sumL / 1e6);
    var beta = sumB / 1e6;
    var delta = 385000.56 + sumR / 1000;             // km
    var parallax = Math.asin(6378.14 / delta) * RAD; // equatorial horizontal parallax

    var nut = A.nutation(T);
    var apparentLon = norm360(lambda + nut.dpsi);
    var eps = A.meanObliquity(T) + nut.deps;

    var sl = sin(apparentLon), cl = cos(apparentLon);
    var sb = sin(beta), cb = cos(beta), se = sin(eps), ce = cos(eps);
    var ra = norm360(Math.atan2(sl * ce - (sb / cb) * se, cl) * RAD);
    var dec = Math.asin(sb * ce + cb * se * sl) * RAD;

    return {
      longitude: apparentLon, latitude: beta, distanceKm: delta,
      ra: ra, dec: dec, parallax: parallax, obliquity: eps,
      semidiameter: 0.2725 * parallax
    };
  }

  var PHASE_NAMES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
                     'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];

  /* Illuminated fraction, phase angle, and a named phase. */
  function moonPhase(jde) {
    var m = moonPosition(jde), s = A.sunPosition(jde);
    var sunDistKm = s.distanceAU * 149597870.7;
    // geocentric elongation of the Moon from the Sun
    var psi = Math.acos(A.cosDeg(m.latitude) * A.cosDeg(m.longitude - s.longitude)) * RAD;
    // phase angle of the Moon (Meeus 48.3)
    var i = Math.atan2(sunDistKm * A.sinDeg(psi), m.distanceKm - sunDistKm * A.cosDeg(psi)) * RAD;
    var k = (1 + A.cosDeg(i)) / 2;
    // signed age: 0 at new, 180 at full, growing through the waxing half
    var age = A.norm360(m.longitude - s.longitude);
    var idx = Math.floor(A.norm360(age + 22.5) / 45) % 8;
    return {
      illumination: k, phaseAngle: i, elongation: psi, age: age,
      waxing: age < 180, name: PHASE_NAMES[idx],
      // days since the last new moon, approximate
      ageDays: age / 360 * 29.530588853
    };
  }

  A.moonPosition = moonPosition;
  A.moonPhase = moonPhase;
})(typeof window !== 'undefined' ? window.Astro : globalThis.Astro);
