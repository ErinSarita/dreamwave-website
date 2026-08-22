/* menses.js — the menstrual cycle as a wheel of its own.
 *
 * This begins as an example rather than a record: one common shape of cycle at
 * twenty-nine days, laid against a lunation so that bleeding sits at the dark
 * moon and ovulation at the full one. That alignment is a teaching frame, not
 * a finding. The evidence that real cycles synchronise with the moon is weak
 * and has failed to replicate, so the wheel is drawn as a reference to read
 * your own days against, and the moment a woman logs her own the drawing
 * follows her instead of the average.
 *
 * The phases carry two kinds of description, kept apart on purpose. What the
 * hormones are measured to do, and what the tradition holds the phase is good
 * for. The first is physiology; the second is Nu Dan, the women's branch of
 * Daoist internal alchemy, where the cycle is treated as something to work
 * with rather than a process to be managed.
 */
(function (global) {
  'use strict';

  var BLUEPRINT_DAYS = 29;

  /* Day one is the first day of bleeding. The spans below are the common
   * teaching division of an average cycle; a real one moves, and moves most in
   * the stretch before ovulation. */
  var PHASES = [
    { key: 'menstrual', name: 'Menstruation', from: 1, to: 5,
      moon: 'dark moon',
      hormones: 'Oestrogen and progesterone are both at their floor. The ' +
        'lining is shed. FSH begins to rise and the next set of follicles is ' +
        'recruited.',
      body: 'Core temperature drops back to its baseline as progesterone ' +
        'clears. Energy is commonly lowest in the first days and returns as ' +
        'oestrogen starts to climb.',
      support: 'Rest without apology. Warmth on the belly and lower back. ' +
        'Gentle movement if any: walking, stretching, restorative work rather ' +
        'than anything that asks for output. Sleep is worth protecting here ' +
        'more than at any other point in the cycle.',
      food: 'Chinese medicine reads this as the most yin part of the cycle ' +
        'and asks for warmth and simplicity: broths, soups, stews, congee, ' +
        'with ginger, cinnamon or clove. Raw and cold food is discouraged as ' +
        'harder on digestion just now. Iron is genuinely being lost, so this ' +
        'is a sensible time for iron-rich food alongside vitamin C.' },
    { key: 'follicular', name: 'Follicular', from: 6, to: 13,
      moon: 'waxing',
      hormones: 'Oestradiol climbs steadily from the dominant follicle. FSH ' +
        'gives way to LH as oestrogen rises.',
      body: 'Temperature stays at the lower baseline. This is generally the ' +
        'stretch of rising energy, appetite for effort and clearer sleep.',
      support: 'The natural time to begin things, and to take on the work ' +
        'that needs the most from you. Many find this the easiest stretch for ' +
        'harder training and for anything socially demanding.',
      food: 'The rebuilding phase in Chinese medicine, nourishing blood and ' +
        'yin after what was lost: dark leafy greens, beetroot, berries, eggs, ' +
        'oily fish, sesame and tahini, walnuts and almonds, with liver or ' +
        'bone broth if that suits you.' },
    { key: 'ovulation', name: 'Ovulation', from: 14, to: 16,
      moon: 'full moon',
      hormones: 'Oestrogen peaks and flips the pituitary into a sharp LH ' +
        'surge. The egg is released roughly 24 to 36 hours after that surge.',
      body: 'Temperature has not risen yet; the shift comes just after. Many ' +
        'notice a change in cervical fluid, and some a one-sided ache.',
      support: 'Outward and expressive. A good window for conversations that ' +
        'need warmth, and for anything that benefits from confidence. Worth ' +
        'a longer warm-up before hard training: ligament laxity rises around ' +
        'the oestrogen peak.',
      food: 'Light and fresh rather than heavy. Plenty of water, and food ' +
        'that supports the liver in clearing the oestrogen peak: cruciferous ' +
        'vegetables, bitter leaves, fibre.' },
    { key: 'luteal', name: 'Luteal', from: 17, to: 29,
      moon: 'waning',
      hormones: 'The spent follicle becomes the corpus luteum and pours out ' +
        'progesterone. When it fails, progesterone falls and bleeding begins.',
      body: 'Progesterone resets the hypothalamus about 0.3 degrees warmer ' +
        'and holds it there until the fall. Resting metabolism runs some 7 ' +
        'per cent higher, and heat is shed less readily.',
      support: 'Better for finishing than beginning. Appetite genuinely rises ' +
        'with the metabolic rate, so eating more here is a body doing its ' +
        'arithmetic rather than a failure of will. Heat is shed poorly now, ' +
        'so a cooler room helps sleep, and moderate resistance work in the ' +
        'evening seems to help the body dump heat before bed.',
      food: 'Steady blood sugar matters more here than at any other point: ' +
        'regular meals with protein and fat, complex carbohydrates rather ' +
        'than fast ones. Magnesium-rich food, and warm cooked meals as the ' +
        'phase closes and the next bleed approaches.' }
  ];

  /* The moon read on its own terms, as a second clock running beside the
   * cycle rather than inside it.
   *
   * This matters most when the two disagree. A woman whose bleeding has just
   * finished but who still feels heavy and slow may be looking at a dark moon,
   * and the tradition has a name for that rather than treating it as a fault.
   *
   * The readings below come from the Huangdi Neijing, which describes blood
   * and qi as thin at the new moon, filling as it waxes, replete at the full
   * with the flesh firm and the pores closed, and draining away as it wanes
   * until the channels stand empty. The clinical rule attached is explicit:
   * on a waxing moon do not drain, on a full moon do not supplement, on the
   * new moon do not treat. The Nanjing, a century or so later, ties the
   * moon's 29.5 days to the menstrual cycle and to the waxing and waning of
   * kidney jing.
   *
   * It is a framework, and it is labelled as one. Modern evidence for the
   * moon acting on human physiology is weak and has failed to replicate.
   * What it offers is a second reading when your own cycle does not explain
   * how you feel.
   */
  var MOON_NOTES = [
    { key: 'new', name: 'Dark moon', from: 0, to: 45,
      classical: 'Blood and qi are at their thinnest, and the defensive qi is ' +
        'only beginning to move. The channels are relatively empty.',
      living: 'The lowest point of the lunar month. Rest reads as sensible ' +
        'here even if your cycle says you should be picking up, and feeling ' +
        'slow just after a period that has ended is exactly what this would ' +
        'predict.',
      rule: 'On the new moon, do not treat.' },
    { key: 'waxing', name: 'Waxing moon', from: 45, to: 135,
      classical: 'Qi and blood fill steadily. The defensive qi gathers and ' +
        'begins to hold the surface.',
      living: 'The building half. Begin things, take on the work that needs ' +
        'the most from you, and let the load rise with the light.',
      rule: 'On a waxing moon, do not drain.' },
    { key: 'full', name: 'Full moon', from: 135, to: 225,
      classical: 'Blood and qi are replete. The flesh and muscles are full, ' +
        'the pores close, and the body is at its most defended.',
      living: 'The peak. The most to spend, and the least need to be given ' +
        'anything. Some find sleep lighter here, which the closed pores and ' +
        'abundant qi are the old way of describing.',
      rule: 'On a full moon, do not supplement.' },
    { key: 'waning', name: 'Waning moon', from: 225, to: 315,
      classical: 'The fluids diminish and the channels begin to empty again ' +
        'as the defensive qi withdraws.',
      living: 'The drawing-down half. Better for finishing than starting, and ' +
        'for letting go of what has run its course.',
      rule: '' }
  ];

  function moonNoteAt(age) {
    var a = ((age % 360) + 360) % 360;
    for (var i = 0; i < MOON_NOTES.length; i++) {
      var m = MOON_NOTES[i];
      if (a >= m.from && a < m.to) return m;
    }
    return MOON_NOTES[0];      // wraps past 315 back into the dark
  }

  /* Hormone levels across the cycle, each scaled to its own range so four
   * quantities measured in different units can share one band. The shapes are
   * the textbook ones: oestrogen climbing to a sharp pre-ovulatory peak and
   * returning in a broader luteal rise, progesterone flat until ovulation and
   * then dominant, LH as a single narrow surge, FSH rising early and once
   * more alongside the surge.
   *
   * Heights are relative, not concentrations. What is worth reading is the
   * shape and the order, which is the same for everyone; the levels are not. */
  var CURVES = {
    oestrogen:    [[1,.15],[5,.20],[9,.45],[13,1],[15,.42],[18,.58],[21,.72],[25,.48],[29,.18]],
    progesterone: [[1,.05],[13,.05],[15,.15],[18,.6],[22,1],[25,.78],[28,.2],[29,.08]],
    lh:           [[1,.12],[11,.15],[13,.38],[14,1],[15,.3],[17,.12],[29,.12]],
    fsh:          [[1,.45],[4,.55],[8,.35],[12,.3],[14,.62],[16,.25],[26,.2],[29,.42]]
  };
  var CURVE_ORDER = ['oestrogen', 'progesterone', 'lh', 'fsh'];
  var CURVE_LABEL = { oestrogen: 'oestrogen', progesterone: 'progesterone',
                      lh: 'LH', fsh: 'FSH' };

  /* Level of one hormone on a given cycle day, eased between control points so
   * the curve has no corners. */
  function levelAt(name, day, length) {
    var pts = CURVES[name];
    if (!pts) return 0;
    var scale = (length || BLUEPRINT_DAYS) / BLUEPRINT_DAYS;
    var d = day / scale;
    if (d <= pts[0][0]) return pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      if (d >= a[0] && d <= b[0]) {
        var t = (b[0] === a[0]) ? 0 : (d - a[0]) / (b[0] - a[0]);
        var e = (1 - Math.cos(t * Math.PI)) / 2;
        return a[1] + (b[1] - a[1]) * e;
      }
    }
    return pts[pts.length - 1][1];
  }

  function phaseOfDay(day, length) {
    var n = length || BLUEPRINT_DAYS;
    /* A shorter or longer cycle stretches the luteal phase least, so the
     * blueprint's spans are scaled from the front and the last phase simply
     * takes what is left. */
    var scale = n / BLUEPRINT_DAYS;
    for (var i = 0; i < PHASES.length; i++) {
      var p = PHASES[i];
      var from = i === 0 ? 1 : Math.round((p.from - 1) * scale) + 1;
      var to = i === PHASES.length - 1 ? n : Math.round(p.to * scale);
      if (day >= from && day <= to) return p;
    }
    return PHASES[PHASES.length - 1];
  }

  /* The spans, scaled to a given cycle length. */
  function spans(length) {
    var n = length || BLUEPRINT_DAYS;
    var scale = n / BLUEPRINT_DAYS;
    return PHASES.map(function (p, i) {
      return {
        phase: p,
        from: i === 0 ? 1 : Math.round((p.from - 1) * scale) + 1,
        to: i === PHASES.length - 1 ? n : Math.round(p.to * scale)
      };
    });
  }

  global.Menses = {
    BLUEPRINT_DAYS: BLUEPRINT_DAYS,
    PHASES: PHASES,
    CURVE_ORDER: CURVE_ORDER, CURVE_LABEL: CURVE_LABEL,
    MOON_NOTES: MOON_NOTES, moonNoteAt: moonNoteAt,
    levelAt: levelAt,
    phaseOfDay: phaseOfDay,
    spans: spans
  };
})(typeof window !== 'undefined' ? window : globalThis);
