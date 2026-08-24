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
  /* Three rings now, drawn to one scale so they can be read against each
   * other directly: the tropical zodiac outside, the sidereal zodiac of
   * jyotisha in the middle, and the real sky innermost. Each band gets the
   * same depth, since none of them is truer than the others. They are three
   * answers to three different questions. */
  /* Three rings, drawn to one scale so they can be read against each other:
   * the tropical zodiac outside, the sidereal zodiac of jyotisha in the
   * middle, and the real sky innermost.
   *
   * The sky ring is given far more depth than the other two because it has
   * something to show. The zodiacs are bands with names on them; this one
   * carries the actual stars, and a star needs room away from the ecliptic to
   * stand where it really stands. */
  var R = { horizonOut: 384, horizonIn: 226,
            signOut: 378, signIn: 352, signLabel: 365,
            sidOut: 348, sidIn: 322, sidLabel: 335,
            conOut: 318, conIn: 226, conLabel: 234,
            /* Ecliptic latitude is mapped across this span, so a star sits
             * off the ecliptic by the amount it is really off it. */
            starMid: 278, starSpread: 38, starLatMax: 16,
            tick: 222, bodyMax: 212, bodyMin: 136, hub: 120 };

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
  /* Text set in its band. Two ways of doing it.
   *
   * Laid along the ring, curving with it, is the handsomer arrangement and
   * the one the printed charts use. It also asks the reader to tilt their
   * head, and on the small stage a name at the bottom of the wheel ends up
   * the wrong way up however it is turned.
   *
   * Set flat, every name reads straight off the page at a glance, which is
   * what the old painted clock faces did: the figures went round, the words
   * stayed level. `flat` chooses the second.
   */
  /* A name set along its own band, turned with the ring and kept the right
   * way up on the lower half, which is how the season names sit on the year
   * wheel. `span` is how many degrees of ring the name has to live in: the
   * size is brought down until the word fits inside its own slice rather than
   * running out over its neighbours. Scorpius owns six degrees and cannot be
   * given the same lettering as Virgo, which owns forty-four.
   *
   * The 0.55 is the width of a character as a fraction of its height for this
   * face, near enough for fitting text nobody is going to measure. */
  function tangential(r, a, txt, size, fill, weight, span) {
    var p = polar(r, a);
    if (span) {
      var room = 2 * Math.PI * r * (span / 360) * 0.86;   // a little padding
      var need = String(txt).length * size * 0.55;
      if (need > room) size = Math.max(7, size * room / need);
    }
    /* A segment of a ring is long the way the ring runs and short across it,
     * and a name wants the long way. Text drawn in SVG runs left to right, so
     * at the top of the circle, where the ring runs horizontally, it needs no
     * turning at all; a quarter turn further round it needs a quarter turn to
     * match. The rotation is therefore the angle itself.
     *
     * It was the angle minus ninety, which set every name across the narrow
     * dimension instead of along the wide one, so the words ran outwards like
     * spokes and had only the depth of the band to fit into.
     *
     * Between ninety and two hundred and seventy degrees the same rotation
     * would leave the word upside down, so it is turned the rest of the way,
     * which is exactly what the year wheel does with its season names. */
    var rot = (a > 90 && a < 270) ? a + 180 : a;
    return '<text x="' + f(p[0]) + '" y="' + f(p[1]) + '" text-anchor="middle" ' +
      'dominant-baseline="middle" font-size="' + f(size) + '" fill="' + fill + '"' +
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
    /* On the main stage the words lie flat and only the wheel turns, which is
     * how a painted clock face reads: nothing asks the head to tilt. */
    var flat = opts.centre === 'earth';

    /* -- the horizon, and where to actually look ---------------------------
     *
     * This wheel spends its angle on ecliptic longitude, not on compass
     * bearing, so a constellation's place on it does not by itself say which
     * way to turn. What does say so is where it falls between the three
     * marks below.
     *
     * At any moment the ecliptic cuts the horizon at two opposite points: one
     * rising, one setting. Between them, over your head, runs the visible
     * half, and the highest point of that half is where it crosses the
     * meridian. Read from the rising mark round to the setting mark, the
     * visible half sweeps from one horizon, up across the sky, and down to
     * the other. So something near the rising mark is low and about to climb;
     * something near the highest mark is at its best; something near the
     * setting mark is on its way down.
     *
     * The three marks carry the compass bearing they actually have, worked
     * out rather than assumed, because it is not the same from every latitude
     * and it is not the same at every hour.
     */
    var COMPASS16 = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                     'S','SSW','SW','WSW','W','WNW','NW','NNW'];
    function altAzOf(lonEcl) {
      var e2 = P.toEquatorial(norm360(lonEcl), 0, eps);
      return { alt: A.altitudeOf(e2.ra, e2.dec, jd, opts.lat, opts.lon),
               az: A.azimuthOf(e2.ra, e2.dec, jd, opts.lat, opts.lon) };
    }
    function compassOf(az) { return COMPASS16[Math.round(norm360(az) / 22.5) % 16]; }

    if (opts.lat !== undefined && opts.lon !== undefined) {
      /* The half under your feet, shaded. */
      var below = [], run = null;
      for (var h = 0; h <= 360; h += 2) {
        if (altAzOf(h).alt < 0) {
          if (!run) run = { a1: h, a2: h }; else run.a2 = h;
        } else if (run) { below.push(run); run = null; }
      }
      if (run) below.push(run);
      below.forEach(function (b2) {
        if (b2.a2 - b2.a1 < 1) return;
        parts.push('<path d="' + sector(R.horizonIn, R.horizonOut, b2.a1, b2.a2) +
          '" fill="var(--void)" fill-opacity=".62" pointer-events="none"><title>' +
          'Under the horizon from here right now</title></path>');
      });

      /* Rising, highest, setting: the three marks that turn longitude into a
       * direction to face. Drawn right across the rings so they read as
       * boundaries rather than as ticks on one of them. */
      var ang2 = P.angles(jd, jde, opts.lat, opts.lon);
      var asc = norm360(ang2.ascendant);
      var mid = norm360(ang2.midheaven);
      /* The meridian point is whichever of the midheaven or its opposite is
       * actually up; below the pole it is the other one that shows. */
      if (altAzOf(mid).alt < 0) mid = norm360(mid + 180);

      [{ a: asc, k: 'Rising' },
       { a: mid, k: 'Highest' },
       { a: norm360(asc + 180), k: 'Setting' }].forEach(function (m) {
        var aa = altAzOf(m.a);
        var dir = compassOf(aa.az);
        var q1 = polar(R.horizonIn, m.a), q2 = polar(R.horizonOut + 8, m.a);
        parts.push('<path d="M' + f(q1[0]) + ' ' + f(q1[1]) + 'L' + f(q2[0]) + ' ' +
          f(q2[1]) + '" stroke="var(--sun-bright)" stroke-width="1.6" opacity=".85"/>');
        var lab = m.k === 'Highest'
          ? dir + ' \u00b7 ' + Math.round(aa.alt) + '\u00b0 up'
          : dir + ' horizon';
        parts.push(tangential(R.horizonOut + 22, m.a, m.k.toUpperCase() + '  ' + lab,
          10, 'var(--sun-bright)', '600'));
      });
    }

    /* -- the twelve signs, equal by construction ------------------------- */
    for (var i = 0; i < 12; i++) {
      var a1 = i * 30, a2 = a1 + 30;
      parts.push('<path d="' + sector(R.signIn, R.signOut, a1, a2) +
        '" fill="var(--bg-2)" fill-opacity="' + (i % 2 ? '.85' : '.45') +
        '" stroke="var(--line-soft)" stroke-width=".8"/>');
      parts.push(tangential(R.signLabel, a1 + 15, SIGNS[i], 12.5, 'var(--ink-2)', '500', 30));
    }

    /* -- the sidereal zodiac: jyotisha ------------------------------------
     * The same twelve equal signs as above, counted from the fixed stars
     * rather than from the equinox, so each stays with the stars it was named
     * for. The whole ring is the tropical one turned back by the ayanamsa,
     * about twenty-four degrees today: very nearly a whole sign, and exactly
     * why a Vedic chart so often reads one sign back. */
    var ayan = P.ayanamsa(T);
    for (var v = 0; v < 12; v++) {
      var v1 = norm360(v * 30 + ayan);
      parts.push('<path d="' + sector(R.sidIn, R.sidOut, v1, v1 + 30) +
        '" fill="var(--panel)" fill-opacity="' + (v % 2 ? '.8' : '.4') +
        '" stroke="var(--line-soft)" stroke-width=".8"><title>' +
        esc(SIGNS[v]) + ' (sidereal \u00b7 jyotisha)</title></path>');
      parts.push(tangential(R.sidLabel, v1 + 15, SIGNS[v], 11.5,
                            'var(--sc-iris, #8b7bd8)', '500', 30));
    }

    /* -- the thirteen constellations, at the widths they really have ------
     * Their J2000 boundaries are carried forward by precession so they line
     * up against the signs as they stand on this date. */
    for (var j = 0; j < BANDS.length; j++) {
      var s1 = norm360(BANDS[j][0] + pre);
      var s2 = norm360(BANDS[(j + 1) % BANDS.length][0] + pre);
      var span = norm360(s2 - s1);
      /* Where to turn to find it, said on the band itself. The wheel can
       * only place a constellation along the ecliptic; this is the part that
       * answers "so which way do I face". */
      var whereCon = '';
      if (opts.lat !== undefined && opts.lon !== undefined) {
        var ca = altAzOf(norm360(s1 + span / 2));
        whereCon = ca.alt < 0
          ? ' · under the horizon now'
          : ' · look ' + compassOf(ca.az) + ', ' + Math.round(ca.alt) + '° up';
      }
      parts.push('<path d="' + sector(R.conIn, R.conOut, s1, s1 + span) +
        '" fill="var(--panel)" fill-opacity="' + (j % 2 ? '.9' : '.55') +
        '" stroke="var(--line-soft)" stroke-width=".8"><title>' +
        esc(BANDS[j][1]) + ', ' + span.toFixed(1) + '° of the ecliptic' +
        whereCon + '</title></path>');
      /* Scorpius gets seven degrees of ecliptic and cannot hold its own name
       * at any readable size, so the narrow bands are abbreviated and the
       * full name stays in the tooltip. */
      var SHORT = { Capricornus: 'Capr', Sagittarius: 'Sagitt', Ophiuchus: 'Ophi',
                    Scorpius: 'Scorp', Aquarius: 'Aquar' };
      var label = span < 20 ? (SHORT[BANDS[j][1]] || BANDS[j][1]) : BANDS[j][1];
      if (span > 5) {
        parts.push(tangential(R.conLabel, s1 + span / 2, label,
          10.5, 'var(--ink-3)', null, span));
      }

      /* -- and the stars themselves ------------------------------------
       * The pattern anybody would actually recognise, set where it really
       * is: longitude round the ring, latitude out from the ecliptic. The
       * catalogue is J2000, so the same precession that moved the band
       * moves the stars with it and the two stay together. */
      if (global.ZodiacStars) {
        var fig = global.ZodiacStars.figure(BANDS[j][1], eps);
        if (fig) {
          var pts = fig.stars.map(function (st) {
            var la = Math.max(-R.starLatMax, Math.min(R.starLatMax, st.lat));
            var rr = R.starMid + (la / R.starLatMax) * R.starSpread;
            return { p: polar(rr, norm360(st.lon + pre)), mag: st.mag, name: st.name };
          });

          fig.lines.forEach(function (run) {
            if (run.length < 2) return;
            var d = '';
            run.forEach(function (ix, k) {
              var q2 = pts[ix].p;
              d += (k ? 'L' : 'M') + f(q2[0]) + ' ' + f(q2[1]);
            });
            parts.push('<path d="' + d + '" fill="none" stroke="var(--zstar-line)" ' +
              'stroke-width=".8" opacity=".5" pointer-events="none"/>');
          });

          pts.forEach(function (q2) {
            /* Brighter stars bigger, as the eye sorts them. Two discs: a
             * soft wide one for the glow and a hard small one for the
             * star, which reads better at this size than a blur filter
             * and costs nothing. */
            var rad = Math.max(0.9, Math.min(2.9, 2.9 - 0.38 * (q2.mag - 1)));
            parts.push('<circle cx="' + f(q2.p[0]) + '" cy="' + f(q2.p[1]) +
              '" r="' + f(rad * 2.7) + '" fill="var(--zstar-glow)" ' +
              'opacity=".28" pointer-events="none"/>');
            parts.push('<circle cx="' + f(q2.p[0]) + '" cy="' + f(q2.p[1]) +
              '" r="' + f(rad) + '" fill="var(--zstar)"><title>' +
              esc(q2.name) + '</title></circle>');
          });
        }
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
    /* Elongation from the sun is the moon's age in degrees: nought at new,
     * a hundred and eighty at full. It is also the angle the sunlight is
     * coming in at, which is the same fact said the other way round, and it
     * is what decides the shape. */
    var moonAge = norm360(moon.longitude - sun.longitude);
    bodies.push({ g: '☽', n: 'Moon', lon: norm360(moon.longitude), c: 'var(--moon)',
                  age: moonAge });
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
        /* The moon is drawn as it actually looks tonight rather than as its
         * symbol: the one body whose face is worth showing. */
        (b.age != null && global.MoonGlyph
          ? '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="9" ' +
            'fill="var(--moon-shadow, #2a2d3d)"/>' +
            '<path d="' + global.MoonGlyph.litPath(q[0], q[1], 9, b.age) +
            '" fill="var(--moon)"/>'
          : '<text x="' + f(q[0]) + '" y="' + f(q[1] + 0.5) + '" text-anchor="middle" ' +
            'dominant-baseline="middle" font-size="13" fill="' + b.c + '">' + b.g + '</text>') +
        /* The glyph alone asks the reader to know their symbols. Set the name
         * under it, level, so the wheel can simply be read. */
        (flat
          ? '<text x="' + f(q[0]) + '" y="' + f(q[1] + 22) + '" text-anchor="middle" ' +
            'dominant-baseline="middle" font-size="9" fill="' + b.c +
            '" opacity=".9">' + esc(b.n) + '</text>'
          : '') +
        '</g>');
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

    /* -- the middle ------------------------------------------------------
     * Two ways of filling it. The window wants words, because it is there to
     * explain the two rings. The main stage wants the earth, because the
     * point of standing this wheel up on its own is to say plainly where the
     * looking is being done from: the old clock faces put the world at the
     * middle and let the sun and moon go round it, which is what it looks
     * like from here, and is an honest picture of the view even though it is
     * not one of the system.
     */
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R.hub +
      '" fill="var(--bg)" opacity=".8"/>');

    if (opts.centre === 'earth' && global.Globe &&
        opts.lat !== undefined && opts.lon !== undefined) {
      parts.push('<g transform="translate(' + CX + ' ' + CY + ')">' +
        global.Globe.render(jde, jd, 18, opts.lon, 74,
                            { lat: opts.lat, lon: opts.lon }) + '</g>');
      parts.push('<text x="' + CX + '" y="' + (CY + 100) + '" text-anchor="middle" ' +
        'font-size="12" font-family="var(--serif)" fill="var(--ink-2)">' +
        esc(opts.placeName || '') + '</text>');
      parts.push('<text x="' + CX + '" y="' + (CY + 118) + '" text-anchor="middle" ' +
        'font-size="10" font-family="var(--mono)" fill="var(--ink-3)">' +
        esc(opts.stamp || '') + '</text>');
      return { svg: parts.join(''), precession: pre };
    }

    parts.push('<text x="' + CX + '" y="' + (CY - 16) + '" text-anchor="middle" ' +
      'font-size="11" letter-spacing="1.4" fill="var(--ink-3)">ALONG THE ECLIPTIC</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 10) + '" text-anchor="middle" ' +
      'font-size="13" font-family="var(--serif)" fill="var(--ink-2)">' +
      esc(opts.placeName || '') + '</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 32) + '" text-anchor="middle" ' +
      'font-size="10.5" font-family="var(--mono)" fill="var(--ink-3)">' +
      esc(opts.stamp || '') + '</text>');
    parts.push('<text x="' + CX + '" y="' + (CY + 54) + '" text-anchor="middle" ' +
      'font-size="9.5" fill="var(--ink-3)">tropical · sidereal · real sky</text>');

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
