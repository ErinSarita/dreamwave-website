/* app.js — state, controls, and the zoom between year, season and day. */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Places = global.Places,
      CycleModel = global.Cycle, WheelView = global.WheelView, DayView = global.DayView,
      Clock = global.Clock, MoonView = global.MoonView, Lunar = global.Lunar;

  var STORE = 'turning-year:v1';
  var NOTES_STORE = 'turning-year:notes';
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
    panelMin: false,    // day panel collapsed to a single line
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
    moonPhases: { 'New Moon': true, 'Waxing Crescent': true, 'First Quarter': true,
                  'Waxing Gibbous': true, 'Full Moon': true, 'Waning Gibbous': true,
                  'Last Quarter': true, 'Waning Crescent': true }
  };
  var cycle = null;
  var notes = {};                 // { 'YYYY-MM-DD': 'free text' }, one per calendar date
  var wheelZoom = null, dayZoom = null, moonZoom = null;  // ZoomPan controllers, attached in init

  /* ------------------------------------------------------------ persistence */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        place: state.place, layers: state.layers, frost: state.frost,
        theme: state.theme, hour12: state.hour12, useDST: state.useDST,
        panelMin: state.panelMin, moonMin: state.moonMin,
        readoutMin: state.readoutMin, lunarCountdown: state.lunarCountdown,
        showPlanets: state.showPlanets,
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
      if (typeof o.moonMin === 'boolean') state.moonMin = o.moonMin;
      if (typeof o.readoutMin === 'boolean') state.readoutMin = o.readoutMin;
      if (typeof o.lunarCountdown === 'boolean') state.lunarCountdown = o.lunarCountdown;
      if (typeof o.showPlanets === 'boolean') state.showPlanets = o.showPlanets;
      if (o.moonPhases) Object.keys(state.moonPhases).forEach(function (k) {
        if (typeof o.moonPhases[k] === 'boolean') state.moonPhases[k] = o.moonPhases[k];
      });
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
    if (wheelZoom) wheelZoom.reset();
    if (dayZoom) dayZoom.reset();
    if (moonZoom) moonZoom.reset();
    state.level = level;
    /* Each ring ticks only while its own face is on the stage. */
    if (level !== 'moon') stopMoonClock();
    if (level !== 'day') stopDayRing();
    if (level === 'year') { state.season = null; state.day = null; state.lunationK = null; }
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

    /* Three scenes share the stage. Whichever the new level wants comes
     * forward and the other two step back, on the same fade the wheel and the
     * day already used between them. */
    function showScene(want) {
      var all = [['wheel', wheelScene], ['day', dayScene], ['moon', moonScene]];
      var current = null;
      all.forEach(function (pair) { if (!pair[1].hidden) current = pair; });
      var target = all.filter(function (pair) { return pair[0] === want; })[0];
      if (current && current[0] === want) { if (want === 'wheel') applyZoom(); return; }
      if (!current) { target[1].hidden = false; target[1].classList.remove('fading'); return; }
      current[1].classList.add('fading');
      setTimeout(function () {
        current[1].hidden = true;
        target[1].hidden = false;
        requestAnimationFrame(function () {
          target[1].classList.remove('fading');
          if (want === 'wheel') applyZoom();
        });
      }, 260);
    }

    if (level === 'moon') {
      drawMoon();
      showScene('moon');
      /* The ring zooms and pans like the year wheel, so the stack stays. */
      syncCrumbs(); syncLegend(); writeHash();
      return;
    }
    if (level === 'day') {
      drawDay();
      showScene('day');
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
    '<li><i class="sw sw-noted"></i> A day you\'ve written a note on</li>' +
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
    var slot = state.level;
    for (var i = 0; i < cs.length; i++) {
      var lvl = cs[i].getAttribute('data-level');
      cs[i].classList.toggle('is-on', lvl === slot);
    }
    var cS = $('crumb-season'), cM = $('crumb-moon'), cD = $('crumb-day');
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

  /* Where each body stands along the ecliptic, named twice over.
   *
   * The sign is the tropical one: twelve equal cuts from the equinox, which is
   * what a birth chart uses. The constellation is the patch of sky the body is
   * actually in front of. They disagree by nearly a whole sign now, because
   * the signs were named around 130 BCE and the equinox has precessed about
   * thirty degrees away from the stars since. Giving one without the other
   * would be picking a side; giving both makes the drift visible, which is
   * the more interesting fact and the one this site is otherwise about.
   *
   * The Ascendant and Midheaven close the list because they are the only
   * entries that move on this dial's timescale, sweeping the whole zodiac
   * once a day. House cusps are a convention rather than a measurement, so
   * they are not here. */
  function planetsMarkup(d, out) {
    if (!global.Planets) return '';
    var head = '<label class="tog d-planets-tog"><input type="checkbox" id="planet-tog"' +
      (state.showPlanets ? ' checked' : '') + '><span>Planets &amp; angles</span></label>';
    if (!state.showPlanets) return '<div class="d-planets">' + head + '</div>';

    var isToday = (d.n === todayNumber());
    var when = isToday ? new Date() : (d.solarNoon || d.date);
    var jd = A.jdFromDate(when), jde = A.jdeFromJD(jd);
    var T = (jde - 2451545) / 36525, pre = Planets.precession(T);
    var eps = A.sunPosition(jde).obliquity;

    /* Each row says two different things. Where the body sits along the
     * ecliptic, which is a fact about the solar system and holds all day; and
     * where to point your face, which is a fact about this minute and this
     * spot of ground. The dial can show the first and can show how high a
     * body climbs, but its angle is spent on the hour, so it can never say
     * north or west. That is what the second line is for.
     *
     * The bearing is only shown for today, because "look south-west" means
     * nothing about a Tuesday in March. */
    function row(glyph, name, lon, colour, eq) {
      var sg = Planets.signOf(lon);
      var con = Planets.constellationOf(((lon - pre) % 360 + 360) % 360);
      var where = '';
      if (eq && isToday) {
        var L = Planets.lookAt(eq.ra, eq.dec, jd, cycle.lat, cycle.lon);
        where = L.up
          ? ' &#183; <em>' + L.altitude.toFixed(0) + '&#176; up, look ' + L.compass + '</em>'
          : ' &#183; <em class="d-pl-down">below the horizon</em>';
      }
      return '<div class="d-pl">' +
        '<i class="d-pl-g" style="color:' + colour + '">' + glyph + '</i>' +
        '<span class="d-pl-n">' + name + '</span>' +
        '<b>' + sg.name + ' ' + sg.degree.toFixed(1) + '&#176;</b>' +
        '<span class="d-pl-c">in ' + con + where + '</span></div>';
    }

    var rows = '';
    var sun = A.sunPosition(jde);
    rows += row('\u2609', 'Sun', A.norm360(sun.longitude), 'var(--sun-bright)', sun);
    var mp = A.moonPosition(jde);
    rows += row('\u263D', 'Moon', A.norm360(mp.longitude), 'var(--moon)', mp);
    Planets.ORDER.forEach(function (nm) {
      var p = Planets.position(nm, jde);
      rows += row(Planets.GLYPH[nm], nm, p.longitude, PLANET_COLOUR[nm], p);
    });
    var an = Planets.angles(jd, jde, cycle.lat, cycle.lon);
    rows += '<div class="d-pl-rule"></div>';
    rows += row('\u2191', 'Ascendant', an.ascendant, 'var(--today)',
                Planets.toEquatorial(an.ascendant, 0, eps));
    rows += row('\u22A5', 'Midheaven', an.midheaven, 'var(--today)',
                Planets.toEquatorial(an.midheaven, 0, eps));

    return '<div class="d-planets">' + head +
      '<div class="d-pl-list">' + rows + '</div>' +
      (isToday ? '' : '<p class="d-pl-note">Bearings are shown for today only: ' +
        'which way to look has no meaning for another date.</p>') +
      '<p class="d-pl-note">Sign is tropical, measured from the equinox. ' +
      '<b>In</b> is the constellation actually behind it. The two run nearly a ' +
      'sign apart: the constellation Aries now begins ' + (28.7 - pre).toFixed(1) +
      '&#176; past the equinox, where the sign Aries begins at 0&#176; by ' +
      'definition.</p></div>';
  }

  var PLANET_COLOUR = {
    Mercury: '#8fa3b8', Venus: '#c98fb9', Mars: '#d1685a',
    Jupiter: '#c9a24a', Saturn: '#8d8ab5'
  };

  function drawDay() {
    var d = cycle.days[state.day - 1];
    if (!d) return;
    var out = DayView.render(cycle, d, { hour12: state.hour12, useDST: state.useDST,
      now: new Date(), placeName: state.place ? (state.place.name || state.place.label) : '',
      planets: state.showPlanets });
    $('dayclock').innerHTML = out.svg + '<g id="day-clock-ring"></g>';
    startDayRing();

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
      planetsMarkup(d, out) +
      clockShiftMarkup(d) +
      noteMarkup(d.iso);

    $('panel-min').addEventListener('click', function () {
      state.panelMin = !state.panelMin;
      save(); drawDay();
    });
    if ($('planet-tog')) {
      $('planet-tog').addEventListener('change', function () {
        state.showPlanets = this.checked;
        save(); drawDay();
      });
    }
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

  function openTool(kind) {
    if (toolOpen === kind) { closeTool(); return; }
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
      setLevel(lvl);
    });

    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
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
    moonZoom = ZoomPan.attach($('moon-svg'), $('scene-moon'));
    function active() {
      return state.level === 'day' ? dayZoom
           : state.level === 'moon' ? moonZoom : wheelZoom;
    }
    $('zoom-in').addEventListener('click', function () { active().zoomIn(); });
    $('zoom-out').addEventListener('click', function () { active().zoomOut(); });
    $('zoom-reset').addEventListener('click', function () { active().reset(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
