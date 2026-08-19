/* app.js — state, controls, and the zoom between year, season and day. */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Places = global.Places,
      CycleModel = global.Cycle, WheelView = global.WheelView, DayView = global.DayView,
      Clock = global.Clock;

  var STORE = 'turning-year:v1';
  var NOTES_STORE = 'turning-year:notes';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var state = {
    place: null,
    anchorYear: null,
    level: 'year',
    season: null,
    lunation: null,
    day: null,
    hover: null,
    noteOpen: false,
    layers: { moon: true, terms: false, frost: true, months: true, traditional: false, skyClock: true, declination: true },
    frost: { last: null, first: null },
    theme: 'night',
    hour12: false,
    useDST: true,       // off = the zone's winter offset all year; see clock.js
    panelMin: false     // day panel collapsed to a single line
  };
  var cycle = null;
  var notes = {};                 // { 'YYYY-MM-DD': 'free text' }, one per calendar date
  var wheelZoom = null, dayZoom = null;   // ZoomPan controllers, attached once in init

  /* ------------------------------------------------------------ persistence */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        place: state.place, layers: state.layers, frost: state.frost,
        theme: state.theme, hour12: state.hour12, useDST: state.useDST,
        panelMin: state.panelMin
      }));
    } catch (e) { /* private mode; the site still works, it just forgets */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (o.place && typeof o.place.lat === 'number') state.place = o.place;
      if (o.layers) Object.keys(state.layers).forEach(function (k) {
        if (typeof o.layers[k] === 'boolean') state.layers[k] = o.layers[k];
      });
      if (o.frost) state.frost = o.frost;
      if (o.theme) state.theme = o.theme;
      if (typeof o.hour12 === 'boolean') state.hour12 = o.hour12;
      if (typeof o.useDST === 'boolean') state.useDST = o.useDST;
      if (typeof o.panelMin === 'boolean') state.panelMin = o.panelMin;
    } catch (e) { /* ignore corrupt state */ }
  }

  function loadNotes() {
    try { notes = JSON.parse(localStorage.getItem(NOTES_STORE) || '{}') || {}; }
    catch (e) { notes = {}; }
  }
  function saveNotes() {
    try { localStorage.setItem(NOTES_STORE, JSON.stringify(notes)); } catch (e) { /* private mode */ }
  }
  function getNote(iso) { return notes[iso] || ''; }
  function setNote(iso, text) {
    text = text.trim();
    if (text) notes[iso] = text; else delete notes[iso];
    saveNotes();
  }
  /* Notes live only in this browser's localStorage, so they are one cleared
   * cache away from gone and never appear on another device. Export/import
   * is the honest fix: a plain JSON file the user actually holds. */
  function exportNotes() {
    var payload = {
      kind: 'turning-year-notes', version: 1,
      exported: new Date().toISOString(), notes: notes
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'turning-year-notes-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Merge rather than replace: restoring on a device that already has notes
   * should never silently destroy them. Same date on both sides keeps the
   * longer text, on the assumption that the fuller note is the wanted one. */
  function importNotes(text) {
    var parsed;
    try { parsed = JSON.parse(text); } catch (e) { return { ok: false, msg: 'That file is not valid JSON.' }; }
    var incoming = parsed && parsed.notes && typeof parsed.notes === 'object' ? parsed.notes
                 : (parsed && typeof parsed === 'object' && !parsed.notes ? parsed : null);
    if (!incoming) return { ok: false, msg: 'No notes found in that file.' };
    var added = 0, merged = 0;
    Object.keys(incoming).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var val = String(incoming[k] || '').trim();
      if (!val) return;
      if (!notes[k]) { notes[k] = val; added++; }
      else if (notes[k] !== val) { if (val.length > notes[k].length) notes[k] = val; merged++; }
    });
    saveNotes();
    return { ok: true, msg: 'Restored: ' + added + ' added, ' + merged + ' already here.' };
  }

  /* Notes from other years on this same month and day, most recent first,
   * so "last frost" or "first bloom" can actually be compared year to year. */
  function notesOnSameDate(iso, limit) {
    var md = iso.slice(5), out = [];
    Object.keys(notes).forEach(function (k) {
      if (k !== iso && k.slice(5) === md) out.push({ year: k.slice(0, 4), iso: k, text: notes[k] });
    });
    out.sort(function (a, b) { return b.year - a.year; });
    return out.slice(0, limit || 5);
  }

  function readHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) return null;
    var q = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
    });
    if (q.lat && q.lon && q.tz) {
      state.place = { name: q.name || 'Custom', region: '', lat: +q.lat, lon: +q.lon, tz: q.tz,
                      label: (q.name || 'Custom location') };
    }
    if (q.year) state.anchorYear = parseInt(q.year, 10);
    if (q.day) { state.day = parseInt(q.day, 10); state.level = 'day'; }
    else if (q.season) { state.season = parseInt(q.season, 10); state.level = 'season'; }
    return q;
  }
  var hashLock = false;
  function writeHash() {
    if (!state.place) return;
    var p = state.place;
    var bits = ['name=' + encodeURIComponent(p.name), 'lat=' + p.lat.toFixed(4),
                'lon=' + p.lon.toFixed(4), 'tz=' + encodeURIComponent(p.tz),
                'year=' + state.anchorYear];
    if (state.level === 'day' && state.day) bits.push('day=' + state.day);
    else if (state.level === 'season' && state.season !== null) bits.push('season=' + state.season);
    hashLock = true;
    location.replace('#' + bits.join('&'));
    setTimeout(function () { hashLock = false; }, 0);
  }

  /* --------------------------------------------------------- cycle plumbing */
  function anchorYearFor(when, lat, tz) {
    var southern = lat < 0;
    var lon = southern ? 90 : 270;
    var y = TZ.civilParts(tz, when).year;
    for (var attempt = 0; attempt < 3; attempt++) {
      var start = A.dateFromJD(A.jdFromJDE(A.seasonalPointJDE(y, lon)));
      var cp = TZ.civilParts(tz, start);
      var day1 = TZ.startOfDay(tz, cp.year, cp.month, cp.day);
      if (when >= day1) return y;
      y -= 1;
    }
    return y;
  }

  /* Accepts "Apr 25", "25 Apr", "4/25" and "04-25". */
  function parseMonthDay(s) {
    s = (s || '').trim();
    if (!s) return null;
    var numeric = s.match(/^(\d{1,2})\s*[\/\-.]\s*(\d{1,2})$/);
    if (numeric) return validMonthDay(+numeric[1], +numeric[2]);

    var name = null, dayNum = null;
    var wordFirst = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})$/);
    var dayFirst = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?$/);
    if (wordFirst) { name = wordFirst[1]; dayNum = +wordFirst[2]; }
    else if (dayFirst) { name = dayFirst[2]; dayNum = +dayFirst[1]; }
    if (name === null) return null;

    name = name.toLowerCase();
    for (var i = 0; i < 12; i++) {
      if (TZ.MONTHS[i].toLowerCase().indexOf(name) === 0) return validMonthDay(i + 1, dayNum);
    }
    return null;
  }
  var MONTH_LENGTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function validMonthDay(m, d) {
    if (m < 1 || m > 12 || d < 1 || d > MONTH_LENGTH[m - 1]) return null;
    return [m, d];
  }
  function formatMonthDay(md) {
    return md ? TZ.MONTHS_SHORT[md[0] - 1] + ' ' + md[1] : '';
  }

  function rebuild(then) {
    $('loading').hidden = false;
    setTimeout(function () {
      var t0 = performance.now();
      cycle = CycleModel.build({
        lat: state.place.lat, lon: state.place.lon, tz: state.place.tz,
        anchorYear: state.anchorYear
      });
      CycleModel.applyFrost(cycle, state.frost);
      cycle.buildMs = Math.round(performance.now() - t0);
      drawWheel();
      syncChrome();
      closeTool();
      $('loading').hidden = true;
      if (then) then();
    }, 16);
  }

  function todayNumber() {
    if (!cycle) return null;
    return CycleModel.dayNumberForInstant(cycle, new Date());
  }

  /* ----------------------------------------------------------------- render */
  function drawWheel() {
    var svg = $('wheel-svg');
    var opts = { layers: state.layers, todayN: todayNumber(), notedDays: notes,
                 useDST: state.useDST };
    $('wheel').innerHTML = WheelView.render(cycle, opts);
    $('hud').innerHTML = WheelView.renderSky(cycle, opts);
    bindHits();
    applyZoom();
    updateReadout(state.hover || state.day || todayNumber() || 1);
  }

  function bindHits() {
    var hits = $('wheel').querySelectorAll('.hit');
    for (var i = 0; i < hits.length; i++) {
      hits[i].addEventListener('mouseenter', onHover);
      hits[i].addEventListener('click', onPick);
      hits[i].addEventListener('focus', onHover);
    }
    var moonHits = $('wheel').querySelectorAll('.moon-hit');
    for (var m = 0; m < moonHits.length; m++) {
      moonHits[m].addEventListener('click', function (e) {
        e.stopPropagation();          // the day sector underneath must not also fire
        state.lunation = +e.currentTarget.getAttribute('data-lunation');
        setLevel('lunation');
      });
    }
    $('wheel').addEventListener('mouseleave', function () {
      state.hover = null;
      updateReadout(state.day || todayNumber() || 1);
    });
  }
  function onHover(e) {
    var n = +e.currentTarget.getAttribute('data-day');
    state.hover = n;
    updateReadout(n);
    WheelView.highlight($('wheel-svg'), cycle, n);
  }
  function onPick(e) {
    var n = +e.currentTarget.getAttribute('data-day');
    if (state.level === 'year') {
      state.season = WheelView.seasonOfDay(cycle, n);
      setLevel('season');
    } else {
      state.day = n;
      setLevel('day');
    }
  }

  function applyZoom() {
    var t = WheelView.transformFor(cycle, state.level, state.season, state.lunation);
    $('wheel').style.transform = t.transform;
    $('hud').style.transform = t.transform;    // kept in lock-step so the sky glyphs track their stations
    $('wheel-svg').classList.toggle('zoomed', !!t.zoomed);
    WheelView.applyRotation($('wheel-svg'), t.rotation || 0);
  }

  function setLevel(level, opts) {
    if (wheelZoom) wheelZoom.reset();
    if (dayZoom) dayZoom.reset();
    state.level = level;
    if (level === 'year') { state.season = null; state.day = null; state.lunation = null; }
    if (level === 'season') state.lunation = null;
    if (level === 'season' && state.season === null) {
      state.season = WheelView.seasonOfDay(cycle, state.day || todayNumber() || 1);
    }
    if (level === 'day') {
      if (!state.day) state.day = todayNumber() || 1;
      state.season = WheelView.seasonOfDay(cycle, state.day);
      state.noteOpen = false;
    }
    var wheelScene = $('scene-wheel'), dayScene = $('scene-day');
    if (level === 'lunation') {
      applyZoom();
      updateReadout(state.hover || todayNumber() || 1);
      syncCrumbs(); syncLegend(); writeHash();
      return;
    }
    if (level === 'day') {
      drawDay();
      wheelScene.classList.add('fading');
      setTimeout(function () {
        wheelScene.hidden = true; dayScene.hidden = false;
        requestAnimationFrame(function () { dayScene.classList.remove('fading'); });
      }, 260);
    } else {
      if (dayScene.hidden === false) {
        drawWheel();                      // refresh note markers set while on the day view
        dayScene.classList.add('fading');
        setTimeout(function () {
          dayScene.hidden = true; wheelScene.hidden = false;
          requestAnimationFrame(function () {
            wheelScene.classList.remove('fading');
            applyZoom();
          });
        }, 260);
      } else applyZoom();
      updateReadout(state.hover || state.day || todayNumber() || 1);
    }
    syncCrumbs();
    syncLegend();
    writeHash();
  }

  var YEAR_LEGEND =
    '<li><i class="sw sw-day"></i> Daylight hours (bar length)</li>' +
    '<li><i class="sw sw-night"></i> Dark hours</li>' +
    '<li><i class="sw sw-moon"></i> Moon, shaded by illumination</li>' +
    '<li><i class="sw sw-grow"></i> Growing season, dark where it\'s safe, fading to light where frost still could</li>' +
    '<li><i class="sw sw-sol"></i> Solstice &amp; equinox</li>' +
    '<li><i class="sw sw-cq"></i> Midseason (cross-quarter day)</li>' +
    '<li><i class="sw sw-noted"></i> A day you\'ve written a note on</li>' +
    '<li><i class="sw sw-sky"></i> The Big Dipper facing north at nightfall</li>' +
    '<li><i class="sw sw-polaris"></i> Polaris, held still by the pointer stars\' dashed sightline</li>' +
    '<li><i class="sw sw-dec"></i> Sun north / south of the celestial equator</li>';

  var DAY_LEGEND =
    '<li><i class="sw sw-day"></i> Sun above the horizon (gold ring)</li>' +
    '<li><i class="sw sw-twi"></i> Twilight, then night (blue bands)</li>' +
    '<li><i class="sw sw-moon"></i> Moon above the horizon, shaded by phase (silver ring)</li>' +
    '<li><i class="sw sw-sunline"></i> Sun\'s height above the horizon (solid line)</li>' +
    '<li><i class="sw sw-moonline"></i> Moon\'s height above the horizon (dashed line)</li>' +
    '<li><i class="sw sw-fill"></i> How high the sun climbed (shaded fill)</li>' +
    '<li><i class="sw sw-ring"></i> Altitude scale: 30°, 60°, 90° (rings)</li>' +
    '<li><i class="sw sw-earth"></i> Earth, centred on your place; the gold line is the day/night edge</li>';

  function syncLegend() {
    var isDay = state.level === 'day';
    $('legend-list').innerHTML = isDay ? DAY_LEGEND : YEAR_LEGEND;
    $('legend-context').hidden = !isDay;
  }

  function syncCrumbs() {
    var cs = $('crumbs').querySelectorAll('.crumb');
    // A lunation sits in the same middle slot a season does, so it lights the
    // same crumb; without this nothing is highlighted at that level at all.
    var slot = state.level === 'lunation' ? 'season' : state.level;
    for (var i = 0; i < cs.length; i++) {
      var lvl = cs[i].getAttribute('data-level');
      cs[i].classList.toggle('is-on', lvl === slot);
    }
    var cS = $('crumb-season'), cD = $('crumb-day');
    cS.disabled = !cycle;
    cD.disabled = !cycle;
    if (cycle && state.level === 'lunation' && state.lunation !== null && cycle.lunations) {
      var L = cycle.lunations[state.lunation];
      cS.textContent = L && L.yearMoonNumber ? 'Moon ' + L.yearMoonNumber : 'Lunar month';
    } else if (cycle && state.season !== null) cS.textContent = cycle.seasons[state.season].from.name;
    else cS.textContent = 'Season';
    cD.textContent = state.day ? 'Day ' + state.day : 'Day';
  }

  /* --------------------------------------------------------------- readouts */
  function updateReadout(n) {
    if (!cycle) return;
    var d = cycle.days[Math.max(1, Math.min(cycle.length, n)) - 1];
    if (!d) return;
    var rows = [];
    rows.push(row('Daylight', d.sunAlwaysUp ? 'all day'
      : d.sunAlwaysDown ? 'none' : DayView.hm(d.daylightHours)));
    rows.push(row('Dark', d.sunAlwaysUp ? 'none'
      : d.sunAlwaysDown ? 'all day' : DayView.hm(d.nightHours)));
    if (d.sunrise) rows.push(row('Sunrise', Clock.time(cycle, d.sunrise, state.useDST, state.hour12)));
    if (d.sunset) rows.push(row('Sunset', Clock.time(cycle, d.sunset, state.useDST, state.hour12)));

    var station = d.station ? '<div class="r-station">' + d.station.name +
      (d.station.term ? ' · ' + d.station.term.hanzi + ' ' + d.station.term.pinyin : '') + '</div>' : '';
    if (!d.station && d.term && state.layers.terms) {
      station = '<div class="r-station">Solar term ' + d.term.number + ' of 24</div>';
    }
    if (!d.station && d.frost) {
      station = '<div class="r-station" style="color:var(--frost)">' +
        (d.frost.kind === 'last-frost' ? 'Last spring frost' : 'First autumn frost') + '</div>';
    }
    var hint = state.level === 'year'
      ? 'Click to open this season'
      : state.level === 'season' ? 'Click a day for its 24 hours' : '';

    $('readout').innerHTML =
      '<div class="r-lab">Day</div>' +
      '<div class="r-num">' + d.n + '</div>' +
      '<div class="r-lab">of ' + cycle.length + '</div>' +
      '<div class="r-date">' + TZ.formatDate(cycle.tz, d.date) + '</div>' +
      station +
      '<div class="r-rows">' + rows.join('') + '</div>' +
      '<div class="r-moon">' + MoonGlyph.svg(d.moonAge, 20) +
        '<span>' + Math.round(d.moonIllumination * 100) + '% lit · ' + d.moonPhaseName + '</span></div>' +
      (d.lunation ? '<div class="r-lunation">' + lunationLabel(d) + '</div>' : '') +
      (hint ? '<div class="r-hint">' + hint + '</div>' : '');
  }
  function row(k, v) { return '<div><span>' + k + '</span> · ' + v + '</div>'; }

  function drawDay() {
    var d = cycle.days[state.day - 1];
    if (!d) return;
    var out = DayView.render(cycle, d, { hour12: state.hour12, useDST: state.useDST, now: new Date() });
    $('dayclock').innerHTML = out.svg;

    var stationHTML = '';
    if (d.station) stationHTML += '<div class="d-station">' + d.station.name +
      (d.station.alt ? ' <span style="opacity:.6">/ ' + d.station.alt + '</span>' : '') + '</div>';
    if (d.term) stationHTML += '<div class="d-term">Solar term ' + d.term.number + ' of 24' +
      ' <span style="opacity:.6">(' + d.term.hanzi + ' ' + d.term.pinyin + ')</span></div>';
    if (d.frost) stationHTML += '<div class="d-term" style="color:var(--frost)">' +
      (d.frost.kind === 'last-frost' ? 'Last spring frost' : 'First autumn frost') +
      (cycle.frost.isEstimate ? ' (estimate)' : '') + '</div>';
    if (d.moonEvent) stationHTML += '<div class="d-term">' + d.moonEvent + '</div>';

    $('day-panel').className = 'day-panel' + (state.panelMin ? ' min' : '');
    $('day-panel').innerHTML =
      '<button class="panel-min" id="panel-min" aria-label="' +
        (state.panelMin ? 'Expand day details' : 'Minimise day details') +
        '" title="' + (state.panelMin ? 'Expand' : 'Minimise') + '">' +
        (state.panelMin ? '▴' : '▾') + '</button>' +
      '<div class="d-mini">Day ' + d.n + ' &middot; ' +
        TZ.formatDate(cycle.tz, d.date, 'short') + '</div>' +
      '<div class="d-of">Day</div>' +
      '<div class="d-num">' + d.n + '</div>' +
      '<div class="d-of">of ' + cycle.length + '</div>' +
      '<div class="d-date">' + TZ.formatDate(cycle.tz, d.date) + '</div>' +
      '<div class="d-week">' + TZ.weekdayName(cycle.tz, d.date) + '</div>' +
      (d.n === todayNumber()
        ? '<div class="d-now">Now ' + Clock.time(cycle, new Date(), state.useDST, state.hour12) +
          (cycle.shiftsClocks && !state.useDST ? ' &middot; clocks here read ' +
            Clock.time(cycle, new Date(), true, state.hour12) : '') + '</div>'
        : '') +
      stationHTML +
      '<div class="d-split">' +
        '<div class="d-sun"><b>' + (d.sunAlwaysUp ? '24 h' : d.sunAlwaysDown ? '0 h' : DayView.hm(d.daylightHours)) + '</b>light</div>' +
        '<div class="d-dark"><b>' + (d.sunAlwaysDown ? '24 h' : d.sunAlwaysUp ? '0 h' : DayView.hm(d.nightHours)) + '</b>dark</div>' +
      '</div>' +
      timesMarkup(d, out.darkMidpoint, out) +
      clockShiftMarkup(d) +
      noteMarkup(d.iso);

    $('panel-min').addEventListener('click', function () {
      state.panelMin = !state.panelMin;
      save(); drawDay();
    });
    wireNote(d.iso);
  }

  /* "Moon 3 · day 12 of 30" — which lunation this day sits in and how far
   * through it. Segment length is the real 29 or 30 days rather than a
   * rounded 29, and the partial ends say so instead of claiming a number. */
  function lunationLabel(d) {
    var L = d.lunation;
    if (!L) return '';
    if (!L.yearMoonNumber) {
      var edge = L.lead ? 'Lunar month carried in from last year'
                        : 'Lunar month running into next year';
      return edge + ' · day ' + d.dayInLunation + (L.complete ? ' of ' + L.days : '');
    }
    return 'Year Moon ' + L.yearMoonNumber +
           (cycle.yearMoonCount ? ' of ' + cycle.yearMoonCount : '') +
           ' · ' + L.shortLabel + (L.isBlue ? ' · blue moon' : '') +
           ' · day ' + d.dayInLunation + (L.complete ? ' of ' + L.days : '');
  }

  /* ------------------------------------------------------- quick-find lists
   * Two indexes into the cycle: the moons, and the eight seasonal stations.
   * Both are just views onto data already computed for the wheel, and every
   * row jumps straight to that day. */
  var toolOpen = null;

  function moonListItems() {
    return cycle.days
      .filter(function (d) { return d.moonEvent === 'Full Moon' || d.moonEvent === 'New Moon'; })
      .map(function (d) {
        return {
          n: d.n,
          name: d.moonEvent === 'Full Moon'
            ? ('Year Moon ' + d.yearMoonNumber + ' · ' + d.fullMoonSeasonLabel)
            : (d.newMoonSeasonLabel ? d.newMoonSeasonLabel + ' · new' : d.moonEvent),
          date: TZ.formatDate(cycle.tz, d.date),
          sub: (d.isBlueMoon ? 'blue moon · ' : '') +
               Math.round(d.moonIllumination * 100) + '% lit · ' +
               Math.round(d.moonDistanceKm).toLocaleString() + ' km',
          glyph: MoonGlyph.svg(d.moonAge, 17)
        };
      });
  }

  function stationListItems() {
    return cycle.stations.filter(function (s) { return s.dayNumber; }).map(function (s) {
      var d = cycle.days[s.dayNumber - 1];
      return {
        n: s.dayNumber, name: s.name,
        date: TZ.formatDate(cycle.tz, d.date),
        sub: s.alt + (s.term ? ' · ' + s.term.hanzi + ' ' + s.term.pinyin : ''),
        glyph: '<i class="sw ' + (s.kind === 'cross-quarter' ? 'sw-cq' : 'sw-sol') + '"></i>'
      };
    });
  }

  function openTool(kind) {
    if (toolOpen === kind) { closeTool(); return; }
    var items = kind === 'moon' ? moonListItems() : stationListItems();
    var todayN = todayNumber();
    $('tool-panel-title').textContent = kind === 'moon'
      ? 'Full and new moons' : 'Solstices, equinoxes and midseasons';
    $('tool-panel-list').innerHTML = items.length
      ? items.map(function (it) {
          return '<li><button data-day="' + it.n + '"' +
            (it.n === todayN ? ' class="is-today"' : '') + '>' +
            it.glyph +
            '<span class="ti-name">' + esc(it.name) +
            (it.sub ? '<span class="ti-sub">' + esc(it.sub) + '</span>' : '') + '</span>' +
            '<span class="ti-date">' + esc(it.date) + '</span>' +
            '<span class="ti-day">day ' + it.n + '</span>' +
            '</button></li>';
        }).join('')
      : '<li class="tool-panel-empty">Nothing to list for this cycle.</li>';

    Array.prototype.forEach.call($('tool-panel-list').querySelectorAll('button[data-day]'), function (b) {
      b.addEventListener('click', function () {
        state.day = +b.getAttribute('data-day');
        closeTool();
        setLevel('day');
      });
    });

    $('tool-panel').hidden = false;
    toolOpen = kind;
    $('tool-moon').classList.toggle('is-open', kind === 'moon');
    $('tool-stations').classList.toggle('is-open', kind === 'stations');
    $('tool-moon').setAttribute('aria-expanded', String(kind === 'moon'));
    $('tool-stations').setAttribute('aria-expanded', String(kind === 'stations'));
  }

  function closeTool() {
    toolOpen = null;
    $('tool-panel').hidden = true;
    $('tool-moon').classList.remove('is-open');
    $('tool-stations').classList.remove('is-open');
    $('tool-moon').setAttribute('aria-expanded', 'false');
    $('tool-stations').setAttribute('aria-expanded', 'false');
  }

  /* The day's two turning points: the sun's upper and lower meridian
   * crossings. Altitudes are signed, so a negative peak-sun means the sun
   * never cleared the horizon and a positive peak-darkness means it never
   * set, both of which are worth saying outright rather than hiding. */
  /* Eight of the compass. Azimuth runs clockwise from due north, so dividing
   * by 45 and rounding names the nearest point. */
  function compass(az) {
    var names = ['north', 'northeast', 'east', 'southeast',
                 'south', 'southwest', 'west', 'northwest'];
    return names[Math.round((((az % 360) + 360) % 360) / 45) % 8];
  }
  function height(v) {
    return Math.round(Math.abs(v)) + '° ' + (v >= 0 ? 'above' : 'below');
  }

  /* Every time the day holds, in one block: the sun's four moments, then the
   * moon's, and where the moon actually stands. `marks` comes back from the
   * dial, resolved against its window rather than against the calendar date,
   * so the panel and the dial cannot disagree. */
  function timesMarkup(d, darkMidpoint, out) {
    var marks = out.marks;
    function row(dot, name, value, at) {
      return '<div class="d-peak"><i class="pk pk-' + dot + '"></i>' +
        '<span class="pk-name">' + name + '</span>' +
        '<b>' + value + '</b>' +
        '<span class="pk-at">' + (at || '') + '</span></div>';
    }
    function t(m) { return Clock.time(cycle, m.t, state.useDST, state.hour12); }

    var rows = '';
    if (marks.sunrise) rows += row('sun', 'Sunrise', t(marks.sunrise), '');
    if (marks.sunset) rows += row('sun', 'Sunset', t(marks.sunset), '');
    if (marks.solarNoon) rows += row('sun', 'Peak sun', height(marks.solarNoon.alt), t(marks.solarNoon));
    if (marks.solarMidnight) rows += row('dark', 'Peak darkness', height(marks.solarMidnight.alt), t(marks.solarMidnight));

    /* The moon's own heading: its face, how much of it is lit, and what that
     * phase is called, with the lunar month underneath. Everything the moon
     * does that day then follows below it, so the block reads as one thing
     * rather than a set of times in one place and a picture in another. */
    var moonHead = '<div class="d-moon-row">' + MoonGlyph.svg(d.moonAge, 30) +
      '<div class="d-moon-text"><b>' + Math.round(d.moonIllumination * 100) + '% lit</b>' +
      d.moonPhaseName + '</div></div>' +
      (d.lunation ? '<div class="d-moon-sub">' + lunationLabel(d) + '</div>' : '');

    var moonRows = '';
    if (d.moonAlwaysUp) moonRows += row('moon', 'Moon', 'up all day', '');
    else if (d.moonAlwaysDown) moonRows += row('moon', 'Moon', 'down all day', '');
    if (marks.moonrise) moonRows += row('moon', 'Moonrise', t(marks.moonrise), '');
    if (marks.moonset) moonRows += row('moon', 'Moonset', t(marks.moonset), '');
    if (!marks.moonrise && !marks.moonset && !d.moonAlwaysUp && !d.moonAlwaysDown) {
      moonRows += row('moon', 'Moon', 'no rise or set', '');
    }
    if (out.moonHigh) {
      moonRows += row('moon', 'Highest',
        height(out.moonHigh.alt) + ', ' + compass(out.moonHigh.az), t(out.moonHigh));
    }
    if (out.moonNow) {
      moonRows += row('now', 'Right now',
        height(out.moonNow.alt) + ', ' + compass(out.moonNow.az), '');
    }

    var note = '';
    if (d.sunAlwaysUp) note = 'The sun stays up all day; even its low point is above the horizon.';
    else if (d.sunAlwaysDown) note = 'The sun stays down all day; even its high point is below the horizon.';
    else if (!marks.solarMidnight) note = 'No peak darkness inside this date. The sun’s low point ' +
      'sits within a minute of midnight here, so it falls at the close of yesterday ' +
      'and again at the open of tomorrow.';
    else if (darkMidpoint) {
      var mins = Math.abs(darkMidpoint.getTime() - marks.solarMidnight.t.getTime()) / 60000;
      note = 'Middle of the dark: ' + Clock.time(cycle, darkMidpoint, state.useDST, state.hour12) +
             (mins < 1 ? ', under a minute off.' : ', ' + Math.round(mins) + ' min off.');
    }

    if (!rows && !moonRows) return '';
    return '<div class="d-peaks"><div class="d-cols">' +
             '<div class="d-sunblock">' + rows + '</div>' +
             '<div class="d-moonblock">' + moonHead + moonRows + '</div>' +
           '</div>' +
           (note ? '<div class="d-peak-note">' + note + '</div>' : '') + '</div>';
  }

  /* The two days a year the wall clock jumps. Worth saying out loud, because
   * the dial looks wrong on both of them and the reason is not astronomical:
   * nothing happens in the sky at 02:00 on either date. Which sentence is
   * right depends on the clock being read, since standard and sun time run
   * straight through the jump and only the calendar date is clipped. */
  function clockShiftMarkup(d) {
    if (!d.clockShiftMinutes || !d.clockShiftAt) return '';
    var fwd = d.clockShiftMinutes > 0;
    var at = d.clockShiftFrom, to = d.clockShiftTo;
    var txt;
    if (state.useDST) {
      txt = fwd
        ? 'Clocks went forward at ' + at + ', straight to ' + to + '. That hour has no marks on this dial because it did not happen here.'
        : 'Clocks went back at ' + at + ', to ' + to + '. The hour between is marked twice because it was lived through twice.';
    } else {
      txt = 'Local clocks ' + (fwd ? 'went forward' : 'went back') + ' an hour at ' + at +
            ' today. This dial ignores that, so the day runs its usual 24 hours.';
    }
    txt += ' The sun did nothing unusual: peak sun to peak sun was its ordinary length.';
    return '<div class="d-shift">' + txt + '</div>';
  }


  /* A note is one free-text entry per calendar date: what actually happened
   * here, this year, whether that's the real last frost, first robin, or
   * anything else worth checking against next year. */
  function noteMarkup(iso) {
    var text = getNote(iso);
    var btn = '<button class="note-btn' + (text ? ' has-note' : '') + '" id="note-btn" ' +
      'aria-label="' + (text ? 'Edit your note for this day' : 'Add a note for this day') + '" ' +
      'title="' + (text ? 'Edit your note' : 'Add a note') + '">&#9998;' +
      (text ? '<span class="note-dot"></span>' : '') + '</button>';
    if (!state.noteOpen) return btn;

    var history = notesOnSameDate(iso);
    return btn + '<div class="note-box">' +
      '<textarea id="note-text" placeholder="Last frost on the tomatoes. Robins back. Corn knee-high...">' +
      esc(text) + '</textarea>' +
      (history.length
        ? '<div class="note-history"><div class="note-history-label">On this date before</div>' +
          history.map(function (h) {
            return '<div class="note-history-item"><b>' + h.year + '</b> ' + esc(h.text) + '</div>';
          }).join('') + '</div>'
        : '') +
      '<button class="note-done" id="note-done">Done</button></div>';
  }

  function wireNote(iso) {
    $('note-btn').addEventListener('click', function () {
      state.noteOpen = !state.noteOpen;
      drawDay();
    });
    if (!state.noteOpen) return;
    var ta = $('note-text');
    // The click that opened this box replaced its own DOM node; the browser's
    // native post-click focus step can lose the race with a synchronous
    // focus() call here, so defer it to the next tick to make sure it wins.
    setTimeout(function () { ta.focus(); ta.selectionStart = ta.selectionEnd = ta.value.length; }, 0);
    ta.addEventListener('input', function () {
      setNote(iso, ta.value);
      $('note-btn').classList.toggle('has-note', !!ta.value.trim());
      syncNotesCount();
    });
    $('note-done').addEventListener('click', function () {
      state.noteOpen = false;
      drawDay();
    });
  }

  /* ---------------------------------------------------------------- chrome */
  function syncChrome() {
    /* Whether the zone shifts its clocks is a property of the place, so the
     * chooser's note has to be rewritten whenever the place does. */
    syncDstMeta();
    var p = state.place;
    $('place-input').value = p.label || p.name;
    $('place-meta').textContent =
      Math.abs(p.lat).toFixed(3) + '°' + (p.lat >= 0 ? 'N' : 'S') + ', ' +
      Math.abs(p.lon).toFixed(3) + '°' + (p.lon >= 0 ? 'E' : 'W') + ' · ' + p.tz +
      ' · ' + TZ.offsetLabel(p.tz, cycle ? cycle.day1 : new Date());

    var lastDay = cycle.days[cycle.length - 1];
    $('cycle-title').textContent =
      TZ.formatDate(cycle.tz, cycle.day1, 'short') + ' ' + TZ.civilParts(cycle.tz, cycle.day1).year +
      ' → ' + TZ.formatDate(cycle.tz, lastDay.date, 'short') + ' ' + lastDay.year;
    $('cycle-meta').textContent = cycle.length + ' days' +
      (cycle.yearMoonCount ? ' · ' + cycle.yearMoonCount + ' full moons' : '') +
      (cycle.isLong ? ' · a long cycle' : '') +
      (cycle.southern ? ' · June solstice anchor' : '');

    var fr = cycle.frost;
    $('frost-last').value = fr.last ? formatMonthDay(fr.last.monthDay) : '';
    $('frost-first').value = fr.first ? formatMonthDay(fr.first.monthDay) : '';
    if (fr.none) {
      $('frost-meta').textContent = 'No frost expected at this latitude: shown as a year-round growing season. Type dates if that\'s wrong.';
    } else {
      $('frost-meta').textContent = (fr.isEstimate
        ? 'Latitude estimate, shown as a ±15 day window around each date. Type your own dates.'
        : 'Shown as a ±15 day window around each date.');
    }
    syncNotesCount();
    syncCrumbs();
  }

  function syncNotesCount() {
    var n = Object.keys(notes).length;
    $('notes-count').textContent = n ? (n + (n === 1 ? ' day noted' : ' days noted')) : 'No notes yet.';
  }

  /* ------------------------------------------------------------------ setup */
  function setPlace(p, rebuildAfter) {
    state.place = p;
    state.anchorYear = anchorYearFor(new Date(), p.lat, p.tz);
    save();
    if (rebuildAfter !== false) rebuild(function () { setLevel(state.level); });
  }

  function wirePlaceSearch() {
    var input = $('place-input'), list = $('place-results');
    function close() { list.hidden = true; list.innerHTML = ''; }
    input.addEventListener('input', function () {
      var res = Places.search(input.value, 10);
      if (!res.length) { close(); return; }
      list.innerHTML = res.map(function (p, i) {
        return '<li data-i="' + i + '">' + p.name + '<small>' + p.region + ' · ' + p.tz + '</small></li>';
      }).join('');
      list.hidden = false;
      Array.prototype.forEach.call(list.children, function (li) {
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          var p = res[+li.getAttribute('data-i')];
          close();
          state.level = 'year'; state.season = null; state.day = null;
          setPlace(p);
        });
      });
    });
    input.addEventListener('focus', function () { input.select(); });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
  }

  function wireGeo() {
    $('geo-btn').addEventListener('click', function () {
      if (!navigator.geolocation) { $('place-meta').textContent = 'This browser has no location service.'; return; }
      $('place-meta').textContent = 'Asking your browser for a location…';
      navigator.geolocation.getCurrentPosition(function (pos) {
        var lat = pos.coords.latitude, lon = pos.coords.longitude;
        var near = Places.nearest(lat, lon);
        var tz = TZ.localZone();
        state.level = 'year'; state.season = null; state.day = null;
        setPlace({ name: 'My location', region: near ? near.region : '', lat: lat, lon: lon,
                   tz: tz, label: 'My location (' + lat.toFixed(2) + ', ' + lon.toFixed(2) + ')' });
      }, function () {
        $('place-meta').textContent = 'Location was declined. Search for a place instead.';
      }, { timeout: 10000 });
    });
  }

  function wireControls() {
    $('cycle-prev').addEventListener('click', function () {
      state.anchorYear -= 1; state.day = null; state.season = null; state.level = 'year';
      rebuild(function () { setLevel('year'); });
    });
    $('cycle-next').addEventListener('click', function () {
      state.anchorYear += 1; state.day = null; state.season = null; state.level = 'year';
      rebuild(function () { setLevel('year'); });
    });
    $('cycle-today').addEventListener('click', function () {
      var y = anchorYearFor(new Date(), state.place.lat, state.place.tz);
      var go = function () {
        var n = todayNumber();
        if (n) { state.day = n; setLevel('day'); }
      };
      if (y !== state.anchorYear) { state.anchorYear = y; rebuild(go); } else go();
    });

    function goToDate() {
      var val = $('goto-date').value;                    // "YYYY-MM-DD" or ""
      var m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) { $('goto-meta').textContent = 'Pick a date first.'; return; }
      var y = +m[1], mo = +m[2], d = +m[3];
      var target = TZ.instantFromCivil(state.place.tz, y, mo, d, 12, 0, 0);   // local noon avoids DST edge cases
      var anchorYear = anchorYearFor(target, state.place.lat, state.place.tz);
      var go = function () {
        var n = CycleModel.dayNumberForInstant(cycle, target);
        if (n) { state.day = n; setLevel('day'); $('goto-meta').textContent = 'Any date, past or future, in this place\'s own calendar.'; }
        else $('goto-meta').textContent = 'Could not place that date. Try another.';
      };
      if (anchorYear !== state.anchorYear) { state.anchorYear = anchorYear; rebuild(go); } else go();
    }
    $('goto-btn').addEventListener('click', goToDate);
    $('goto-date').addEventListener('keydown', function (e) { if (e.key === 'Enter') goToDate(); });

    [['lay-moon', 'moon'], ['lay-terms', 'terms'], ['lay-frost', 'frost'],
     ['lay-months', 'months'], ['lay-trad', 'traditional'], ['lay-sky', 'skyClock'],
     ['lay-dec', 'declination']].forEach(function (pair) {
      var el = $(pair[0]);
      el.checked = state.layers[pair[1]];
      el.addEventListener('change', function () {
        state.layers[pair[1]] = el.checked;
        save(); drawWheel();
      });
    });

    (function () {
      var el = $('use-dst');
      el.checked = state.useDST;
      el.addEventListener('change', function () {
        state.useDST = el.checked;
        save(); syncDstMeta(); drawWheel(); syncChrome();
        if (state.level === 'day') drawDay();
        updateReadout(state.hover || state.day || todayNumber() || 1);
      });
    })();
    syncDstMeta();

    function frostChanged() {
      state.frost = { last: parseMonthDay($('frost-last').value),
                      first: parseMonthDay($('frost-first').value) };
      save();
      CycleModel.applyFrost(cycle, state.frost);
      drawWheel(); syncChrome();
    }
    $('notes-export').addEventListener('click', function () {
      if (!Object.keys(notes).length) { $('notes-meta').textContent = 'No notes to back up yet.'; return; }
      exportNotes();
      $('notes-meta').textContent = 'Backup downloaded.';
    });
    $('notes-import').addEventListener('click', function () { $('notes-file').click(); });
    $('notes-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var res = importNotes(String(reader.result));
        $('notes-meta').textContent = res.msg;
        if (res.ok) { drawWheel(); syncNotesCount(); if (state.level === 'day') drawDay(); }
      };
      reader.readAsText(f);
      e.target.value = '';
    });

    $('frost-last').addEventListener('change', frostChanged);
    $('frost-first').addEventListener('change', frostChanged);

    $('about-btn').addEventListener('click', function () { $('about').hidden = false; });
    $('about-close').addEventListener('click', function () { $('about').hidden = true; });
    $('about').addEventListener('click', function (e) {
      if (e.target === $('about')) $('about').hidden = true;
    });

    $('tool-moon').addEventListener('click', function () { openTool('moon'); });
    $('tool-stations').addEventListener('click', function () { openTool('stations'); });
    $('tool-panel-close').addEventListener('click', closeTool);
    document.addEventListener('click', function (e) {
      if (!toolOpen) return;
      if ($('tool-panel').contains(e.target) || $('top-tools').contains(e.target)) return;
      closeTool();
    });

    $('compare-btn').addEventListener('click', function () {
      var out = DayView.renderCompare(cycle);
      $('compare-svg').innerHTML = out.svg;
      $('compare-legend').innerHTML = out.curves.map(function (c) {
        return '<li><i class="swatch" style="border-top-color:' + c.color +
          (c.dash ? ';border-top-style:dashed' : '') + '"></i>' + c.label +
          '<span class="stat">' + c.maxAlt + '° high · ' + c.daylight + '</span></li>';
      }).join('');
      $('compare').hidden = false;
    });
    $('spiral-btn').addEventListener('click', function () {
      var data = Spiral.build({
        lat: state.place.lat, tz: state.place.tz, centerYear: state.anchorYear,
        anchorMode: cycle.anchorMode, span: 2
      });
      var out = Spiral.render(data, { todayJD: A.jdFromDate(new Date()) });
      $('spiral-svg').innerHTML = out.svg;
      var lengths = data.turns.map(function (t) { return t.days; });
      var long = data.turns.filter(function (t) { return t.days === 366; })
                           .map(function (t) { return t.year; });
      $('spiral-meta').textContent =
        'Cycle lengths shown: ' + lengths.join(', ') + ' days. ' +
        (long.length
          ? 'The ' + long.join(' and ') + ' cycle' + (long.length > 1 ? 's run' : ' runs') +
            ' to 366 days, which is where the extra sunrise goes.'
          : 'All the same length in this stretch.');
      $('spiral').hidden = false;
    });
    $('spiral-close').addEventListener('click', function () { $('spiral').hidden = true; });
    $('spiral').addEventListener('click', function (e) {
      if (e.target === $('spiral')) $('spiral').hidden = true;
    });

    $('compare-close').addEventListener('click', function () { $('compare').hidden = true; });
    $('compare').addEventListener('click', function (e) {
      if (e.target === $('compare')) $('compare').hidden = true;
    });

    $('theme-btn').addEventListener('click', function () {
      state.theme = state.theme === 'night' ? 'day' : 'night';
      applyTheme(); save();
    });

    $('panel-toggle').addEventListener('click', function () {
      $('app').classList.toggle('panel-open');
    });

    $('crumbs').addEventListener('click', function (e) {
      var b = e.target.closest('.crumb');
      if (!b || b.disabled) return;
      setLevel(b.getAttribute('data-level'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (!$('about').hidden) { $('about').hidden = true; return; }
        if (!$('compare').hidden) { $('compare').hidden = true; return; }
        if (!$('spiral').hidden) { $('spiral').hidden = true; return; }
        if (toolOpen) { closeTool(); return; }
        setLevel(state.level === 'day' ? 'season' : 'year');
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        var dir = e.key === 'ArrowRight' ? 1 : -1;
        if (state.level === 'day') {
          var n = state.day + dir;
          if (n >= 1 && n <= cycle.length) { state.day = n; state.noteOpen = false; drawDay(); syncCrumbs(); writeHash(); }
        } else if (state.level === 'season') {
          state.season = (state.season + dir + 4) % 4;
          applyZoom(); syncCrumbs(); writeHash();
        }
        e.preventDefault();
      }
    });

    window.addEventListener('hashchange', function () {
      if (hashLock) return;
      var q = readHash();
      if (q) boot();
    });
  }

  function applyTheme() {
    document.body.setAttribute('data-theme', state.theme);
    $('theme-btn').textContent = state.theme === 'night' ? 'Daylight theme' : 'Night theme';
  }

  function boot() {
    rebuild(function () {
      if (state.level === 'day' && state.day) setLevel('day');
      else if (state.level === 'season') setLevel('season');
      else setLevel('year');
    });
  }

  /* The line under the checkbox. What it should say depends on the place:
   * most of the world keeps one offset all year, and there the setting has
   * nothing to act on. */
  function syncDstMeta() {
    var el = $('dst-meta');
    if (!el) return;
    if (cycle && !cycle.shiftsClocks) {
      el.textContent = 'This zone keeps one offset all year, so this setting changes nothing here.';
    } else if (state.useDST) {
      el.textContent = 'Times follow the wall clock, so they jump an hour twice a year. ' +
                       'The sun is unaffected either way.';
    } else {
      el.textContent = 'Times keep the winter offset all year, so noon stays where the sun put it.';
    }
  }

  function init() {
    load();
    loadNotes();
    readHash();
    if (!state.place) {
      var tz = TZ.localZone();
      var guess = Places.all.filter(function (p) { return p.tz === tz; })[0];
      state.place = guess || Places.all.filter(function (p) { return p.name === 'Dublin'; })[0];
    }
    if (!state.anchorYear) {
      state.anchorYear = anchorYearFor(new Date(), state.place.lat, state.place.tz);
    }
    applyTheme();
    wirePlaceSearch(); wireGeo(); wireControls(); wireZoom();
    boot();
  }

  function wireZoom() {
    wheelZoom = ZoomPan.attach($('wheel-svg'), $('scene-wheel'));
    dayZoom = ZoomPan.attach($('day-svg'), $('scene-day'));
    function active() { return state.level === 'day' ? dayZoom : wheelZoom; }
    $('zoom-in').addEventListener('click', function () { active().zoomIn(); });
    $('zoom-out').addEventListener('click', function () { active().zoomOut(); });
    $('zoom-reset').addEventListener('click', function () { active().reset(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
