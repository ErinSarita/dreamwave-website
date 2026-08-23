/* clock.js — daylight saving on or off.
 *
 * The wall clock is a convention. Twice a year most of North America and
 * Europe move it an hour and then move it back, and for the months between,
 * every printed time sits an hour away from where the sun put it. Around
 * seventy countries do this; most of the world does not.
 *
 * None of it reaches the sky. Sunrise, sunset, the length of the daylight and
 * the height the sun climbs to are all fixed by latitude and the date, and
 * are identical either way. Only the number written beside them moves.
 *
 * With daylight saving off, the zone keeps its winter offset all year.
 */
(function (global) {
  'use strict';
  var TZ = global.TZ;

  /* Fractional hours 0-24 that this instant reads as. */
  function hoursOf(cycle, date, useDST) {
    var off = useDST ? TZ.offsetMinutes(cycle.tz, date) : cycle.standardOffsetMin;
    var d = new Date(date.getTime() + off * 60000);
    return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  }

  /* "HH:MM". */
  function time(cycle, date, useDST, hour12) {
    if (!date) return '--';
    return useDST ? TZ.formatTime(cycle.tz, date, hour12)
                  : TZ.formatAtOffset(cycle.standardOffsetMin, date, hour12);
  }

  global.Clock = { time: time, hoursOf: hoursOf };
})(typeof window !== 'undefined' ? window : globalThis);
