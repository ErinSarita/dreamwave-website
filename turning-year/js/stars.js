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

  /* Small SVG path data for the dipper glyph. Its seven stars only span
   * about 25 degrees of sky (Dubhe to Alkaid) — mapping that against the
   * full 90-degree horizon-to-zenith range, the way a compass sketch would,
   * squeezes the whole shape into an unreadable dot. Instead this centres
   * and zooms on the pattern itself: real relative position and orientation
   * (which is what actually varies with date and place), rescaled around a
   * fixed ~16-degree half-width so the dipper reads as a dipper wherever it
   * sits in the sky. Returns null if it isn't above the horizon to draw. */
  function dipperGlyph(jd, lat, lon, size) {
    var view = dipperView(jd, lat, lon);
    if (!view.visible) return null;

    // Circular mean azimuth and mean altitude of the seven stars, so the
    // sketch is centred on the constellation regardless of which way it
    // happens to be facing (its azimuth can sit right across the 0/360 seam).
    var sx = 0, sy = 0, salt = 0;
    DIPPER.forEach(function (s) {
      var p = view.pos[s.name];
      sx += Math.sin(p.az * Math.PI / 180);
      sy += Math.cos(p.az * Math.PI / 180);
      salt += p.alt;
    });
    var centerAz = Math.atan2(sx, sy) * 180 / Math.PI;
    var centerAlt = salt / DIPPER.length;

    var DEGREE_HALF_WIDTH = 20;               // sky-degrees mapped to size/2
    var scale = (size / 2) / DEGREE_HALF_WIDTH;
    var azCorrection = Math.max(0.35, Math.cos(centerAlt * Math.PI / 180));

    function xy(name) {
      var p = view.pos[name];
      var daz = ((p.az - centerAz + 540) % 360) - 180;    // shortest signed delta
      var dalt = p.alt - centerAlt;
      return [daz * azCorrection * scale, -dalt * scale];
    }
    function path(names) {
      return names.map(function (n, i) {
        var p = xy(n);
        return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }).join('');
    }
    var stars = DIPPER.map(function (s) {
      var p = xy(s.name);
      return { name: s.name, x: p[0], y: p[1] };
    });
    return { bowl: path(BOWL), handle: path(HANDLE), stars: stars, polarisUp: view.pos.Polaris.alt > 0 };
  }

  global.Stars = { DIPPER: DIPPER, POLARIS: POLARIS, dipperView: dipperView,
                   eveningInstant: eveningInstant, dipperGlyph: dipperGlyph };
})(typeof window !== 'undefined' ? window : globalThis);
