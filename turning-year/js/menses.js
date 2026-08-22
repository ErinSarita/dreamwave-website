/* menses.js — the menstrual cycle as a wheel of its own.
 *
 * This begins as a blueprint rather than a record: an average cycle of
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
      tradition: 'Nu Dan treats this as the inward turn, the point where ' +
        'essence sinks toward the uterus. Rest is the practice; forcing is not.' },
    { key: 'follicular', name: 'Follicular', from: 6, to: 13,
      moon: 'waxing',
      hormones: 'Oestradiol climbs steadily from the dominant follicle. FSH ' +
        'gives way to LH as oestrogen rises.',
      body: 'Temperature stays at the lower baseline. This is generally the ' +
        'stretch of rising energy, appetite for effort and clearer sleep.',
      tradition: 'The building phase. Held to be the time to begin things, ' +
        'and where the strongest work can be taken on.' },
    { key: 'ovulation', name: 'Ovulation', from: 14, to: 16,
      moon: 'full moon',
      hormones: 'Oestrogen peaks and flips the pituitary into a sharp LH ' +
        'surge. The egg is released roughly 24 to 36 hours after that surge.',
      body: 'Temperature has not risen yet; the shift comes just after. Many ' +
        'notice a change in cervical fluid, and some a one-sided ache.',
      tradition: 'Yang at its fullest within the month, mirroring the full ' +
        'moon in the older reckoning. Outward, expressive, warm.' },
    { key: 'luteal', name: 'Luteal', from: 17, to: 29,
      moon: 'waning',
      hormones: 'The spent follicle becomes the corpus luteum and pours out ' +
        'progesterone. When it fails, progesterone falls and bleeding begins.',
      body: 'Progesterone resets the hypothalamus about 0.3 degrees warmer ' +
        'and holds it there until the fall. Resting metabolism runs some 7 ' +
        'per cent higher, and heat is shed less readily.',
      tradition: 'The gathering-in. Held to be the time to finish rather ' +
        'than begin, and to let the attention turn inward again.' }
  ];

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
    phaseOfDay: phaseOfDay,
    spans: spans
  };
})(typeof window !== 'undefined' ? window : globalThis);
