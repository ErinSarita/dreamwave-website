/* app.js — state, controls, and the zoom between year, season and day. */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ, Places = global.Places,
      CycleModel = global.Cycle, WheelView = global.WheelView, DayView = global.DayView;

  var STORE = 'turning-year:v1';
  var NOTES_STORE = 'turning-year:notes';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  var state = {
    place: null,
    anchorYear: null,
    level: 'year',
    season: null,
    day: null,
    hover: null,
    noteOpen: false,
    layers: { moon: true, terms: false, frost: true, months: true, traditional: false, skyClock: true },
    frost: { last: null, first: null },
    theme: 'night',
    hour12: false
  };
  var cycle = null;
  var notes = {};                 // { 'YYYY-MM-DD': 'free text' }, one per calendar date
  var wheelZoom = null, dayZoom = null;   // ZoomPan controllers, attached once in init

  /* ------------------------------------------------------------ persistence */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        place: state.place, layers: state.layers, frost: state.frost,
        theme: state.theme, hour12: state.hour12
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
    var opts = { layers: state.layers, todayN: todayNumber(), notedDays: notes };
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
    var t = WheelView.transformFor(cycle, state.level, state.season);
    $('wheel').style.transform = t.transform;
    $('hud').style.transform = t.transform;    // kept in lock-step so the sky glyphs track their stations
    $('wheel-svg').classList.toggle('zoomed', !!t.zoomed);
    WheelView.applyRotation($('wheel-svg'), t.rotation || 0);
  }

  function setLevel(level, opts) {
    if (wheelZoom) wheelZoom.reset();
    if (dayZoom) dayZoom.reset();
    state.level = level;
    if (level === 'year') { state.season = null; state.day = null; }
    if (level === 'season' && state.season === null) {
      state.season = WheelView.seasonOfDay(cycle, state.day || todayNumber() || 1);
    }
    if (level === 'day') {
      if (!state.day) state.day = todayNumber() || 1;
      state.season = WheelView.seasonOfDay(cycle, state.day);
      state.noteOpen = false;
    }
    var wheelScene = $('scene-wheel'), dayScene = $('scene-day');
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
    '<li><i class="sw sw-sky"></i> The Big Dipper facing north at nightfall</li>';

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
    for (var i = 0; i < cs.length; i++) {
      var lvl = cs[i].getAttribute('data-level');
      cs[i].classList.toggle('is-on', lvl === state.level);
    }
    var cS = $('crumb-season'), cD = $('crumb-day');
    cS.disabled = !cycle;
    cD.disabled = !cycle;
    if (cycle && state.season !== null) cS.textContent = cycle.seasons[state.season].from.name;
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
    if (d.sunrise) rows.push(row('Sunrise', TZ.formatTime(cycle.tz, d.sunrise, state.hour12)));
    if (d.sunset) rows.push(row('Sunset', TZ.formatTime(cycle.tz, d.sunset, state.hour12)));

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
      (hint ? '<div class="r-hint">' + hint + '</div>' : '');
  }
  function row(k, v) { return '<div><span>' + k + '</span> · ' + v + '</div>'; }

  function drawDay() {
    var d = cycle.days[state.day - 1];
    if (!d) return;
    var out = DayView.render(cycle, d, { hour12: state.hour12, now: new Date() });
    $('dayclock').innerHTML = out.svg;

    var moonLine;
    if (d.moonAlwaysUp) moonLine = 'above the horizon all day';
    else if (d.moonAlwaysDown) moonLine = 'below the horizon all day';
    else {
      var bits = [];
      if (d.moonrise) bits.push('rises ' + TZ.formatTime(cycle.tz, d.moonrise, state.hour12));
      if (d.moonset) bits.push('sets ' + TZ.formatTime(cycle.tz, d.moonset, state.hour12));
      moonLine = bits.join(' · ') || 'no rise or set today';
    }

    var stationHTML = '';
    if (d.station) stationHTML += '<div class="d-station">' + d.station.name +
      (d.station.alt ? ' <span style="opacity:.6">/ ' + d.station.alt + '</span>' : '') + '</div>';
    if (d.term) stationHTML += '<div class="d-term">Solar term ' + d.term.number + ' of 24' +
      ' <span style="opacity:.6">(' + d.term.hanzi + ' ' + d.term.pinyin + ')</span></div>';
    if (d.frost) stationHTML += '<div class="d-term" style="color:var(--frost)">' +
      (d.frost.kind === 'last-frost' ? 'Last spring frost' : 'First autumn frost') +
      (cycle.frost.isEstimate ? ' (estimate)' : '') + '</div>';
    if (d.moonEvent) stationHTML += '<div class="d-term">' + d.moonEvent + '</div>';

    $('day-panel').innerHTML =
      '<div class="d-of">Day</div>' +
      '<div class="d-num">' + d.n + '</div>' +
      '<div class="d-of">of ' + cycle.length + '</div>' +
      '<div class="d-date">' + TZ.formatDate(cycle.tz, d.date) + '</div>' +
      '<div class="d-week">' + TZ.weekdayName(cycle.tz, d.date) + '</div>' +
      stationHTML +
      '<div class="d-split">' +
        '<div class="d-sun"><b>' + (d.sunAlwaysUp ? '24 h' : d.sunAlwaysDown ? '0 h' : DayView.hm(d.daylightHours)) + '</b>light</div>' +
        '<div class="d-dark"><b>' + (d.sunAlwaysDown ? '24 h' : d.sunAlwaysUp ? '0 h' : DayView.hm(d.nightHours)) + '</b>dark</div>' +
      '</div>' +
      '<div class="d-moon-row">' + MoonGlyph.svg(d.moonAge, 30) +
        '<div class="d-moon-text"><b>' + Math.round(d.moonIllumination * 100) + '% lit</b>' +
        d.moonPhaseName + '</div></div>' +
      '<div class="d-week" style="margin-top:6px">Moon ' + moonLine + '</div>' +
      noteMarkup(d.iso);

    wireNote(d.iso);
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
    });
    $('note-done').addEventListener('click', function () {
      state.noteOpen = false;
      drawDay();
    });
  }

  /* ---------------------------------------------------------------- chrome */
  function syncChrome() {
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
    syncCrumbs();
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
     ['lay-months', 'months'], ['lay-trad', 'traditional'], ['lay-sky', 'skyClock']].forEach(function (pair) {
      var el = $(pair[0]);
      el.checked = state.layers[pair[1]];
      el.addEventListener('change', function () {
        state.layers[pair[1]] = el.checked;
        save(); drawWheel();
      });
    });

    function frostChanged() {
      state.frost = { last: parseMonthDay($('frost-last').value),
                      first: parseMonthDay($('frost-first').value) };
      save();
      CycleModel.applyFrost(cycle, state.frost);
      drawWheel(); syncChrome();
    }
    $('frost-last').addEventListener('change', frostChanged);
    $('frost-first').addEventListener('change', frostChanged);

    $('about-btn').addEventListener('click', function () { $('about').hidden = false; });
    $('about-close').addEventListener('click', function () { $('about').hidden = true; });
    $('about').addEventListener('click', function (e) {
      if (e.target === $('about')) $('about').hidden = true;
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
