/* stars.js — the Big Dipper as a real, computed sky reference: what it looks
 * like facing north on a given date, from a given place, so you can go
 * outside and check it against the actual sky.
 *
 * Catalog positions are J2000 equatorial coordinates (RA/Dec, degrees) for
 * the seven bright stars of Ursa Major, plus Polaris. No proper motion or
 * precession correction is applied — over the century or two this site's
 * dates span, that error is a small fraction of a degree, well under what
 * matters for a naked-eye reference chart.
 */
(function (global) {
  'use strict';
  var A = global.Astro;

  var DIPPER = [
    { name: 'Dubhe',  ra: 165.9319, dec: 61.7511 },
    { name: 'Merak',  ra: 165.4603, dec: 56.3824 },
    { name: 'Phecda', ra: 178.4577, dec: 53.6948 },
    { name: 'Megrez', ra: 183.8565, dec: 57.0326 },
    { name: 'Alioth', ra: 193.5073, dec: 55.9598 },
    { name: 'Mizar',  ra: 200.9814, dec: 54.9254 },
    { name: 'Alkaid', ra: 206.8852, dec: 49.3133 }
  ];
  var POLARIS = { name: 'Polaris', ra: 37.9529, dec: 89.2641 };

  // Bowl is a closed quadrilateral, Megrez to Alkaid is the handle.
  var BOWL = ['Megrez', 'Dubhe', 'Merak', 'Phecda', 'Megrez'];
  var HANDLE = ['Megrez', 'Alioth', 'Mizar', 'Alkaid'];

  /* Alt/az for every named star at a given JD (UT), for an observer at
   * lat/lon. Returns null stars as {alt, az}; also flags whether the whole
   * dipper is below the horizon (not visible from this latitude/time). */
  function dipperView(jd, lat, lon) {
    var pos = {}, anyUp = false;
    DIPPER.concat([POLARIS]).forEach(function (s) {
      var alt = A.altitudeOf(s.ra, s.dec, jd, lat, lon);
      var az = A.azimuthOf(s.ra, s.dec, jd, lat, lon);
      pos[s.name] = { alt: alt, az: az };
      if (s.name !== 'Polaris' && alt > 0) anyUp = true;
    });
    return { pos: pos, visible: anyUp };
  }

  /* The evening reference instant for a given civil date: when the Sun
   * crosses -12° (nautical twilight), dark enough for the Dipper to show
   * against the sky, timed close enough to nightfall to stay "this evening"
   * rather than drifting into deep night. Falls back to local midnight at
   * high latitudes where that crossing doesn't happen (near-continuous
   * twilight or polar day/night). */
  function eveningInstant(dayStartJD, lat, lon) {
    var rs = A.riseSet('sun', dayStartJD, 1, lat, lon, -12);
    if (rs.set !== null) return rs.set;
    return dayStartJD + 0.5;
  }

  /* alt/az (degrees) to a unit vector in (east, north, up). */
  function toVector(alt, az) {
    var a = alt * Math.PI / 180, z = az * Math.PI / 180, ca = Math.cos(a);
    return [ca * Math.sin(z), ca * Math.cos(z), Math.sin(a)];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function norm(v) {
    var m = Math.sqrt(dot(v, v)) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
  }

  /* SVG path data for the dipper glyph, with Polaris included as a fixed
   * anchor so each circle reads as a piece of sky rather than a loose
   * scatter of dots: the Dipper's orientation changes through the year, but
   * its relationship to the pole star doesn't, which is exactly what makes
   * the rotation legible.
   *
   * The projection is azimuthal-equidistant centred on Polaris itself. That
   * choice matters: Polaris sits under a degree from the celestial pole, so
   * it is the one star that effectively does not move all night or all year.
   * Pinning it to the middle and letting the Dipper swing around it renders
   * the yearly rotation as rotation. Centring on the group's centroid, as
   * this did before, slid the whole pattern about the frame instead and
   * partly hid the motion the glyph exists to show.
   *
   * Distances are exact angular degrees from Polaris, with local "up" mapped
   * to up in the glyph, so it matches what you see facing north. Returns null
   * if the Dipper is below the horizon. */
  function dipperGlyph(jd, lat, lon, size) {
    var view = dipperView(jd, lat, lon);
    if (!view.visible) return null;

    var names = DIPPER.map(function (s) { return s.name; }).concat(['Polaris']);
    var vecs = {};
    names.forEach(function (n) {
      vecs[n] = toVector(view.pos[n].alt, view.pos[n].az);
    });

    // Polaris is the axis the whole picture turns on, so it is the centre.
    var w = vecs.Polaris;

    // View basis: `right` is horizontal (perpendicular to the zenith), `up`
    // completes it, so the sketch keeps the sky's own up/down.
    var zenith = [0, 0, 1];
    var right = norm(cross(w, zenith));
    if (!isFinite(right[0]) || dot(right, right) < 1e-9) right = [1, 0, 0];   // looking straight up
    var up = cross(right, w);

    var DEGREE_HALF_WIDTH = 47;               // Polaris to Alkaid is about 41 deg
    var scale = (size / 2) / DEGREE_HALF_WIDTH;

    function xy(name) {
      var v = vecs[name];
      var cosT = Math.max(-1, Math.min(1, dot(v, w)));
      var theta = Math.acos(cosT) * 180 / Math.PI;      // angular distance from centre
      var px = dot(v, right), py = dot(v, up);
      var m = Math.sqrt(px * px + py * py);
      if (m < 1e-9) return [0, 0];
      return [theta * scale * (px / m), -theta * scale * (py / m)];
    }
    function path(list) {
      return list.map(function (n, i) {
        var p = xy(n);
        return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }).join('');
    }
    var stars = DIPPER.map(function (s) {
      var p = xy(s.name);
      return { name: s.name, x: p[0], y: p[1] };
    });
    var polarisXY = xy('Polaris');
    // The classic pointer line: the bowl's outer edge, Merak through Dubhe,
    // extended onward to Polaris. Drawn faintly so it reads as a sightline
    // rather than part of the constellation itself.
    var pointer = path(['Merak', 'Dubhe']) + 'L' + polarisXY[0].toFixed(1) + ' ' + polarisXY[1].toFixed(1);

    return {
      bowl: path(BOWL), handle: path(HANDLE), stars: stars,
      polaris: { x: polarisXY[0], y: polarisXY[1], alt: view.pos.Polaris.alt },
      pointer: pointer,
      polarisUp: view.pos.Polaris.alt > 0
    };
  }

  global.Stars = { DIPPER: DIPPER, POLARIS: POLARIS, dipperView: dipperView,
                   eveningInstant: eveningInstant, dipperGlyph: dipperGlyph };
})(typeof window !== 'undefined' ? window : globalThis);
