/* zodiac.js — the ecliptic as a wheel, with the wanderers placed on it.
 *
 * Every other dial on this site spends its angle on time. This one spends it
 * on ecliptic longitude, which is why it has to be its own wheel rather than
 * another ring on the day clock: two meanings for one angle is how a diagram
 * starts lying.
 *
 * Two rings, drawn to the same scale so they can be compared directly. The
 * outer is the tropical zodiac: twelve equal thirty-degree cuts from the
 * equinox, which is what a birth chart uses. The inner is the sky itself, the
 * thirteen constellations the ecliptic actually crosses, at their real and
 * very unequal widths. Ophiuchus is there because it is there. Virgo is six
 * weeks wide and Scorpius is one, and the only way to see that is to draw them
 * honestly.
 *
 * The gap between the two rings is precession: about twenty-eight degrees now,
 * very nearly a whole sign.
 */
(function (global) {
  'use strict';
  var A = global.Astro, P = global.Planets;
  var CX = 350, CY = 350;
  var R = { signOut: 330, signIn: 292, signLabel: 311,
            conOut: 288, conIn: 252, conLabel: 270,
            tick: 248, bodyMax: 236, bodyMin: 150, hub: 132 };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function norm360(d) { return ((d % 360) + 360) % 360; }

  function sector(r1, r2, a1, a2) {
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    var big = (a2 - a1) > 180 ? 1 : 0;
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) +
           'A' + r2 + ' ' + r2 + ' 0 ' + big + ' 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
           'L' + f(p3[0]) + ' ' + f(p3[1]) +
           'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }
  /* Text laid along the ring, kept upright on the lower half. */
  function tangential(r, a, txt, size, fill, weight) {
    var p = polar(r, a);
    var rot = a > 180 ? a + 90 : a - 90;
    return '<text x="' + f(p[0]) + '" y="' + f(p[1]) + '" text-anchor="middle" ' +
      'dominant-baseline="middle" font-size="' + size + '" fill="' + fill + '"' +
      (weight ? ' font-weight="' + weight + '"' : '') +
      ' transform="rotate(' + f(rot) + ' ' + f(p[0]) + ' ' + f(p[1]) + ')">' +
      esc(txt) + '</text>';
  }

  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra',
               'Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  var SIGN_GLYPH = ['♈','♉','♊','♋','♌','♍',
                    '♎','♏','♐','♑','♒','♓'];
  var BANDS = [
    [351.6, 'Pisces'], [28.7, 'Aries'], [53.4, 'Taurus'], [90.4, 'Gemini'],
    [118.0, 'Cancer'], [138.0, 'Leo'], [174.0, 'Virgo'], [217.8, 'Libra'],
    [241.1, 'Scorpius'], [247.7, 'Ophiuchus'], [266.6, 'Sagittarius'],
    [299.7, 'Capricornus'], [327.6, 'Aquarius']
  ];

  /* opts: { lat, lon, when, placeName } */
  function render(opts) {
    var when = opts.when || new Date();
    var jd = A.jdFromDate(when), jde = A.jdeFromJD(jd);
    var T = (jde - 2451545) / 36525, pre = P.precession(T);
    var eps = A.sunPosition(jde).obliquity;
    var parts = [];

    /* -- the twelve signs, equal by construction ------------------------- */
    for (var i = 0; i < 12; i++) {
      var a1 = i * 30, a2 = a1 + 30;
      parts.push('<path d="' + sector(R.signIn, R.signOut, a1, a2) +
        '" fill="var(--bg-2)" fill-opacity="' + (i % 2 ? '.85' : '.45') +
        '" stroke="var(--line-soft)" stroke-width=".8"/>');
      parts.push(tangential(R.signLabel, a1 + 15,
        SIGN_GLYPH[i] + '  ' + SIGNS[i], 12, 'var(--ink-2)'));
    }

    /* -- the thirteen constellations, at the widths they really have ------
     * Their J2000 boundaries are carried forward by precession so they line
     * up against the signs as they stand on this date. */
    for (var j = 0; j < BANDS.length; j++) {
      var s1 = norm360(BANDS[j][0] + pre);
      var s2 = norm360(BANDS[(j + 1) % BANDS.length][0] + pre);
      var span = norm360(s2 - s1);
      parts.push('<path d="' + sector(R.conIn, R.conOut, s1, s1 + span) +
        '" fill="var(--panel)" fill-opacity="' + (j % 2 ? '.9' : '.55') +
        '" stroke="var(--line-soft)" stroke-width=".8"><title>' +
        esc(BANDS[j][1]) + ', ' + span.toFixed(1) + '° of the ecliptic</title></path>');
      if (span > 9) {
        parts.push(tangential(R.conLabel, s1 + span / 2,
          BANDS[j][1] + (span < 22 ? '' : ''), span < 16 ? 8.5 : 10.5, 'var(--ink-3)'));
      }
    }

    /* -- the bodies ------------------------------------------------------
     * Crowding is real: three planets can sit inside a couple of degrees. So
     * anything landing within eight degrees of something already placed steps
     * inward a rung rather than overprinting it. */
    var bodies = [];
    var sun = A.sunPosition(jde);
    bodies.push({ g: '☉', n: 'Sun', lon: norm360(sun.longitude), c: 'var(--sun-bright)' });
    var moon = A.moonPosition(jde);
    bodies.push({ g: '☽', n: 'Moon', lon: norm360(moon.longitude), c: 'var(--moon)' });
    var COL = { Mercury: '#8fa3b8', Venus: '#c98fb9', Mars: '#d1685a',
                Jupiter: '#c9a24a', Saturn: '#8d8ab5' };
    P.ORDER.forEach(function (nm) {
      var p = P.position(nm, jde);
      bodies.push({ g: P.GLYPH[nm], n: nm, lon: norm360(p.longitude), c: COL[nm] });
    });

    var placed = [];
    bodies.sort(function (x, y) { return x.lon - y.lon; }).forEach(function (b) {
      var rung = 0;
      while (placed.some(function (o) {
        var d = Math.abs(o.lon - b.lon) % 360;
        return o.rung === rung && Math.min(d, 360 - d) < 8;
      })) rung++;
      b.rung = rung;
      b.r = R.bodyMax - rung * 26;
      placed.push(b);

      var tick1 = polar(R.tick, b.lon), tick2 = polar(b.r + 11, b.lon);
      parts.push('<path d="M' + f(tick1[0]) + ' ' + f(tick1[1]) + 'L' +
        f(tick2[0]) + ' ' + f(tick2[1]) + '" stroke="' + b.c +
        '" stroke-width="1" opacity=".5"/>');
      var q = polar(b.r, b.lon);
      var sg = P.signOf(b.lon);
      var con = P.constellationOf(norm360(b.lon - pre));
      parts.push('<g><title>' + esc(b.n) + ' · ' + sg.name + ' ' +
        sg.degree.toFixed(1) + '° · in ' + con + '</title>' +
        '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="12" fill="var(--bg)" ' +
        'stroke="' + b.c + '" stroke-width="1.2"/>' +
        '<text x="' + f(q[0]) + '" y="' + f(q[1] + 0.5) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="13" fill="' + b.c + '">' + b.g + '</text></g>');
    });

    /* -- the two angles, marked on the rim where they actually fall ------- */
    if (opts.lat !== undefined && opts.lon !== undefined) {
      var an = P.angles(jd, jde, opts.lat, opts.lon);
      [['Ascendant', an.ascendant, 'ASC'], ['Midheaven', an.midheaven, 'MC']]
        .forEach(function (m) {
          var p1 = polar(R.signOut, m[1]), p2 = polar(R.signOut + 16, m[1]);
          parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' +
            f(p2[1]) + '" stroke="var(--today)" stroke-width="2"/>');
          parts.push('<text x="' + f(p2[0]) + '" y="' + f(p2[1]) + '" text-anchor="middle" ' +
            'dominant-baseline="middle" font-size="9.5" fill="var(--today)" ' +
            'transform="rotate(' + f(m[1] > 180 ? m[1] + 90 : m[1] - 90) + ' ' +
            f(p2[0]) + ' ' + f(p2[1]) + ')"><title>' + m[0] + '</title>' + m[2] + '</text>');
        });
    }

    /* -- the middle ------------------------------------------------------ */
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R.hub +
      '" fill="var(--bg)" opacity=".8"/>');
    parts.push('<text x="' + CX + '" y="' + (CY - 16) + '" text-anchor="middle" ' +
      'font-size="11" letter-spacing="1.4" fill="var(--ink-3)">ALONG THE ECLIPTIC</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 10) + '" text-anchor="middle" ' +
      'font-size="13" font-family="var(--serif)" fill="var(--ink-2)">' +
      esc(opts.placeName || '') + '</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 32) + '" text-anchor="middle" ' +
      'font-size="10.5" font-family="var(--mono)" fill="var(--ink-3)">' +
      esc(opts.stamp || '') + '</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 54) + '" text-anchor="middle" ' +
      'font-size="10" fill="var(--ink-3)">signs outside · real sky inside</text>');

    return { svg: parts.join(''), precession: pre };
  }

  global.Zodiac = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
