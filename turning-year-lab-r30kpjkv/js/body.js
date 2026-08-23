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
  /* The twelve watches, listed from zi because zi straddles midnight.
   *
   * Each carries its earthly branch, the old name for that double hour, and
   * its animal. Zi is the yin pole of the day and wu the yang pole: the whole
   * cycle is built as a swing between those two, which is what the name zi wu
   * liu zhu says, "midnight-noon flowing and pouring".
   *
   * The guidance is the traditional guidance, gathered from practitioner
   * sources rather than invented here. It is offered as when a thing is
   * easiest, not as a rule about when it is allowed.
   */
  var WATCHES = [
    { organ: 'Gallbladder', branch: 'zi', animal: 'Rat', hours: '23–1',
      pole: 'The yin pole of the day. Yin is at its fullest, and yin governs sleep.',
      best: 'Be asleep, or on your way there.',
      avoid: 'Starting anything new, or a screen.',
      why: 'This watch is held to govern decisions and the courage to make them, ' +
           'and it is where the deep repair of the night begins. Sleep entered ' +
           'before it rather than during it is the classical advice.' },
    { organ: 'Liver', branch: 'chou', animal: 'Ox', hours: '1–3',
      pole: '', best: 'Deep sleep.',
      avoid: 'Being awake, alcohol, and late arguments.',
      why: 'The blood is said to return to the liver to be cleaned, and the ' +
           'liver is the organ of anger and of plans. Waking reliably in this ' +
           'watch is the classic sign a practitioner asks about. It also sits ' +
           'squarely on the measured melatonin peak.' },
    { organ: 'Lung', branch: 'yin', animal: 'Tiger', hours: '3–5',
      pole: '', best: 'Sleep. If you are awake anyway, breathe slowly rather than fight it.',
      avoid: 'Forcing yourself back to sleep with effort.',
      why: 'The lungs take in the first qi of the new day, which is why this is ' +
           'the traditional hour for breathing practice and why monastic ' +
           'schedules start here. The lungs are also the organ of grief.' },
    { organ: 'Large Intestine', branch: 'mao', animal: 'Rabbit', hours: '5–7',
      pole: '', best: 'Wake, drink warm water, empty the bowels, move gently.',
      avoid: 'Coffee before water.',
      why: 'The letting-go organ, physically and otherwise. Warm water ahead of ' +
           'anything else is the near-universal recommendation.' },
    { organ: 'Stomach', branch: 'chen', animal: 'Dragon', hours: '7–9',
      pole: '', best: 'Eat the largest, warmest meal of the day.',
      avoid: 'Cold food and iced drinks; skipping breakfast.',
      why: 'Digestive fire is held to be at its strongest here, so this is the ' +
           'cheapest meal for the body to process. Cold is said to damp that fire.' },
    { organ: 'Spleen', branch: 'si', animal: 'Snake', hours: '9–11',
      pole: '', best: 'Hard thinking, and the work that needs your best attention.',
      avoid: 'Heavy snacking; it interrupts what the spleen is doing.',
      why: 'The spleen turns food into usable energy and is tied to clear ' +
           'thought. This lands close to the measured morning alertness peak.' },
    { organ: 'Heart', branch: 'wu', animal: 'Horse', hours: '11–13',
      pole: 'The yang pole of the day. Yang is at its fullest and yin begins to gather again.',
      best: 'Lunch, company, laughter. A short rest after.',
      avoid: 'Eating while working or reading.',
      why: 'The heart houses the shen, the spirit, and is the organ of joy and ' +
           'of connection. The old advice to eat with people rather than at a ' +
           'desk belongs to this watch.' },
    { organ: 'Small Intestine', branch: 'wei', animal: 'Goat', hours: '13–15',
      pole: '', best: 'Sorting, filing, tidying, anything fiddly and detailed.',
      avoid: 'Big decisions on a full stomach.',
      why: 'Its job is separating the pure from the impure, so the tasks that ' +
           'suit it are the ones that sort one thing from another.' },
    { organ: 'Bladder', branch: 'shen', animal: 'Monkey', hours: '15–17',
      pole: '', best: 'Drink water. Study, learn, revise.',
      avoid: 'Letting yourself get dehydrated into the afternoon dip.',
      why: 'The bladder channel runs the length of the back and is tied to ' +
           'stamina. The traditional study hour, and it holds up: this is close ' +
           'to the daily peak in body temperature and reaction speed.' },
    { organ: 'Kidney', branch: 'you', animal: 'Rooster', hours: '17–19',
      pole: '', best: 'A light dinner, then a walk or a stretch.',
      avoid: 'A heavy late meal, and hard training that leaves nothing back.',
      why: 'The kidneys store jing, the deep reserve you are not meant to spend ' +
           'freely. The watch for restoring rather than pushing.' },
    { organ: 'Pericardium', branch: 'xu', animal: 'Dog', hours: '19–21',
      pole: '', best: 'Warmth and closeness. A bath, touch, people you like.',
      avoid: 'Conflict, and hard exercise this late.',
      why: 'The heart protector. Named for shielding the heart, and traditionally ' +
           'the watch for intimacy and for putting the day down.' },
    { organ: 'Triple Burner', branch: 'hai', animal: 'Pig', hours: '21–23',
      pole: '', best: 'Wind down. Dim the lights, read on paper, get into bed.',
      avoid: 'Bright screens, which delay melatonin directly.',
      why: 'The san jiao balances the three burners, upper, middle and lower, ' +
           'before the night. Getting to sleep before zi opens is the single ' +
           'piece of advice this whole cycle is most often reduced to.' }
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

  /* Which watch a given phase falls in. Zi runs from -1 to +1, so the whole
   * cycle is shifted an hour before dividing. */
  function watchAt(phase) {
    var p = ((phase + 1) % 24 + 24) % 24;
    return WATCHES[Math.floor(p / 2) % 12];
  }

  global.BodyClock = {
    WATCHES: WATCHES, watchAt: watchAt, melatonin: melatonin, cortisol: cortisol,
    temperature: temperature,
    MEL_PEAK: MEL_PEAK, TEMP_MIN: TEMP_MIN, CORT_PEAK: CORT_PEAK, TEMP_MAX: TEMP_MAX
  };
})(typeof window !== 'undefined' ? window : globalThis);
