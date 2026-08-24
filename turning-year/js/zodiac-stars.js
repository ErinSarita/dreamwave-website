/* zodiac-stars.js — the principal stars of the thirteen constellations the
 * ecliptic crosses, so the inner ring can be the actual sky rather than a
 * band with a name written on it.
 *
 * Positions are J2000 equatorial (right ascension and declination, in
 * degrees), the same convention stars.js uses for the Dipper, and for the
 * same reason: it is how catalogues give them. No proper motion is applied.
 * Over the couple of centuries this site's dates run to, the brightest stars
 * move by a small fraction of a degree, far under what matters for something
 * meant to be checked against the sky with the naked eye.
 *
 * These are the pattern stars, the ones that make the shape people actually
 * recognise, not every star in the constellation. Cancer and Pisces are faint
 * and look sparse here because they are faint and sparse up there.
 *
 * `lines` are the joins that make the figure, given as runs of names.
 */
(function (global) {
  'use strict';

  var C = {
    Aries: {
      stars: [
        ['Hamal', 31.793, 23.463, 2.0], ['Sheratan', 28.660, 20.808, 2.6],
        ['Mesarthim', 28.383, 19.294, 3.9], ['41 Ari', 42.496, 27.261, 3.6]
      ],
      lines: [['Mesarthim', 'Sheratan', 'Hamal', '41 Ari']]
    },
    Taurus: {
      stars: [
        ['Aldebaran', 68.980, 16.509, 0.9], ['Elnath', 81.573, 28.608, 1.7],
        ['Alcyone', 56.871, 24.105, 2.9], ['Theta Tau', 67.154, 15.871, 3.4],
        ['Epsilon Tau', 67.166, 19.180, 3.5], ['Zeta Tau', 84.411, 21.143, 3.0]
      ],
      lines: [['Alcyone', 'Epsilon Tau', 'Aldebaran', 'Zeta Tau'],
              ['Epsilon Tau', 'Elnath'], ['Aldebaran', 'Theta Tau']]
    },
    Gemini: {
      stars: [
        ['Pollux', 116.329, 28.026, 1.1], ['Castor', 113.650, 31.888, 1.6],
        ['Alhena', 99.428, 16.399, 1.9], ['Wasat', 110.031, 21.982, 3.5],
        ['Mebsuta', 100.983, 25.131, 3.0], ['Tejat', 95.740, 22.514, 2.9]
      ],
      lines: [['Castor', 'Mebsuta', 'Tejat'], ['Pollux', 'Wasat', 'Alhena'],
              ['Castor', 'Pollux']]
    },
    Cancer: {
      stars: [
        ['Acubens', 134.622, 11.858, 4.3], ['Altarf', 124.129, 9.186, 3.5],
        ['Asellus Australis', 131.171, 18.154, 3.9],
        ['Asellus Borealis', 130.821, 21.469, 4.7]
      ],
      lines: [['Altarf', 'Asellus Australis', 'Asellus Borealis'],
              ['Asellus Australis', 'Acubens']]
    },
    Leo: {
      stars: [
        ['Regulus', 152.093, 11.967, 1.4], ['Denebola', 177.265, 14.572, 2.1],
        ['Algieba', 154.993, 19.842, 2.0], ['Zosma', 168.527, 20.524, 2.6],
        ['Chort', 168.560, 15.430, 3.3], ['Epsilon Leo', 146.463, 23.774, 3.0],
        ['Adhafera', 154.173, 23.417, 3.4], ['Eta Leo', 151.833, 16.763, 3.5]
      ],
      lines: [['Regulus', 'Eta Leo', 'Algieba', 'Adhafera', 'Epsilon Leo'],
              ['Algieba', 'Zosma', 'Denebola', 'Chort', 'Regulus']]
    },
    Virgo: {
      stars: [
        ['Spica', 201.298, -11.161, 1.0], ['Zavijava', 177.674, 1.765, 3.6],
        ['Porrima', 190.415, -1.449, 2.7], ['Auva', 193.901, 3.398, 3.4],
        ['Vindemiatrix', 195.544, 10.959, 2.8], ['Zeta Vir', 203.673, -0.596, 3.4]
      ],
      lines: [['Zavijava', 'Porrima', 'Auva', 'Vindemiatrix'],
              ['Porrima', 'Spica'], ['Spica', 'Zeta Vir']]
    },
    Libra: {
      stars: [
        ['Zubenelgenubi', 222.720, -16.042, 2.8],
        ['Zubeneschamali', 229.252, -9.383, 2.6],
        ['Zubenelakrab', 233.881, -14.790, 3.9], ['Sigma Lib', 226.018, -25.282, 3.3]
      ],
      lines: [['Sigma Lib', 'Zubenelgenubi', 'Zubeneschamali', 'Zubenelakrab',
               'Zubenelgenubi']]
    },
    Scorpius: {
      stars: [
        ['Antares', 247.352, -26.432, 1.1], ['Graffias', 241.359, -19.805, 2.6],
        ['Dschubba', 240.083, -22.622, 2.3], ['Pi Sco', 239.713, -26.114, 2.9],
        ['Sigma Sco', 245.297, -25.593, 2.9], ['Tau Sco', 248.971, -28.216, 2.8],
        ['Epsilon Sco', 252.543, -34.293, 2.3], ['Shaula', 263.402, -37.104, 1.6]
      ],
      lines: [['Graffias', 'Dschubba', 'Pi Sco'],
              ['Dschubba', 'Sigma Sco', 'Antares', 'Tau Sco', 'Epsilon Sco', 'Shaula']]
    },
    Ophiuchus: {
      stars: [
        ['Rasalhague', 263.734, 12.560, 2.1], ['Cebalrai', 265.868, 4.567, 2.8],
        ['Yed Prior', 243.586, -3.694, 2.7], ['Epsilon Oph', 244.580, -4.693, 3.2],
        ['Zeta Oph', 249.290, -10.567, 2.6], ['Eta Oph', 257.595, -15.725, 2.4]
      ],
      lines: [['Yed Prior', 'Epsilon Oph', 'Zeta Oph', 'Eta Oph'],
              ['Zeta Oph', 'Rasalhague'], ['Rasalhague', 'Cebalrai']]
    },
    Sagittarius: {
      stars: [
        ['Kaus Australis', 276.043, -34.385, 1.8],
        ['Kaus Media', 275.249, -29.828, 2.7],
        ['Kaus Borealis', 276.993, -25.422, 2.8], ['Nunki', 283.816, -26.297, 2.1],
        ['Phi Sgr', 281.414, -26.991, 3.2], ['Zeta Sgr', 285.653, -29.880, 2.6],
        ['Tau Sgr', 286.735, -27.670, 3.3]
      ],
      /* The teapot, which is what anyone actually finds in the sky. */
      lines: [['Kaus Borealis', 'Phi Sgr', 'Nunki', 'Tau Sgr', 'Zeta Sgr',
               'Kaus Australis', 'Kaus Media', 'Kaus Borealis'],
              ['Kaus Media', 'Phi Sgr']]
    },
    Capricornus: {
      stars: [
        ['Algedi', 304.513, -12.545, 3.6], ['Dabih', 305.253, -14.781, 3.1],
        ['Deneb Algedi', 326.760, -16.127, 2.9], ['Gamma Cap', 325.023, -16.662, 3.7],
        ['Omega Cap', 312.955, -26.919, 4.1], ['Zeta Cap', 321.667, -22.411, 3.7]
      ],
      lines: [['Algedi', 'Dabih', 'Omega Cap', 'Zeta Cap', 'Deneb Algedi',
               'Gamma Cap', 'Algedi']]
    },
    Aquarius: {
      stars: [
        ['Sadalsuud', 322.890, -5.571, 2.9], ['Sadalmelik', 331.446, -0.320, 3.0],
        ['Sadachbia', 335.414, -1.387, 3.8], ['Zeta Aqr', 337.208, -0.020, 3.6],
        ['Eta Aqr', 338.839, -0.118, 4.0], ['Delta Aqr', 343.663, -15.821, 3.3],
        ['Lambda Aqr', 343.154, -7.580, 3.7]
      ],
      lines: [['Sadalsuud', 'Sadalmelik', 'Sadachbia', 'Zeta Aqr', 'Eta Aqr'],
              ['Zeta Aqr', 'Lambda Aqr', 'Delta Aqr']]
    },
    Pisces: {
      stars: [
        ['Eta Psc', 22.871, 15.346, 3.6], ['Gamma Psc', 349.290, 3.282, 3.7],
        ['Omega Psc', 359.828, 6.863, 4.0], ['Iota Psc', 354.990, 5.626, 4.1],
        ['Alrescha', 30.512, 2.764, 3.8], ['Epsilon Psc', 15.736, 7.890, 4.3],
        ['Delta Psc', 12.173, 7.585, 4.4]
      ],
      /* The two fish and the cord that ties them, which is the whole figure. */
      lines: [['Gamma Psc', 'Iota Psc', 'Omega Psc', 'Delta Psc', 'Epsilon Psc',
               'Eta Psc'], ['Eta Psc', 'Alrescha'], ['Omega Psc', 'Alrescha']]
    }
  };

  var DEG = Math.PI / 180;

  /* Equatorial to ecliptic. planets.js carries the other direction; this is
   * the same rotation about the vernal point, turned the other way. */
  function toEcliptic(ra, dec, eps) {
    var a = ra * DEG, d = dec * DEG, e = eps * DEG;
    var lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e),
                         Math.cos(a)) / DEG;
    var lat = Math.asin(Math.sin(d) * Math.cos(e) -
                        Math.cos(d) * Math.sin(e) * Math.sin(a)) / DEG;
    return { lon: ((lon % 360) + 360) % 360, lat: lat };
  }

  /* Every star of one constellation as ecliptic longitude and latitude, with
   * its magnitude, plus the joins between them by index. */
  function figure(name, eps) {
    var c = C[name];
    if (!c) return null;
    var byName = {}, stars = c.stars.map(function (s, i) {
      var p = toEcliptic(s[1], s[2], eps);
      byName[s[0]] = i;
      return { name: s[0], lon: p.lon, lat: p.lat, mag: s[3] };
    });
    var lines = c.lines.map(function (run) {
      return run.map(function (n) { return byName[n]; })
                .filter(function (i) { return i !== undefined; });
    });
    return { stars: stars, lines: lines };
  }

  global.ZodiacStars = { figure: figure, has: function (n) { return !!C[n]; } };
})(typeof window !== 'undefined' ? window : globalThis);
