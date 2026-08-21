/* body.js — what the day is doing to the body, anchored to the actual sun.
 *
 * Two bands, kept visibly apart because they are two different kinds of claim.
 *
 * The inner band is the horary cycle of Chinese medicine, the zi wu liu zhu,
 * twelve two-hour organ watches from the Huang Di Nei Jing and Nan Jing. It is
 * a traditional framework, and it is labelled as one.
 *
 * The outer band is measured chronobiology: melatonin, cortisol and core body
 * temperature. The shapes are a model rather than a measurement of you, but
 * the phase relationships between them are the published ones. Melatonin
 * crests about two hours before the core temperature minimum and four to six
 * hours before the cortisol crest; temperature peaks in the early evening.
 *
 * What makes drawing it here worth doing is the anchor. Almost every organ
 * clock and circadian chart is pinned to wall-clock hours, which are a
 * political fiction: a timezone is a band up to fifteen degrees wide with
 * daylight saving layered on top, so the same clock hour can sit more than an
 * hour from where the sun actually is. Both systems are anchored to the sun.
 * The horary cycle is traditionally reckoned by solar time, and the body
 * entrains to light rather than to a clock. So everything here is phased from
 * this place's own solar midnight and solar noon.
 *
 * Not included: any lunar effect on the body. The best-known study found
 * shorter sleep and lower melatonin near full moon, and it then failed to
 * replicate, once in the opposite direction, and a much larger analysis with
 * ample power to see the claimed effect found nothing. It is contested, so it
 * is not drawn as though it were settled.
 */
(function (global) {
  'use strict';

  /* Gallbladder holds the zi hour, which straddles midnight, so the cycle is
   * listed from there and each watch runs two solar hours. */
  var WATCHES = [
    ['Gallbladder', 'Decision, and the turn into deep sleep'],
    ['Liver', 'Blood returns to the liver; deepest repair'],
    ['Lung', 'Breath; the classical hour for waking practice'],
    ['Large Intestine', 'Letting go, and the first release of the day'],
    ['Stomach', 'The hour to eat well'],
    ['Spleen', 'Transforming food into usable energy'],
    ['Heart', 'Yang at its height; circulation and joy'],
    ['Small Intestine', 'Sorting the pure from the impure'],
    ['Bladder', 'Storing and clearing; the afternoon push'],
    ['Kidney', 'Essence and reserve; the deep well'],
    ['Pericardium', 'The heart protector; warmth and intimacy'],
    ['Triple Burner', 'Balancing the three burners before rest']
  ];

  /* Phase, in hours after solar midnight, of each thing worth marking. Taken
   * from the published relationships rather than from clock times, so they
   * move with the sun and the season instead of staying pinned to a number. */
  var MEL_PEAK = 0.75;      // melatonin crests just after solar midnight
  var TEMP_MIN = 2.75;      // about two hours after the melatonin crest
  var CORT_PEAK = 6.25;     // four to six hours after the melatonin crest
  var TEMP_MAX = 18;        // six hours after solar noon: early evening

  /* Smooth interpolation through control points, easing with a cosine so the
   * curve has no corners. Phases wrap at twenty-four. */
  function curveAt(points, phase) {
    var p = ((phase % 24) + 24) % 24;
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      if (p >= a[0] && p <= b[0]) {
        var t = (b[0] === a[0]) ? 0 : (p - a[0]) / (b[0] - a[0]);
        var e = (1 - Math.cos(t * Math.PI)) / 2;
        return a[1] + (b[1] - a[1]) * e;
      }
    }
    return points[points.length - 1][1];
  }

  function melatonin(phase, onset, offset) {
    var p = ((phase % 24) + 24) % 24;
    /* Rises after dusk, crests just past solar midnight, gone after dawn. The
     * two halves are eased separately because the night is not symmetric
     * about midnight except at the equinoxes. */
    var rise = ((onset % 24) + 24) % 24;
    var fall = ((offset % 24) + 24) % 24;
    function span(from, to, x) {
      var len = ((to - from) % 24 + 24) % 24;
      var at = ((x - from) % 24 + 24) % 24;
      return (at <= len) ? at / (len || 1) : null;
    }
    var up = span(rise, MEL_PEAK, p);
    if (up !== null) return (1 - Math.cos(up * Math.PI)) / 2;
    var down = span(MEL_PEAK, fall, p);
    if (down !== null) return (1 + Math.cos(down * Math.PI)) / 2;
    return 0;
  }

  var CORTISOL = [[0, 0.06], [3, 0.16], [CORT_PEAK, 1], [10, 0.5],
                  [14, 0.32], [19, 0.12], [24, 0.06]];
  var TEMPERATURE = [[0, 0.22], [TEMP_MIN, 0], [10, 0.62], [TEMP_MAX, 1], [24, 0.22]];

  function cortisol(phase) { return curveAt(CORTISOL, phase); }
  function temperature(phase) { return curveAt(TEMPERATURE, phase); }

  global.BodyClock = {
    WATCHES: WATCHES, melatonin: melatonin, cortisol: cortisol,
    temperature: temperature,
    MEL_PEAK: MEL_PEAK, TEMP_MIN: TEMP_MIN, CORT_PEAK: CORT_PEAK, TEMP_MAX: TEMP_MAX
  };
})(typeof window !== 'undefined' ? window : globalThis);
