/* globe.js — a small orthographic Earth, centred on the viewer's own place,
 * so the day clock has something to anchor "how close to day or night is it"
 * against: not just an abstract band, but the planet itself, day and night
 * sides, with you at the middle of what's visible.
 *
 * The projection is genuine 3D (a sphere rotated so the observer faces the
 * camera, then dropped to 2D by discarding depth) rather than an illustration
 * standing in for one — the standard orthographic map projection, centred on
 * a point instead of a pole.
 */
(function (global) {
  'use strict';
  var A = global.Astro;
  var DEG = Math.PI / 180;

  /* The point on Earth directly under the Sun right now: its latitude is the
   * Sun's declination, its longitude comes from the Sun's hour angle at
   * Greenwich. */
  function subsolarPoint(jde, jd) {
    var s = A.sunPosition(jde);
    var gha = A.norm360(A.greenwichSiderealTime(jd) - s.ra);
    var lon = A.norm180(-gha);
    return { lat: s.dec, lon: lon };
  }

  /* Orthographic projection of (lat, lon) onto a disc of radius R, as seen
   * face-on from directly above (lat0, lon0). Returns null if the point is
   * on the far side (not visible from that vantage). */
  function project(lat, lon, lat0, lon0, R) {
    var la = lat * DEG, lo = (lon - lon0) * DEG, la0 = lat0 * DEG;
    var cosc = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo);
    if (cosc < 0) return null;
    var x = R * Math.cos(la) * Math.sin(lo);
    var y = -R * (Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo));
    return [x, y];
  }
  // Same, but without the visibility cull, for building a continuous outline.
  function projectRaw(lat, lon, lat0, lon0, R) {
    var la = lat * DEG, lo = (lon - lon0) * DEG, la0 = lat0 * DEG;
    var x = R * Math.cos(la) * Math.sin(lo);
    var y = -R * (Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo));
    var cosc = Math.sin(la0) * Math.sin(la) + Math.cos(la0) * Math.cos(la) * Math.cos(lo);
    return { x: x, y: y, front: cosc >= 0 };
  }

  /* SVG path built from consecutive visible segments of a sampled line (a
   * meridian, parallel, or the terminator) — breaks the path wherever it
   * crosses the limb rather than jumping straight across the disc. */
  function pathFromSamples(samples) {
    var d = '', open = false;
    samples.forEach(function (p) {
      if (p.front) {
        d += (open ? 'L' : 'M') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
        open = true;
      } else open = false;
    });
    return d;
  }

  /* The terminator (day/night boundary): every point where the Sun is
   * exactly on the horizon. Sampled as a closed curve on the globe, then
   * projected and used both as a drawn line and as the clip boundary for the
   * lit hemisphere. */
  function terminatorSamples(sub, lat0, lon0, R, steps) {
    var poleLat = sub.lat >= 0 ? sub.lat - 90 : sub.lat + 90;   // antipode-ish pole of the terminator circle
    var out = [];
    // Parametrize the terminator as the great circle 90 degrees from the
    // subsolar point: rotate a starting vector around the subsolar axis.
    for (var i = 0; i <= steps; i++) {
      var t = i / steps * 360;
      // Point at angular distance 90 from the subsolar point, bearing t.
      var la0 = sub.lat * DEG, lo0 = sub.lon * DEG, brg = t * DEG, d = 90 * DEG;
      var la = Math.asin(Math.sin(la0) * Math.cos(d) + Math.cos(la0) * Math.sin(d) * Math.cos(brg));
      var lo = lo0 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la0),
                                 Math.cos(d) - Math.sin(la0) * Math.sin(la));
      out.push(projectRaw(la / DEG, lo / DEG, lat0, lon0, R));
    }
    return out;
  }

  function litFraction(lat, lon, sub) {
    var la = lat * DEG, lo = lon * DEG, las = sub.lat * DEG, los = sub.lon * DEG;
    return Math.sin(las) * Math.sin(la) + Math.cos(las) * Math.cos(la) * Math.cos(lo - los);
  }

  /* Renders the globe centred on (lat0, lon0) at the given instant. Returns
   * SVG markup (no outer <svg> wrapper) sized to a viewBox of [-R,-R,2R,2R]
   * around (0,0). */
  function render(jde, jd, lat0, lon0, R) {
    var sub = subsolarPoint(jde, jd);
    var parts = [];

    parts.push('<circle cx="0" cy="0" r="' + R + '" fill="var(--night-2)"/>');

    // Lit hemisphere: sample a grid and fill each lit, visible cell — simple
    // and robust against the terminator's shape and the visible limb both,
    // with no path-clipping edge cases to get wrong. Every cell becomes one
    // subpath within a single <path>, rather than one element each, which is
    // what actually keeps this cheap: a few hundred "M..L..L..L..Z" chunks
    // cost far less than repeating fill/stroke on each of them.
    var latSteps = 42, lonSteps = 84, cells = [];
    for (var i = 0; i < latSteps; i++) {
      var lat1 = -90 + i * 180 / latSteps, lat2 = lat1 + 180 / latSteps;
      var latMid = (lat1 + lat2) / 2;
      for (var j = 0; j < lonSteps; j++) {
        var lon1 = -180 + j * 360 / lonSteps, lon2 = lon1 + 360 / lonSteps;
        var lonMid = (lon1 + lon2) / 2;
        if (litFraction(latMid, lonMid, sub) <= 0) continue;
        var p1 = project(lat1, lon1, lat0, lon0, R), p2 = project(lat1, lon2, lat0, lon0, R);
        var p3 = project(lat2, lon2, lat0, lon0, R), p4 = project(lat2, lon1, lat0, lon0, R);
        if (!p1 || !p2 || !p3 || !p4) continue;
        cells.push('M' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
                   'L' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) +
                   'L' + p3[0].toFixed(1) + ' ' + p3[1].toFixed(1) +
                   'L' + p4[0].toFixed(1) + ' ' + p4[1].toFixed(1) + 'Z');
      }
    }
    if (cells.length) {
      parts.push('<path d="' + cells.join('') + '" fill="var(--sun)" stroke="var(--sun)" stroke-width=".4"/>');
    }

    // Graticule: meridians every 30 degrees, parallels every 30 degrees.
    for (var lon = -150; lon <= 180; lon += 30) {
      var m = [];
      for (var la2 = -90; la2 <= 90; la2 += 3) m.push(projectRaw(la2, lon, lat0, lon0, R));
      parts.push('<path d="' + pathFromSamples(m) + '" fill="none" stroke="var(--line)" stroke-width=".5" opacity=".55"/>');
    }
    for (var lat = -60; lat <= 60; lat += 30) {
      var p = [];
      for (var lo2 = -180; lo2 <= 180; lo2 += 3) p.push(projectRaw(lat, lo2, lat0, lon0, R));
      parts.push('<path d="' + pathFromSamples(p) + '" fill="none" stroke="var(--line)" stroke-width=".5" opacity=".55"/>');
    }

    // Terminator line itself, drawn crisp on top of the shaded fill.
    var term = terminatorSamples(sub, lat0, lon0, R, 180);
    parts.push('<path d="' + pathFromSamples(term) + '" fill="none" stroke="var(--sun-bright)" stroke-width="1" opacity=".9"/>');

    // Globe outline and the observer, dead centre by construction.
    parts.push('<circle cx="0" cy="0" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="1.2"/>');
    parts.push('<circle cx="0" cy="0" r="3" fill="var(--today)" stroke="var(--bg)" stroke-width="1"/>');

    return parts.join('');
  }

  global.Globe = { render: render, subsolarPoint: subsolarPoint, project: project };
})(typeof window !== 'undefined' ? window : globalThis);
