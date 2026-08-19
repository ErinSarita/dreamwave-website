/* cycle.js — the solar cycle model.
 *
 * A cycle runs from one winter solstice to the next.  Day 1 is the local civil
 * date on which the solstice instant falls, and the cycle ends the day before
 * day 1 of the following cycle.  Because the tropical year is about 365.2422
 * days, that count comes out to 365 or 366 on its own: no leap-year rule is
 * applied, the length is simply whatever the sky did.
 */
(function (global) {
  'use strict';
  var A = global.Astro, TZ = global.TZ;
  var DAY_MS = 86400000;

  /* Offsets from the anchor (the local winter solstice), in degrees of solar
   * longitude, with the names the wheel uses for each station. */
  /* The four cross-quarter days are named for what they are astronomically
   * (the midpoint of that season, halfway in solar longitude between the
   * solstice and equinox on either side) rather than leading with the Gaelic
   * festival names, which are one specific tradition's names for them, kept
   * here as the alt line instead. */
  var STATIONS = [
    { offset: 0,   key: 'winter-solstice', name: 'Winter Solstice',
      alt: 'Yule', kind: 'solstice', note: 'The longest night. Day 1 of the cycle.' },
    { offset: 45,  key: 'imbolc', name: 'Winter Midseason',
      alt: 'Imbolc · Candlemas / Brigid', kind: 'cross-quarter', note: 'Midpoint of winter; first stirring of spring.' },
    { offset: 90,  key: 'spring-equinox', name: 'Spring Equinox',
      alt: 'Ostara', kind: 'equinox', note: 'Day and night in balance, light still rising.' },
    { offset: 135, key: 'beltane', name: 'Spring Midseason',
      alt: 'Beltane · May Day', kind: 'cross-quarter', note: 'Midpoint of spring; the move toward summer.' },
    { offset: 180, key: 'summer-solstice', name: 'Summer Solstice',
      alt: 'Litha', kind: 'solstice', note: 'The longest day; the turning of the light.' },
    { offset: 225, key: 'lughnasadh', name: 'Summer Midseason',
      alt: 'Lughnasadh · Lammas', kind: 'cross-quarter', note: 'Midpoint of summer; first harvest.' },
    { offset: 270, key: 'autumn-equinox', name: 'Autumn Equinox',
      alt: 'Mabon', kind: 'equinox', note: 'Balance again, light now falling.' },
    { offset: 315, key: 'samhain', name: 'Autumn Midseason',
      alt: 'Samhain · Hallows', kind: 'cross-quarter', note: 'Midpoint of autumn; the dark half begins.' }
  ];

  /* The 24 Chinese solar terms, keyed by absolute apparent solar longitude.
   * These are fixed to the sky, not to a hemisphere. */
  var SOLAR_TERMS = [
    [315,'立春','Lichun','Start of Spring'],   [330,'雨水','Yushui','Rain Water'],
    [345,'惊蛰','Jingzhe','Waking of Insects'],[0,'春分','Chunfen','Spring Equinox'],
    [15,'清明','Qingming','Clear and Bright'], [30,'谷雨','Guyu','Grain Rain'],
    [45,'立夏','Lixia','Start of Summer'],     [60,'小满','Xiaoman','Grain Buds'],
    [75,'芒种','Mangzhong','Grain in Ear'],    [90,'夏至','Xiazhi','Summer Solstice'],
    [105,'小暑','Xiaoshu','Minor Heat'],       [120,'大暑','Dashu','Major Heat'],
    [135,'立秋','Liqiu','Start of Autumn'],    [150,'处暑','Chushu','End of Heat'],
    [165,'白露','Bailu','White Dew'],          [180,'秋分','Qiufen','Autumn Equinox'],
    [195,'寒露','Hanlu','Cold Dew'],           [210,'霜降','Shuangjiang','Frost Descends'],
    [225,'立冬','Lidong','Start of Winter'],   [240,'小雪','Xiaoxue','Minor Snow'],
    [255,'大雪','Daxue','Major Snow'],         [270,'冬至','Dongzhi','Winter Solstice'],
    [285,'小寒','Xiaohan','Minor Cold'],       [300,'大寒','Dahan','Major Cold']
  ];

  /* Traditional fixed calendar dates for the four fire festivals, as
   * [month, day]; the southern set is the common antipodean adjustment. */
  var TRADITIONAL = {
    north: { imbolc: [2,1], beltane: [5,1], lughnasadh: [8,1], samhain: [11,1] },
    south: { imbolc: [8,1], beltane: [11,1], lughnasadh: [2,1], samhain: [5,1] }
  };

  /* Rough frost normals by latitude band.  These are a starting estimate only;
   * real first and last frost depend on elevation, water, and local ground far
   * more than on latitude, so the site invites you to set your own. */
  var FROST_BANDS = [
    [30, null, null],
    [35, [3,15], [11,25]],
    [40, [4,5],  [11,5]],
    [45, [4,25], [10,15]],
    [50, [5,10], [10,5]],
    [55, [5,20], [9,25]],
    [60, [6,1],  [9,15]],
    [90, [6,15], [9,1]]
  ];

  function estimateFrost(lat) {
    var a = Math.abs(lat), band = null;
    for (var i = 0; i < FROST_BANDS.length; i++) {
      if (a < FROST_BANDS[i][0]) { band = FROST_BANDS[i]; break; }
    }
    if (!band) band = FROST_BANDS[FROST_BANDS.length - 1];
    if (!band[1]) return null;
    if (lat >= 0) return { last: band[1], first: band[2] };
    // Southern hemisphere: shift both by six months.
    return { last: shiftSixMonths(band[1]), first: shiftSixMonths(band[2]) };
  }
  function shiftSixMonths(md) {
    var m = md[0] + 6; if (m > 12) m -= 12;
    return [m, md[1]];
  }

  function civilOf(tz, date) { return TZ.civilParts(tz, date); }

  /* Build the whole cycle.  opts: {lat, lon, tz, anchorYear, anchorMode}
   * anchorMode: 'local' (default) anchors on the viewer's own winter solstice,
   * 'december' always anchors on the December solstice. */
  function build(opts) {
    var lat = opts.lat, lon = opts.lon, tz = opts.tz;
    var southern = lat < 0 && opts.anchorMode !== 'december';
    var anchorLongitude = southern ? 90 : 270;

    // Anchor instant: the winter solstice that opens this cycle.
    var anchorJDE = A.seasonalPointJDE(opts.anchorYear, anchorLongitude);
    if (southern) {
      // The June solstice of `anchorYear` is the one we want; no adjustment.
    }
    var anchorJD = A.jdFromJDE(anchorJDE);
    var anchorInstant = A.dateFromJD(anchorJD);
    var c0 = civilOf(tz, anchorInstant);
    var day1 = TZ.startOfDay(tz, c0.year, c0.month, c0.day);

    // Where the next cycle begins, which fixes this cycle's length.
    var nextJDE = A.seasonalPointJDE(opts.anchorYear + 1, anchorLongitude);
    var nextInstant = A.dateFromJD(A.jdFromJDE(nextJDE));
    var c1 = civilOf(tz, nextInstant);
    var nextDay1 = TZ.startOfDay(tz, c1.year, c1.month, c1.day);
    var length = Math.round((nextDay1.getTime() - day1.getTime()) / DAY_MS);

    var cycle = {
      lat: lat, lon: lon, tz: tz,
      anchorYear: opts.anchorYear, anchorMode: opts.anchorMode || 'local',
      southern: southern, anchorLongitude: anchorLongitude,
      anchorInstant: anchorInstant, nextAnchorInstant: nextInstant,
      day1: day1, nextDay1: nextDay1, length: length,
      isLong: length === 366,
      days: [], stations: [], terms: [], frost: null,
      dayByISO: {},
      /* The zone's own winter offset, and whether it shifts at all. Read once
       * here so every view can offer the year without its summer hour. */
      standardOffsetMin: TZ.standardOffsetMinutes(tz, c0.year),
      shiftsClocks: TZ.observesShift(tz, c0.year) || TZ.observesShift(tz, c1.year)
    };

    buildDays(cycle);
    buildStations(cycle, anchorJDE, nextJDE);
    labelMoonsBySeason(cycle);
    buildTerms(cycle, anchorJDE, nextJDE);
    return cycle;
  }

  function buildDays(cycle) {
    var tz = cycle.tz, lat = cycle.lat, lon = cycle.lon;
    var days = cycle.days;
    for (var n = 1; n <= cycle.length; n++) {
      var approx = new Date(cycle.day1.getTime() + (n - 1) * DAY_MS);
      var cp = civilOf(tz, approx);
      var start = TZ.startOfDay(tz, cp.year, cp.month, cp.day);
      var nextCp = civilOf(tz, new Date(start.getTime() + 36 * 3600000));
      var end = TZ.startOfDay(tz, nextCp.year, nextCp.month, nextCp.day);
      var spanDays = (end.getTime() - start.getTime()) / DAY_MS;   // 1, or 0.958/1.042 on DST days

      var jdStart = A.jdFromDate(start);
      var sun = A.riseSet('sun', jdStart, spanDays, lat, lon);
      var moon = A.riseSet('moon', jdStart, spanDays, lat, lon);
      var noonJDE = A.jdeFromJD(jdStart + spanDays / 2);
      var phase = A.moonPhase(noonJDE);

      var daylight;
      if (sun.alwaysUp) daylight = spanDays * 24;
      else if (sun.alwaysDown) daylight = 0;
      else if (sun.rise !== null && sun.set !== null) {
        daylight = (sun.set - sun.rise) * 24;
        if (daylight < 0) daylight += spanDays * 24;
      } else if (sun.rise !== null) daylight = (jdStart + spanDays - sun.rise) * 24;
      else if (sun.set !== null) daylight = (sun.set - jdStart) * 24;
      else daylight = 0;

      var day = {
        n: n, date: start, end: end, spanHours: spanDays * 24,
        year: cp.year, month: cp.month, day: cp.day,
        iso: cp.year + '-' + TZ.pad(cp.month) + '-' + TZ.pad(cp.day),
        sunrise: sun.rise !== null ? A.dateFromJD(sun.rise) : null,
        sunset: sun.set !== null ? A.dateFromJD(sun.set) : null,
        solarNoon: sun.transit !== null ? A.dateFromJD(sun.transit) : null,
        // The two meridian crossings: peak sun (highest the sun gets) and
        // peak darkness (lowest it goes). Altitudes are taken at the refined
        // culmination itself, so "how high did it actually get" is exact.
        solarMidnight: sun.antiTransit !== null ? A.dateFromJD(sun.antiTransit) : null,
        minSunAltitude: sun.minAltitude,
        sunAlwaysUp: sun.alwaysUp, sunAlwaysDown: sun.alwaysDown,
        maxSunAltitude: sun.maxAltitude,
        daylightHours: daylight, nightHours: spanDays * 24 - daylight,
        moonrise: moon.rise !== null ? A.dateFromJD(moon.rise) : null,
        moonset: moon.set !== null ? A.dateFromJD(moon.set) : null,
        moonAlwaysUp: moon.alwaysUp, moonAlwaysDown: moon.alwaysDown,
        moonIllumination: phase.illumination, moonPhaseName: phase.name,
        moonWaxing: phase.waxing, moonAgeDays: phase.ageDays, moonAge: phase.age,
        moonDistanceKm: phase.distanceKm,
        // The Sun's declination: its angle north (+) or south (-) of the
        // celestial equator. This is the quantity the solstices and equinoxes
        // are actually defined by, so the wheel can draw it directly.
        sunDeclination: A.sunPosition(noonJDE).dec,
        station: null, term: null, season: 0, frost: null
      };
      days.push(day);
      cycle.dayByISO[day.iso] = day;
    }
    markMoonEvents(cycle);
    markClockShifts(cycle);
    buildLunations(cycle);
    computeExtremes(cycle);
  }

  /* Daylight-saving bookkeeping, kept strictly apart from the astronomy.
   *
   * None of this touches the sky. Sunrise, the solstices and the moon are all
   * computed as absolute instants and only translated into wall-clock time at
   * the point of display, so a clock change cannot reach them. What it does
   * change is real all the same: the civil day genuinely holds 23 or 25 hours
   * on the two changeover days, and one hour of the local clock either never
   * occurs or occurs twice. Recorded here so the day view can say so plainly
   * rather than leaving a puzzling gap.
   *
   * Also records how far the wall clock has drifted from the sun, measured at
   * the moment the sun is actually highest: if peak sun lands at 13:01, the
   * clock is running 61 minutes ahead of the sky. */
  function markClockShifts(cycle) {
    cycle.days.forEach(function (d) {
      d.clockShiftMinutes = 0;
      d.clockAheadOfSunMin = null;

      if (d.solarNoon) {
        // Apparent solar time is 12:00 exactly at the sun's upper transit, so
        // whatever the civil clock reads there is the whole offset.
        d.clockAheadOfSunMin = Math.round((TZ.hoursIntoDay(cycle.tz, d.solarNoon) - 12) * 60);
      }

      if (Math.abs(d.spanHours - 24) < 0.01) return;
      var offStart = TZ.offsetMinutes(cycle.tz, d.date);
      var offEnd = TZ.offsetMinutes(cycle.tz, new Date(d.end.getTime() - 1000));
      d.clockShiftMinutes = offEnd - offStart;

      // Bisect for the instant the offset actually changes.
      var lo = d.date.getTime(), hi = d.end.getTime();
      for (var i = 0; i < 44; i++) {
        var mid = Math.floor((lo + hi) / 2);
        if (TZ.offsetMinutes(cycle.tz, new Date(mid)) === offStart) lo = mid; else hi = mid;
      }
      d.clockShiftAt = new Date(hi);
      /* Both faces of the one instant. Reading the changeover moment at the
       * outgoing offset gives the time the clocks left (02:00), and at the
       * incoming offset the time they arrived at (03:00 going forward, 01:00
       * coming back). Taking the "before" label from the instant just prior
       * instead would read 01:59, which is the last minute of the old hour
       * rather than the moment of the change. */
      d.clockShiftFrom = TZ.formatAtOffset(offStart, d.clockShiftAt, false);
      d.clockShiftTo = TZ.formatAtOffset(offEnd, d.clockShiftAt, false);
    });
  }

  /* Lunations: new moon to new moon, the Moon's own cycle laid against the
   * Sun's. A synodic month is 29.53 days and a solar cycle 365, so 12.37 of
   * them fit: a year carries 12 or 13 new moons and almost always opens and
   * closes mid-moon, leaving a partial segment at each end. Those partials
   * are kept and marked rather than hidden, because pretending the year
   * begins on a new moon would be the same error as pretending it closes
   * into a circle.
   *
   * Only the whole ones are numbered. The first of those is flagged, since
   * "the first full moon-cycle of the solar year" is a real, locatable thing
   * and the partial that precedes it is not. */
  function buildLunations(cycle) {
    var starts = [];
    cycle.days.forEach(function (d) { if (d.moonEvent === 'New Moon') starts.push(d.n); });
    cycle.lunations = [];
    if (!starts.length) return;

    var segs = [];
    if (starts[0] > 1) segs.push({ startDay: 1, endDay: starts[0] - 1, complete: false, lead: true });
    starts.forEach(function (s, i) {
      var last = i + 1 >= starts.length;
      segs.push({
        startDay: s,
        endDay: last ? cycle.length : starts[i + 1] - 1,
        complete: !last,          // the trailing segment runs off the end of the cycle
        lead: false
      });
    });

    var n = 0, firstComplete = null;
    segs.forEach(function (seg) {
      seg.days = seg.endDay - seg.startDay + 1;
      if (seg.complete) {
        seg.number = ++n;
        if (firstComplete === null) firstComplete = seg;
      } else seg.number = null;
      cycle.lunations.push(seg);
    });
    if (firstComplete) firstComplete.isFirstComplete = true;
    cycle.completeLunations = n;

    // Tag every day with the moon it belongs to and how far into it we are.
    cycle.lunations.forEach(function (seg) {
      for (var k = seg.startDay; k <= seg.endDay; k++) {
        var d = cycle.days[k - 1];
        d.lunation = seg;
        // The leading partial has no new moon inside the cycle to count from,
        // so fall back on the Moon's true age for those days.
        d.dayInLunation = seg.lead
          ? Math.floor(d.moonAgeDays) + 1
          : k - seg.startDay + 1;
      }
    });
  }

  /* Flag the day nearest each new / first quarter / full / last quarter. */
  function markMoonEvents(cycle) {
    var days = cycle.days, targets = [0, 90, 180, 270];
    var labels = ['New Moon', 'First Quarter', 'Full Moon', 'Last Quarter'];
    for (var i = 1; i < days.length; i++) {
      var prevAge = days[i - 1].moonAge;
      var age = days[i].moonAge;
      for (var t = 0; t < targets.length; t++) {
        var a = A.norm180(prevAge - targets[t]), b = A.norm180(age - targets[t]);
        if (a < 0 && b >= 0) {
          var pick = Math.abs(a) < Math.abs(b) ? days[i - 1] : days[i];
          pick.moonEvent = labels[t];
        }
      }
    }
  }

  function computeExtremes(cycle) {
    var minD = Infinity, maxD = -Infinity, minDay = null, maxDay = null;
    cycle.days.forEach(function (d) {
      if (d.daylightHours < minD) { minD = d.daylightHours; minDay = d; }
      if (d.daylightHours > maxD) { maxD = d.daylightHours; maxDay = d; }
    });
    cycle.minDaylight = minD; cycle.maxDaylight = maxD;
    cycle.shortestDay = minDay; cycle.longestDay = maxDay;

    // Moon distance range over this cycle, and which days hold the closest
    // and furthest full moons (the "supermoon" / "micromoon" of the year).
    var near = Infinity, far = -Infinity, nearDay = null, farDay = null;
    cycle.days.forEach(function (d) {
      if (d.moonDistanceKm < near) { near = d.moonDistanceKm; nearDay = d; }
      if (d.moonDistanceKm > far) { far = d.moonDistanceKm; farDay = d; }
    });
    cycle.moonNearestKm = near; cycle.moonFurthestKm = far;
    cycle.moonNearestDay = nearDay; cycle.moonFurthestDay = farDay;
  }

  function dayNumberForInstant(cycle, instant) {
    var cp = civilOf(cycle.tz, instant);
    var iso = cp.year + '-' + TZ.pad(cp.month) + '-' + TZ.pad(cp.day);
    var d = cycle.dayByISO[iso];
    return d ? d.n : null;
  }

  function buildStations(cycle, anchorJDE, nextJDE) {
    var trad = TRADITIONAL[cycle.southern ? 'south' : 'north'];
    var prev = anchorJDE - 0.5;
    for (var i = 0; i < STATIONS.length; i++) {
      var s = STATIONS[i];
      var absLon = A.norm360(cycle.anchorLongitude + s.offset);
      var jde = i === 0 ? anchorJDE : A.solarLongitudeAfterJDE(absLon, prev + 1);
      prev = jde;
      var instant = A.dateFromJD(A.jdFromJDE(jde));
      var term = termFor(absLon);
      var station = {
        key: s.key, name: s.name, alt: s.alt, kind: s.kind, note: s.note,
        offset: s.offset, longitude: absLon,
        instant: instant, dayNumber: dayNumberForInstant(cycle, instant),
        term: term, traditional: null
      };
      if (trad[s.key]) {
        var md = trad[s.key];
        // Pick whichever calendar year of that month/day lands inside the cycle.
        var candidates = [cycle.day1.getUTCFullYear() - 1, cycle.day1.getUTCFullYear(),
                          cycle.day1.getUTCFullYear() + 1];
        for (var c = 0; c < candidates.length; c++) {
          var when = TZ.startOfDay(cycle.tz, candidates[c], md[0], md[1]);
          var dn = dayNumberForInstant(cycle, when);
          if (dn !== null) { station.traditional = { instant: when, dayNumber: dn }; break; }
        }
      }
      cycle.stations.push(station);
      if (station.dayNumber) cycle.days[station.dayNumber - 1].station = station;
    }
    // Season index per day: quarters delimited by the four cardinal stations.
    var cardinals = cycle.stations.filter(function (s) { return s.offset % 90 === 0; });
    cycle.days.forEach(function (d) {
      var idx = 0;
      for (var i = 0; i < cardinals.length; i++) {
        if (cardinals[i].dayNumber !== null && d.n >= cardinals[i].dayNumber) idx = i;
      }
      d.season = idx;
    });
    cycle.seasons = cardinals.map(function (s, i) {
      var next = cardinals[(i + 1) % cardinals.length];
      var startN = s.dayNumber || 1;
      var endN = (i === cardinals.length - 1) ? cycle.length : (next.dayNumber - 1);
      return {
        index: i, name: SEASON_NAMES[i], from: s, startDay: startN, endDay: endN,
        days: endN - startN + 1
      };
    });
  }

  /* The cycle is anchored on the local winter solstice, so season 0 is always
   * the viewer's own winter and these names hold in either hemisphere. */
  var MOON_SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'];
  var ORDINALS = ['', '1st', '2nd', '3rd', '4th'];

  var SEASON_NAMES = ['Deep Winter to Spring', 'Spring to Summer',
                      'Summer to Autumn', 'Autumn to Winter'];

  /* Name each full and new moon by where it falls in the seasons, which is how
   * they are actually spoken of: "the second full moon of spring".
   *
   * A season runs about 91.3 days against a 29.53-day month, so 3.09 moons fit
   * and a season carries three full moons most of the time but sometimes four
   * (three of them span 88.6 days, which fits; a fourth instant can still land
   * inside before the season closes). Measured over 18 years, 66 seasons held
   * three and 6 held four. The third full moon of a four-moon season is the
   * traditional blue moon, which is where that name comes from.
   *
   * Runs after buildStations, since it needs each day's season, which is only
   * assigned there. */
  function labelMoonsBySeason(cycle) {
    /* The year count runs straight through from the first full moon after the
     * winter solstice to the last one before the next, so it usually reaches
     * 12 and reaches 13 whenever some season carries four. Season position and
     * year position are both kept: "Spring Moon 2" says where in the season it
     * falls, "Year Moon 5" where in the whole turn. */
    var yearMoon = 0;
    cycle.days.forEach(function (d) {
      if (d.moonEvent === 'Full Moon') {
        d.yearMoonNumber = ++yearMoon;
        d.yearMoonLabel = 'Year Moon ' + d.yearMoonNumber;
      }
    });
    cycle.yearMoonCount = yearMoon;

    [['Full Moon', 'full'], ['New Moon', 'new']].forEach(function (pair) {
      var evt = pair[0], key = pair[1];
      var bySeason = [[], [], [], []];
      cycle.days.forEach(function (d) {
        if (d.moonEvent === evt && bySeason[d.season]) bySeason[d.season].push(d);
      });
      bySeason.forEach(function (list, si) {
        list.forEach(function (d, i) {
          d[key + 'MoonSeason'] = MOON_SEASONS[si];
          d[key + 'MoonOrdinal'] = i + 1;
          d[key + 'MoonOfSeason'] = list.length;
          d[key + 'MoonLabel'] = (ORDINALS[i + 1] || (i + 1) + 'th') + ' ' +
            (evt === 'Full Moon' ? 'full' : 'new') + ' moon of ' + MOON_SEASONS[si];
          // Shorter form the wheel uses: "Spring Moon 2".
          d[key + 'MoonSeasonLabel'] = MOON_SEASONS[si] + ' Moon ' + (i + 1);
          // The third of four is the blue moon in the older seasonal sense.
          if (evt === 'Full Moon' && list.length === 4 && i === 2) d.isBlueMoon = true;
        });
      });
    });

    // Carry the naming onto the lunar month that contains each full moon, so
    // a wedge can be spoken of by its moon rather than a bare index.
    (cycle.lunations || []).forEach(function (L) {
      L.fullMoon = null;
      for (var k = L.startDay; k <= L.endDay; k++) {
        var d = cycle.days[k - 1];
        if (d && d.moonEvent === 'Full Moon') { L.fullMoon = d; break; }
      }
      if (L.fullMoon) {
        L.seasonName = L.fullMoon.fullMoonSeason;
        L.ordinal = L.fullMoon.fullMoonOrdinal;
        L.ofSeason = L.fullMoon.fullMoonOfSeason;
        L.isBlue = !!L.fullMoon.isBlueMoon;
        L.yearMoonNumber = L.fullMoon.yearMoonNumber;
        L.shortLabel = L.fullMoon.fullMoonSeasonLabel;      // "Spring Moon 2"
        L.yearLabel = 'Year Moon ' + L.yearMoonNumber;
        L.longLabel = (ORDINALS[L.ordinal] || L.ordinal + 'th') +
                      ' full moon of ' + L.seasonName;
      }
    });
  }

  function termFor(lon) {
    for (var i = 0; i < SOLAR_TERMS.length; i++) {
      if (SOLAR_TERMS[i][0] === A.norm360(lon)) {
        return { longitude: SOLAR_TERMS[i][0], hanzi: SOLAR_TERMS[i][1],
                 pinyin: SOLAR_TERMS[i][2], english: SOLAR_TERMS[i][3] };
      }
    }
    return null;
  }

  function buildTerms(cycle, anchorJDE) {
    var prev = anchorJDE - 0.5;
    for (var step = 0; step < 24; step++) {
      var absLon = A.norm360(cycle.anchorLongitude + step * 15);
      var jde = step === 0 ? anchorJDE : A.solarLongitudeAfterJDE(absLon, prev + 1);
      prev = jde;
      var instant = A.dateFromJD(A.jdFromJDE(jde));
      var t = termFor(absLon);
      if (!t) continue;
      var entry = { longitude: absLon, hanzi: t.hanzi, pinyin: t.pinyin, english: t.english,
                    number: step + 1, instant: instant, dayNumber: dayNumberForInstant(cycle, instant) };
      cycle.terms.push(entry);
      if (entry.dayNumber) cycle.days[entry.dayNumber - 1].term = entry;
    }
  }

  /* Attach frost markers.  `custom` is {last: [m,d]|null, first: [m,d]|null};
   * pass null to fall back to the latitude estimate. */
  function applyFrost(cycle, custom) {
    cycle.days.forEach(function (d) { d.frost = null; });
    var est = estimateFrost(cycle.lat);
    var src = custom && (custom.last || custom.first) ? custom : est;
    if (!src) {
      // No frost in the estimate for this latitude, and nothing typed in by
      // hand: treat it as a year-round growing season rather than showing
      // nothing at all.
      cycle.frost = { last: null, first: null, none: true, isEstimate: !custom };
      return cycle.frost;
    }
    var isEstimate = !(custom && (custom.last || custom.first));

    function place(md, kind) {
      if (!md) return null;
      var years = [cycle.day1.getUTCFullYear() - 1, cycle.day1.getUTCFullYear(),
                   cycle.day1.getUTCFullYear() + 1];
      for (var i = 0; i < years.length; i++) {
        var when = TZ.startOfDay(cycle.tz, years[i], md[0], md[1]);
        var dn = dayNumberForInstant(cycle, when);
        if (dn !== null) return { monthDay: md, instant: when, dayNumber: dn, kind: kind };
      }
      return null;
    }
    var last = place(src.last, 'last-frost');
    var first = place(src.first, 'first-frost');
    cycle.frost = { last: last, first: first, isEstimate: isEstimate };
    if (last) cycle.days[last.dayNumber - 1].frost = last;
    if (first) cycle.days[first.dayNumber - 1].frost = first;
    // Growing window, in cycle-day terms.
    if (last && first) {
      cycle.frost.growingDays = first.dayNumber >= last.dayNumber
        ? first.dayNumber - last.dayNumber
        : cycle.length - last.dayNumber + first.dayNumber;
    }
    return cycle.frost;
  }

  global.Cycle = {
    build: build, applyFrost: applyFrost, estimateFrost: estimateFrost,
    dayNumberForInstant: dayNumberForInstant,
    STATIONS: STATIONS, SOLAR_TERMS: SOLAR_TERMS, SEASON_NAMES: SEASON_NAMES,
    MOON_SEASONS: MOON_SEASONS
  };
})(typeof window !== 'undefined' ? window : globalThis);
