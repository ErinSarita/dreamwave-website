/* orrery.js — the system from above, and why it looks the way it does from here.
 *
 * Drawn to true scale. Saturn's orbit sets the rim, so the inner four are a
 * small knot near the middle: that is not a drawing problem, it is what the
 * solar system is like, and the view can be zoomed like every other wheel on
 * the site. Compressing the radii would have made the inner planets legible
 * and made the sight-lines lies, and the sight-lines are the point.
 *
 * Because the scale is honest, the line drawn from the Earth through a planet
 * and out to the zodiac ring lands on the sign that planet really appears in.
 * That is the whole argument of the picture: you can see the flat wheel and
 * the sky view, and here is the machinery that produces both.
 *
 * The orbits are drawn as the ellipses they are, oriented by each planet's
 * own perihelion, and flattened onto the ecliptic plane. Inclinations run
 * from 0.8 degrees for Uranus to 7 for Mercury, so the flattening costs very
 * little and is stated rather than hidden.
 */
(function (global) {
  'use strict';
  var A = global.Astro, P = global.Planets;
  var CX = 500, CY = 500;
  var RIM = 430;                 // Saturn's orbit sits here
  var AU = RIM / 9.9;            // pixels per astronomical unit
  var RING = 470;                // the zodiac, drawn as if at arm's length

  function f(n) { return Math.round(n * 100) / 100; }
  function norm360(d) { return ((d % 360) + 360) % 360; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* Ecliptic longitude increases anticlockwise seen from the north, and every
   * other wheel here runs clockwise from the top, so this one does too. */
  function place(lonDeg, distAU) {
    var t = (lonDeg - 90) * Math.PI / 180;
    return [CX + distAU * AU * Math.cos(t), CY + distAU * AU * Math.sin(t)];
  }

  var BODIES = [
    { n: 'Mercury', c: '#8fa3b8', r: 4 },
    { n: 'Venus',   c: '#c98fb9', r: 5.5 },
    { n: 'Earth',   c: '#4b8fd4', r: 5.5 },
    { n: 'Mars',    c: '#d1685a', r: 4.5 },
    { n: 'Jupiter', c: '#c9a24a', r: 9 },
    { n: 'Saturn',  c: '#8d8ab5', r: 8 }
  ];
  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra',
               'Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  function render(opts) {
    var when = opts.when || new Date();
    var jd = A.jdFromDate(when), jde = A.jdeFromJD(jd);
    var T = (jde - 2451545) / 36525, pre = P.precession(T);
    var parts = [];

    /* -- the zodiac, out where the stars are ---------------------------- */
    for (var i = 0; i < 12; i++) {
      var a1 = i * 30;
      var p1 = place(a1, RING / AU), p2 = place(a1 + 30, RING / AU);
      parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + RING + ' ' + RING +
        ' 0 0 1 ' + f(p2[0]) + ' ' + f(p2[1]) + '" fill="none" stroke="var(--line)" ' +
        'stroke-width="' + (i % 2 ? 9 : 5) + '" opacity="' + (i % 2 ? '.5' : '.3') + '"/>');
      var lp = place(a1 + 15, (RING + 26) / AU);
      var rot = (a1 + 15) > 180 ? (a1 + 15) + 90 : (a1 + 15) - 90;
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="13" fill="var(--ink-3)" ' +
        'transform="rotate(' + f(rot) + ' ' + f(lp[0]) + ' ' + f(lp[1]) + ')">' +
        SIGNS[i] + '</text>');
    }

    /* -- the orbits, as the ellipses they are --------------------------- */
    var pos = {};
    BODIES.forEach(function (b) {
      var d = '';
      for (var deg = 0; deg <= 360; deg += 2) {
        var v0 = P.helioAtMean(b.n, T, deg);
        var q = place(norm360(Math.atan2(v0[1], v0[0]) * 180 / Math.PI + pre),
                      Math.sqrt(v0[0] * v0[0] + v0[1] * v0[1]));
        d += (deg ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
      }
      parts.push('<path d="' + d + 'Z" fill="none" stroke="' + b.c +
        '" stroke-width="1" opacity=".38"/>');
      var v = P.helio(b.n, T);
      /* The orbital elements give J2000 longitudes; the sign ring outside is
       * cut from the equinox of the date. Without carrying the bodies forward
       * by the precession between them, every sight-line lands a third of a
       * degree short of the sign the panel says the planet is in, which is
       * invisible until a planet sits near a boundary and then is simply
       * wrong. */
      var lon = norm360(Math.atan2(v[1], v[0]) * 180 / Math.PI + pre);
      var dist = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
      pos[b.n] = { lon: lon, dist: dist, xy: place(lon, dist) };
    });

    /* -- sight-lines from the Earth ------------------------------------- */
    var e = pos.Earth;
    BODIES.forEach(function (b) {
      if (b.n === 'Earth') return;
      var t = pos[b.n];
      var dx = t.xy[0] - e.xy[0], dy = t.xy[1] - e.xy[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var far = [e.xy[0] + dx / len * 1400, e.xy[1] + dy / len * 1400];
      parts.push('<path d="M' + f(e.xy[0]) + ' ' + f(e.xy[1]) + 'L' + f(far[0]) + ' ' +
        f(far[1]) + '" stroke="' + b.c + '" stroke-width=".9" opacity=".45" ' +
        'stroke-dasharray="4 5"/>');
    });
    /* The sun's sight-line is the only one that runs through the middle, which
     * is exactly why the sun always appears opposite where the earth stands. */
    var sdx = CX - e.xy[0], sdy = CY - e.xy[1];
    var slen = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
    parts.push('<path d="M' + f(e.xy[0]) + ' ' + f(e.xy[1]) + 'L' +
      f(e.xy[0] + sdx / slen * 1400) + ' ' + f(e.xy[1] + sdy / slen * 1400) +
      '" stroke="var(--sun)" stroke-width="1" opacity=".55" stroke-dasharray="4 5"/>');

    /* -- the sun ---------------------------------------------------------- */
    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="11" fill="var(--sun-bright)"/>');
    parts.push('<text x="' + CX + '" y="' + (CY + 26) + '" text-anchor="middle" ' +
      'font-size="11" fill="var(--ink-3)">Sun</text>');

    /* -- the planets ------------------------------------------------------ */
    BODIES.forEach(function (b) {
      var q = pos[b.n].xy;
      var sg = b.n === 'Earth' ? null : P.signOf(P.position(b.n, jde).longitude);
      var con = b.n === 'Earth' ? null
        : P.constellationOf(norm360(P.position(b.n, jde).longitude - pre));
      parts.push('<g><title>' + esc(b.n) +
        (sg ? ' · appears in ' + sg.name + ' ' + sg.degree.toFixed(1) + '° · in front of ' + con : '') +
        ' · ' + pos[b.n].dist.toFixed(2) + ' AU from the sun</title>' +
        '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="' + (b.r + 3) +
        '" fill="var(--bg)" opacity=".9"/>' +
        '<circle cx="' + f(q[0]) + '" cy="' + f(q[1]) + '" r="' + b.r +
        '" fill="' + b.c + '"/></g>');
      var lab = place(pos[b.n].lon, pos[b.n].dist);
      parts.push('<text x="' + f(lab[0]) + '" y="' + f(lab[1] - b.r - 6) +
        '" text-anchor="middle" font-size="11" fill="' + b.c + '">' +
        (b.n === 'Earth' ? 'Earth (you)' : b.n) + '</text>');
    });

    return { svg: parts.join(''), earthLon: e.lon,
             au: AU, distances: pos };
  }

  global.Orrery = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
