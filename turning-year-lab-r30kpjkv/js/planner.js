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

  /* Minutes from local midnight, which is how the day dial thinks. */
  function clamp(min) { return Math.max(0, Math.min(1440, Math.round(min || 0))); }

  function create(iso, fields) {
    var e = {
      id: uid(),
      date: iso,
      title: String(fields.title || '').slice(0, 120),
      allDay: !!fields.allDay,
      startMin: clamp(fields.startMin),
      endMin: clamp(fields.endMin),
      colour: COLOURS.indexOf(fields.colour) >= 0 ? fields.colour : 'amber',
      updatedAt: now(),
      deleted: false
    };
    /* An event with no length is a moment, not a span. Give it a readable
     * half hour so it can be seen and aimed at on the ring. */
    if (!e.allDay && e.endMin <= e.startMin) e.endMin = clamp(e.startMin + 30);
    events[e.id] = e;
    save();
    return e;
  }

  function update(id, fields) {
    var e = events[id];
    if (!e || e.deleted) return null;
    if ('title'    in fields) e.title = String(fields.title || '').slice(0, 120);
    if ('allDay'   in fields) e.allDay = !!fields.allDay;
    if ('startMin' in fields) e.startMin = clamp(fields.startMin);
    if ('endMin'   in fields) e.endMin = clamp(fields.endMin);
    if ('colour'   in fields && COLOURS.indexOf(fields.colour) >= 0) e.colour = fields.colour;
    if (!e.allDay && e.endMin <= e.startMin) e.endMin = clamp(e.startMin + 30);
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
  function onDate(iso) {
    var out = [];
    Object.keys(events).forEach(function (k) {
      var e = events[k];
      if (!e.deleted && e.date === iso) out.push(e);
    });
    out.sort(function (a, b) {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.startMin - b.startMin || a.updatedAt - b.updatedAt;
    });
    return out;
  }

  function countOnDate(iso) { return onDate(iso).length; }

  /* Every date that has something on it, for marking days on the year wheel. */
  function datesWithEvents() {
    var set = {};
    Object.keys(events).forEach(function (k) {
      var e = events[k];
      if (!e.deleted) set[e.date] = true;
    });
    return set;
  }

  function hhmm(min) {
    var h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
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
    hhmm: hhmm, parseHHMM: parseHHMM
  };
})(typeof window !== 'undefined' ? window : globalThis);
