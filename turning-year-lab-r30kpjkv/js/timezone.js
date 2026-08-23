/* timezone.js — civil time in an arbitrary IANA zone, using Intl only.
 * The wheel needs local midnight for a place that may not be the viewer's own,
 * so every conversion goes through the named zone rather than the host offset.
 */
(function (global) {
  'use strict';

  var cache = {};
  function partsFormatter(tz) {
    if (!cache[tz]) {
      cache[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
    return cache[tz];
  }

  /* Civil clock fields for an instant, in the given zone. */
  function civilParts(tz, date) {
    var parts = partsFormatter(tz).formatToParts(date), out = {};
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parseInt(parts[i].value, 10);
    }
    if (out.hour === 24) out.hour = 0;
    return { year: out.year, month: out.month, day: out.day,
             hour: out.hour, minute: out.minute, second: out.second };
  }

  /* Zone offset from UTC, in minutes, at a given instant (east positive). */
  function offsetMinutes(tz, date) {
    var p = civilParts(tz, date);
    var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - date.getTime()) / 60000);
  }

  /* The instant at which the given civil time occurs in the zone.
   * Two passes settle daylight-saving transitions; times inside a spring-forward
   * gap resolve to the instant just after the jump. */
  function instantFromCivil(tz, y, m, d, hh, mm, ss) {
    var target = Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0);
    var guess = new Date(target - offsetMinutes(tz, new Date(target)) * 60000);
    guess = new Date(target - offsetMinutes(tz, guess) * 60000);
    return guess;
  }

  /* Local midnight starting the civil date {y, m, d} in the zone. */
  function startOfDay(tz, y, m, d) { return instantFromCivil(tz, y, m, d, 0, 0, 0); }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* "HH:MM" in the zone, 24-hour or 12-hour. */
  function formatTime(tz, date, hour12) {
    var p = civilParts(tz, date);
    if (!hour12) return pad(p.hour) + ':' + pad(p.minute);
    var h = p.hour % 12; if (h === 0) h = 12;
    return h + ':' + pad(p.minute) + ' ' + (p.hour < 12 ? 'am' : 'pm');
  }

  var MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December'];
  var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function formatDate(tz, date, style) {
    var p = civilParts(tz, date);
    if (style === 'short') return MONTHS_SHORT[p.month - 1] + ' ' + p.day;
    if (style === 'iso') return p.year + '-' + pad(p.month) + '-' + pad(p.day);
    return MONTHS[p.month - 1] + ' ' + p.day + ', ' + p.year;
  }

  function weekdayName(tz, date) {
    var w = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date);
    return w;
  }

  /* Fractional hours since local midnight of the civil day containing `date`. */
  function hoursIntoDay(tz, date) {
    var p = civilParts(tz, date);
    var mid = startOfDay(tz, p.year, p.month, p.day);
    return (date.getTime() - mid.getTime()) / 3600000;
  }

  function localZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }

  /* "UTC+01:00" style label for an instant. */
  function offsetLabel(tz, date) {
    var o = offsetMinutes(tz, date), sign = o < 0 ? '-' : '+';
    o = Math.abs(o);
    return 'UTC' + sign + pad(Math.floor(o / 60)) + ':' + pad(o % 60);
  }

  /* The zone's standard offset, in minutes. Daylight saving only ever adds
   * time, so the standard offset is the least the zone takes across a year:
   * a zone that never shifts returns its single offset, one that does returns
   * its winter one. */
  var stdCache = {};
  function zoneOffsetRange(tz, year) {
    var key = tz + ':' + year;
    if (!stdCache[key]) {
      var least = Infinity, most = -Infinity;
      for (var m = 1; m <= 12; m++) {
        var o = offsetMinutes(tz, instantFromCivil(tz, year, m, 15, 12, 0, 0));
        if (o < least) least = o;
        if (o > most) most = o;
      }
      stdCache[key] = { standard: least, summer: most, shifts: most !== least };
    }
    return stdCache[key];
  }
  function standardOffsetMinutes(tz, year) { return zoneOffsetRange(tz, year).standard; }
  function observesShift(tz, year) { return zoneOffsetRange(tz, year).shifts; }

  /* "HH:MM" for an instant read at a fixed offset from UTC. */
  function formatAtOffset(offsetMin, date, hour12) {
    var d = new Date(date.getTime() + offsetMin * 60000);
    return formatHours(d.getUTCHours() + d.getUTCMinutes() / 60, hour12);
  }

  /* "HH:MM" from fractional hours. */
  function formatHours(h, hour12) {
    var mins = Math.round((((h % 24) + 24) % 24) * 60);
    var hh = Math.floor(mins / 60) % 24, mm = mins % 60;
    if (!hour12) return pad(hh) + ':' + pad(mm);
    var t = hh % 12; if (t === 0) t = 12;
    return t + ':' + pad(mm) + ' ' + (hh < 12 ? 'am' : 'pm');
  }

  global.TZ = {
    civilParts: civilParts, offsetMinutes: offsetMinutes, instantFromCivil: instantFromCivil,
    startOfDay: startOfDay, formatTime: formatTime, formatDate: formatDate,
    weekdayName: weekdayName, hoursIntoDay: hoursIntoDay, localZone: localZone,
    offsetLabel: offsetLabel, standardOffsetMinutes: standardOffsetMinutes,
    observesShift: observesShift, formatAtOffset: formatAtOffset, formatHours: formatHours, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, WEEKDAYS: WEEKDAYS,
    pad: pad
  };
})(typeof window !== 'undefined' ? window : globalThis);
