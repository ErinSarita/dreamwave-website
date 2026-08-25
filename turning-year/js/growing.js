/* growing.js — the cool, warm and hot windows inside the growing season.
 *
 * The frost band already says when it is safe to grow anything at all. This
 * says what kind of thing, because a lettuce and an okra want opposite
 * weather and both of them sit inside the same frost-free stretch.
 *
 * On where the numbers come from, plainly:
 *
 *   The TEMPERATURE RANGES below are the ordinary horticultural ones, the
 *   figures that appear in extension-service guides and on the backs of seed
 *   packets. They are conventions rather than one book's findings, and no
 *   particular source is claimed for them.
 *
 *   The DATES are worked out from this place's own frost dates, which the
 *   user has already given or corrected, plus the fact that the year's heat
 *   lags the solstice by about four weeks: the sun is highest in June and the
 *   hottest weeks come in late July. Ground temperature lags air temperature
 *   again by a week or two, which is why warm-season planting waits after the
 *   last frost rather than starting on it.
 *
 *   No temperature is measured, and none is looked up. This is arithmetic on
 *   frost dates, which is why every boundary can be overridden and why the
 *   interface says it is a starting point rather than an answer.
 *
 * The second cool window matters as much as the first. Hardy crops go in
 * again in late summer for an autumn harvest, and a wheel that showed only
 * the spring one would be describing half the gardening year.
 */
(function (global) {
  'use strict';

  var STORE = 'turning-year:growing:v1';

  /* Offsets in days from the frost dates, and the lag from the solstice.
   * These are the rules of thumb the windows are built from. */
  var RULE = {
    coolSpringFrom: -21,   /* hardy crops go in before the last frost */
    coolSpringTo:    35,   /* and bolt once it warms past them */
    warmFrom:        14,   /* soil needs a week or two past frost to reach 60F */
    warmTo:         -14,   /* pulled in from the first frost for ripening */
    hotLagDays:      30,   /* the heat's lag behind the solstice */
    hotHalfSpan:     28,   /* four weeks either side of the hottest point */
    coolAutumnFrom: -70,   /* sown in late summer for an autumn harvest */
    coolAutumnTo:    14    /* and standing through the first light frosts */
  };

  var BANDS = [
    { key: 'coolSpring', name: 'Cool season', when: 'spring',
      colour: 'var(--gw-cool)',
      airF: '55 to 70', airC: '13 to 21',
      note: 'Lettuce, spinach, peas, brassicas, radish, chard. Most take a ' +
            'light frost and many prefer one. They bolt when it turns hot.' },
    { key: 'warm', name: 'Warm season', when: 'after the last frost',
      colour: 'var(--gw-warm)',
      airF: '70 to 85', airC: '21 to 29',
      note: 'Tomatoes, peppers, beans, squash, cucumbers, corn. Frost kills ' +
            'them outright, and the soil wants to be past 60F before sowing.' },
    { key: 'hot', name: 'Hot season', when: 'high summer',
      colour: 'var(--gw-hot)',
      airF: 'above 85', airC: 'above 29',
      note: 'Okra, sweet potato, melons, southern peas, amaranth, malabar ' +
            'spinach. These want the weeks that make everything else sulk.' },
    { key: 'coolAutumn', name: 'Cool season again', when: 'autumn',
      colour: 'var(--gw-cool)',
      airF: '55 to 70', airC: '13 to 21',
      note: 'The same crops as spring, sown in the heat to mature as it ' +
            'breaks. Frost sweetens kale, leeks and parsnips rather than ' +
            'ending them.' }
  ];

  var custom = {};        /* key -> { from: 'MM-DD', to: 'MM-DD', note: '' } */

  function load() {
    try { custom = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
    catch (e) { custom = {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(custom)); } catch (e) { /* private mode */ }
  }

  function setWindow(key, fields) {
    var c = custom[key] || (custom[key] = {});
    if ('from' in fields) c.from = fields.from || null;
    if ('to' in fields) c.to = fields.to || null;
    if ('note' in fields) c.note = String(fields.note || '').slice(0, 300);
    c.updatedAt = Date.now();
    save();
  }
  function clearWindow(key) { delete custom[key]; save(); }
  function customFor(key) { return custom[key] || null; }

  function clampDay(n, len) { return Math.max(1, Math.min(len, n)); }

  /* Month-day to this cycle's own day number, or null if it is not in it. */
  function dayFromMonthDay(cycle, md) {
    if (!md) return null;
    var m = /^(\d{1,2})-(\d{1,2})$/.exec(md);
    if (!m) return null;
    for (var i = 0; i < cycle.days.length; i++) {
      var p = cycle.days[i].iso.split('-');
      if (+p[1] === +m[1] && +p[2] === +m[2]) return cycle.days[i].n;
    }
    return null;
  }
  function monthDayOfDay(cycle, n) {
    var d = cycle.days[n - 1];
    if (!d) return null;
    var p = d.iso.split('-');
    return +p[1] + '-' + +p[2];
  }

  /* The four windows as day numbers in this cycle.
   *
   * Returns null when there is nothing to build them on: a place with no
   * frost at all has no last frost to count from, and inventing one would be
   * worse than saying so. */
  function windows(cycle) {
    if (!cycle || !cycle.frost || cycle.frost.none) return null;
    if (!cycle.frost.last || !cycle.frost.first) return null;

    var len = cycle.length;
    var lastN = cycle.frost.last.dayNumber;
    var firstN = cycle.frost.first.dayNumber;

    /* The hottest weeks, taken as the summer solstice plus the lag. The
     * solstice is day 183 of a cycle that starts at the winter one, which is
     * the whole reason this wheel is cut where it is. */
    var solstice = Math.round(len / 2);
    var hotMid = solstice + RULE.hotLagDays;

    var derived = {
      coolSpring: [lastN + RULE.coolSpringFrom, lastN + RULE.coolSpringTo],
      warm:       [lastN + RULE.warmFrom, firstN + RULE.warmTo],
      hot:        [hotMid - RULE.hotHalfSpan, hotMid + RULE.hotHalfSpan],
      coolAutumn: [firstN + RULE.coolAutumnFrom, firstN + RULE.coolAutumnTo]
    };

    return BANDS.map(function (b) {
      var c = custom[b.key];
      var fromN = c && c.from ? dayFromMonthDay(cycle, c.from) : null;
      var toN = c && c.to ? dayFromMonthDay(cycle, c.to) : null;
      var edited = !!(fromN || toN);
      if (fromN === null) fromN = clampDay(derived[b.key][0], len);
      if (toN === null) toN = clampDay(derived[b.key][1], len);
      return {
        key: b.key, name: b.name, when: b.when, colour: b.colour,
        airF: b.airF, airC: b.airC,
        note: (c && c.note) || b.note,
        noteIsOwn: !!(c && c.note),
        from: fromN, to: toN,
        fromMD: monthDayOfDay(cycle, fromN),
        toMD: monthDayOfDay(cycle, toN),
        fromLabel: cycle.days[fromN - 1] ? cycle.days[fromN - 1].iso : '',
        toLabel: cycle.days[toN - 1] ? cycle.days[toN - 1].iso : '',
        edited: edited
      };
    });
  }

  global.Growing = {
    BANDS: BANDS, RULE: RULE,
    load: load, windows: windows,
    setWindow: setWindow, clearWindow: clearWindow, customFor: customFor,
    monthDayOfDay: monthDayOfDay, dayFromMonthDay: dayFromMonthDay
  };
})(typeof window !== 'undefined' ? window : globalThis);
