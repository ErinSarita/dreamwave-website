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
  /* No sign glyphs. The zodiac characters are emoji-presentation by default
   * in most fonts and arrive as coloured tiles, which is the same thing that
   * was pulled off the season markers on the year wheel. Names read better
   * anyway at this size. */
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
      parts.push(tangential(R.signLabel, a1 + 15, SIGNS[i], 12.5, 'var(--ink-2)', '500'));
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
      /* Scorpius gets seven degrees of ecliptic and cannot hold its own name
       * at any readable size, so the narrow bands are abbreviated and the
       * full name stays in the tooltip. */
      var SHORT = { Capricornus: 'Capr', Sagittarius: 'Sagitt', Ophiuchus: 'Ophi',
                    Scorpius: 'Scorp', Aquarius: 'Aquar' };
      var label = span < 20 ? (SHORT[BANDS[j][1]] || BANDS[j][1]) : BANDS[j][1];
      if (span > 5) {
        parts.push(tangential(R.conLabel, s1 + span / 2, label,
          span < 14 ? 9 : 11, 'var(--ink-2)'));
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

  /* ------------------------------------------------------- the same ring,
   * as it actually stands over your head.
   *
   * The flat wheel above is the zodiac laid out end to end. This is that ring
   * seen from underneath it, which is where we live. The horizon is the rim,
   * straight up is the middle, and the ecliptic crosses it as an arc rather
   * than a circle, because you only ever get half of it: the half from where
   * it rises in the east, over the meridian, down to where it sets in the
   * west. The other half is under your feet.
   *
   * North is at the top and east is on the LEFT, which looks wrong on paper
   * and is right in the sky: this is a picture of what is above you, so it is
   * handed the same way as holding a map over your head rather than laying it
   * on a table.
   */
  var SR = { rim: 292, ring30: 195, ring60: 97 };
  function altR(alt) { return SR.rim * (1 - alt / 90); }
  /* Azimuth runs the other way round the page from a compass rose on a map,
   * for the same reason the east is on the left. */
  function skyPolar(alt, az) { return polar(altR(alt), norm360(-az)); }

  function sky(opts) {
    var when = opts.when || new Date();
    var jd = A.jdFromDate(when), jde = A.jdeFromJD(jd);
    var T = (jde - 2451545) / 36525, pre = P.precession(T);
    var eps = A.sunPosition(jde).obliquity;
    var lat = opts.lat, lon = opts.lon;
    var parts = [];

    function at(lonEcl) {
      var e = P.toEquatorial(norm360(lonEcl), 0, eps);
      return { alt: A.altitudeOf(e.ra, e.dec, jd, lat, lon),
               az: A.azimuthOf(e.ra, e.dec, jd, lat, lon) };
    }

    /* -- the ground you are standing on --------------------------------- */
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + SR.rim +
      '" fill="var(--bg-2)" fill-opacity=".5" stroke="var(--line)" stroke-width="1.5"/>');
    [[SR.ring30, '30°'], [SR.ring60, '60°']].forEach(function (r) {
      parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + r[0] + '" fill="none" ' +
        'stroke="var(--line-soft)" stroke-width=".8" stroke-dasharray="3 5"/>');
      parts.push('<text x="' + (CX + 4) + '" y="' + f(CY - r[0] + 12) + '" font-size="9" ' +
        'fill="var(--ink-3)">' + r[1] + '</text>');
    });
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="2.5" fill="var(--ink-3)"/>');
    parts.push('<text x="' + CX + '" y="' + (CY + 18) + '" text-anchor="middle" ' +
      'font-size="9" letter-spacing="1.2" fill="var(--ink-3)">ZENITH</text>');

    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (c) {
      var q = polar(SR.rim + 20, norm360(-c[1]));
      parts.push('<text x="' + f(q[0]) + '" y="' + f(q[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="15" font-family="var(--serif)" ' +
        'fill="var(--ink-2)">' + c[0] + '</text>');
    });

    /* -- the visible half of the ecliptic ------------------------------- */
    var run = [], best = [];
    for (var l = 0; l <= 720; l++) {
      var s0 = at(l);
      if (s0.alt > 0) { run.push({ lon: l % 360, alt: s0.alt, az: s0.az }); }
      else { if (run.length > best.length) best = run; run = []; }
    }
    if (run.length > best.length) best = run;
    if (best.length > 361) best = best.slice(0, 361);

    var d = '';
    best.forEach(function (pt, i) {
      var q = skyPolar(pt.alt, pt.az);
      d += (i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
    });
    parts.push('<path d="' + d + '" fill="none" stroke="var(--sun)" stroke-width="2" ' +
      'opacity=".65"/>');

    /* -- the constellations, on the arc, at their real widths ----------- */
    for (var j = 0; j < BANDS.length; j++) {
      var b1 = norm360(BANDS[j][0] + pre);
      var b2 = norm360(BANDS[(j + 1) % BANDS.length][0] + pre);
      var width = norm360(b2 - b1);
      var seg = best.filter(function (pt) { return norm360(pt.lon - b1) < width; });
      if (seg.length < 2) continue;
      var sd = '';
      seg.forEach(function (pt, i) {
        var q = skyPolar(pt.alt, pt.az);
        sd += (i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
      });
      parts.push('<path d="' + sd + '" fill="none" stroke="' +
        (j % 2 ? 'var(--moon)' : 'var(--equinox)') +
        '" stroke-width="7" opacity=".28" stroke-linecap="butt"><title>' +
        esc(BANDS[j][1]) + ', ' + width.toFixed(1) + '° wide</title></path>');
      var mid = seg[Math.floor(seg.length / 2)];
      var mq = skyPolar(mid.alt, mid.az);
      if (seg.length > 6) {
        parts.push('<text x="' + f(mq[0]) + '" y="' + f(mq[1] - 12) + '" text-anchor="middle" ' +
          'font-size="10" fill="var(--ink-2)">' + esc(BANDS[j][1]) + '</text>');
      }
    }

    /* -- where the ring meets the ground -------------------------------- */
    /* Which end is which is decided by the bearing, not by the order the arc
     * was walked in. Longitude increases from the setting point towards the
     * rising one, because the zodiac rises in sign order, so reading the ends
     * off the array puts them the wrong way round. An easterly bearing is a
     * rising point; a westerly one is setting. That is true whichever way the
     * sampling happened to run. */
    [best[0], best[best.length - 1]].forEach(function (end) {
      if (!end) return;
      var rising = norm360(end.az) < 180;
      var q = skyPolar(0, end.az);
      parts.push('<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="4" fill="var(--today)"/>');
      parts.push('<text x="' + f(q[0]) + '" y="' + f(q[1] - 12) + '" text-anchor="middle" ' +
        'font-size="9.5" fill="var(--today)">' +
        (rising ? 'ecliptic rises' : 'ecliptic sets') + '</text>');
    });

    /* -- and the bodies riding on it ------------------------------------ */
    var COL = { Mercury: '#8fa3b8', Venus: '#c98fb9', Mars: '#d1685a',
                Jupiter: '#c9a24a', Saturn: '#8d8ab5' };
    var list = [];
    var sun = A.sunPosition(jde);
    list.push({ g: '☉', n: 'Sun', ra: sun.ra, dec: sun.dec, c: 'var(--sun-bright)' });
    var moon = A.moonPosition(jde);
    list.push({ g: '☽', n: 'Moon', ra: moon.ra, dec: moon.dec, c: 'var(--moon)' });
    P.ORDER.forEach(function (nm) {
      var pp = P.position(nm, jde);
      list.push({ g: P.GLYPH[nm], n: nm, ra: pp.ra, dec: pp.dec, c: COL[nm] });
    });

    var shown = 0;
    list.forEach(function (b) {
      var alt = A.altitudeOf(b.ra, b.dec, jd, lat, lon);
      if (alt <= 0) return;
      shown++;
      var az = A.azimuthOf(b.ra, b.dec, jd, lat, lon);
      var q = skyPolar(alt, az);
      parts.push('<g><title>' + esc(b.n) + ' · ' + alt.toFixed(0) + '° up · bearing ' +
        az.toFixed(0) + '°</title>' +
        '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="12" fill="var(--bg)" ' +
        'stroke="' + b.c + '" stroke-width="1.4"/>' +
        '<text x="' + f(q[0]) + '" y="' + f(q[1] + 0.5) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="13" fill="' + b.c + '">' + b.g + '</text></g>');
    });

    return { svg: parts.join(''), visible: shown, arcDegrees: best.length };
  }

  global.Zodiac = { render: render, sky: sky };
})(typeof window !== 'undefined' ? window : globalThis);
