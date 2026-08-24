/* menses-log.js — the dates a person's own cycles actually began, and what
 * can honestly be worked out from them.
 *
 * The wheel this feeds already knows how to draw a cycle of any length: it
 * scales its phases from a twenty-nine day blueprint. What it has never had
 * is a real length to draw, because nobody had told it one. This holds the
 * recorded starts and turns them into that number.
 *
 * On the arithmetic, and why it is the shape it is:
 *
 *   The MEDIAN is used rather than the mean. One missed entry makes a single
 *   double-length cycle in the record, and a mean is dragged a long way by
 *   that while a median barely notices. The same goes for one genuinely odd
 *   month, which most people have.
 *
 *   OVULATION is reckoned backwards from the next expected start, not
 *   forwards from the last one. The luteal phase, from ovulation to the next
 *   bleed, is the steady part at around fourteen days; the follicular phase
 *   before it is what actually varies. Counting forwards to "day fourteen"
 *   assumes the variable half is the fixed one, which is the wrong way round
 *   and is why that rule misses so often on cycles that are not twenty-eight
 *   days long.
 *
 *   The SPREAD is kept and shown. A prediction from four cycles that ran 26,
 *   27, 34 and 28 days is not the same thing as one from four that all ran
 *   28, and a single date hides that difference completely.
 *
 * Everything here is an estimate drawn from a small sample, and the interface
 * says so. It is not a medical instrument and must not be leaned on as one.
 *
 * Storage is the same sync-ready shape as the planner: an id made on the
 * device, an updatedAt to settle which of two edits is newer, and a soft
 * delete so a removal can travel rather than being an absence nobody can tell
 * from never-existed.
 */
(function (global) {
  'use strict';

  var STORE = 'turning-year:menses:v1';
  var LUTEAL_DAYS = 14;                /* the steady half */
  var MIN_SANE = 15, MAX_SANE = 90;    /* a gap outside this is a gap in the record */

  var starts = {};

  function uid() {
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function load() {
    try { starts = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
    catch (e) { starts = {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(starts)); } catch (e) { /* private mode */ }
  }

  function toUTC(iso) {
    var p = String(iso).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function fromUTC(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); }
  function addDays(iso, n) { return fromUTC(toUTC(iso) + n * 86400000); }

  /* One recorded start. The same date twice is the same fact twice, so it
   * replaces rather than duplicating. */
  function add(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var existing = null;
    Object.keys(starts).forEach(function (k) {
      if (!starts[k].deleted && starts[k].date === iso) existing = starts[k];
    });
    if (existing) return existing;
    var rec = { id: uid(), date: iso, updatedAt: Date.now(), deleted: false };
    starts[rec.id] = rec;
    save();
    return rec;
  }

  function remove(id) {
    var r = starts[id];
    if (!r) return;
    r.deleted = true;
    r.updatedAt = Date.now();
    save();
  }

  /* Oldest first. */
  function all() {
    return Object.keys(starts)
      .map(function (k) { return starts[k]; })
      .filter(function (r) { return !r.deleted; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /* The gaps between consecutive starts. Anything absurdly short or long is
   * set aside rather than averaged in: it almost always means a month went
   * unrecorded, and treating that as one enormous cycle would poison every
   * number downstream. It is still counted and reported, so the interface can
   * say a gap was ignored rather than quietly dropping it. */
  function lengths() {
    var list = all(), out = [], skipped = 0;
    for (var i = 1; i < list.length; i++) {
      var n = daysBetween(list[i - 1].date, list[i].date);
      if (n >= MIN_SANE && n <= MAX_SANE) out.push(n);
      else skipped++;
    }
    return { lengths: out, skipped: skipped };
  }

  function median(xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
  }

  /* Everything the wheel and the panel need, worked out once.
   *
   * `todayIso` comes from the app because only it knows the place's own
   * timezone, and which day it is where you are standing is the whole basis
   * of "what day of my cycle is this". */
  function summary(todayIso) {
    var list = all();
    var L = lengths();
    var typical = median(L.lengths);
    var out = {
      starts: list,
      count: list.length,
      lengths: L.lengths,
      skippedGaps: L.skipped,
      typicalLength: typical,
      shortest: L.lengths.length ? Math.min.apply(null, L.lengths) : null,
      longest: L.lengths.length ? Math.max.apply(null, L.lengths) : null,
      lastStart: list.length ? list[list.length - 1].date : null,
      /* Enough to say anything at all? One start gives a day count but no
       * length; two give one gap, which is a sample of one. */
      canCount: list.length >= 1,
      canPredict: L.lengths.length >= 1,
      confident: L.lengths.length >= 3
    };

    if (out.lastStart && todayIso) {
      out.dayOfCycle = daysBetween(out.lastStart, todayIso) + 1;
      if (out.dayOfCycle < 1) out.dayOfCycle = null;    // the last start is in the future
    }

    if (out.canPredict && out.lastStart) {
      out.nextStart = addDays(out.lastStart, typical);
      /* The window the spread actually allows, not a single confident date. */
      out.nextEarliest = addDays(out.lastStart, out.shortest);
      out.nextLatest = addDays(out.lastStart, out.longest);
      out.ovulation = addDays(out.nextStart, -LUTEAL_DAYS);
      /* The days either side of it usually counted as fertile. */
      out.fertileFrom = addDays(out.ovulation, -5);
      out.fertileTo = addDays(out.ovulation, 1);
      if (todayIso) {
        out.daysToNext = daysBetween(todayIso, out.nextStart);
        out.overdueBy = out.daysToNext < 0 ? -out.daysToNext : 0;
      }
    }
    return out;
  }

  global.MensesLog = {
    LUTEAL_DAYS: LUTEAL_DAYS,
    load: load, add: add, remove: remove, all: all,
    summary: summary, addDays: addDays, daysBetween: daysBetween
  };
})(typeof window !== 'undefined' ? window : globalThis);
