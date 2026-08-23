/* render-strip.js — the same day as a vertical column.
 *
 * The dial is beautiful and it is the wrong shape for a phone: a circle wastes
 * a tall screen, and an hour on it is a nine-pixel arc no fingertip can find.
 * Unrolled, the day becomes what a day actually feels like, a line you go
 * down, and every hour gets a full row to be tapped.
 *
 * This is the same strip that stands for one day on the year wheel, taken out
 * and enlarged. Nothing here is recomputed: the sun's bands and the moon's
 * risings come from DayView.bands, so the two views can never disagree about
 * where sunset was.
 *
 * Built as HTML rather than SVG on purpose. Rows, scrolling and text want to
 * be laid out by the browser, not placed by hand, and a div is a touch target
 * the platform already knows how to treat kindly.
 */
(function (global) {
  'use strict';

  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pc(n) { return (n * 100).toFixed(3) + '%'; }

  /* A band from f1 to f2 of the day, as a slab down the column. */
  function slab(f1, f2, cls, style, extra) {
    return '<div class="' + cls + '" style="top:' + pc(f1) +
           ';height:' + pc(Math.max(0, f2 - f1)) + (style ? ';' + style : '') + '"' +
           (extra || '') + '></div>';
  }

  /* opts: { events, organs, hour12, nowFraction, showMoon } */
  function render(b, opts) {
    opts = opts || {};
    var out = [];

    /* ---- hours down the left ---------------------------------------------
     * The label sits at the line the hour begins on, not in the middle of the
     * row, so it reads as a time rather than as a name for a block. */
    var hours = b.hours.map(function (h) {
      var label = opts.hour12
        ? ((h.h % 12 === 0 ? 12 : h.h % 12) + (h.h < 12 ? 'am' : 'pm'))
        : (h.h < 10 ? '0' : '') + h.h;
      return '<div class="st-hour" style="top:' + pc(h.f1) + '">' + esc(label) + '</div>' +
             '<div class="st-rule" style="top:' + pc(h.f1) + '"></div>';
    }).join('');
    out.push('<div class="st-col st-gutter">' + hours + '</div>');

    /* ---- the sun ---------------------------------------------------------- */
    var sun = b.sun.map(function (r) {
      return slab(r.f1, r.f2, 'st-band st-sun-' + r.key,
                  'background:' + (r.key === 'day' ? 'var(--sun)' : r.fill),
                  ' title="' + esc(r.label) + '"');
    }).join('');
    out.push('<div class="st-col st-sun" aria-label="Sun">' + sun + '</div>');

    /* ---- the moon --------------------------------------------------------- */
    if (opts.showMoon !== false) {
      var lit = 0.12 + 0.7 * (b.moonIllumination || 0);
      var moon = b.moon.map(function (r) {
        return slab(r.f1, r.f2, 'st-band st-moon-up',
                    'background:var(--moon);opacity:' + lit.toFixed(2),
                    ' title="Moon above the horizon"');
      }).join('');
      out.push('<div class="st-col st-moon" aria-label="Moon">' + moon + '</div>');
    }

    /* ---- the organ clock, when asked for ---------------------------------- */
    if (opts.organs && opts.organs.length) {
      var organs = opts.organs.map(function (o) {
        return slab(o.f1, o.f2, 'st-band st-organ',
                    'background:' + (o.colour || 'var(--line-soft)'),
                    ' title="' + esc(o.label) + '"') +
               '<div class="st-organ-tx" style="top:' + pc(o.f1) +
               ';height:' + pc(o.f2 - o.f1) + '">' + esc(o.short || o.label) + '</div>';
      }).join('');
      out.push('<div class="st-col st-organs" aria-label="Organ clock">' + organs + '</div>');
    }

    /* ---- the day's own business ------------------------------------------
     * An empty row per hour to be tapped, then the events on top of them. */
    var rows = b.hours.map(function (h) {
      return '<button class="st-slot" data-hour-min="' + h.minOfDay +
             '" style="top:' + pc(h.f1) + ';height:' + pc(h.f2 - h.f1) +
             '" aria-label="Add something at this hour"></button>';
    }).join('');

    var evs = (opts.events || []).filter(function (e) { return !e.allDay && !e.untimed; });
    var lanes = [];
    var placed = evs.map(function (e) {
      var f1 = b.fractionOfMinute(e.startMin), f2 = b.fractionOfMinute(e.endMin);
      if (f2 - f1 < 0.012) f2 = f1 + 0.012;      // a short thing still gets a body
      var li = 0;
      while ((lanes[li] || []).some(function (o) { return f1 < o.f2 && o.f1 < f2; })) li++;
      (lanes[li] = lanes[li] || []).push({ f1: f1, f2: f2 });
      return { e: e, f1: f1, f2: f2, lane: li };
    });
    var laneCount = Math.max(1, lanes.length);

    var blocks = placed.map(function (p) {
      var w = 100 / laneCount;
      return '<button class="st-ev" data-event="' + esc(p.e.id) + '" style="top:' + pc(p.f1) +
             ';height:' + pc(p.f2 - p.f1) + ';left:' + (p.lane * w) + '%;width:' +
             (w - (laneCount > 1 ? 1.5 : 0)) + '%;background:var(--sc-' + p.e.colour + ')">' +
             '<span class="st-ev-t">' + esc(p.e.title || 'Untitled') + '</span>' +
             '<span class="st-ev-w">' + esc(hhmm(p.e.startMin)) + '</span></button>';
    }).join('');

    /* All-day things ride as a thin stripe down the whole column, so they are
     * present without pretending to occupy any particular hour. */
    var allDay = (opts.events || []).filter(function (e) { return e.allDay; })
      .map(function (e) {
        return '<button class="st-allday" data-event="' + esc(e.id) +
               '" style="background:var(--sc-' + e.colour + ')" title="' +
               esc(e.title || 'Untitled') + '"><span>' + esc(e.title || 'Untitled') +
               '</span></button>';
      }).join('');

    out.push('<div class="st-col st-events">' + rows + blocks + '</div>');

    var nowLine = (opts.nowFraction != null && opts.nowFraction >= 0 && opts.nowFraction <= 1)
      ? '<div class="st-now" style="top:' + pc(opts.nowFraction) + '"></div>' : '';

    /* The template has to name exactly the columns that were built, or the
     * events column inherits a width meant for something that is not there. */
    var cols = ['46px', '26px'];
    if (opts.showMoon !== false) cols.push('16px');
    if (opts.organs && opts.organs.length) cols.push('34px');
    cols.push('1fr');

    return '<div class="st-body">' +
             (allDay ? '<div class="st-allday-row">' + allDay + '</div>' : '') +
             '<div class="st-grid" style="grid-template-columns:' + cols.join(' ') + '">' +
               out.join('') + nowLine +
             '</div>' +
           '</div>';
  }

  function hhmm(min) {
    var h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* Things with no hour attached: the list a ring has nowhere to put. */
  function untimed(events) {
    var list = (events || []).filter(function (e) { return e.untimed; });
    return '<div class="st-untimed">' +
      '<div class="st-untimed-head">No set time' +
        '<button class="st-add-untimed" id="st-add-untimed">+ Add</button></div>' +
      (list.length
        ? '<ul>' + list.map(function (e) {
            return '<li><button class="st-task" data-event="' + esc(e.id) + '">' +
                   '<i class="dot" style="background:var(--sc-' + e.colour + ')"></i>' +
                   '<span>' + esc(e.title || 'Untitled') + '</span></button></li>';
          }).join('') + '</ul>'
        : '<p class="st-empty">Anything that needs doing today but not at a particular hour.</p>') +
      '</div>';
  }

  global.StripView = { render: render, untimed: untimed };
})(typeof window !== 'undefined' ? window : globalThis);
