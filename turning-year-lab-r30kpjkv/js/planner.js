/* planner.js — the events a person puts on their own day.
 *
 * Deliberately dumb about storage. Everything here works on a plain object in
 * memory and is written to localStorage as a stopgap, because where these
 * really belong is an account, so they follow a person from a phone to a
 * laptop. That move should be a change to `load` and `save` alone.
 *
 * Which is why every record already carries what syncing will need:
 *
 *   id         made on the device, so an event can be created with no network
 *   updatedAt  so two devices that both edited can be told apart, later wins
 *   deleted    a tombstone, not a removal, so a delete can travel between
 *              devices. Without it a deleted event walks back in on the next
 *              sync, which is the classic way these go wrong.
 *
 * None of that is visible to anyone using it. It costs nothing now and cannot
 * be retrofitted later without rewriting everyone's data.
 */
(function (global) {
  'use strict';

  var STORE = 'turning-year:planner:v1';
  var events = {};        // id -> record, tombstones included

  /* Named rather than raw hex so a theme can answer for what they look like,
   * and so what is stored stays readable a decade from now. */
  var COLOURS = ['rose', 'amber', 'leaf', 'sea', 'iris', 'stone'];

  function uid() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function now() { return Date.now(); }

  function load() {
    try { events = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; }
    catch (e) { events = {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(events)); } catch (e) { /* private mode */ }
  }

  /* Minutes from the start date's local midnight, which is how the day dial
   * thinks. A start is always inside its own day. */
  function clamp(min) { return Math.max(0, Math.min(1440, Math.round(min || 0))); }

  /* An end is measured from the same midnight as its start, and is allowed to
   * run past it: a night shift from 22:00 to 06:00 ends at minute 1800, not
   * at 360. Keeping one record with a long end, rather than splitting the
   * thing in two, means it can still be edited and deleted as one event, and
   * that a later sync has one row to reconcile rather than a pair that could
   * come apart. Capped at a fortnight so a typo cannot paint every day. */
  var MAX_SPAN_MIN = 1440 * 14;
  function clampEnd(min) { return Math.max(0, Math.min(MAX_SPAN_MIN, Math.round(min || 0))); }

  /* An end at or before its start is read as crossing midnight, which is what
   * someone means by 23:00 until 01:00. It used to be treated as a mistake
   * and flattened to half an hour. */
  function settleEnd(e) {
    if (e.allDay || e.untimed) return;
    while (e.endMin <= e.startMin) e.endMin += 1440;
    if (e.endMin > e.startMin + MAX_SPAN_MIN) e.endMin = e.startMin + MAX_SPAN_MIN;
  }

  function addDays(iso, n) {
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(isoA, isoB) {
    var a = isoA.split('-'), b = isoB.split('-');
    return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) -
                       Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
  }

  function create(iso, fields) {
    var e = {
      id: uid(),
      date: iso,
      title: String(fields.title || '').slice(0, 120),
      allDay: !!fields.allDay,
      /* Distinct from all-day: this is a thing to be done today that has no
       * hour and never had one. A ring has nowhere to put such a thing, which
       * is why the strip carries a list underneath it. */
      untimed: !!fields.untimed,
      /* Only meaningful for an untimed thing: a task is done or it is not.
       * An appointment is not something you tick off, it simply happens. */
      done: !!fields.done,
      doneAt: null,
      /* The day it was ticked off on, which is not always the day it was
       * written for: a task carried forward is usually finished on some later
       * morning, and that morning is where it should be seen to have been
       * done. Kept as a date rather than worked out from `doneAt`, because
       * only the app knows which day the place's own clock was showing. */
      doneOn: null,
      startMin: clamp(fields.startMin),
      endMin: clampEnd(fields.endMin),
      colour: COLOURS.indexOf(fields.colour) >= 0 ? fields.colour : 'amber',
      updatedAt: now(),
      deleted: false
    };
    settleEnd(e);
    events[e.id] = e;
    save();
    return e;
  }

  function update(id, fields) {
    var e = events[id];
    if (!e || e.deleted) return null;
    if ('title'    in fields) e.title = String(fields.title || '').slice(0, 120);
    if ('allDay'   in fields) e.allDay = !!fields.allDay;
    if ('untimed'  in fields) e.untimed = !!fields.untimed;
    if ('done'     in fields) setDoneOn(e, !!fields.done, fields.doneOn);
    if ('startMin' in fields) e.startMin = clamp(fields.startMin);
    if ('endMin'   in fields) e.endMin = clampEnd(fields.endMin);
    if ('colour'   in fields && COLOURS.indexOf(fields.colour) >= 0) e.colour = fields.colour;
    settleEnd(e);
    e.updatedAt = now();
    save();
    return e;
  }

  function setDoneOn(e, done, iso) {
    if (e.done === done) return;
    e.done = done;
    e.doneAt = done ? now() : null;
    e.doneOn = done ? (iso || e.date) : null;
  }

  /* Ticking a task off. Separate from `update` because it is the one change
   * that happens in a single tap and should not need the editor at all. */
  function setDone(id, done, iso) {
    var e = events[id];
    if (!e || e.deleted) return null;
    setDoneOn(e, done, iso);
    e.updatedAt = now();
    save();
    return e;
  }

  /* Marked gone rather than taken away, so the deletion is a fact that can
   * travel rather than an absence nobody can distinguish from never-existed. */
  function remove(id) {
    var e = events[id];
    if (!e) return;
    e.deleted = true;
    e.updatedAt = now();
    save();
  }

  function get(id) {
    var e = events[id];
    return e && !e.deleted ? e : null;
  }

  /* All-day first, then by start, so the ring and the list agree on order. */
  /* A copy carrying where it sits on the day being drawn. */
  function shown(e, dayStart, dayEnd, fromPrevious, intoNext) {
    var c = {};
    for (var k in e) if (Object.prototype.hasOwnProperty.call(e, k)) c[k] = e[k];
    c.dayStartMin = dayStart;
    c.dayEndMin = dayEnd;
    c.fromPrevious = !!fromPrevious;
    c.intoNext = !!intoNext;
    return c;
  }

  /* Everything showing on this date, which is not the same as everything
   * belonging to it: a shift begun the night before is part of this morning,
   * and something begun this evening is part of tomorrow's small hours.
   *
   * Each event comes back with the window it occupies *on this date*, clipped
   * to midnight at either end, so neither view has to know that days have
   * edges. `fromPrevious` and `intoNext` say which ends were cut, so they can
   * be drawn as continuing rather than as starting or stopping there.
   *
   * The record itself is untouched: these are extra fields on a copy. */
  var LOOK_BACK_DAYS = 14;

  /* `todayIso` is the day the clock is actually on, which the planner cannot
   * work out for itself: the app knows the place's own timezone and this file
   * deliberately does not. Kept so a view can tell an overdue thing from one
   * merely written for a later day. */
  function onDate(iso, todayIso) {
    var out = [];
    Object.keys(events).forEach(function (k) {
      var e = events[k];
      if (e.deleted) return;

      if (e.allDay) {
        if (e.date === iso) out.push(shown(e, e.startMin, e.endMin, false, false));
        return;
      }

      if (e.untimed) {
        if (e.date === iso) { out.push(shown(e, 0, 0, false, false)); return; }
        /* Finished here, on a day it had been carried into. It stays on this
         * day rather than vanishing the instant it is ticked, which would be
         * a strange reward for doing the thing. */
        if (e.done && e.doneOn === iso) {
          var f = shown(e, 0, 0, false, false);
          f.carriedFrom = e.date;
          f.carriedDays = daysBetween(e.date, iso);
          out.push(f);
          return;
        }
        /* Not finished, and this day is after the one it was written on: it
         * comes along. Deliberately not stopped at today. Looking at tomorrow
         * and seeing nothing, when the whole promise is that an unfinished
         * thing follows you to tomorrow, reads as the feature being broken.
         * A task that is still outstanding is still outstanding whichever day
         * you are looking at. */
        if (!e.done && e.date < iso) {
          var c = shown(e, 0, 0, false, false);
          c.carriedFrom = e.date;
          c.carriedDays = daysBetween(e.date, iso);
          c.overdue = !todayIso || iso <= todayIso;
          out.push(c);
        }
        return;
      }

      var offset = daysBetween(e.date, iso);      // days from its start to here
      if (offset < 0 || offset > LOOK_BACK_DAYS) return;

      /* Its span, expressed in minutes from *this* date's midnight. */
      var s = e.startMin - offset * 1440;
      var f = e.endMin - offset * 1440;
      if (f <= 0 || s >= 1440) return;            // finished before, or not begun

      out.push(shown(e, Math.max(0, s), Math.min(1440, f), s < 0, f > 1440));
    });
    /* All day first, then the hours in order, then the things with no hour,
     * which is the order both the ring and the strip want to read them in. */
    function rank(e) { return e.untimed ? 2 : (e.allDay ? 0 : 1); }
    out.sort(function (a, b) {
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return (a.dayStartMin - b.dayStartMin) || (a.startMin - b.startMin) ||
             (a.updatedAt - b.updatedAt);
    });
    return out;
  }

  function countOnDate(iso) { return onDate(iso).length; }

  /* Every date that has something on it, for marking days on the year wheel. */
  function datesWithEvents() {
    var set = {};
    Object.keys(events).forEach(function (k) {
      var e = events[k];
      if (e.deleted) return;
      set[e.date] = true;
      /* A night shift belongs to the morning it ends in as well, so the year
       * wheel marks both days rather than only the one it began on. */
      if (!e.allDay && !e.untimed) {
        var last = Math.floor((e.endMin - 1) / 1440);
        for (var i = 1; i <= last && i <= LOOK_BACK_DAYS; i++) set[addDays(e.date, i)] = true;
      }
    });
    return set;
  }

  function hhmm(min) {
    var h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  /* How many midnights an end lies past its own start's. */
  function daysPast(min) { return Math.floor(min / 1440); }
  /* "06:00" or "06:00 +1", so a night shift reads as one. */
  function hhmmDay(min) {
    var d = daysPast(min);
    return hhmm(min) + (d > 0 ? ' +' + d : '');
  }
  function parseHHMM(s) {
    var m = /^(\d{1,2}):?(\d{2})?$/.exec(String(s || '').trim());
    if (!m) return null;
    var h = +m[1], mi = m[2] ? +m[2] : 0;
    if (h > 24 || mi > 59) return null;
    return clamp(h * 60 + mi);
  }

  global.Planner = {
    COLOURS: COLOURS,
    load: load, create: create, update: update, remove: remove, get: get,
    onDate: onDate, countOnDate: countOnDate, datesWithEvents: datesWithEvents,
    setDone: setDone,
    hhmm: hhmm, hhmmDay: hhmmDay, daysPast: daysPast,
    addDays: addDays, daysBetween: daysBetween, parseHHMM: parseHHMM
  };
})(typeof window !== 'undefined' ? window : globalThis);
