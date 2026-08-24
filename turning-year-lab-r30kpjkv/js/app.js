/* app.js — state, controls, and the zoom between year, season and day. */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Places = global.Places,
      CycleModel = global.Cycle, WheelView = global.WheelView, DayView = global.DayView,
      Clock = global.Clock, MoonView = global.MoonView, Lunar = global.Lunar;

  /* Empty for the public build, so its saved places and settings keep the
   * keys they have always had. Any other build gets its own drawer. */
  var NS = (global.FEATURES && global.FEATURES.ns && global.FEATURES.ns !== 'public')
    ? global.FEATURES.ns + ':' : '';

  var STORE = 'turning-year:' + NS + 'v1';
  var NOTES_STORE = 'turning-year:' + NS + 'notes';

  /* The website ships with notes off. Everything below that touches a note
   * checks this first, so with the flag down nothing is read, nothing is
   * written, and no part of the interface offers it. See features.js. */
  var NOTES_ON = !!(global.FEATURES && global.FEATURES.notes);
  var BODY_ON  = !!(global.FEATURES && global.FEATURES.bodyCycles);
  var PLAN_ON  = !!(global.FEATURES && global.FEATURES.planner) && !!global.Planner;
  var STRIP_ON = !!global.StripView;
  var SKY_ON   = !!(global.Zodiac && global.Zodiac.sky);
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var state = {
    place: null,
    anchorYear: null,
    level: 'year',
    season: null,
    lunationK: null,   // absolute lunation index; see lunar.js
    day: null,
    hover: null,
    noteOpen: false,
    layers: { moon: true, terms: false, frost: true, months: true, seasons: true, traditional: false, skyClock: true, declination: true },
    frost: { last: null, first: null },
    theme: 'night',
    hour12: false,
    useDST: true,       // off = the zone's winter offset all year; see clock.js
    /* Collapsed by default on a narrow screen. Open, this panel covers the
     * lower two thirds of a phone, which hides half the day clock: on a
     * 375-wide screen exactly twelve of the twenty-four hours sit underneath
     * it, so half the day cannot be reached at all. Someone who has once
     * opened it keeps their choice, since `load` overwrites this. */
    panelMin: typeof window !== 'undefined' && window.innerWidth < 760,
    /* 'dial' or 'strip'. A circle wastes a tall screen and gives each hour a
     * nine-pixel arc, so a phone opens on the strip and a desktop on the
     * dial. Either way the choice is remembered once it is made. */
    dayView: (typeof window !== 'undefined' && window.innerWidth < 760) ? 'strip' : 'dial',
    /* 'above' or 'here'. The map from outside the system, or the sky as it
     * actually stands over this place: the same planets, the same instant,
     * seen from the two positions a person can imagine occupying. */
    systemView: 'above',
    moonMin: false,     // lunation readout collapsed to a single line
    readoutMin: false,  // year readout collapsed to a single line
    /* The lunar clock counts up from the start of the lunar day, the way a
     * clock does. Counting down suits an uneven unit better, since the hours
     * elapsed mean less when the day can run 20 or 27, but a clock that
     * counts down is a timer, and reading time as it accumulates is how
     * every clock anyone uses already works. */
    lunarCountdown: false,
    /* The planets and the two angles, off by default: the day clock is about
     * the sun and moon first, and five more curves on it is a choice. */
    showPlanets: false,
    /* Two separate layers now. They were one switch, which forced the
     * measured curves and the traditional watches on together; they are
     * different kinds of claim and deserve to be looked at one at a time. */
    showBio: false,
    showOrgans: false,
    orbitsMin: false,   // the system readout collapsed to a single line
    monthRun: null,     // which calendar month is open, as an index
    mensesOpen: false,  // the cycle wheel showing instead of the dials
    mensesDay: null,    // the day of the cycle under the pointer
    mensesMin: false,   // the blueprint readout folded to one line
    monthMin: false,
    /* A chosen instant, when someone wants a particular moment rather than
     * now: a birth time, an eclipse, a date in 1969. Held as an ISO string so
     * it survives a reload. Null means "read the sky as it is". */
    moment: null,
    moonPhases: { 'New Moon': true, 'Waxing Crescent': true, 'First Quarter': true,
                  'Waxing Gibbous': true, 'Full Moon': true, 'Waning Gibbous': true,
                  'Last Quarter': true, 'Waning Crescent': true }
  };
  var cycle = null;
  var notes = {};                 // { 'YYYY-MM-DD': 'free text' }, one per calendar date
  var wheelZoom = null, dayZoom = null, moonZoom = null, orbitsZoom = null,
      monthZoom = null, mensesZoom = null, pregZoom = null, skyZoom = null;

  /* ------------------------------------------------------------ persistence */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        place: state.place, layers: state.layers, frost: state.frost,
        theme: state.theme, hour12: state.hour12, useDST: state.useDST,
        panelMin: state.panelMin, moonMin: state.moonMin, dayView: state.dayView,
        systemView: state.systemView,
        readoutMin: state.readoutMin, lunarCountdown: state.lunarCountdown,
        monthRun: state.monthRun, monthMin: state.monthMin,
        mensesOpen: state.mensesOpen, mensesMin: state.mensesMin,
        showPlanets: state.showPlanets,
        showBio: state.showBio, showOrgans: state.showOrgans,
        orbitsMin: state.orbitsMin,
        moment: state.moment,
        moonPhases: state.moonPhases
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
      if (o.dayView === 'strip' || o.dayView === 'dial') state.dayView = o.dayView;
      if (o.systemView === 'above' || o.systemView === 'here') state.systemView = o.systemView;
      if (typeof o.moonMin === 'boolean') state.moonMin = o.moonMin;
      if (typeof o.readoutMin === 'boolean') state.readoutMin = o.readoutMin;
      if (typeof o.lunarCountdown === 'boolean') state.lunarCountdown = o.lunarCountdown;
      if (typeof o.showPlanets === 'boolean') state.showPlanets = o.showPlanets;
      /* Anyone carrying the old single setting gets the measured band, which
       * is the half that needs no framing to read. */
      if (typeof o.showBody === 'boolean') { state.showBio = o.showBody; }
      if (typeof o.showBio === 'boolean') state.showBio = o.showBio;
      if (typeof o.showOrgans === 'boolean') state.showOrgans = o.showOrgans;
      if (typeof o.orbitsMin === 'boolean') state.orbitsMin = o.orbitsMin;
      if (typeof o.monthRun === 'number' || o.monthRun === null) state.monthRun = o.monthRun;
      if (typeof o.monthMin === 'boolean') state.monthMin = o.monthMin;
      if (typeof o.mensesOpen === 'boolean') state.mensesOpen = o.mensesOpen;
      if (typeof o.mensesMin === 'boolean') state.mensesMin = o.mensesMin;
      if (typeof o.moment === 'string' || o.moment === null) state.moment = o.moment;
      if (o.moonPhases) Object.keys(state.moonPhases).forEach(function (k) {
        if (typeof o.moonPhases[k] === 'boolean') state.moonPhases[k] = o.moonPhases[k];
      });
    } catch (e) { /* ignore corrupt state */ }
  }

  function loadNotes() {
    if (!NOTES_ON) { notes = {}; return; }
    try { notes = JSON.parse(localStorage.getItem(NOTES_STORE) || '{}') || {}; }
    catch (e) { notes = {}; }
  }
  function saveNotes() {
    if (!NOTES_ON) return;
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

  /* Which scene swap is the current one, so an older timer cannot undo it. */
  var sceneSwapId = 0, sceneSwap = 0;

  /* ----------------------------------------------------------------- render */
  function drawWheel() {
    var svg = $('wheel-svg');
    var opts = { layers: state.layers, todayN: todayNumber(),
                 notedDays: NOTES_ON ? notes : null,
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
    var monthHits = $('wheel').querySelectorAll('.month-hit');
    for (var q = 0; q < monthHits.length; q++) {
      monthHits[q].addEventListener('click', function (e) {
        e.stopPropagation();          // the day sector underneath must not also fire
        state.monthRun = +e.currentTarget.getAttribute('data-run');
        setLevel('month');
      });
    }
    var moonHits = $('wheel').querySelectorAll('.moon-hit');
    for (var m = 0; m < moonHits.length; m++) {
      moonHits[m].addEventListener('click', function (e) {
        e.stopPropagation();          // the day sector underneath must not also fire
        var li = +e.currentTarget.getAttribute('data-lunation');
        var L = cycle.lunations[li];
        state.lunationK = L ? Lunar.kAt(A.jdFromDate(cycle.days[L.startDay - 1].end) - 1e-6)
                            : lunationKOfDay(state.day || todayNumber() || 1);
        setLevel('moon');
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
    /* The moon has its own scene now, so the wheel is never zoomed to a
     * lunation and that argument no longer has anything to say. */
    var t = WheelView.transformFor(cycle, state.level, state.season, null);
    $('wheel').style.transform = t.transform;
    $('hud').style.transform = t.transform;    // kept in lock-step so the sky glyphs track their stations
    $('wheel-svg').classList.toggle('zoomed', !!t.zoomed);
    WheelView.applyRotation($('wheel-svg'), t.rotation || 0);
  }

  function setLevel(level, opts) {
    if (orbitsZoom) orbitsZoom.reset();
    if (monthZoom) monthZoom.reset();
    if (mensesZoom) mensesZoom.reset();
    if (pregZoom) pregZoom.reset();
    if (wheelZoom) wheelZoom.reset();
    if (dayZoom) dayZoom.reset();
    if (moonZoom) moonZoom.reset();
    state.level = level;
    if (global.__syncDayTools) setTimeout(global.__syncDayTools, 0);
    /* Each ring ticks only while its own face is on the stage. */
    if (level !== 'moon') stopMoonClock();
    if (level !== 'day') stopDayRing();
    if (level !== 'month') stopMonthNow();
    if (STRIP_ON) setTimeout(syncViewSwitch, 0);
    if (SKY_ON) setTimeout(syncSystemSwitch, 0);
    if (level !== 'day') stopStripNow();
    if (BODY_ON) {
      if (level !== 'menses' && level !== 'preg') {
        $('menses-flyout').hidden = true;
        $('menses-btn').setAttribute('aria-expanded', 'false');
        $('preg-btn').setAttribute('aria-expanded', 'false');
      }
      $('menses-btn').classList.toggle('is-on', level === 'menses');
      $('preg-btn').classList.toggle('is-on', level === 'preg');
    }
    if (level === 'year') { state.season = null; state.day = null; state.lunationK = null; state.monthRun = null; }
    if (level === 'season') state.lunationK = null;
    if (level === 'season' && state.season === null) {
      state.season = WheelView.seasonOfDay(cycle, state.day || todayNumber() || 1);
    }
    if (level === 'day') {
      if (!state.day) state.day = todayNumber() || 1;
      state.season = WheelView.seasonOfDay(cycle, state.day);
      state.noteOpen = false;
    }
    $('zoom-controls').hidden = false;
    var wheelScene = $('scene-wheel'), dayScene = $('scene-day'), moonScene = $('scene-moon');
    var orbitsScene = $('scene-orbits'), monthScene = $('scene-month');
    var mensesScene = $('scene-menses'), pregScene = $('scene-preg');
    var stripScene = $('scene-strip');

    /* Three scenes share the stage. Whichever the new level wants comes
     * forward and the other two step back, on the same fade the wheel and the
     * day already used between them. */
    function showScene(want) {
      /* A build without the body-cycle wheels has no scenes for them, so
       * they drop out of the rota rather than being looked for. */
      var all = [['orbits', orbitsScene], ['wheel', wheelScene], ['month', monthScene],
                 ['day', dayScene], ['moon', moonScene], ['menses', mensesScene],
                 ['preg', pregScene], ['strip', stripScene]]
                 .filter(function (pair) { return !!pair[1]; });
      var target = all.filter(function (pair) { return pair[0] === want; })[0];
      if (!target) return;

      /* Every scene that is not the wanted one, rather than just the one that
       * happened to be up. Switching faster than the fade used to leave a
       * stale timer to hide only what it remembered, so two scenes could end
       * up drawn over each other: the strip's hours showing through the dial.
       * Sweeping the whole set makes the outcome the same however the clicks
       * are ordered. */
      var showing = all.filter(function (pair) { return !pair[1].hidden; });
      var already = showing.length === 1 && showing[0][0] === want;
      if (already) { if (want === 'wheel') applyZoom(); return; }

      if (!showing.length) {
        target[1].hidden = false;
        target[1].classList.remove('fading');
        if (want === 'wheel') applyZoom();
        return;
      }

      showing.forEach(function (pair) {
        if (pair[0] !== want) pair[1].classList.add('fading');
      });
      sceneSwap = ++sceneSwapId;
      (function (mine) {
        setTimeout(function () {
          if (mine !== sceneSwapId) return;   // a newer switch has taken over
          all.forEach(function (pair) {
            if (pair[0] === want) return;
            pair[1].hidden = true;
            pair[1].classList.remove('fading');
          });
          target[1].hidden = false;
          requestAnimationFrame(function () {
            target[1].classList.remove('fading');
            if (want === 'wheel') applyZoom();
          });
        }, 260);
      })(sceneSwap);
    }

    if (level === 'orbits') {
      drawOrbits();
      showScene('orbits');
      syncCrumbs(); syncLegend(); writeHash();
      return;
    }
    if (level === 'preg') {
      drawPregnancy();
      showScene('preg');
      syncCrumbs(); syncLegend();
      return;
    }
    if (level === 'menses') {
      drawMenses();
      showScene('menses');
      syncCrumbs(); syncLegend();
      return;
    }
    if (level === 'month') {
      if (state.monthRun === null) state.monthRun = monthRunOfDay(state.day || todayNumber() || 1);
      drawMonth();
      showScene('month');
      syncCrumbs(); syncLegend(); writeHash();
      return;
    }
    if (level === 'moon') {
      drawMoon();
      showScene('moon');
      /* The ring zooms and pans like the year wheel, so the stack stays. */
      syncCrumbs(); syncLegend(); writeHash();
      return;
    }
    if (level === 'day') {
      if (STRIP_ON && state.dayView === 'strip') {
        drawStrip();
        showScene('strip');
      } else {
        drawDay();
        showScene('day');
      }
    } else {
      if (!dayScene.hidden) drawWheel();  // refresh note markers set while on the day view
      showScene('wheel');
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
    '<li><i class="sw sw-wheel"></i> The eight stations, each its own colour round the year</li>' +
    '<li><i class="sw sw-sol"></i> Solstice a disc, equinox a ring, midseason a diamond</li>' +
    (NOTES_ON ? '<li><i class="sw sw-noted"></i> A day you\'ve written a note on</li>' : '') +
    '<li><i class="sw sw-sky"></i> The Big Dipper facing north at nightfall</li>' +
    '<li><i class="sw sw-polaris"></i> Polaris, held still by the pointer stars\' dashed sightline</li>' +
    '<li><i class="sw sw-dec"></i> The sun\u2019s declination, turning at &#177;23.4&#176;</li>';

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
    var slot = (state.level === 'menses' || state.level === 'preg') ? null : state.level;
    for (var i = 0; i < cs.length; i++) {
      var lvl = cs[i].getAttribute('data-level');
      cs[i].classList.toggle('is-on', lvl === slot);
    }
    var cS = $('crumb-season'), cM = $('crumb-moon'), cD = $('crumb-day');
    $('crumb-month').disabled = !cycle;
    cS.disabled = !cycle;
    cM.disabled = !cycle;
    cD.disabled = !cycle;
    /* The word alone. Naming the station here spelled out "Summer Solstice"
     * in a trail that already has three other levels in it, and on a phone
     * that is most of the width. Which season is showing is plain from the
     * wheel. */
    cS.textContent = 'Season';
    cM.textContent = 'Lunation';
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
      '</div>' : '';
    if (!d.station && d.inTerm && state.layers.terms) {
      station = '<div class="r-station">Solar term ' + d.inTerm.number + ' of 24 &#183; day ' +
        d.dayInTerm + ' of ' + d.inTerm.days + '</div>';
    }
    if (!d.station && d.frost) {
      station = '<div class="r-station" style="color:var(--frost)">' +
        (d.frost.kind === 'last-frost' ? 'Last spring frost' : 'First autumn frost') + '</div>';
    }
    var hint = state.level === 'year'
      ? 'Click to open this season'
      : state.level === 'season' ? 'Click a day for its 24 hours' : '';

    $('readout').className = 'readout' + (state.readoutMin ? ' min' : '');
    $('readout').innerHTML =
      '<button class="panel-min" id="readout-min" aria-label="' +
        (state.readoutMin ? 'Expand day details' : 'Minimise day details') +
        '" title="' + (state.readoutMin ? 'Expand' : 'Minimise') + '">' +
        (state.readoutMin ? '\u25B4' : '\u25BE') + '</button>' +
      '<div class="r-mini">Day ' + d.n + ' &middot; ' +
        TZ.formatDate(cycle.tz, d.date, 'short') + '</div>' +
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

    /* Rebuilt on every hover, so the listener goes on with it. Stopping the
     * click here keeps it off the wheel behind, which would otherwise read it
     * as a click on whatever day the box happens to be covering. */
    $('readout-min').addEventListener('click', function (e) {
      e.stopPropagation();
      state.readoutMin = !state.readoutMin;
      save(); updateReadout(d.n);
    });
  }
  function row(k, v) { return '<div><span>' + k + '</span> · ' + v + '</div>'; }

  /* Open across redraws, not remembered between visits: it is read once. */
  var dayInfoOpen = false;

  /* What the clock face is doing, for someone meeting it cold. Two things
   * about it are not guessable: the radius carries height rather than being
   * decoration, and peak sun is a position in the sky, not a time of day. */
  function dayInfoHTML() {
    return '<div class="mr-info-panel">' +
      '<p>Round the circle is <b>the day</b>, midnight at the top, clockwise ' +
      'through noon at the foot and back. Distance from the horizon ring is ' +
      '<b>height in the sky</b>: the sun\u2019s line rides outside the ring ' +
      'while it is up and inside it while it is down, so the gold is exactly ' +
      'the part of the day the sun spends above the horizon.</p>' +
      '<p><b>Peak sun</b> is the moment the sun stands highest, given as its ' +
      'angle above the horizon and the time it reaches it. It is not noon. ' +
      'Clock noon belongs to the timezone; the sun keeps its own schedule and ' +
      'drifts either side of the hour across the year.</p>' +
      '<p>Every time here follows the <b>daylight saving</b> switch in the ' +
      'panel. With it off the day is bounded by standard midnights, so it ' +
      'runs a plain 24 hours on the two days a year that otherwise do not.</p>' +
      '<button class="mr-info-more" id="day-info-more">Read more under About</button>' +
      '</div>';
  }

  /* The day's outer ring, redrawn on its own so the whole clock face does not
   * have to be. A minute is plenty: the ring turns a quarter of a degree in
   * that time, and rebuilding 720 samples every second would be absurd. */
  var dayRingTimer = null;
  function tickDayRing() {
    var g = $('day-clock-ring');
    if (!g) { stopDayRing(); return; }
    g.innerHTML = DayView.clock(Date.now());
  }
  function startDayRing() {
    stopDayRing();
    tickDayRing();
    dayRingTimer = setInterval(tickDayRing, 60000);
  }
  function stopDayRing() {
    if (dayRingTimer) { clearInterval(dayRingTimer); dayRingTimer = null; }
  }

  /* When each planet clears the horizon and when it goes back under, and
   * which way to face for both. This is the one planetary question that is
   * genuinely about your patch of ground: the sign a planet is in reads the
   * same from anywhere on earth, but its rising time and bearing are yours
   * alone, and change with every degree of latitude.
   *
   * Where a planet stands along the zodiac now lives on the system map and
   * the ecliptic wheel, where the angle actually means longitude. Keeping it
   * here as well said the same thing twice in a view that cannot draw it.
   */
  function planetsMarkup(d, out) {
    if (!global.Planets || !state.showPlanets) return '';
    var head = '';

    var jdStart = A.jdFromDate(d.date);
    var live = haveRealInstant(d) ? momentFor(d) : null;
    var rows = '';

    Planets.ORDER.forEach(function (nm) {
      var rs = A.riseSet(nm, jdStart, 1, cycle.lat, cycle.lon);
      function leg(word, jdEv) {
        if (!jdEv) return '';
        var pp = Planets.position(nm, A.jdeFromJD(jdEv));
        var L = Planets.lookAt(pp.ra, pp.dec, jdEv, cycle.lat, cycle.lon);
        return word + ' ' + Clock.time(cycle, A.dateFromJD(jdEv), state.useDST, state.hour12) +
          ' <em>' + L.compass + '</em>';
      }
      var legs = [leg('rises', rs && rs.rise), leg('sets', rs && rs.set)]
        .filter(Boolean).join(' &#183; ');
      if (!legs) legs = '<em class="d-pl-down">stays ' +
        ((rs && rs.maxAlt > 0) ? 'up all day' : 'below the horizon') + '</em>';

      var nowLine = '';
      if (live) {
        var pn = Planets.position(nm, A.jdeFromJD(A.jdFromDate(live)));
        var Ln = Planets.lookAt(pn.ra, pn.dec, A.jdFromDate(live), cycle.lat, cycle.lon);
        nowLine = Ln.up
          ? '<b>' + Ln.altitude.toFixed(0) + '&#176; up, ' + Ln.compass + '</b>'
          : '<b class="d-pl-down">under</b>';
      }
      rows += '<div class="d-pl">' +
        '<i class="d-pl-g" style="color:' + PLANET_COLOUR[nm] + '">' +
        Planets.GLYPH[nm] + '</i>' +
        '<span class="d-pl-n">' + nm + '</span>' + nowLine +
        '<span class="d-pl-c">' + legs + '</span></div>';
    });

    return '<div class="d-planets">' + head +
      '<div class="d-pl-list">' + rows + '</div>' +
      '<p class="d-pl-note">Times and bearings are for ' +
      esc(state.place ? (state.place.name || state.place.label) : 'this place') +
      '. Move the place and they all change, which is the whole difference ' +
      'between this and where a planet sits in the zodiac.' +
      (live ? '' : ' Add a time beside the date to see where each one stands at a given moment.') +
      '</p></div>';
  }

  var PLANET_COLOUR = {
    Mercury: '#8fa3b8', Venus: '#c98fb9', Mars: '#d1685a',
    Jupiter: '#c9a24a', Saturn: '#8d8ab5'
  };

  /* What the map is, for someone opening it cold. Kept in the readout's own
   * corner rather than printed under the dial, because it is read once and
   * then wanted out of the way. */
  var orbitsInfoOpen = false;
  function orbitsInfoHTML() {
    /* The panel is shared by two very different pictures, so it has to say
     * which one is being looked at before it explains anything about it. */
    if (SKY_ON && state.systemView === 'here') return earthViewInfoHTML();
    return '<div class="mr-info-panel">' +
      '<p class="mr-info-which">The view <b>from above</b></p>' +
      '<p>You are looking down on the solar system from above the north pole. ' +
      'The sun is at the middle and every planet is where it really is today. ' +
      'The rings are drawn to <b>true scale</b>, which is why the inner four ' +
      'crowd together: that is the shape of the thing. Zoom in on them.</p>' +
      '<p>The <b>dashed lines run from the earth</b> outward through each ' +
      'planet to the band of signs at the edge. That is the whole trick of it. ' +
      'A planet is not <i>in</i> a sign the way a coin is in a pocket: it is ' +
      'simply that when you stand on the earth and look toward Saturn, the ' +
      'stretch of sky behind it is the one called Aries. Move the earth round ' +
      'its orbit and the same planet appears against a different stretch.</p>' +
      '<p>The sun gets a line too, and it is the one that passes through the ' +
      'middle. That is why the sun always appears in the sign opposite where ' +
      'the earth is standing.</p>' +
      '<p><b>Sign</b> and <b>in</b> differ by about a whole sign. The signs ' +
      'are twelve equal cuts from the equinox; the constellations are the real ' +
      'and unequal patches of sky, and the equinox has slid roughly thirty ' +
      'degrees away from them since the signs were named.</p>' +
      '<button class="mr-info-more" id="zodiac-open">Open the ecliptic wheel</button>' +
      '</div>';
  }

  function earthViewInfoHTML() {
    var T = (A.jdeFromJD(A.jdFromDate(new Date())) - 2451545) / 36525;
    var ayan = Planets.ayanamsa(T);
    return '<div class="mr-info-panel">' +
      '<p class="mr-info-which">The view <b>from earth</b></p>' +
      '<p>This is how the sky looks from <b>' +
      esc(state.place ? (state.place.name || state.place.label) : 'here') +
      '</b> at the moment shown. The earth is at the middle and everything ' +
      'else is set round it where it stands from there: which constellation ' +
      'each planet is in front of, and which way to turn to find it.</p>' +

      '<h4>The outer ring: the tropical zodiac</h4>' +
      '<p>Twelve equal thirty-degree cuts, counted from the <b>March ' +
      'equinox</b>. Zero degrees of Aries is defined as the point where the ' +
      'sun crosses the equator going north, so this zodiac is tied to the ' +
      'seasons and to the earth\u2019s tilt rather than to any star. This is ' +
      'the one Western astrology uses.</p>' +

      '<h4>The inner ring: the constellations</h4>' +
      '<p>Not a zodiac at all, but the sky itself: the thirteen constellations ' +
      'the ecliptic really crosses, at their real and very unequal widths. ' +
      'The sun spends six weeks in front of Virgo and about one in front of ' +
      'Scorpius. <b>Ophiuchus</b>, the serpent-bearer, is the thirteenth. It ' +
      'sits between Scorpius and Sagittarius and the sun passes through it ' +
      'every year, from roughly the last days of November. It is left out of ' +
      'both zodiacs because twelve divides a year neatly and thirteen does ' +
      'not, but it is there in the sky whether or not it is counted.</p>' +

      '<h4>The middle ring: the sidereal zodiac, jyotisha</h4>' +
      '<p>Probably the one you recognise if you have a Vedic chart. It cuts ' +
      'twelve equal signs like the tropical zodiac, but counts them from the ' +
      '<b>fixed stars</b> instead of from the equinox, so a sign stays with ' +
      'the stars it was named for. Every body in the list below carries both ' +
      'readings.</p>' +
      '<p>The gap between the two starting points is the <b>ayanamsa</b>, ' +
      'about ' + ayan.toFixed(1) + '\u00b0 today, which is why a Vedic chart ' +
      'so often puts a planet one whole sign back from where a Western one ' +
      'puts it. It grows by roughly fifty arcseconds a year, because the ' +
      'equinox creeps backwards round the ecliptic once every twenty-six ' +
      'thousand years. The two last agreed around the fifth century.</p>' +
      '<p>The middle ring and the inner one both keep to the stars, but they ' +
      'are not the same thing: the sidereal zodiac is twelve equal signs, and ' +
      'the constellations are thirteen unequal patches of real sky.</p>' +

      '<h4>The shaded part</h4>' +
      '<p>Exactly half the ring is above the horizon at any moment and half ' +
      'below, and the whole thing swings round once a day as the earth turns. ' +
      'The <b>darkened stretch is the half under your feet</b>: anything ' +
      'standing in it is there, but you could not see it from here now. The ' +
      'two dashed marks are where the ecliptic cuts the horizon, rising on ' +
      'one side and setting on the other.</p>' +
      '<p>This is why the sun so often sits in the shaded half. At night the ' +
      'sun is below the horizon by definition, and the earth at the middle is ' +
      'lit from whichever side the sun is on.</p>' +
      '<button class="mr-info-more" id="zodiac-open">Open the ecliptic wheel</button>' +
      '</div>';
  }

  /* Which instant the sky is being read for.
   *
   * A moment the reader has chosen wins over everything: that is the whole
   * point of typing a birth time. Otherwise it is the clock if the day on
   * screen is today, and that day's noon if it is not, because "where is Mars
   * right now" has no answer for a Tuesday in 1994 until you say when.
   *
   * Bearings and the two angles need a real instant to mean anything, so they
   * appear whenever there is one, chosen or current, and stay hidden when all
   * we have is an arbitrary noon. */
  function momentFor(d) {
    if (state.moment) {
      var t = new Date(state.moment);
      if (!isNaN(t.getTime())) return t;
    }
    if (!d) return new Date();
    return d.n === todayNumber() ? new Date() : (d.solarNoon || d.date);
  }
  function haveRealInstant(d) {
    return !!state.moment || (!!d && d.n === todayNumber());
  }
  function momentLabel(when) {
    return TZ.formatDate(cycle.tz, when) + ' · ' +
      Clock.time(cycle, when, state.useDST, state.hour12) +
      (state.moment ? ' (chosen)' : '');
  }

  /* ------------------------------------------------------------ the cycle
   *
   * A wheel of its own, because a cycle is its own turning and reads badly as
   * a stripe across somebody else's calendar.
   *
   * The blueprint hangs day one on a new moon, so bleeding sits at the dark
   * and ovulation near the full. That is the old teaching picture rather than
   * a finding: the evidence for real cycles keeping step with the moon is weak
   * and has failed to replicate. Drawing it this way gives a woman something
   * to read her own days against, and the moment she logs her own the wheel
   * will follow her instead.
   */
  function drawMenses() {
    if (!global.MensesView || !cycle) return;
    var length = Menses.BLUEPRINT_DAYS;
    /* No day-frame: the moon ring falls back to the idealised progression,
     * dark at day one and full at the middle, which is the whole point of an
     * example. Real dates arrive with real logged days. */
    var out = MensesView.render({ length: length });
    $('menseswheel').innerHTML = out.svg;

    function showHub(day) {
      var ph = day ? Menses.phaseOfDay(day, length) : null;
      var mn = day ? Menses.moonNoteAt(360 * (day - 1) / length) : null;
      $('mn-hub').innerHTML = MensesView.hub(ph ? [
        { text: 'CYCLE DAY', size: 10, gap: 24, colour: 'var(--ink-3)' },
        { text: String(day), size: 42, serif: true, gap: 24, colour: 'var(--ink)' },
        { text: ph.name, size: 17, serif: true, gap: 20,
          colour: MensesView.COLOUR[ph.key] },
        { text: mn ? mn.name : '', size: 12, gap: 18, colour: 'var(--moon)' }
      ] : [
        { text: 'ONE COMMON CYCLE', size: 10, gap: 26, colour: 'var(--ink-3)' },
        { text: String(length), size: 44, serif: true, gap: 24, colour: 'var(--ink)' },
        { text: 'days, laid on a lunation', size: 12, gap: 20, colour: 'var(--ink-3)' },
        { text: 'an example to read your own against', size: 10, gap: 18,
          colour: 'var(--ink-3)' }
      ]);
      MensesView.highlight($('menseswheel'), day, length);
      state.mensesDay = day;
    }
    showHub(null);

    Array.prototype.forEach.call($('menseswheel').querySelectorAll('.mn-day'),
      function (el) {
        var d = +el.getAttribute('data-day');
        el.addEventListener('mouseenter', function () { showHub(d); });
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openMensesPhase(Menses.phaseOfDay(d, length).key);
        });
      });
    Array.prototype.forEach.call($('menseswheel').querySelectorAll('.mn-horm'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openHormone(el.getAttribute('data-horm'));
        });
      });
    Array.prototype.forEach.call($('menseswheel').querySelectorAll('.mn-moon'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openMoonNote(el.getAttribute('data-moon'));
        });
      });
    Array.prototype.forEach.call($('menseswheel').querySelectorAll('.mn-phase'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openMensesPhase(el.getAttribute('data-phase'));
        });
      });
    $('menseswheel').addEventListener('mouseleave', function () { showHub(null); });

    var spans = Menses.spans(length);
    $('menses-readout').className = 'readout' + (state.mensesMin ? ' min' : '');
    $('menses-readout').innerHTML =
      '<button class="panel-min" id="menses-min" aria-label="' +
        (state.mensesMin ? 'Expand the blueprint' : 'Minimise the blueprint') +
        '" title="' + (state.mensesMin ? 'Expand' : 'Minimise') + '">' +
        (state.mensesMin ? '\u25B4' : '\u25BE') + '</button>' +
      '<div class="r-mini">One common cycle &#183; ' + length + ' days</div>' +
      '<div class="r-lab">One common cycle</div>' +
      '<div class="r-date">' + length + ' days, laid on one lunation</div>' +
      '<div class="r-rows">' + spans.map(function (s) {
        return '<div><span>' + esc(s.phase.name) + '</span> · ' + s.from + '–' + s.to + '</div>';
      }).join('') + '</div>' +
      '<div class="r-key">' + Menses.CURVE_ORDER.map(function (k) {
        return '<button class="r-key-btn" data-horm="' + k + '">' +
          '<i style="background:' + MensesView.HORMONE_COLOUR[k] + '"></i>' +
          esc(Menses.CURVE_LABEL[k]) + '</button>';
      }).join('') + '</div>' +
      '<div class="r-hint">This is <b>one possible shape of a common cycle</b>, ' +
      'not a template. Bleeding is drawn at the dark moon and ovulation near ' +
      'the full because that is the old teaching picture, rather than because ' +
      'cycles are known to follow the moon. <b>Tap a phase</b> for the body, ' +
      '<b>tap the moon ring</b> for the moon read on its own, ' +
      '<b>tap a curve</b> for the hormone behind it.</div>';

    Array.prototype.forEach.call($('menses-readout').querySelectorAll('.r-key-btn'),
      function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          openHormone(b.getAttribute('data-horm'));
        });
      });
    $('menses-min').addEventListener('click', function (e) {
      e.stopPropagation();
      state.mensesMin = !state.mensesMin;
      save(); drawMenses();
    });
  }

  /* The moon read on its own, for the days when the cycle does not explain
   * how someone feels. Two clocks, each with something to say. */
  function openHormone(key) {
    var h = Menses.HORMONE_NOTES[key];
    if (!h) return;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:' + MensesView.HORMONE_COLOUR[key] + '">' +
        esc(h.name) + '</h4>' +
      '<p class="tp-brief">' + esc(h.full) + '</p>' +
      '<h4>What it is</h4><p>' + esc(h.what) + '</p>' +
      '<h4>What it does</h4><p>' + esc(h.role) + '</p>' +
      '<h4>What it feels like</h4><p>' + esc(h.felt) + '</p>' +
      '<h4>Looking after it</h4><p>' + esc(h.support) + '</p>' +
      '<p class="tp-brief">The heights on the wheel are relative, each curve ' +
      'scaled to its own range so four things measured in different units can ' +
      'share one band. The shape and the order are the reading; the levels ' +
      'are not, and they differ between women and between cycles.</p>';
    $('menses-flyout').hidden = false;
  }

  function openMoonNote(key) {
    var m = null;
    Menses.MOON_NOTES.forEach(function (x) { if (x.key === key) m = x; });
    if (!m) return;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:var(--moon)">' + esc(m.name) + '</h4>' +
      '<p class="tp-brief">The moon on its own, beside the cycle rather than ' +
      'inside it.</p>' +
      '<h4>What the classics say</h4><p>' + esc(m.classical) + '</p>' +
      '<h4>Living with it</h4><p>' + esc(m.living) + '</p>' +
      (m.rule ? '<h4>The old clinical rule</h4><p><i>' + esc(m.rule) + '</i></p>' : '') +
      '<p class="tp-brief">These readings are from the Huangdi Neijing, which ' +
      'describes blood and qi as thin at the new moon, filling as it waxes, ' +
      'replete at the full, and draining as it wanes. The Nanjing, a century ' +
      'or so later, ties the moon\'s 29.5 days to the menstrual cycle and to ' +
      'the waxing and waning of kidney jing.</p>' +
      '<p class="tp-brief">It is a framework, not a finding. Modern evidence ' +
      'for the moon acting on the body is weak and has failed to replicate. ' +
      'What it gives you is a second thing to read when your own cycle does ' +
      'not account for how you feel: if a period has finished but everything ' +
      'still feels slow, the moon may be dark, and that is the reading.</p>';
    $('menses-flyout').hidden = false;
  }

  /* ---------------------------------------------------------- forty weeks
   *
   * Counted from the first day of the last period, which is how medicine
   * counts it, so the first fortnight is spent before there is anything to be
   * pregnant with. The wheel says that rather than quietly starting at
   * conception.
   */
  function drawPregnancy() {
    if (!global.PregnancyView) return;
    var out = PregnancyView.render();
    $('pregwheel').innerHTML = out.svg;

    function showHub(week) {
      var t = week ? Pregnancy.trimesterOf(week) : null;
      var st = week ? Pregnancy.stageOf(week) : null;
      var mk = week ? Pregnancy.markAt(week) : null;
      $('pg-hub').innerHTML = PregnancyView.hub(t ? [
        { text: 'WEEK', size: 10, gap: 24, colour: 'var(--ink-3)' },
        { text: String(week), size: 42, serif: true, gap: 24, colour: 'var(--ink)' },
        { text: t.name, size: 14, serif: true, gap: 19, colour: PregnancyView.COLOUR[t.key] },
        { text: st.name, size: 10.5, gap: 17, colour: 'var(--ink-3)' },
        { text: mk ? mk.label : Pregnancy.senseOf(week).name, size: 10.5, gap: 16,
          colour: mk ? 'var(--sun)' : 'var(--ink-3)' }
      ] : [
        { text: 'FORTY WEEKS', size: 10, gap: 24, colour: 'var(--ink-3)' },
        { text: '40', size: 42, serif: true, gap: 22, colour: 'var(--ink)' },
        { text: 'counted from the last period', size: 11.5, gap: 19,
          colour: 'var(--ink-3)' },
        { text: 'hover a week, tap a trimester', size: 10, gap: 18,
          colour: 'var(--ink-3)' }
      ]);
      PregnancyView.highlight($('pregwheel'), week);
    }
    showHub(null);

    Array.prototype.forEach.call($('pregwheel').querySelectorAll('.pg-week'),
      function (el) {
        var w = +el.getAttribute('data-week');
        el.addEventListener('mouseenter', function () { showHub(w); });
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var mk = Pregnancy.markAt(w);
          if (mk) openPregMark(w); else openPregTrimester(Pregnancy.trimesterOf(w).key);
        });
      });
    Array.prototype.forEach.call($('pregwheel').querySelectorAll('.pg-baby'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openPregTrimester(Pregnancy.trimesterOf(
            Pregnancy.STAGES.filter(function (x) {
              return x.key === el.getAttribute('data-stage'); })[0].from).key);
        });
      });
    Array.prototype.forEach.call($('pregwheel').querySelectorAll('.pg-sense'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openPregSense(el.getAttribute('data-sense'));
        });
      });
    Array.prototype.forEach.call($('pregwheel').querySelectorAll('.pg-tri'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openPregTrimester(el.getAttribute('data-tri'));
        });
      });
    Array.prototype.forEach.call($('pregwheel').querySelectorAll('.pg-mark'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openPregMark(+el.getAttribute('data-week'));
        });
      });
    $('pregwheel').addEventListener('mouseleave', function () { showHub(null); });

    $('preg-readout').innerHTML =
      '<div class="r-lab">Forty weeks</div>' +
      '<div class="r-date">counted from the last period</div>' +
      '<div class="r-rows">' + Pregnancy.TRIMESTERS.map(function (t) {
        return '<div><span>' + esc(t.name.split(' ')[0]) + '</span> · weeks ' +
          t.from + '–' + t.to + '</div>';
      }).join('') + '</div>' +
      '<div class="r-key"><button class="r-key-btn" id="ppne-open">' +
      'what reaches the baby, and the field that studies it</button></div>' +
      '<div class="r-hint">The first fortnight is spent before there is ' +
      'anything to be pregnant with: that is how the counting works, rather ' +
      'than an error. <b>Only about five births in a hundred land on the ' +
      'estimated date</b>; seventy fall within ten days of it and ninety ' +
      'within a fortnight. The baby is drawn <b>inside</b> her, with the ring ' +
      'between them showing what can reach it. Hover a week; tap any ring.</div>';

    if ($('ppne-open')) {
      $('ppne-open').addEventListener('click', function (e) {
        e.stopPropagation(); openPPNE();
      });
    }
  }

  function openPregTrimester(key) {
    var t = null;
    Pregnancy.TRIMESTERS.forEach(function (x) { if (x.key === key) t = x; });
    if (!t) return;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:' + PregnancyView.COLOUR[t.key] + '">' +
        esc(t.name) + '</h4>' +
      '<p class="tp-brief">Weeks ' + t.from + ' to ' + t.to + '.</p>' +
      '<h4>The baby</h4><p>' + esc(t.baby) + '</p>' +
      '<h4>The mother</h4><p>' + esc(t.mother) + '</p>' +
      '<h4>What tends to help</h4><p>' + esc(t.helps) + '</p>' +
      '<p class="tp-brief">General information, and no substitute for the ' +
      'people looking after you. Anything that worries you is worth a call ' +
      'rather than a wait.</p>';
    $('menses-flyout').hidden = false;
  }

  /* What can reach the baby, and the field built around that. */
  function openPregSense(key) {
    var sn = null;
    Pregnancy.SENSES.forEach(function (x) { if (x.key === key) sn = x; });
    if (!sn) return;
    var P = Pregnancy.PPNE;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:' + PregnancyView.SENSE_COLOUR[sn.key] + '">' +
        esc(sn.name) + '</h4>' +
      '<p class="tp-brief">Weeks ' + sn.from + ' to ' + sn.to +
        ', in the ring between the baby and the mother.</p>' +
      '<h4>What is measured</h4><p>' + esc(sn.measured) + '</p>' +
      '<h4>What the field makes of it</h4><p>' + esc(sn.ppne) + '</p>' +
      '<button class="mr-info-more" id="ppne-more">Read about the field itself</button>';
    $('menses-flyout').hidden = false;
    if ($('ppne-more')) {
      $('ppne-more').addEventListener('click', function (e) {
        e.stopPropagation(); openPPNE();
      });
    }
  }

  function openPPNE() {
    var P = Pregnancy.PPNE;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0">' + esc(P.name) + '</h4>' +
      '<h4>What it is</h4><p>' + esc(P.what) + '</p>' +
      '<h4>What it holds</h4><p>' + esc(P.holds) + '</p>' +
      '<h4>What the evidence supports</h4><p>' + esc(P.evidence) + '</p>' +
      '<h4>Where to hold it loosely</h4><p>' + esc(P.caution) + '</p>' +
      '<h4>What survives either way</h4><p>' + esc(P.useful) + '</p>' +
      '<ul class="tp-refs">' +
      '<li><a href="https://birthpsychology.com/ppne/" target="_blank" rel="noopener noreferrer">APPPAH, the PPNE programme</a></li>' +
      '<li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4595376/" target="_blank" rel="noopener noreferrer">The maternal voice and infant development</a></li>' +
      '<li><a href="https://www.sciencedirect.com/science/article/abs/pii/S0163638308000866" target="_blank" rel="noopener noreferrer">Fetal sensitivity to maternal speech</a></li>' +
      '<li><a href="https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2024.1379660/full" target="_blank" rel="noopener noreferrer">Maternal speech and neonatal speech encoding</a></li>' +
      '<li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10109481/" target="_blank" rel="noopener noreferrer">Prenatal maternal stress and infant development</a></li>' +
      '</ul>';
    $('menses-flyout').hidden = false;
  }

  function openPregMark(week) {
    var mk = Pregnancy.markAt(week);
    if (!mk) return;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:var(--sun)">Week ' + week + '</h4>' +
      '<p class="tp-brief">' + esc(mk.label) + '</p>' +
      '<p>' + esc(mk.note) + '</p>' +
      '<p class="tp-brief">Weeks are markers, not deadlines. Almost everything ' +
      'here happens across a span rather than on a day, and the spans differ ' +
      'between pregnancies.</p>';
    $('menses-flyout').hidden = false;
  }

  function openMensesPhase(key) {
    var ph = null;
    Menses.PHASES.forEach(function (p) { if (p.key === key) ph = p; });
    if (!ph) return;
    $('menses-prose').innerHTML =
      '<h4 style="margin-top:0;color:' + MensesView.COLOUR[ph.key] + '">' +
        esc(ph.name) + '</h4>' +
      '<p class="tp-brief">Days ' + ph.from + ' to ' + ph.to +
        ' of this example, at the ' + esc(ph.moon) + '.</p>' +
      '<h4>What the hormones do</h4><p>' + esc(ph.hormones) + '</p>' +
      '<h4>What the body does</h4><p>' + esc(ph.body) + '</p>' +
      '<h4>What tends to help</h4><p>' + esc(ph.support) + '</p>' +
      '<h4>Eating for it</h4><p>' + esc(ph.food) + '</p>' +
      '<p class="tp-brief">The hormones and the body are measured. The last ' +
      'two are suggestions, part sense and part Chinese medicine, offered as ' +
      'what tends to suit rather than what you ought to do. On movement in ' +
      'particular the research is mixed: most studies find no reliable change ' +
      'in strength across the cycle, so take how you feel over any schedule.</p>' +
      '<p class="tp-brief">These spans are one common shape, and no more than ' +
      'that. A real cycle moves, and moves most in the stretch before ' +
      'ovulation. Once you log your own days the wheel will follow them.</p>';
    $('menses-flyout').hidden = false;
  }

  /* One month, opened out of the year wheel into its own fan.
   *
   * A level of its own rather than a window, so it can be zoomed, stepped and
   * linked like every other view, and so the trail says where you are. */
  /* The cycle either side of this one, built once and kept.
   *
   * A solar cycle opens and closes mid-December, so the first and last months
   * on the wheel are both stumps: eleven days of December at one end and
   * twenty at the other. Drawn as they fall they look broken, as though the
   * calendar had lost some days. They have not gone anywhere; they belong to
   * the neighbouring cycle, and that cycle numbers them from its own solstice.
   * So the fan borrows them and shows the month whole, with each day carrying
   * the count its own cycle gives it. */
  var neighbours = {};
  function neighbourCycle(dir) {
    var year = state.anchorYear + dir;
    if (neighbours[year] === undefined) {
      try {
        var c = CycleModel.build({
          lat: state.place.lat, lon: state.place.lon, tz: state.place.tz,
          anchorYear: year
        });
        CycleModel.applyFrost(c, state.frost);
        neighbours[year] = c;
      } catch (e) { neighbours[year] = null; }
    }
    return neighbours[year];
  }

  /* One calendar month, complete, however the solar cycle cuts it. */
  function monthDaysFor(idx) {
    var runs = WheelView.monthRuns(cycle);
    var run = runs[idx];
    if (!run) return null;
    var days = cycle.days.slice(run.start - 1, run.end);
    var first = days[0], last = days[days.length - 1];

    if (idx === 0 && first.day > 1) {
      var prev = neighbourCycle(-1);
      if (prev) {
        days = prev.days.filter(function (d) {
          return d.year === first.year && d.month === first.month && d.day < first.day;
        }).concat(days);
      }
    }
    if (idx === runs.length - 1) {
      var next = neighbourCycle(1);
      if (next) {
        days = days.concat(next.days.filter(function (d) {
          return d.year === last.year && d.month === last.month && d.day > last.day;
        }));
      }
    }
    return { run: run, days: days };
  }

  function monthRunOfDay(n) {
    var runs = WheelView.monthRuns(cycle);
    for (var i = 0; i < runs.length; i++) {
      if (n >= runs[i].start && n <= runs[i].end) return i;
    }
    return 0;
  }

  function drawMonth() {
    if (!global.MonthView || !cycle) return;
    var runs = WheelView.monthRuns(cycle);
    var idx = Math.max(0, Math.min(runs.length - 1, state.monthRun || 0));
    state.monthRun = idx;
    var pack = monthDaysFor(idx);
    var run = pack.run;
    var out = MonthView.render(cycle, run, { days: pack.days });
    $('monthfan').innerHTML = out.svg;

    $('month-head').innerHTML =
      '<div class="mh-name">' + esc(TZ.MONTHS[run.month - 1]) +
      ' <span class="mh-year">' + run.year + '</span></div>' +
      '<div class="mh-sub">' + out.days.length + ' days &#183; solar day ' +
      out.days[0].n + ' to ' + out.days[out.days.length - 1].n +
      (out.foreign ? ' &#183; ' + out.foreign + ' from the neighbouring cycle' : '') +
      '</div>';
    $('month-prev').disabled = idx === 0;
    $('month-next').disabled = idx === runs.length - 1;

    var terms = {}, luns = {};
    out.days.forEach(function (d) {
      if (d.inTerm) terms[d.inTerm.number] = d.inTerm.english;
      if (d.lunation) luns[d.lunation.startDay] = 1;
    });
    var tk = Object.keys(terms);
    var events = out.days.filter(function (d) { return d.moonEvent; });
    var stations = out.days.filter(function (d) { return d.station; });
    var rows = '';
    rows += '<div><span>Season</span> · ' +
      ['Winter', 'Spring', 'Summer', 'Autumn'][out.days[0].season] + '</div>';
    rows += '<div><span>Terms</span> · ' + tk.length + '</div>';
    rows += '<div><span>Lunations</span> · ' + Object.keys(luns).length + '</div>';

    $('month-readout').className = 'readout' + (state.monthMin ? ' min' : '');
    $('month-readout').innerHTML =
      '<button class="panel-min" id="month-min" aria-label="' +
        (state.monthMin ? 'Expand month details' : 'Minimise month details') +
        '" title="' + (state.monthMin ? 'Expand' : 'Minimise') + '">' +
        (state.monthMin ? '▴' : '▾') + '</button>' +
      '<div class="r-mini">' + esc(TZ.MONTHS_SHORT[run.month - 1]) + ' ' + run.year +
        ' &#183; ' + out.days.length + ' days</div>' +
      '<div class="r-lab">' + esc(TZ.MONTHS[run.month - 1]) + '</div>' +
      '<div class="r-date">' + esc(tk.map(function (k) { return terms[k]; }).join(' · ')) + '</div>' +
      '<div class="r-rows">' + rows + '</div>' +
      '<div class="r-body"></div>' +
      '<div class="r-hint">Hover a day to read it, click it for its ' +
      'twenty-four hours. The month is the one ring here that owes nothing to ' +
      'the sky; everything else cuts across it as the sun and moon decide.</div>';

    $('month-min').addEventListener('click', function (e) {
      e.stopPropagation();
      state.monthMin = !state.monthMin;
      save(); drawMonth();
    });

    /* The day under the pointer, read out below the fan and marked on it, the
     * way the year wheel behaves. It settles back on the day in hand when the
     * pointer leaves, so the box is never blank. */
    var body = $('month-readout').querySelector('.r-body');
    var sectors = $('monthfan').querySelectorAll('.mv-day');
    /* One spoke through the whole stack, as on the year wheel. Everything
     * that shares the day is lit by the marker passing through it, rather
     * than by each layer being picked out separately. */
    function markDay(n) {
      MonthView.highlight($('monthfan'), out.days, n);
    }
    function showDay(n, iso) {
      var d = iso ? findDay(iso) : cycle.days[n - 1];
      if (!d || !body) return;
      markDay(n);
      var bits = [];
      bits.push('<div class="r-num">' + d.day + '</div>');
      bits.push('<div class="r-lab">' + TZ.weekdayName(cycle.tz, d.date) + ' &#183; solar day ' +
        d.n + '</div>');
      bits.push('<div class="r-rows">' +
        row('Daylight', d.sunAlwaysUp ? 'all day' : d.sunAlwaysDown ? 'none'
          : DayView.hm(d.daylightHours)) +
        (d.sunrise ? row('Sunrise', Clock.time(cycle, d.sunrise, state.useDST, state.hour12)) : '') +
        (d.sunset ? row('Sunset', Clock.time(cycle, d.sunset, state.useDST, state.hour12)) : '') +
        '</div>');
      bits.push('<div class="r-moon">' + MoonGlyph.svg(d.moonAge, 18) + '<span>' +
        Math.round(d.moonIllumination * 100) + '% &#183; ' + esc(d.moonPhaseName) + '</span></div>');
      if (d.inTerm) bits.push('<div class="r-lunation">' + esc(d.inTerm.english) +
        ' &#183; day ' + d.dayInTerm + ' of ' + d.inTerm.days + '</div>');
      if (d.station) bits.push('<div class="r-station">' + esc(d.station.name) + '</div>');
      body.innerHTML = bits.join('');
    }
    function restDay() {
      var n = (state.day && state.day >= run.start && state.day <= run.end)
        ? state.day
        : (todayNumber() >= run.start && todayNumber() <= run.end ? todayNumber() : run.start);
      showDay(n);
    }
    /* A day borrowed from the neighbouring cycle has no entry in this one, so
     * the readout reads it from the slice rather than from cycle.days. */
    var byNumber = {};
    out.days.forEach(function (d) { byNumber[d.n + ':' + d.iso] = d; });

    function findDay(iso) {
      for (var i = 0; i < out.days.length; i++) if (out.days[i].iso === iso) return out.days[i];
      return null;
    }
    Array.prototype.forEach.call(sectors, function (el) {
      var n = +el.getAttribute('data-day');
      var iso = el.getAttribute('data-iso');
      el.addEventListener('mouseenter', function () { showDay(n, iso); });
      el.addEventListener('focus', function () { showDay(n, iso); });
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        /* A borrowed day belongs to the cycle next door, so opening it moves
         * the whole view there rather than pretending it sits in this one. */
        if (!cycle.dayByISO[iso]) { openISO(iso); return; }
        state.day = n;
        setLevel('day');
      });
    });
    $('monthfan').addEventListener('mouseleave', restDay);
    restDay();
    monthDaysNow = out.days;
    startMonthNow(run);
  }

  /* The clock's own position on today's column, kept current while the fan is
   * on the stage. A minute is plenty: the tick moves a fraction of its own
   * width in that time. */
  var monthNowTimer = null, monthDaysNow = [];
  function tickMonthNow(run) {
    var g = document.getElementById('mv-now');
    if (!g || !global.MonthView) { stopMonthNow(); return; }
    g.innerHTML = MonthView.nowMark(cycle, monthDaysNow, new Date());
  }
  function startMonthNow(run) {
    stopMonthNow();
    tickMonthNow(run);
    monthNowTimer = setInterval(function () { tickMonthNow(run); }, 60000);
  }
  function stopMonthNow() {
    if (monthNowTimer) { clearInterval(monthNowTimer); monthNowTimer = null; }
  }

  /* The ecliptic wheel, in its own window because its angle means something
   * different from every other dial on the site. */
  function openZodiac() {
    if (!global.Zodiac) return;
    var d = state.day ? cycle.days[state.day - 1] : null;
    var when = momentFor(d);
    var out = Zodiac.render({
      lat: cycle.lat, lon: cycle.lon, when: when,
      placeName: state.place ? (state.place.name || state.place.label) : '',
      stamp: momentLabel(when)
    });
    $('zodiac-svg').innerHTML = out.svg;
    $('zodiac-meta').textContent =
      'The two rings run about ' + (28.7 - out.precession).toFixed(0) + '° out of step: ' +
      'the constellation Aries now begins that far past the equinox, where the sign ' +
      'Aries begins at 0° by definition. That is nearly a whole sign, and it is why a ' +
      'planet is so often listed in one and standing in front of the other. Ascendant ' +
      'and Midheaven are marked on the rim; house cusps are a convention rather than a ' +
      'measurement and are not drawn.';
    var skyOut = Zodiac.sky({ lat: cycle.lat, lon: cycle.lon, when: when });
    $('sky-svg').innerHTML = skyOut.svg;
    $('sky-meta').textContent =
      'Exactly half the ring is up at any moment, never more and never less: ' +
      skyOut.arcDegrees + ' degrees of it, from horizon to horizon. ' +
      skyOut.visible + ' of the seven bodies are above the horizon right now. ' +
      'The whole arc swings round once a day as the earth turns, so a ' +
      'constellation low in the east now will be overhead in six hours.';
    $('zodiac').hidden = false;
  }

  /* `el.hidden = false` is an HTMLElement property, and an <svg> is not one:
   * on an SVG element the assignment sets a plain JS property and leaves the
   * hidden *attribute* sitting exactly where it was, so the CSS goes on
   * hiding a drawing the code believes it has just revealed. The attribute
   * has to be moved directly.
   */
  function showSvg(el, show) {
    if (!el) return;
    if (show) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
  }

  /* The widest view there is: the system from above, and the lines of sight
   * that turn it into what we see from inside it. */
  function drawOrbits() {
    if (!global.Orrery || !cycle) return;
    var d = state.day ? cycle.days[state.day - 1] : null;
    var when = momentFor(d);

    /* Two pictures of one moment. Only the drawing changes here: the panel
     * underneath is the same list of where each body stands, because that is
     * the same fact whichever side of it you are standing on, and having it
     * change shape with the picture would suggest otherwise. */
    if (SKY_ON && state.systemView === 'here') {
      showSvg($('orrery-svg'), false);
      showSvg($('sky-dome-svg'), true);
      $('sky-dome-svg').innerHTML = Zodiac.render({
        lat: cycle.lat, lon: cycle.lon, when: when, centre: 'earth',
        placeName: state.place ? (state.place.name || state.place.label) : '',
        stamp: momentLabel(when)
      }).svg;
    } else {
      showSvg($('sky-dome-svg'), false);
      showSvg($('orrery-svg'), true);
      $('orrery').innerHTML = Orrery.render({ when: when }).svg;
    }

    /* What the map means from inside it. Each dashed line on the drawing ends
     * somewhere, and this says where: the sign it lands in, and the
     * constellation actually behind that patch of sky. The distance is there
     * because it is the one thing the flat wheel and the sky view cannot
     * show, and it is what makes the picture make sense: Mars is bright this
     * month because it is near, not because it is high. */
    var jdw = A.jdFromDate(when), jdew = A.jdeFromJD(jdw);
    var prew = Planets.precession((jdew - 2451545) / 36525);
    var epsw = A.sunPosition(jdew).obliquity;

    /* Sixteen points rather than eight: "south-west" covers forty-five
     * degrees of sky, which is a lot of horizon to search. */
    var COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                   'S','SSW','SW','WSW','W','WNW','NW','NNW'];
    function compass(az) {
      return COMPASS[Math.round(A.norm360(az) / 22.5) % 16];
    }

    /* Where to actually look, which is the one thing neither ring can say.
     * A direction for something under the horizon would be a direction to
     * look at the ground, so that case says so instead.
     *
     * Taken on the ecliptic itself: the planets stray a degree or two off it
     * in latitude, which moves a bearing by less than the width of a hand
     * held up at arm's length and does not change where to turn. */
    function whereToLook(lon) {
      var eq = Planets.toEquatorial(A.norm360(lon), 0, epsw);
      var alt = A.altitudeOf(eq.ra, eq.dec, jdw, cycle.lat, cycle.lon);
      var az = A.azimuthOf(eq.ra, eq.dec, jdw, cycle.lat, cycle.lon);
      if (alt < -0.5) return { up: false, text: 'below the horizon' };
      return { up: true, text: compass(az) + ' &#183; ' + Math.round(alt) + '&#176; up' };
    }

    var Tw = (jdew - 2451545) / 36525;
    /* The eight names, cut at the quarters and the halves of the quarters,
     * which is where the eye stops seeing one shape and starts seeing the
     * next. */
    function phaseName(age) {
      var names = ['New', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
                   'Full', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
      return names[Math.floor(((age + 22.5) % 360) / 45)];
    }

    function orow(glyph, name, lon, colour, au, extra) {
      var sg = Planets.signOf(lon);
      var vd = Planets.siderealSignOf(lon, Tw);
      var con = Planets.constellationOf(((lon - prew) % 360 + 360) % 360);
      var look = whereToLook(lon);
      return '<div class="o-pl">' +
        '<i class="o-pl-g" style="color:' + colour + '">' + glyph + '</i>' +
        '<span class="o-pl-n">' + name + '</span>' +
        '<b>' + sg.name + ' ' + sg.degree.toFixed(1) + '&#176;</b>' +
        '<span class="o-pl-z"><em>tropical</em> ' + sg.name + ' &#183; ' +
          '<em>sidereal</em> ' + vd.name + ' ' + vd.degree.toFixed(1) + '&#176;</span>' +
        '<span class="o-pl-c">in front of ' + con +
        (au ? ' &#183; ' + au.toFixed(2) + ' AU from earth' : '') + '</span>' +
        (extra ? '<span class="o-pl-x">' + extra + '</span>' : '') +
        '<span class="o-pl-look' + (look.up ? ' is-up' : '') + '">' +
        look.text + '</span></div>';
    }
    var sunp = A.sunPosition(jdew);
    var rows = orow('\u2609', 'Sun', A.norm360(sunp.longitude), 'var(--sun-bright)',
                    sunp.distanceAU);
    /* The moon goes round the earth, not the sun, so it has no orbit on the
     * map from above. It is emphatically in the sky from here, though, and
     * the panel is shared, so it belongs on the list either way. */
    var moonp = A.moonPosition(jdew);
    /* Elongation from the sun: the moon's age in degrees, nought at new and a
     * hundred and eighty at full. It is also the angle the sunlight arrives
     * at, which is why it decides the shape, and both are worth saying. */
    var moonAge = A.norm360(moonp.longitude - sunp.longitude);
    var moonLit = (1 - Math.cos(moonAge * Math.PI / 180)) / 2;
    rows += orow('\u263D', 'Moon', A.norm360(moonp.longitude), 'var(--moon)', null,
      phaseName(moonAge) + ' \u00b7 ' + Math.round(moonLit * 100) + '% lit \u00b7 ' +
      'sun at ' + Math.round(moonAge) + '\u00b0');
    Planets.ORDER.forEach(function (nm) {
      var pp = Planets.position(nm, jdew);
      rows += orow(Planets.GLYPH[nm], nm, pp.longitude, PLANET_COLOUR[nm], pp.distanceAU);
    });

    $('orrery-readout').className = 'readout' + (state.orbitsMin ? ' min' : '') +
      (orbitsInfoOpen ? ' info' : '');
    $('orrery-readout').innerHTML =
      '<button class="mr-info" id="orbits-info" aria-expanded="' + orbitsInfoOpen +
        '" aria-label="What this map is showing" ' +
        'title="What this map is showing">i</button>' +
      '<button class="panel-min" id="orbits-min" aria-label="' +
        (state.orbitsMin ? 'Expand the system details' : 'Minimise the system details') +
        '" title="' + (state.orbitsMin ? 'Expand' : 'Minimise') + '">' +
        (state.orbitsMin ? '\u25B4' : '\u25BE') + '</button>' +
      '<div class="r-mini">The system &#183; ' +
        TZ.formatDate(cycle.tz, when, 'short') + '</div>' +
      (orbitsInfoOpen ? orbitsInfoHTML() : '') +
      '<div class="r-lab">Seen from ' +
        esc(state.place ? (state.place.name || state.place.label) : 'the earth') + '</div>' +
      '<div class="r-date">' + esc(momentLabel(when)) + '</div>' +
      '<div class="o-list">' + rows + '</div>' +
      '<div class="r-hint">Each dashed line runs from the earth through a planet ' +
      'to the sign it appears in. <b>In</b> is the constellation really behind ' +
      'it. Distance is from the earth itself, so it reads the same from any ' +
      'town; the place sets the clock this moment is read on, and it is what ' +
      'the day view and the zodiac wheel use for bearings.</div>';

    $('orbits-min').addEventListener('click', function (e) {
      e.stopPropagation();
      state.orbitsMin = !state.orbitsMin;
      save(); drawOrbits();
    });
    $('orbits-info').addEventListener('click', function (e) {
      e.stopPropagation();
      orbitsInfoOpen = !orbitsInfoOpen;
      drawOrbits();
    });
    if ($('zodiac-open')) {
      $('zodiac-open').addEventListener('click', function (e) {
        e.stopPropagation();
        openZodiac();
      });
    }
  }

  /* The body layer's switch and its legend.
   *
   * Two bands, and they are two different kinds of claim, so the panel says
   * which is which rather than letting the drawing imply they are the same
   * sort of thing. The outer curves are measured chronobiology; the inner
   * watches are a framework from the Huang Di Nei Jing. Both are hung on this
   * place's own solar midnight, which is the one thing they agree on and the
   * reason it is worth drawing here at all. */
  /* Everything the body layer needs to say, in its own drawer on the right.
   *
   * It used to sit in the day panel, where it was buried under the times and
   * kept getting collapsed out of sight. The panel now carries only what is
   * being measured; the reasoning lives here, next to the switch that turns
   * the layer on.
   */
  function bodyPanelHTML(d) {
    var BC = global.BodyClock;
    var ph = null, w = null;
    if (d && d.solarNoon) {
      var when = momentFor(d);
      var sm = new Date(d.solarNoon.getTime() - 12 * 3600000);
      ph = ((when.getTime() - sm.getTime()) / 3600000 % 24 + 24) % 24;
      w = BC.watchAt(ph);
    }
    var live = haveRealInstant(d) ? 'Right now' : 'At midday';

    /* --- the measured band ------------------------------------------- */
    var bio = '<label class="tog tp-switch"><input type="checkbox" id="bio-tog"' +
      (state.showBio ? ' checked' : '') +
      '><span>Hormones &amp; body temperature</span></label>' +
      '<p class="tp-brief">Melatonin, cortisol and your core temperature, drawn ' +
      'as three curves around the outside of the dial. The measured kind, hung ' +
      'on your own solar midnight rather than the clock.</p>';

    if (state.showBio) {
      var levels = '';
      if (ph !== null) {
        var mOn = d.sunset ? ((d.sunset.getTime() - sm.getTime()) / 3600000 % 24 + 24) % 24 + 1 : 19;
        var mOff = d.sunrise ? ((d.sunrise.getTime() - sm.getTime()) / 3600000 % 24 + 24) % 24 + 1 : 6.5;
        levels = [
          ['melatonin', 'var(--moon)', function (x) { return BC.melatonin(x, mOn, mOff); }],
          ['cortisol', 'var(--sun-bright)', BC.cortisol],
          ['core temperature', 'var(--equinox)', BC.temperature]
        ].map(function (L) {
          var v = Math.max(0, Math.min(1, L[2](ph)));
          var ahead = Math.max(0, Math.min(1, L[2](ph + 0.5)));
          var dir = ahead - v > 0.012 ? 'climbing' : v - ahead > 0.012 ? 'falling' : 'level';
          var word = v > 0.85 ? (dir === 'level' ? 'at its peak' : dir)
                   : v < 0.1 ? (dir === 'climbing' ? 'starting to climb' : 'near its floor')
                   : dir;
          return '<div class="tp-lv"><span class="tp-lv-n">' + L[0] + '</span>' +
            '<span class="tp-lv-bar"><i style="width:' + Math.round(v * 100) +
              '%;background:' + L[1] + '"></i></span>' +
            '<span class="tp-lv-v">' + Math.round(v * 100) + '%</span>' +
            '<span class="tp-lv-d">' + word + '</span></div>';
        }).join('');
        bio += '<div class="tp-now"><div class="tp-now-lab">' + live + '</div>' +
          '<div class="tp-levels">' + levels + '</div>' +
          '<p class="tp-lv-note">Modelled from the published phase ' +
          'relationships rather than measured from you. The shape and the ' +
          'timing carry the meaning; read the percentage as roughly where you ' +
          'sit between that curve\'s own low and high.</p></div>';
      }
      bio +=
        '<h4>What these three are</h4>' +
        '<p><b>Melatonin</b> is made in the pineal gland and let go once the clock ' +
        'in your head decides it is dark. It works as an announcement rather ' +
        'than a sedative: word goes out to every tissue at once that night has ' +
        'arrived. Light on the eye hushes it within minutes.</p>' +
        '<p><b>Cortisol</b> comes from the adrenal glands. It frees glucose into ' +
        'the blood, lifts blood pressure and sharpens attention. Its morning ' +
        'rise is more kindness than alarm: it begins in the last hours of sleep ' +
        'so that your body is ready before you are.</p>' +
        '<p><b>Core temperature</b> is your own thermostat, swinging about half a ' +
        'degree across the day. The drift downward into the night helps sleep ' +
        'arrive; the climb through the afternoon carries alertness, reaction ' +
        'speed and strength along with it.</p>' +

        '<h4>How anyone knows this</h4>' +
        '<p>From something called a <b>constant routine</b>. Volunteers stay awake ' +
        'in dim light, half reclined, eating identical small snacks every hour ' +
        'in a room held at one temperature, for a day or longer. With sleep, ' +
        'posture, meals and light all held still, what is left is the rhythm the ' +
        'body keeps on its own. Melatonin read under dim light turns out to be ' +
        'the clearest single marker of where a person\'s clock stands.</p>' +

        '<h4>Why it is only an estimate</h4>' +
        '<p>Light does set the clock, so that instinct is a good one. Cells at the ' +
        'back of the eye carrying <i>melanopsin</i> report daylight straight to ' +
        'the hypothalamus, and morning light pulls the clock earlier while ' +
        'evening light nudges it later.</p>' +
        '<p>The catch is that these markers are pegged to <b>your own sleep</b> ' +
        'rather than to sunrise itself. Melatonin starts climbing about two ' +
        'hours before you usually go to bed, temperature bottoms out an hour or ' +
        'two before you usually wake, and cortisol peaks about half an hour ' +
        'after you get up. The chain runs light, then clock, then sleep, then ' +
        'these.</p>' +
        '<p>So this drawing assumes you live roughly by the sun. If you do, it ' +
        'sits close. If you are up under lamps until one in the morning, the ' +
        'whole set slides hours later than what you see here, and chronotype ' +
        'moves people again on top of that. What stays steady is the <b>spacing ' +
        'between them</b>, and that is what the model is built from.</p>' +

        '<h4>What the research says about eating</h4>' +
        '<p>This is where the tradition and the laboratory shake hands. Insulin ' +
        'sensitivity, beta-cell responsiveness and the thermic effect of food ' +
        'all run <b>higher in the morning</b>, which is to say the same meal ' +
        'costs your body less earlier in the day. Sutton\'s 2018 trial found ' +
        'that simply moving eating earlier improved insulin sensitivity and ' +
        'blood pressure <b>even when nobody lost a gram</b>. Eating late tends ' +
        'the other way.</p>' +
        '<p>Which lands almost exactly on the stomach watch, the two solar hours ' +
        'after dawn that the old cycle names as the time to eat well.</p>' +
        '<ul class="tp-refs">' +
        '<li><a href="https://www.cell.com/cell-metabolism/fulltext/S1550-4131(18)30253-5" target="_blank" rel="noopener noreferrer">Sutton et al. 2018, early time-restricted feeding</a></li>' +
        '<li><a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12252119/" target="_blank" rel="noopener noreferrer">Chrononutrition and energy balance, 2025 review</a></li>' +
        '<li><a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8308587/" target="_blank" rel="noopener noreferrer">Early dinner and 24-hour glucose</a></li>' +
        '<li><a href="https://www.sciencedirect.com/science/article/pii/S2451994422000062" target="_blank" rel="noopener noreferrer">Constant routine protocols</a></li>' +
        '<li><a href="https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0017860" target="_blank" rel="noopener noreferrer">The light-sensing cells that set the clock</a></li>' +
        '</ul>' +
        '<p class="tp-brief">The moon stays out of this one. The evidence there is ' +
        'genuinely unsettled, having failed to replicate more than once, and ' +
        'once in the opposite direction.</p>';
    }

    /* --- the traditional band ----------------------------------------- */
    var organs = '<label class="tog tp-switch"><input type="checkbox" id="organ-tog"' +
      (state.showOrgans ? ' checked' : '') +
      '><span>The twelve organ watches</span></label>' +
      '<p class="tp-brief">The <i>zi wu liu zhu</i> of Chinese medicine: twelve ' +
      'two-hour watches, each with an organ and a character to it, out of the ' +
      'Huang Di Nei Jing. A traditional frame rather than a measurement, and ' +
      'always reckoned by the sun.</p>';

    if (state.showOrgans) {
      if (w) {
        organs += '<div class="tp-now">' +
          '<div class="tp-now-lab">' + live + ' &#183; the ' + esc(w.branch) + ' watch</div>' +
          '<div class="tp-now-organ">' + esc(w.organ) + '</div>' +
          '<div class="tp-now-best">' + esc(w.best) + '</div>' +
          (w.avoid ? '<div class="tp-now-avoid">Easier another hour: ' + esc(w.avoid) + '</div>' : '') +
          '</div>';
      }
      /* All twelve as a list, which is the dependable way in on a phone: the
       * ring is under nine pixels deep at that size, well below a comfortable
       * touch target. The clock times beside each also make plain how far the
       * solar reckoning sits from the hour numerals. */
      organs += '<p class="tp-brief">The twelve, as they fall on your clock ' +
        'today. Their classical hours are solar ones, so they drift off the ' +
        'clock by your longitude inside the timezone, by daylight saving, and ' +
        'by the equation of time. Here that comes to over an hour, which is why ' +
        'the ring sits away from the hour numerals: the ring follows the sun, ' +
        'and the numerals follow the timezone.</p>' +
        '<ul class="tp-watches">' + BC.WATCHES.map(function (x, j) {
        var ck = watchClock(j, d);
        return '<li><button data-watch="' + j + '"' +
          (w === x ? ' class="is-now"' : '') + '>' +
          '<span class="tw-organ">' + esc(x.organ) + '</span>' +
          '<span class="tw-branch">' + esc(x.branch) + '</span>' +
          '<span class="tw-hours">' + esc(ck || x.hours) + '</span></button></li>';
      }).join('') + '</ul>' +

      '<p class="tp-brief">Twice a year, on the daylight saving changeovers, ' +
      'the day really does run 23 or 25 hours. On those two days the watches ' +
      'narrow or widen a little and one of them appears at both ends of the ' +
      'ring, so you will count thirteen.</p>';
      organs +=
        '<h4>Zi and wu</h4>' +
        '<p><i>Zi</i> is the double hour around midnight, when yin is at its ' +
        'fullest, and yin is what governs sleep. <i>Wu</i> is the double hour ' +
        'around noon, when yang is fullest and yin begins gathering again. The ' +
        'whole cycle is named after the pair of them: <i>zi wu liu zhu</i>, ' +
        'midnight-noon flowing and pouring. They are the gold ticks on the ring.</p>' +
        '<p>The ring is measured from those two poles, darkest and brightest, ' +
        'and divided out from there at two-hour intervals.</p>' +
        '<p><b>Click any watch</b> on the ring to see what it governs, what suits ' +
        'it, what sits badly, and why.</p>' +
        '<p class="tp-brief">Take all of it lightly. It marks when things tend to ' +
        'come easiest, and a great deal of good living happens at the wrong ' +
        'hour anyway.</p>' +
        '<ul class="tp-refs">' +
        '<li><a href="https://chinesemedicineatlas.com/tcm-body-clock/" target="_blank" rel="noopener noreferrer">The horary cycle, and its solar reckoning</a></li>' +
        '</ul>';
    }

    return '<p class="tp-intro">Two ways of reading the same day. They come ' +
      'from different places, so they sit apart here. Turn on whichever one you ' +
      'feel like looking at.</p>' +
      '<div class="tp-sec">' + bio + '</div>' +
      '<div class="tp-sec">' + organs + '</div>' +
      ((state.showBio || state.showOrgans)
        ? '<p class="tp-brief tp-foot">Both hang on this place\'s own <b>solar</b> ' +
          'midnight and noon rather than the clock. The horary cycle has always ' +
          'been read by solar time, and your body takes its cue from light, so ' +
          'a timezone makes a poor peg for either.</p>'
        : '');
  }

  function planetsPanelHTML() {
    return '<label class="tog tp-switch"><input type="checkbox" id="planet-tog"' +
      (state.showPlanets ? ' checked' : '') + '><span>Draw it on the dial</span></label>' +
      '<p>Each planet leaves two marks on the dial: one where it clears the ' +
      'horizon and one where it slips back under, lined up with the hour, the ' +
      'same way moonrise and moonset are drawn. The arrow shows which way it is ' +
      'crossing and the label carries the time.</p>' +
      '<p>This is the one planetary question that belongs to your own patch of ' +
      'ground. Where a planet sits in the zodiac reads the same from anywhere ' +
      'on earth, while the hour it rises and the direction you turn to catch ' +
      'it are yours alone, shifting with every degree of latitude. For the ' +
      'positions, open the <b>System</b> view.</p>';
  }

  /* When a watch actually falls today, on this place's clock.
   *
   * The hours in the table are solar hours, and solar time drifts from clock
   * time by longitude within the timezone, by daylight saving, and by the
   * equation of time. At this longitude that runs past an hour, which reads as
   * an error if the ring is compared against the hour numerals with no real
   * times printed anywhere. So they are printed. */
  function watchClock(i, d) {
    if (!d || !d.solarNoon) return '';
    var sm = new Date(d.solarNoon.getTime() - 12 * 3600000);
    var a = new Date(sm.getTime() + (i * 2 - 1) * 3600000);
    var b = new Date(sm.getTime() + (i * 2 + 1) * 3600000);
    return Clock.time(cycle, a, state.useDST, state.hour12) + ' to ' +
           Clock.time(cycle, b, state.useDST, state.hour12);
  }

  /* One watch, opened from the ring or from the list. */
  function openWatch(i) {
    var w = global.BodyClock && global.BodyClock.WATCHES[i];
    if (!w) return;
    var wd = state.day ? cycle.days[state.day - 1] : null;
    var wclock = watchClock(i, wd);
    $('watch-h').textContent = w.organ;
    $('watch-when').textContent = 'The ' + w.branch + ' watch · ' + w.animal +
      ' · ' + w.hours + ' by the sun' +
      (wclock ? ' · today that is ' + wclock : '');
    $('watch-body').innerHTML =
      (w.pole ? '<p class="watch-pole">' + esc(w.pole) + '</p>' : '') +
      '<h3>Suits it</h3><p>' + esc(w.best) + '</p>' +
      (w.avoid ? '<h3>Easier another hour</h3><p>' + esc(w.avoid) + '</p>' : '') +
      '<h3>Why</h3><p>' + esc(w.why) + '</p>';
    $('watch').hidden = false;
  }

  /* One day forward or back, in the same shape as stepping a lunation.
   *
   * The cycle runs solstice to solstice, so its ends are real edges rather
   * than places to wrap round: walking off either one moves to the
   * neighbouring cycle and lands on the day next to where you were, which is
   * what "the next day" means to anyone who is not thinking about solstices.
   */
  function stepDayBy(delta) {
    var n = (state.day || todayNumber() || 1) + delta;

    if (n < 1 || n > cycle.length) {
      var goingOn = n > cycle.length;
      state.anchorYear += goingOn ? 1 : -1;
      rebuild(function () {
        state.day = goingOn ? 1 : cycle.length;
        state.season = WheelView.seasonOfDay(cycle, state.day);
        state.noteOpen = false;
        redrawDay(); drawWheel(); syncChrome(); syncCrumbs(); writeHash();
      });
      return;
    }

    state.day = n;
    state.season = WheelView.seasonOfDay(cycle, state.day);
    state.noteOpen = false;
    save();
    redrawDay();
    syncCrumbs();
    writeHash();
  }

  function drawDay() {
    var d = cycle.days[state.day - 1];
    if (!d) return;
    var out = DayView.render(cycle, d, { hour12: state.hour12, useDST: state.useDST,
      now: new Date(), placeName: state.place ? (state.place.name || state.place.label) : '',
      planets: state.showPlanets, bio: state.showBio, organs: state.showOrgans,
      schedule: PLAN_ON ? { iso: d.iso, events: Planner.onDate(d.iso, todayISO()) } : null });
    $('dayclock').innerHTML = out.svg + '<g id="day-clock-ring"></g>';
    startDayRing();
    if (PLAN_ON) bindSchedule(d.iso);
    /* Once now, and once more after the scene has finished fading in: until
     * it has, the panel is still hidden and measures as nothing at all, which
     * would leave the switch sitting on top of where it lands. */
    if (STRIP_ON) { setTimeout(placeViewSwitch, 0); setTimeout(placeViewSwitch, 320); }

    var stationHTML = '';
    if (d.station) stationHTML += '<div class="d-station">' + d.station.name +
      (d.station.alt ? ' <span style="opacity:.6">/ ' + d.station.alt + '</span>' : '') + '</div>';
    if (d.inTerm) stationHTML += '<div class="d-term">Solar term ' + d.inTerm.number +
      ' of 24 &#183; day ' + d.dayInTerm + ' of ' + d.inTerm.days + '</div>';
    if (d.frost) stationHTML += '<div class="d-term" style="color:var(--frost)">' +
      (d.frost.kind === 'last-frost' ? 'Last spring frost' : 'First autumn frost') +
      (cycle.frost.isEstimate ? ' (estimate)' : '') + '</div>';
    if (d.moonEvent) stationHTML += '<div class="d-term">' + d.moonEvent + '</div>';

    $('day-panel').className = 'day-panel' + (state.panelMin ? ' min' : '') +
      (dayInfoOpen ? ' info' : '');
    $('day-panel').innerHTML =
      '<button class="mr-info" id="day-info" aria-expanded="' + dayInfoOpen +
        '" aria-label="What this clock is showing" ' +
        'title="What this clock is showing">i</button>' +
      '<button class="panel-min" id="panel-min" aria-label="' +
        (state.panelMin ? 'Expand day details' : 'Minimise day details') +
        '" title="' + (state.panelMin ? 'Expand' : 'Minimise') + '">' +
        (state.panelMin ? '▴' : '▾') + '</button>' +
      '<div class="d-mini">Day ' + d.n + ' &middot; ' +
        TZ.formatDate(cycle.tz, d.date, 'short') + '</div>' +
      (dayInfoOpen ? dayInfoHTML() : '') +
      '<div class="d-of">Day</div>' +
      '<div class="d-num">' + d.n + '</div>' +
      '<div class="d-of">of ' + cycle.length + '</div>' +
      '<div class="d-step">' +
        '<button class="moon-arrow day-prev" id="day-prev" aria-label="Previous day" ' +
          'title="Previous day">\u2039</button>' +
        '<div class="d-date">' + TZ.formatDate(cycle.tz, d.date) + '</div>' +
        '<button class="moon-arrow day-next" id="day-next" aria-label="Next day" ' +
          'title="Next day">\u203a</button>' +
      '</div>' +
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
      planetsMarkup(d, out) +
      clockShiftMarkup(d) +
      noteMarkup(d.iso);

    $('panel-min').addEventListener('click', function () {
      state.panelMin = !state.panelMin;
      if (STRIP_ON) setTimeout(placeViewSwitch, 0);
      save(); drawDay();
    });
    Array.prototype.forEach.call($('dayclock').querySelectorAll('.organ-hit'),
      function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          openWatch(+el.getAttribute('data-watch'));
        });
      });
    $('day-info').addEventListener('click', function (e) {
      e.stopPropagation();
      dayInfoOpen = !dayInfoOpen;
      drawDay();
    });
    if (dayInfoOpen) {
      $('day-info-more').addEventListener('click', function (e) {
        e.stopPropagation();
        $('about').hidden = false;
        var all = $('about').querySelectorAll('h3'), h = all[0];
        for (var i = 0; i < all.length; i++) {
          if (/accuracy/i.test(all[i].textContent)) { h = all[i]; break; }
        }
        h.scrollIntoView({ block: 'start' });
      });
    }
    /* After the panel's markup, not before it: the arrows live inside it and
     * do not exist until it has been written. */
    bindDayStep();
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
    return 'Lunation ' + L.yearMoonNumber +
           (cycle.yearMoonCount ? ' of ' + cycle.yearMoonCount : '') +
           ' · ' + L.shortLabel + (L.isBlue ? ' · blue moon' : '') +
           ' · day ' + d.dayInLunation + (L.complete ? ' of ' + L.days : '');
  }


  /* ------------------------------------------------------------ lunar month
   * The moon is not a subdivision of the solar year. Twelve of its months
   * fall eleven days short of a year and thirteen overshoot, so nothing here
   * is anchored to a solstice: months come from the continuous chain in
   * lunar.js and are named afterwards, by the year holding their full moon.
   * Stepping is k-1 and k+1, so it runs as far back or forward as anyone
   * cares to go, and the two calendars are joined only by the dates they
   * happen to share. */
  function moonCtx() {
    return { lat: state.place.lat, lon: state.place.lon, tz: state.place.tz,
             anchorMode: cycle ? cycle.anchorMode : 'local' };
  }
  /* Which month a calendar day belongs to. Read at the day's end rather than
   * its middle: a new moon falling in the afternoon still opens that day's
   * month, but midday would come before it and answer with the month before. */
  function lunationKOfDay(n) {
    var d = cycle && cycle.days[n - 1];
    if (!d) return Lunar.kAt(A.jdFromDate(new Date()));
    return Lunar.kAt(A.jdFromDate(d.end) - 1e-6);
  }
  function todayISO() { return cycle ? TZ.formatDate(cycle.tz, new Date(), 'iso') : null; }
  function selectedISO() {
    var d = cycle && state.day ? cycle.days[state.day - 1] : null;
    return d ? d.iso : null;
  }

  /* The span, with its years shown. A lunation that opens in December and
   * closes in January sits in two calendar years, and "Dec 8 to Jan 6" leaves
   * the reader to guess which January. Both years are named when they differ,
   * one when they do not. */
  function spanLabel(tz, from, to) {
    var y0 = TZ.civilParts(tz, from).year, y1 = TZ.civilParts(tz, to).year;
    var a = TZ.formatDate(tz, from, 'short'), b = TZ.formatDate(tz, to, 'short');
    return y0 === y1 ? a + ' to ' + b + ', ' + y0
                     : a + ', ' + y0 + ' to ' + b + ', ' + y1;
  }

  function moonHeadHTML(m, days) {
    var tz = state.place.tz;
    var selISO = selectedISO(), sel = null;
    for (var i = 0; i < days.length; i++) if (days[i].iso === selISO) { sel = days[i]; break; }
    var sub = [m.shortLabel];
    if (m.isBlue) sub.push('blue moon');
    sub.push(spanLabel(tz, days[0].date, days[days.length - 1].date));
    /* Counted in the moon's own unit. Every lunation is thirty tithis, which
     * is what makes it a whole cycle; the day span above already says how
     * many calendar days that came to. */
    sub.push('30 lunar days');
    var line3 = sel
      ? 'Lunar day ' + sel.dayInMonth + ' of ' + days.length +
        ' &#183; ' + TZ.formatDate(tz, sel.date)
      : 'Pick a day to open its twenty-four hours';
    return '<div class="mh-name">Lunation ' + m.number + ' of ' + m.count +
             ' <span class="mh-year">' + m.yearLabel + '</span></div>' +
           '<div class="mh-sub">' + sub.map(esc).join(' &#183; ') + '</div>' +
           '<div class="mh-day">' + line3 + '</div>';
  }

  /* The day under the cursor, described below the circle. Both calendars are
   * named on it: the standard date, and where the day falls in the solar
   * cycle. A month either side of a solstice reaches into the neighbouring
   * cycle, and those days have no number in the one on screen, so they say
   * which side they fell out on rather than showing a wrong one. */
  /* The two calendars each get a day, named for whose day it is. The lunar
   * day is the tithi: twelve degrees of the moon's elongation from the sun,
   * thirty to a lunation, 19 to 26 hours each. "Tithi" is kept as the
   * technical name in the tooltip and in the About; the label itself says
   * what it is, so a reader meeting it for the first time is not stopped. */
  var DAY_WORD = { lab: 'Lunar day', of: 'of 30' };

  /* Open across redraws, since the readout is rebuilt on every hover. Not
   * remembered between visits: it is a thing you read once. */
  var moonInfoOpen = false;

  /* The short version, for someone meeting two kinds of day at once. The long
   * version is under About, one click away. */
  function moonInfoHTML() {
    return '<div class="mr-info-panel">' +
      '<p><b>Lunar day</b> is the moon\u2019s own unit, the <i>tithi</i>: twelve ' +
      'degrees of its angle from the sun. Thirty of them make the full circle, ' +
      'so a lunation always holds exactly thirty, never twenty-nine.</p>' +
      '<p>They are not equal in length. The moon runs faster when it is nearer ' +
      'the Earth, so one lasts anywhere from 20 to 27 hours. Exact in angle, ' +
      'uneven in time.</p>' +
      '<p><b>Solar day</b> is the ordinary 24-hour day, numbered 1 to ' +
      (cycle ? cycle.length : 365) + ' from the winter solstice. The two units ' +
      'belong to unrelated motions and will never divide into one another, ' +
      'which is why the standard date is kept below as the anchor.</p>' +
      '<button class="mr-info-more" id="moon-info-more">Read more under About</button>' +
      '</div>';
  }

  function moonReadoutHTML(d, monthDays) {
    if (!d) return '';
    var tz = state.place.tz;
    var solar = cycle.dayByISO[d.iso];
    var where;
    if (solar) where = 'Day ' + solar.n + ' of ' + cycle.length;
    else if (d.iso < cycle.days[0].iso) where = 'in the cycle before this one';
    else where = 'in the cycle after this one';

    /* Face first, then what that face is called, then the day of the solar
     * cycle set large, the way the day panel sets it, because that number is
     * the anchor into the other calendar and was previously the smallest
     * thing in the box. The standard date follows it, then the weekday, then
     * where the day sits in the lunation. */
    return '<div class="mr-facerow">' +
        '<button class="mr-step" data-step="-1" aria-label="Previous day" title="Previous day">\u2039</button>' +
        '<span class="mr-face">' + MoonGlyph.svg(d.moonAge, 40) + '</span>' +
        '<button class="mr-step" data-step="1" aria-label="Next day" title="Next day">\u203A</button>' +
      '</div>' +
      /* On the four turning points the phase carries the same words as the
       * event, so it is drawn once, marked, rather than twice. On every other
       * day the name stands plain. */
      '<div class="mr-phase">' +
        (d.moonEvent === d.moonPhaseName
          ? '<span class="mr-event">' + esc(d.moonEvent) + '</span>'
          : esc(d.moonPhaseName) +
            (d.moonEvent ? ' <span class="mr-event">' + esc(d.moonEvent) + '</span>' : '')) +
      '</div>' +
      /* This is the lunation's view, so the lunation's own day is what gets
       * set large. The solar day follows underneath as the tie back to the
       * 365, and the standard date under that. */
      '<div class="mr-solar" title="A lunar day, or tithi, is 12 degrees of the ' +
          'moon\u2019s elongation from the sun: thirty to a lunation, 19 to 26 hours each">' +
        '<span class="mr-lab">' + DAY_WORD.lab + '</span>' +
        '<b>' + d.tithi + '</b>' +
        '<span class="mr-lab">' + DAY_WORD.of + '</span>' +
      '</div>' +
      /* Three reckonings, in the order they matter here: the tithi above,
       * then the day of the solar cycle, then the standard date. The tithi
       * cannot anchor anything by itself, since it does not land one to one
       * on days, so the other two stay and each is labelled for what it
       * counts. */
      '<div class="mr-date">' +
        (solar ? 'Solar day ' + solar.n + ' of ' + cycle.length
               : esc(where.charAt(0).toUpperCase() + where.slice(1))) + '</div>' +
      /* Said in full rather than as two bare verbs. "Opens 07:50, runs 26.0 h"
       * left it unclear what was opening and on which date; this names the
       * lunar day as the thing, and the date it begins on sits below. */
      (d.startJD
        ? '<div class="mr-sub">begins ' +
            Clock.time(cycle, d.start, state.useDST, state.hour12) +
            ' and lasts ' + d.hours.toFixed(1) + ' hours</div>'
        : '') +
      '<div class="mr-refs">' +
        '<div class="mr-ref mr-ref-date"><b>' + esc(TZ.formatDate(tz, d.date)) + '</b>' +
          '<em>' + esc(TZ.weekdayName(tz, d.date)) + '</em>' +
          '<span>standard date</span></div>' +
      '</div>';
  }

  /* ------------------------------------------------------- the lunar clock
   *
   * A lunar day is the same lunar day everywhere on earth at a given instant,
   * because it is defined by the angle between the moon and the sun rather
   * than by anything local. So this clock reads the same in every timezone,
   * which no solar clock does. It runs uneven, 20 to 27 hours a day, and the
   * countdown is to the moment the angle next crosses a multiple of twelve
   * degrees.
   *
   * Solving for the boundaries costs eighty evaluations of the moon's
   * position, for two numbers that change once a day, so they are held until
   * this instant crosses one of them. Per tick it is then arithmetic. */
  var moonClockTimer = null, tithiHeld = null;

  function currentTithi() {
    var jd = A.jdFromDate(new Date());
    if (!tithiHeld || jd < tithiHeld.startJD || jd >= tithiHeld.endJD) {
      tithiHeld = Lunar.tithiAt(new Date());
    }
    var span = tithiHeld.endJD - tithiHeld.startJD;
    return {
      k: tithiHeld.k, n: tithiHeld.n,
      startJD: tithiHeld.startJD, endJD: tithiHeld.endJD,
      hours: span * 24,
      fraction: (jd - tithiHeld.startJD) / span,
      msElapsed: (jd - tithiHeld.startJD) * 86400000,
      msRemaining: (tithiHeld.endJD - jd) * 86400000
    };
  }

  function tickMoonClock() {
    var g = $('moon-clock');
    if (!g || !MoonView.frame) { stopMoonClock(); return; }
    var info = currentTithi();
    var fr = MoonView.frame;
    var jd = A.jdFromDate(new Date());
    var ang = 360 * (jd - fr.t0) / fr.span;
    /* The boundaries are held between crossings, but the angle itself has to
     * be fresh: it is the thing being counted. One evaluation a second. */
    var elong = A.moonPhase(A.jdeFromJD(jd)).age;
    g.innerHTML = MoonView.clock(info, {
      onThisWheel: ang >= 0 && ang <= 360, angle: ang,
      countdown: state.lunarCountdown, elongation: elong
    });
    /* The face is a shortcut to the same switch the panel carries. Rebuilt
     * every second, so the listener goes on with it. */
    var hit = $('moon-clock-hit');
    if (hit) hit.addEventListener('click', function (e) {
      e.stopPropagation();
      state.lunarCountdown = !state.lunarCountdown;
      $('lunar-countdown').checked = state.lunarCountdown;
      save(); tickMoonClock();
    });
  }
  function startMoonClock() {
    stopMoonClock();
    tickMoonClock();
    moonClockTimer = setInterval(tickMoonClock, 1000);
  }
  function stopMoonClock() {
    if (moonClockTimer) { clearInterval(moonClockTimer); moonClockTimer = null; }
  }

  function drawMoon(focusISO) {
    if (!state.place) return;
    if (state.lunationK === null) state.lunationK = lunationKOfDay(state.day || todayNumber() || 1);
    var ctx = moonCtx();
    var m = Lunar.month(state.lunationK, ctx);
    /* Thirty tithis, not 29 or 30 days: a lunation counted in the moon's own
     * unit is a whole cycle every time. The wheel's angle is the elongation,
     * so each segment is exactly the twelve degrees a tithi is defined as. */
    var days = Lunar.tithisOf(state.lunationK, ctx);
    /* The ring marks whichever day the box is describing. Stepping with the
     * day arrows is a deliberate move, so the mark follows it; hovering only
     * changes the box, since the mark chasing the pointer would flicker. */
    var focus = focusISO || selectedISO();
    $('moonwheel').innerHTML = MoonView.render(m, days, {
      tz: ctx.tz, selectedISO: focus, todayISO: todayISO(),
      apsides: Lunar.apsidesIn(days[0].startJD, days[days.length - 1].endJD),
      phaseMarks: Lunar.phaseMarksOf(state.lunationK),
      /* The outer ring needs the day of the solar cycle for each date it
       * draws, and a lunation reaching past a solstice will contain dates the
       * cycle on screen does not hold, which simply go unnumbered. */
      solarDayFor: function (iso) {
        var dd = cycle.dayByISO[iso];
        return dd ? dd.n : null;
      }
    });
    startMoonClock();
    $('moon-head').innerHTML = moonHeadHTML(m, days);
    $('moon-prev').disabled = false;      // the chain has no ends
    $('moon-next').disabled = false;

    /* The readout answers to the pointer, and settles back on the day in hand
     * when the pointer leaves, so it is never blank. */
    var byISO = {};
    days.forEach(function (d) { byISO[d.iso] = d; });
    /* The circle's arrows step a whole lunation; these step one day, and run
     * off the ends into the neighbouring month rather than stopping, since
     * the chain does not stop either. */
    var shown = null;
    function showDay(iso) {
      shown = iso;
      var d0 = byISO[iso];
      $('moon-readout').className = 'moon-readout' + (state.moonMin ? ' min' : '') +
        (moonInfoOpen ? ' info' : '');
      $('moon-readout').innerHTML =
        '<button class="mr-info" id="moon-info" aria-expanded="' + moonInfoOpen +
          '" aria-label="What a lunar day is" title="What a lunar day is">i</button>' +
        '<button class="panel-min" id="moon-min" aria-label="' +
          (state.moonMin ? 'Expand day details' : 'Minimise day details') + '" title="' +
          (state.moonMin ? 'Expand' : 'Minimise') + '">' +
          (state.moonMin ? '\u25B4' : '\u25BE') + '</button>' +
        '<div class="mr-mini">' + (d0 ? esc(TZ.formatDate(state.place.tz, d0.date, 'short')) +
          ' &#183; ' + DAY_WORD.lab.toLowerCase() + ' ' + d0.n : '') + '</div>' +
        (moonInfoOpen ? moonInfoHTML() : '') +
        moonReadoutHTML(d0, days.length);
      $('moon-info').addEventListener('click', function (e) {
        e.stopPropagation();
        moonInfoOpen = !moonInfoOpen;
        showDay(shown);
      });
      if (moonInfoOpen) {
        $('moon-info-more').addEventListener('click', function (e) {
          e.stopPropagation();
          $('about').hidden = false;
          var h = $('about').querySelector('h3');
          var all = $('about').querySelectorAll('h3');
          for (var i = 0; i < all.length; i++) {
            if (/lunar day/i.test(all[i].textContent)) { h = all[i]; break; }
          }
          h.scrollIntoView({ block: 'start' });
        });
      }
      $('moon-min').addEventListener('click', function (e) {
        e.stopPropagation();
        state.moonMin = !state.moonMin;
        save(); showDay(shown);
      });
      Array.prototype.forEach.call($('moon-readout').querySelectorAll('.mr-step'), function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          stepDay(+b.getAttribute('data-step'));
        });
      });
    }
    function stepDay(delta) {
      var i = -1;
      for (var j = 0; j < days.length; j++) if (days[j].iso === shown) { i = j; break; }
      if (i < 0) return;
      var next = i + delta;
      if (next >= 0 && next < days.length) {
        var iso = days[next].iso;
        if (cycle.dayByISO[iso]) state.day = cycle.dayByISO[iso].n;
        drawMoon(iso);
        syncCrumbs();
        writeHash();
        return;
      }
      // off the end: carry into the neighbouring lunation and redraw the circle
      state.lunationK += delta;
      var nd = Lunar.tithisOf(state.lunationK, moonCtx());
      var edge = delta > 0 ? nd[0] : nd[nd.length - 1];
      if (cycle.dayByISO[edge.iso]) state.day = cycle.dayByISO[edge.iso].n;
      drawMoon(edge.iso);
      syncCrumbs();
      writeHash();
    }
    function restDay() {
      var sel = focusISO || selectedISO(), tod = todayISO();
      showDay(byISO[sel] ? sel : (byISO[tod] ? tod : days[0].iso));
    }
    restDay();

    var hits = $('moonwheel').querySelectorAll('.moon-day-hit');
    for (var i = 0; i < hits.length; i++) {
      hits[i].addEventListener('click', function (e) {
        openISO(e.currentTarget.getAttribute('data-iso'));
      });
      hits[i].addEventListener('mouseenter', function (e) {
        showDay(e.currentTarget.getAttribute('data-iso'));
      });
      hits[i].addEventListener('focus', function (e) {
        showDay(e.currentTarget.getAttribute('data-iso'));
      });
    }
    $('moonwheel').addEventListener('mouseleave', restDay);
  }

  /* Open a date in the day view, moving to another solar cycle first if the
   * date belongs to one. A month either side of a solstice holds days from
   * two cycles, so this is the ordinary case at both ends of such a month,
   * not an edge case. */
  function openISO(iso) {
    if (!iso || !cycle) return;
    if (cycle.dayByISO[iso]) { state.day = cycle.dayByISO[iso].n; setLevel('day'); return; }
    var parts = iso.split('-');
    var when = TZ.instantFromCivil(cycle.tz, +parts[0], +parts[1], +parts[2], 12, 0, 0);
    state.anchorYear = anchorYearFor(when, state.place.lat, state.place.tz);
    /* rebuild defers the work a tick so the loading state can paint, so the
     * new cycle only exists inside its callback. Reading `cycle` straight
     * after the call gets the old one and lands on the wrong day. */
    rebuild(function () {
      var d = cycle.dayByISO[iso];
      if (d) { state.day = d.n; setLevel('day'); }
    });
  }

  /* The moon scene reserves room at its foot for the readout that floats
   * there. A fixed share of the screen is the wrong measure: the card is tall
   * when open and one line when folded, and a fixed reserve means folding it
   * away buys the circle nothing. Measuring the card and reserving exactly
   * that means the circle grows into the room the moment it is given up. */
  function sizeMoonReserve() {
    var scene = $('scene-moon'), ro = $('moon-readout');
    if (!scene || !ro) return;
    var h = ro.offsetHeight;
    if (!h) return;
    scene.style.paddingBottom = (h + 26) + 'px';
  }

  function stepMoon(delta) {
    state.lunationK += delta;
    /* Carry the selection into the month arrived at, so its middle keeps
     * showing a day that is actually on screen. */
    var ctx = moonCtx();
    var days = Lunar.daysOf(state.lunationK, ctx);
    var edge = days[delta > 0 ? 0 : days.length - 1];
    if (cycle.dayByISO[edge.iso]) state.day = cycle.dayByISO[edge.iso].n;
    else state.day = null;
    drawMoon();
    syncCrumbs();
    writeHash();
  }

  /* ------------------------------------------------------- quick-find lists
   * Two indexes into the cycle: the moons, and the eight seasonal stations.
   * Both are just views onto data already computed for the wheel, and every
   * row jumps straight to that day. */
  var toolOpen = null;

  /* All four turning points of every lunation in the cycle, filtered by which
   * kinds are switched on. Quarters were absent before, which made the list a
   * list of two phases rather than of the moon's year. */
  function moonListItems() {
    return cycle.days
      .filter(function (d) { return d.moonEvent && state.moonPhases[d.moonEvent]; })
      .map(function (d) {
        /* The seasonal label already carries the word, so pairing it with a
         * running count read "Lunation 1 · Winter Lunation 1". Full and new
         * now name the lunation once and say which of the two this is. */
        /* The seasonal label now names the phase itself, so the old "· full"
         * and "· new" suffixes would say it twice. */
        var name = d.moonEvent === 'Full Moon' ? (d.fullMoonSeasonLabel || d.moonEvent)
                 : d.moonEvent === 'New Moon'  ? (d.newMoonSeasonLabel || d.moonEvent)
                 : d.moonEvent;
        return {
          n: d.n, name: name,
          date: TZ.formatDate(cycle.tz, d.date),
          sub: (d.isBlueMoon ? 'blue moon \u00B7 ' : '') +
               Math.round(d.moonIllumination * 100) + '% lit \u00B7 ' +
               Math.round(d.moonDistanceKm).toLocaleString() + ' km',
          glyph: MoonGlyph.svg(d.moonAge, 17)
        };
      });
  }

  /* All eight, in the order the moon walks them, with the elongation each one
   * sits at. The chip is the moon's own shape at that elongation rather than
   * its name: eight names will not fit the panel, eight faces will, and a
   * picture of a waxing crescent says waxing crescent faster than the words
   * do. Drawn, not typed, for the same reason the wheel's marks are: a moon
   * character arrives as colour emoji on half the machines that meet it. */
  var PHASE_FILTERS = [
    ['New Moon', 'New moon', 0], ['Waxing Crescent', 'Waxing crescent', 45],
    ['First Quarter', 'First quarter', 90], ['Waxing Gibbous', 'Waxing gibbous', 135],
    ['Full Moon', 'Full moon', 180], ['Waning Gibbous', 'Waning gibbous', 225],
    ['Last Quarter', 'Last quarter', 270], ['Waning Crescent', 'Waning crescent', 315]
  ];
  function phaseFilterHTML() {
    return '<div class="phase-filter" role="group" aria-label="Which phases to list">' +
      PHASE_FILTERS.map(function (p) {
        return '<label class="pf-opt" title="' + esc(p[1]) + '">' +
               '<input type="checkbox" data-phase="' + p[0] + '" aria-label="' + esc(p[1]) + '"' +
               (state.moonPhases[p[0]] ? ' checked' : '') + '>' +
               '<span>' + MoonGlyph.svg(p[2], 22) + '</span></label>';
      }).join('') + '</div>';
  }

  /* The same key the wheel uses: each station's own colour, and the shape
   * that says which kind it is. A disc stands for a solstice, a ring for an
   * equinox, a diamond for a midseason. */
  function stationSwatch(s) {
    var c = 'var(--st-' + s.offset + ')';
    if (s.kind === 'solstice') {
      return '<svg class="st-sw" viewBox="0 0 16 16" aria-hidden="true">' +
             '<circle cx="8" cy="8" r="6" fill="' + c + '"/></svg>';
    }
    if (s.kind === 'equinox') {
      return '<svg class="st-sw" viewBox="0 0 16 16" aria-hidden="true">' +
             '<circle cx="8" cy="8" r="5.2" fill="none" stroke="' + c + '" stroke-width="2.4"/></svg>';
    }
    return '<svg class="st-sw" viewBox="0 0 16 16" aria-hidden="true">' +
           '<path d="M8 1.6L14.4 8L8 14.4L1.6 8Z" fill="' + c + '"/></svg>';
  }

  function stationListItems() {
    return cycle.stations.filter(function (s) { return s.dayNumber; }).map(function (s) {
      var d = cycle.days[s.dayNumber - 1];
      return {
        n: s.dayNumber, name: s.name,
        date: TZ.formatDate(cycle.tz, d.date),
        sub: s.alt,
        glyph: stationSwatch(s)
      };
    });
  }

  var syncDayTools = function () {};

  function openTool(kind) {
    if (toolOpen === kind) { closeTool(); return; }

    /* Two of these drawers are lists and two are prose. The prose ones carry
     * the reasoning for a day-view layer along with its switch, which is
     * where it belongs: in the day panel it was buried under the times and
     * collapsed out of sight with them. */
    function wireToolProse(k) {
      [['bio-tog', 'showBio'], ['organ-tog', 'showOrgans'],
       ['planet-tog', 'showPlanets']].forEach(function (pair) {
        var box = $(pair[0]);
        if (!box) return;
        box.addEventListener('change', function () {
          state[pair[1]] = box.checked;
          save(); syncDayTools(); drawDay();
          var d3 = state.day ? cycle.days[state.day - 1] : null;
          $('tool-panel-prose').innerHTML =
            k === 'body' ? bodyPanelHTML(d3) : planetsPanelHTML();
          wireToolProse(k);
        });
      });
    }

    if (kind === 'body' || kind === 'planets') {
      var d = state.day ? cycle.days[state.day - 1] : null;
      $('tool-panel-title').textContent = kind === 'body' ? 'The body clock' : 'The planets';
      $('tool-panel-filter').hidden = true;
      $('tool-panel-list').innerHTML = '';
      $('tool-panel-prose').innerHTML = kind === 'body' ? bodyPanelHTML(d) : planetsPanelHTML();
      $('tool-panel-prose').hidden = false;
      $('tool-panel').hidden = false;
      $('tool-panel').classList.add('is-prose');
      toolOpen = kind;
      $('tool-' + kind).setAttribute('aria-expanded', 'true');
      wireToolProse(kind);
      Array.prototype.forEach.call(
        $('tool-panel-prose').querySelectorAll('.tp-watches button'),
        function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            openWatch(+btn.getAttribute('data-watch'));
          });
        });
      return;
    }
    $('tool-panel-prose').hidden = true;
    $('tool-panel').classList.remove('is-prose');

    var items = kind === 'moon' ? moonListItems() : stationListItems();
    var todayN = todayNumber();
    $('tool-panel-title').textContent = kind === 'moon'
      ? 'Phases of this cycle' : 'Solstices, equinoxes and midseasons';
    $('tool-panel-filter').innerHTML = kind === 'moon' ? phaseFilterHTML() : '';
    $('tool-panel-filter').hidden = kind !== 'moon';
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
      : '<li class="tool-panel-empty">' + (kind === 'moon'
          ? 'No phases selected.' : 'Nothing to list for this cycle.') + '</li>';

    Array.prototype.forEach.call($('tool-panel-filter').querySelectorAll('input[data-phase]'),
      function (el) {
        el.addEventListener('change', function () {
          state.moonPhases[el.getAttribute('data-phase')] = el.checked;
          save();
          toolOpen = null;        // so openTool redraws rather than closing
          openTool('moon');
        });
      });

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
    $('tool-planets').setAttribute('aria-expanded', 'false');
    $('tool-body').setAttribute('aria-expanded', 'false');
    $('tool-panel').classList.remove('is-prose');
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
    if (!NOTES_ON) return '';
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
    if (!NOTES_ON) return;
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

  /* ---------------------------------------------------------------- strip --
   * The day as a column. Same numbers as the dial, laid down a line instead
   * of round a circle, which is what a phone's shape actually wants.
   */
  /* The two arrows exist on both faces of the day, so they are wired in one
   * place and simply skipped wherever they are not on screen. */
  function bindDayStep() {
    var p = $('day-prev'), n = $('day-next');
    if (p) p.addEventListener('click', function (e) { e.stopPropagation(); stepDayBy(-1); });
    if (n) n.addEventListener('click', function (e) { e.stopPropagation(); stepDayBy(1); });
  }

  function drawStrip() {
    var d = cycle.days[state.day - 1];
    if (!d || !STRIP_ON) return;

    var b = DayView.bands(cycle, d, { useDST: state.useDST });
    var now = Date.now();
    var nowF = (now >= b.start.getTime() && now < b.end.getTime())
      ? (now - b.start.getTime()) / b.span : null;

    var evs = PLAN_ON ? Planner.onDate(d.iso, todayISO()) : [];
    $('stripwrap').innerHTML =
      '<div class="st-head">' +
        '<div class="st-head-row">' +
          '<button class="moon-arrow day-prev" id="day-prev" aria-label="Previous day" ' +
            'title="Previous day">\u2039</button>' +
          '<div class="st-head-text">' +
            '<strong>' + esc(TZ.formatDate(cycle.tz, d.date, 'long')) + '</strong>' +
            '<span class="meta">Day ' + d.n + ' of ' + cycle.length +
            ' &middot; light ' + DayView.hm(d.daylightHours) + '</span>' +
          '</div>' +
          '<button class="moon-arrow day-next" id="day-next" aria-label="Next day" ' +
            'title="Next day">\u203a</button>' +
        '</div>' +
      '</div>' +
      StripView.render(b, {
        events: evs, hour12: state.hour12, nowFraction: nowF,
        organs: state.showOrgans ? organBandsForStrip(b) : null
      }) +
      (PLAN_ON ? StripView.untimed(evs) : '');

    bindDayStep();
    if (PLAN_ON) bindStrip(d.iso);
    startStripNow(b);
  }

  /* The organ clock's two-hour watches, placed on the strip by the same
   * fractions everything else uses. */
  function organBandsForStrip(b) {
    if (!global.BodyClock || !global.BodyClock.watches) return null;
    var out = [];
    (global.BodyClock.watches || []).forEach(function (w) {
      if (w.startMin == null) return;
      out.push({ f1: b.fractionOfMinute(w.startMin),
                 f2: b.fractionOfMinute(w.endMin),
                 label: w.organ || w.label || '', short: (w.organ || '').slice(0, 2),
                 colour: w.colour });
    });
    return out.length ? out : null;
  }

  /* The now line creeps rather than jumping, but a minute is close enough for
   * a day that is fourteen hundred pixels tall. */
  var stripNowTimer = null;
  function startStripNow(b) {
    stopStripNow();
    stripNowTimer = setInterval(function () {
      var el = $('stripwrap') && $('stripwrap').querySelector('.st-now');
      if (!el) { stopStripNow(); return; }
      var now = Date.now();
      if (now < b.start.getTime() || now >= b.end.getTime()) { stopStripNow(); return; }
      el.style.top = (100 * (now - b.start.getTime()) / b.span).toFixed(3) + '%';
    }, 60000);
  }
  function stopStripNow() {
    if (stripNowTimer) { clearInterval(stripNowTimer); stripNowTimer = null; }
  }

  function bindStrip(iso) {
    var wrap = $('stripwrap');
    Array.prototype.forEach.call(
      wrap.querySelectorAll('.st-slot, .st-ev, .st-allday, .st-task'),
      function (el) {
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var id = el.getAttribute('data-event');
          if (id) openScheduleEditor(iso, id, null);
          else openScheduleEditor(iso, null, +el.getAttribute('data-hour-min'));
        });
      });
    Array.prototype.forEach.call(wrap.querySelectorAll('.st-check'), function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var id = el.getAttribute('data-check');
        Planner.setDone(id, el.getAttribute('aria-checked') !== 'true', iso);
        drawStrip();
        drawWheel();
      });
    });

    var add = $('st-add-untimed');
    if (add) add.addEventListener('click', function (ev) {
      ev.stopPropagation();
      openScheduleEditor(iso, null, null, true);   // straight to a no-time thing
    });
  }

  /* Redraws whichever face of the day is showing, so a save from the editor
   * lands in the right place without either view knowing about the other. */
  function redrawDay() {
    if (STRIP_ON && state.dayView === 'strip') drawStrip(); else drawDay();
  }

  /* The system has two faces: the map from outside, and the sky from inside.
   * Same planets, same instant, opposite vantage. */
  function wireSystemSwitch() {
    if (!SKY_ON || !$('system-switch')) return;
    function pick(which) {
      if (state.systemView === which) return;
      state.systemView = which;
      save();
      drawOrbits();
      syncSystemSwitch();
      writeHash();
    }
    $('system-above').addEventListener('click', function () { pick('above'); });
    $('system-here').addEventListener('click', function () { pick('here'); });
    syncSystemSwitch();
  }
  function syncSystemSwitch() {
    if (!SKY_ON || !$('system-switch')) return;
    $('system-switch').hidden = state.level !== 'orbits';
    $('system-above').setAttribute('aria-pressed', String(state.systemView === 'above'));
    $('system-here').setAttribute('aria-pressed', String(state.systemView === 'here'));
  }

  function wireViewSwitch() {
    if (!STRIP_ON) return;
    function pick(which) {
      if (state.dayView === which) return;
      state.dayView = which;
      save();
      syncViewSwitch();
      if (state.level === 'day') setLevel('day');
    }
    $('view-circle').addEventListener('click', function () { pick('dial'); });
    $('view-strip').addEventListener('click', function () { pick('strip'); });
    syncViewSwitch();
  }
  function syncViewSwitch() {
    if (!STRIP_ON || !$('view-switch')) return;
    var sw = $('view-switch');
    sw.hidden = state.level !== 'day';
    $('view-circle').setAttribute('aria-pressed', String(state.dayView === 'dial'));
    $('view-strip').setAttribute('aria-pressed', String(state.dayView === 'strip'));
    if (!sw.hidden) placeViewSwitch();
  }

  /* On a phone the switch lives at the bottom, where the day panel also
   * lives. The panel's height changes with what is in it and with whether it
   * has been expanded, so the switch is measured off the panel's real top
   * rather than guessed at, and moves when the panel does. */
  function placeViewSwitch() {
    var sw = $('view-switch');
    if (!sw || sw.hidden) return;
    if (window.innerWidth > 560) { sw.style.bottom = ''; return; }
    var panel = (state.dayView === 'dial') ? $('day-panel') : null;
    if (!panel || panel.hidden || !panel.offsetHeight) {
      sw.style.bottom = '';
      return;
    }
    var gap = window.innerHeight - panel.getBoundingClientRect().top + 8;
    sw.style.bottom = Math.round(gap) + 'px';
  }

  /* ------------------------------------------------------------- schedule --
   * Clicking an empty hour on the schedule ring opens an editor already set
   * to that hour, because the commonest thing to want is the hour you just
   * pointed at. Clicking an event opens the same editor on that event.
   */
  var scEditorOpen = null;   // the id being edited, or 'new'

  function bindSchedule(iso) {
    /* The targets a finger actually lands on are the wide invisible ones. A
     * hit that names an event edits it; one that names an hour starts a new
     * thing at that hour. The visible arc is bound too, for a mouse. */
    Array.prototype.forEach.call($('dayclock').querySelectorAll('.sc-hit, .sc-ev'),
      function (el) {
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var id = el.getAttribute('data-event');
          if (id) openScheduleEditor(iso, id, null);
          else openScheduleEditor(iso, null, +el.getAttribute('data-hour-min'));
        });
      });
  }

  function closeScheduleEditor() {
    ['sc-editor', 'sc-scrim'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    document.removeEventListener('keydown', scEscape);
    scEditorOpen = null;
  }
  function scEscape(ev) { if (ev.key === 'Escape') closeScheduleEditor(); }

  function openScheduleEditor(iso, id, atMin, wantUntimed) {
    closeScheduleEditor();
    var e = id ? Planner.get(id) : null;
    /* An event opened from a day it merely runs through is still that one
     * event: edits go to the record on the date it actually began. */
    if (e && e.date !== iso) iso = e.date;
    var draft = e ? {
      title: e.title, allDay: e.allDay, untimed: e.untimed, colour: e.colour,
      startMin: e.startMin, endMin: e.endMin
    } : {
      title: '', allDay: false, untimed: !!wantUntimed, colour: 'amber',
      startMin: atMin == null ? 540 : atMin,
      endMin: (atMin == null ? 540 : atMin) + 60
    };
    /* Timed, all day, or no hour at all: one choice of three rather than two
     * checkboxes that could contradict each other. */
    var when = draft.untimed ? 'untimed' : (draft.allDay ? 'allday' : 'timed');
    scEditorOpen = id || 'new';

    var box = document.createElement('div');
    box.className = 'sc-editor';
    box.id = 'sc-editor';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', e ? 'Edit event' : 'Add an event');
    box.innerHTML =
      '<h3>' + (e ? 'Edit' : 'On this day') + '</h3>' +
      '<label for="sc-title">What</label>' +
      '<input type="text" id="sc-title" placeholder="Dentist, seed the beds, call Mum" ' +
        'value="' + esc(draft.title) + '" maxlength="120">' +
      '<label>When</label>' +
      '<div class="sc-when" id="sc-when" role="group">' +
        [['timed', 'At a time'], ['allday', 'All day'], ['untimed', 'No set time']]
          .map(function (o) {
            return '<button data-when="' + o[0] + '" aria-pressed="' +
                   (when === o[0]) + '">' + o[1] + '</button>';
          }).join('') +
      '</div>' +
      '<div class="sc-times' + (when === 'timed' ? '' : ' is-off') + '" id="sc-times">' +
        '<div><label for="sc-start">From</label>' +
        '<input type="time" id="sc-start" value="' + Planner.hhmm(draft.startMin) + '"></div>' +
        '<div><label for="sc-end">Until</label>' +
        '<input type="time" id="sc-end" value="' + Planner.hhmm(draft.endMin) + '"></div>' +
      '</div>' +
      '<p class="sc-span" id="sc-span"></p>' +
      '<label>Colour</label>' +
      '<div class="sc-swatches">' +
        Planner.COLOURS.map(function (c) {
          return '<button class="sc-sw" data-colour="' + c + '" aria-label="' + c +
                 '" aria-pressed="' + (c === draft.colour) +
                 '" style="background:var(--sc-' + c + ')"></button>';
        }).join('') +
      '</div>' +
      '<div class="sc-actions">' +
        (e ? '<button class="sc-del" id="sc-del" aria-label="Delete">Delete</button>' : '') +
        '<button id="sc-cancel">Cancel</button>' +
        '<button class="sc-save" id="sc-save">Save</button>' +
      '</div>' +
      scheduleListMarkup(iso, id);
    var scrim = document.createElement('div');
    scrim.className = 'sc-scrim';
    scrim.id = 'sc-scrim';
    scrim.addEventListener('click', closeScheduleEditor);
    document.body.appendChild(scrim);
    document.body.appendChild(box);

    var chosen = draft.colour;
    Array.prototype.forEach.call(box.querySelectorAll('.sc-sw'), function (b) {
      b.addEventListener('click', function () {
        chosen = b.getAttribute('data-colour');
        Array.prototype.forEach.call(box.querySelectorAll('.sc-sw'), function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll('.sc-when button'), function (b) {
      b.addEventListener('click', function () {
        when = b.getAttribute('data-when');
        Array.prototype.forEach.call(box.querySelectorAll('.sc-when button'), function (o) {
          o.setAttribute('aria-pressed', String(o === b));
        });
        $('sc-times').classList.toggle('is-off', when !== 'timed');
        syncSpan();
      });
    });
    /* Jumping to another event from the list keeps the editor open rather
     * than making someone close this one and hunt for that one on the ring. */
    Array.prototype.forEach.call(box.querySelectorAll('.sc-list li'), function (li) {
      li.addEventListener('click', function () {
        openScheduleEditor(iso, li.getAttribute('data-event'), null);
      });
    });

    /* Says out loud what an until-time earlier than its from-time means, so
     * "23:00 until 06:00" is visibly a night rather than a mistake. */
    function syncSpan() {
      var el = $('sc-span');
      if (!el) return;
      var a = Planner.parseHHMM($('sc-start').value);
      var b = Planner.parseHHMM($('sc-end').value);
      if (when !== 'timed' || a === null || b === null) { el.textContent = ''; return; }
      var mins = b <= a ? (b + 1440) - a : b - a;
      el.textContent = (b <= a ? 'Runs past midnight into the next day \u00b7 ' : '') +
        Math.floor(mins / 60) + 'h' + (mins % 60 ? ' ' + (mins % 60) + 'm' : '');
    }
    $('sc-start').addEventListener('input', syncSpan);
    $('sc-end').addEventListener('input', syncSpan);
    syncSpan();

    function commit() {
      var fields = {
        title: $('sc-title').value,
        allDay: when === 'allday',
        untimed: when === 'untimed',
        colour: chosen,
        startMin: Planner.parseHHMM($('sc-start').value),
        endMin: Planner.parseHHMM($('sc-end').value)
      };
      if (fields.startMin === null) fields.startMin = draft.startMin;
      if (fields.endMin === null) fields.endMin = draft.endMin;
      if (e) Planner.update(e.id, fields); else Planner.create(iso, fields);
      closeScheduleEditor();
      redrawDay();
      drawWheel();
    }
    $('sc-save').addEventListener('click', commit);
    $('sc-title').addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') commit();
    });
    $('sc-cancel').addEventListener('click', closeScheduleEditor);
    if ($('sc-del')) $('sc-del').addEventListener('click', function () {
      Planner.remove(e.id);
      closeScheduleEditor();
      redrawDay();
      drawWheel();
    });
    document.addEventListener('keydown', scEscape);
    /* On a phone the keyboard rises over the lower half as soon as this gains
     * focus, so the box is scrolled back into view once it has. */
    setTimeout(function () {
      $('sc-title').focus();
      if (box.scrollIntoView) box.scrollIntoView({ block: 'center' });
    }, 0);
  }

  /* Everything else already on this day, so the ring is not the only way to
   * find something small or short. */
  function scheduleListMarkup(iso, exceptId) {
    var all = Planner.onDate(iso).filter(function (e) { return e.id !== exceptId; });
    if (!all.length) return '';
    return '<ul class="sc-list">' + all.map(function (e) {
      return '<li data-event="' + esc(e.id) + '">' +
        '<i class="dot" style="background:var(--sc-' + e.colour + ')"></i>' +
        '<span>' + esc(e.title || 'Untitled') + '</span>' +
        '<span class="when">' + (e.untimed ? 'no time' : e.allDay ? 'all day'
          : Planner.hhmm(e.startMin) + '–' + Planner.hhmmDay(e.endMin)) + '</span></li>';
    }).join('') + '</ul>';
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

  /* Backup and restore of the whole notes file. Wired only in a build that
   * has notes, since the panel section it drives is removed otherwise. */
  function wireNotesBackup() {
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
  }

  function syncNotesCount() {
    if (!NOTES_ON) return;
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

  /* Anywhere on earth, by three routes. The built-in list answers instantly
   * and offline. Coordinates typed straight in need nothing at all. Anything
   * else goes to an open geocoder a third of a second after typing stops, and
   * its answers are appended to whatever the list already found, so the fast
   * path is never held up waiting for the slow one. */
  function wirePlaceSearch() {
    var input = $('place-input'), list = $('place-results');
    var shown = [], seq = 0, timer = null;
    function close() { list.hidden = true; list.innerHTML = ''; shown = []; }

    function draw(res) {
      shown = res;
      if (!res.length) { close(); return; }
      list.innerHTML = res.map(function (p, i) {
        return '<li data-i="' + i + '">' + esc(p.name) +
          '<small>' + esc(p.region) + (p.coords ? '' : ' · ' + esc(p.tz)) + '</small></li>';
      }).join('');
      list.hidden = false;
      Array.prototype.forEach.call(list.children, function (li) {
        li.addEventListener('mousedown', function (e) {
          e.preventDefault();
          var p = shown[+li.getAttribute('data-i')];
          close();
          state.level = 'year'; state.season = null; state.day = null;
          setPlace(p);
        });
      });
    }

    /* Two entries are the same place if they sit within a few kilometres of
     * each other, or if they carry the same name in the same region. A
     * gazetteer often holds a village twice, as the settlement and as the
     * parish around it, far enough apart to pass a distance test and
     * indistinguishable to a reader looking at a list. */
    function same(a, b) {
      if (a.label.toLowerCase() === b.label.toLowerCase()) return true;
      return Math.abs(a.lat - b.lat) < 0.05 && Math.abs(a.lon - b.lon) < 0.05;
    }

    input.addEventListener('input', function () {
      var q = input.value;
      if (timer) { clearTimeout(timer); timer = null; }

      var coord = Places.parseCoords(q);
      if (coord) { draw([coord]); return; }

      var local = Places.search(q, 6);
      draw(local);

      if (q.trim().length < 2) return;
      var mine = ++seq;
      timer = setTimeout(function () {
        Places.lookup(q, 8).then(function (remote) {
          if (mine !== seq || input.value !== q) return;      // a later keystroke won
          var merged = local.slice();
          remote.forEach(function (r) {
            for (var i = 0; i < merged.length; i++) if (same(merged[i], r)) return;
            merged.push(r);
          });
          if (merged.length) draw(merged);
          else draw([]);
        });
      }, 320);
    });
    input.addEventListener('focus', function () { input.select(); });
    input.addEventListener('blur', function () { setTimeout(close, 140); });
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
      state.moment = null;                     // back to the sky as it is
      $('goto-time').value = '';
      $('goto-meta').textContent = GOTO_HINT;
      save();
      var go = function () {
        var n = todayNumber();
        if (n) { state.day = n; setLevel(state.level === 'orbits' ? 'orbits' : 'day'); }
      };
      if (y !== state.anchorYear) { state.anchorYear = y; rebuild(go); } else go();
    });

    var GOTO_HINT = 'Any date, past or future, in this place\'s own calendar. ' +
      'Add a time to fix the sky to that exact moment.';

    /* A date alone lands on the day; a date with a time fixes the sky to that
     * instant, which is what a birth chart needs. The time is read in the
     * selected place's zone, so for a birth moment set the place to the town
     * it happened in first and the offsets of the day take care of themselves.
     *
     * Without a time we still use local noon internally, because it keeps the
     * day placement clear of the changeover hours, but nothing then claims to
     * know where a planet stood: bearings and the two angles stay hidden. */
    function goToDate() {
      var val = $('goto-date').value;                    // "YYYY-MM-DD" or ""
      var m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) { $('goto-meta').textContent = 'Pick a date first.'; return; }
      var tval = $('goto-time').value;                   // "HH:MM" or ""
      var tm = tval.match(/^(\d{2}):(\d{2})$/);
      var y = +m[1], mo = +m[2], d = +m[3];
      var hh = tm ? +tm[1] : 12, mi = tm ? +tm[2] : 0;
      var target = TZ.instantFromCivil(state.place.tz, y, mo, d, hh, mi, 0);
      var anchorYear = anchorYearFor(target, state.place.lat, state.place.tz);
      var go = function () {
        var n = CycleModel.dayNumberForInstant(cycle, target);
        if (!n) { $('goto-meta').textContent = 'Could not place that date. Try another.'; return; }
        state.day = n;
        state.moment = tm ? target.toISOString() : null;
        save();
        /* Stay where the reader is. Someone who typed a birth time while
         * looking at the system map wants the system map for that moment,
         * not to be dropped into the day view. */
        setLevel(state.level === 'orbits' ? 'orbits' : 'day');
        $('goto-meta').textContent = tm
          ? 'Reading the sky for ' + momentLabel(target) + '. "Go to today" clears it.'
          : GOTO_HINT;
      };
      if (anchorYear !== state.anchorYear) { state.anchorYear = anchorYear; rebuild(go); } else go();
    }
    $('goto-btn').addEventListener('click', goToDate);
    $('goto-date').addEventListener('keydown', function (e) { if (e.key === 'Enter') goToDate(); });
    $('goto-time').addEventListener('keydown', function (e) { if (e.key === 'Enter') goToDate(); });

    [['lay-moon', 'moon'], ['lay-terms', 'terms'], ['lay-frost', 'frost'],
     ['lay-months', 'months'], ['lay-seasons', 'seasons'],
     ['lay-trad', 'traditional'], ['lay-sky', 'skyClock'],
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
    if (NOTES_ON) wireNotesBackup();

    $('frost-last').addEventListener('change', frostChanged);
    $('frost-first').addEventListener('change', frostChanged);

    $('lunar-countdown').checked = state.lunarCountdown;
    $('lunar-countdown').addEventListener('change', function () {
      state.lunarCountdown = this.checked;
      save();
      if (state.level === 'moon') tickMoonClock();
    });

    $('ethos-btn').addEventListener('click', function () { $('ethos').hidden = false; });
    $('ethos-close').addEventListener('click', function () { $('ethos').hidden = true; });
    /* The backdrop closes it, and the links inside it hand off to the view
     * they name rather than rebuilding anything: one door, one key. */
    $('ethos').addEventListener('click', function (e) {
      if (e.target === $('ethos')) { $('ethos').hidden = true; return; }
      var go = e.target.getAttribute && e.target.getAttribute('data-go');
      if (!go) return;
      var i = go.indexOf(':'), kind = go.slice(0, i), arg = go.slice(i + 1);
      $('ethos').hidden = true;
      if (kind === 'modal') { $(arg + '-btn').click(); return; }
      if (kind === 'level') {
        var crumb = document.querySelector('.crumbs [data-level="' + arg + '"]');
        if (crumb) crumb.click();
        return;
      }
      if (kind === 'about') {
        $('about').hidden = false;
        var all = $('about').querySelectorAll('h3'), h = all[0];
        for (var j = 0; j < all.length; j++) {
          if (all[j].textContent.toLowerCase().indexOf(arg) >= 0) { h = all[j]; break; }
        }
        h.scrollIntoView({ block: 'start' });
      }
    });

    /* The two day-view layers now switch from the floating tools, out of the
     * way of the panel that kept swallowing them. */
    syncDayTools = function () {
      var on = state.level === 'day';
      $('tool-planets').hidden = !on;
      $('tool-body').hidden = !on;
      $('tool-planets').classList.toggle('is-on', state.showPlanets);
      $('tool-body').classList.toggle('is-on', state.showBio || state.showOrgans);
      $('tool-planets').setAttribute('aria-pressed', state.showPlanets);
      $('tool-body').setAttribute('aria-pressed', state.showBio || state.showOrgans);
    };
    global.__syncDayTools = syncDayTools;
    $('tool-planets').addEventListener('click', function () { openTool('planets'); });
    $('tool-body').addEventListener('click', function () { openTool('body'); });
    syncDayTools();

    /* The wheel is opened from the sidebar rather than the trail: it is not a
     * zoom level of the year, it is a different clock entirely. */
    if (BODY_ON) wireBodyCycles();

    $('month-prev').addEventListener('click', function () {
      state.monthRun = Math.max(0, (state.monthRun || 0) - 1); drawMonth(); writeHash();
    });
    $('month-next').addEventListener('click', function () {
      state.monthRun = (state.monthRun || 0) + 1; drawMonth(); writeHash();
    });

    $('watch-close').addEventListener('click', function () { $('watch').hidden = true; });
    $('watch').addEventListener('click', function (e) {
      if (e.target === $('watch')) $('watch').hidden = true;
    });

    $('zodiac-close').addEventListener('click', function () { $('zodiac').hidden = true; });
    $('zodiac').addEventListener('click', function (e) {
      if (e.target === $('zodiac')) $('zodiac').hidden = true;
    });

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

    $('moon-prev').addEventListener('click', function () { stepMoon(-1); });
    $('moon-next').addEventListener('click', function () { stepMoon(1); });

    $('crumbs').addEventListener('click', function (e) {
      var b = e.target.closest('.crumb');
      if (!b || b.disabled) return;
      var lvl = b.getAttribute('data-level');
      /* The crumb means "the moon I am on", so it always recomputes from the
       * day in hand. Only the arrows and the wheel's own pies choose a month
       * deliberately, and those set it themselves before coming here. */
      if (lvl === 'moon') state.lunationK = lunationKOfDay(state.day || todayNumber() || 1);
      if (lvl === 'month' && state.monthRun === null) {
        state.monthRun = monthRunOfDay(state.day || todayNumber() || 1);
      }
      setLevel(lvl);
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (!$('watch').hidden) { $('watch').hidden = true; return; }
        if (!$('zodiac').hidden) { $('zodiac').hidden = true; return; }
        if (!$('ethos').hidden) { $('ethos').hidden = true; return; }
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

  /* With notes off, the panel section and its legend line come out of the
   * document rather than being hidden, so there is nothing to reveal. */
  /* The menstrual and pregnancy wheels are opened from the sidebar rather
   * than the trail: they are not zoom levels of the year, they are different
   * clocks entirely. Wired only in a build that carries them. */
  function wireBodyCycles() {
    $('menses-btn').addEventListener('click', function () {
      var showing = state.level === 'menses';
      if (showing) {
        $('menses-flyout').hidden = true;
        $('menses-btn').setAttribute('aria-expanded', 'false');
        setLevel(state.day ? 'day' : 'year');
      } else {
        state.mensesOpen = true; save();
        $('menses-btn').setAttribute('aria-expanded', 'true');
        setLevel('menses');
      }
    });
    $('preg-btn').addEventListener('click', function () {
      if (state.level === 'preg') {
        $('menses-flyout').hidden = true;
        $('preg-btn').setAttribute('aria-expanded', 'false');
        setLevel(state.day ? 'day' : 'year');
      } else {
        $('preg-btn').setAttribute('aria-expanded', 'true');
        setLevel('preg');
      }
    });
    $('menses-close').addEventListener('click', function () {
      $('menses-flyout').hidden = true;
    });
  }

  function stripBodyCyclesUI() {
    ['cycle-section', 'menses-flyout', 'scene-menses', 'scene-preg'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (state.level === 'menses' || state.level === 'preg') state.level = 'year';
    state.mensesOpen = false;
  }

  function stripNotesUI() {
    ['notes-section', 'legend-noted'].forEach(function (id) {
      var el = $(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function init() {
    load();
    loadNotes();
    if (PLAN_ON) Planner.load();
    if (!NOTES_ON) stripNotesUI();
    if (!BODY_ON) stripBodyCyclesUI();
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
    if (typeof ResizeObserver === 'function' && $('moon-readout')) {
      new ResizeObserver(function () { sizeMoonReserve(); }).observe($('moon-readout'));
    }
    if (SKY_ON) wireSystemSwitch();
    if (STRIP_ON) {
      wireViewSwitch();
      window.addEventListener('resize', function () { setTimeout(placeViewSwitch, 0); });
      /* The panel grows and shrinks on a transition, so a measurement taken
       * the instant it is told to change catches it mid-animation and puts
       * the switch back on top of it. Watching its box instead means the
       * switch settles wherever the panel finally settles. */
      if (typeof ResizeObserver === 'function' && $('day-panel')) {
        new ResizeObserver(function () { placeViewSwitch(); }).observe($('day-panel'));
      }
    }
    boot();
  }

  function wireZoom() {
    wheelZoom = ZoomPan.attach($('wheel-svg'), $('scene-wheel'));
    dayZoom = ZoomPan.attach($('day-svg'), $('scene-day'));
    moonZoom = ZoomPan.attach($('moon-svg'), $('scene-moon'));
    monthZoom = ZoomPan.attach($('month-svg'), $('scene-month'));
    orbitsZoom = ZoomPan.attach($('orrery-svg'), $('scene-orbits'));
    /* The dome is a second drawing on the same stage and needs its own
     * handle, or the zoom buttons quietly work the map hidden behind it. */
    if (SKY_ON && $('sky-dome-svg')) skyZoom = ZoomPan.attach($('sky-dome-svg'), $('scene-orbits'));
    if (BODY_ON) {
      mensesZoom = ZoomPan.attach($('menses-svg'), $('scene-menses'));
      pregZoom = ZoomPan.attach($('preg-svg'), $('scene-preg'));
    }
    /* Every scene that can be zoomed needs a line here. The month and system
     * views were falling through to the year wheel, so their buttons appeared
     * to do nothing while quietly zooming a face that was not on screen. */
    var ZOOMS = {
      day: function () { return dayZoom; },
      moon: function () { return moonZoom; },
      month: function () { return monthZoom; },
      orbits: function () { return state.systemView === 'here' ? skyZoom : orbitsZoom; },
      menses: function () { return mensesZoom; },
      preg: function () { return pregZoom; }
    };
    function active() {
      var pick = ZOOMS[state.level];
      return (pick && pick()) || wheelZoom;
    }
    $('zoom-in').addEventListener('click', function () { active().zoomIn(); });
    $('zoom-out').addEventListener('click', function () { active().zoomOut(); });
    $('zoom-reset').addEventListener('click', function () { active().reset(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
