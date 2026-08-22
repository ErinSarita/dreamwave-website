/* pregnancy.js — forty weeks as a wheel, and what is happening to each of them.
 *
 * Counted the way medicine counts it, from the first day of the last period,
 * which means the first fortnight is already spent before there is anything to
 * be pregnant with. That is a quirk of the convention rather than an error,
 * and the wheel says so instead of quietly starting at conception.
 *
 * The date at the end is drawn as a window rather than a day, for the same
 * reason the menstrual prediction is: only about five women in a hundred give
 * birth on the estimated date. Seventy in a hundred are within ten days of it
 * and ninety within a fortnight. A single day on a calendar is the one part of
 * this that everybody remembers and almost nobody meets.
 */
(function (global) {
  'use strict';
  var WEEKS = 40;

  var TRIMESTERS = [
    { key: 'first', name: 'First trimester', from: 1, to: 13,
      baby: 'Everything is built here. All the major organs form between ' +
        'weeks three and eight, the heart first beats around week six, and by ' +
        'week twelve every essential organ and structure is present. The rest ' +
        'of the pregnancy is growth and finishing rather than construction.',
      mother: 'Often the hardest stretch and the least visible one. Nausea ' +
        'tends to peak around week nine, fatigue can be flattening, and the ' +
        'breasts are tender early. Blood volume has already begun to rise.',
      helps: 'Eat what stays down and stop apologising for it. Small and ' +
        'frequent beats large and correct. Sleep is not a luxury here: the ' +
        'tiredness is doing something. Folate matters most in these weeks, ' +
        'when the neural tube closes.' },
    { key: 'second', name: 'Second trimester', from: 14, to: 27,
      baby: 'Growth accelerates and the senses come online. Movement begins ' +
        'to be felt somewhere between weeks sixteen and twenty-two. The ' +
        'anatomy scan usually falls around week twenty. By week twenty-four ' +
        'survival outside is possible with intensive care, though the lungs ' +
        'are far from ready.',
      mother: 'Usually the easiest of the three. Nausea commonly lifts, ' +
        'energy returns, appetite comes back, and the pregnancy becomes ' +
        'visible. Many find this the stretch where they feel well.',
      helps: 'The window for the things that get harder later: travel, ' +
        'dentistry, moving house, the harder conversations. Iron needs climb ' +
        'as blood volume expands. Movement and strength work are generally ' +
        'well tolerated now.' },
    { key: 'third', name: 'Third trimester', from: 28, to: 40,
      baby: 'Brain and lungs mature and fat is laid down. The lungs go on ' +
        'developing from week thirty-two through thirty-six. Most of the ' +
        'weight arrives in these weeks, which is why the last stretch feels ' +
        'so different from the rest.',
      mother: 'Heartburn as the stomach is pressed, breathlessness as the ' +
        'diaphragm is pushed up, practice contractions, and sleep that breaks ' +
        'up. The body is carrying a good deal more blood than it started with.',
      helps: 'Sleep on your side, prop everything, and eat smaller and more ' +
        'often as the stomach loses room. Rest is not idleness at this point. ' +
        'Know the signs that need a call rather than a wait.' }
  ];

  /* Weeks worth marking, and why. */
  var MARKS = [
    { week: 2,  label: 'conception', note: 'Roughly here, a fortnight after the ' +
        'count began. The first two weeks of a pregnancy are, by convention, ' +
        'before there is a pregnancy.' },
    { week: 4,  label: 'implantation', note: 'The embryo settles into the lining. ' +
        'This is usually when a period is first missed and a test turns positive.' },
    { week: 6,  label: 'first heartbeat', note: 'The heart begins to beat, and ' +
        'the single tube loops itself into four chambers over weeks six and seven.' },
    { week: 8,  label: 'organs forming', note: 'The embryonic period is closing. ' +
        'Every major organ has begun between weeks three and eight.' },
    { week: 12, label: 'all organs present', note: 'Every essential organ and ' +
        'structure now exists. From here it is growth and maturation.' },
    { week: 20, label: 'halfway · anatomy scan', note: 'The midpoint, and usually ' +
        'the scan that looks carefully at how everything has been built.' },
    { week: 22, label: 'movement felt', note: 'Quickening falls somewhere between ' +
        'weeks sixteen and twenty-two, later for a first pregnancy.' },
    { week: 24, label: 'viability', note: 'With intensive care, survival outside ' +
        'becomes possible. The lungs are still a long way from ready.' },
    { week: 34, label: 'lungs maturing', note: 'Lung development runs hard from ' +
        'week thirty-two through thirty-six.' },
    { week: 37, label: 'early term', note: 'Early term begins: 37 weeks to 38 ' +
        'weeks and six days.' },
    { week: 39, label: 'full term', note: 'Full term: 39 weeks to 40 weeks and ' +
        'six days. This is the window medicine now prefers.' },
    { week: 40, label: 'the estimated date', note: 'The date everyone remembers. ' +
        'About five births in a hundred happen on it; seventy in a hundred fall ' +
        'within ten days either side.' }
  ];

  /* Broad stages, drawn as their own band. */
  var STAGES = [
    { key: 'pre', name: 'before conception', from: 1, to: 2 },
    { key: 'embryo', name: 'embryonic · everything forms', from: 3, to: 8 },
    { key: 'fetal', name: 'fetal · growth and finishing', from: 9, to: 23 },
    { key: 'viable', name: 'viable with care', from: 24, to: 36 },
    { key: 'term', name: 'term', from: 37, to: 40 }
  ];

  function trimesterOf(week) {
    for (var i = 0; i < TRIMESTERS.length; i++) {
      if (week >= TRIMESTERS[i].from && week <= TRIMESTERS[i].to) return TRIMESTERS[i];
    }
    return TRIMESTERS[TRIMESTERS.length - 1];
  }
  function stageOf(week) {
    for (var i = 0; i < STAGES.length; i++) {
      if (week >= STAGES[i].from && week <= STAGES[i].to) return STAGES[i];
    }
    return STAGES[STAGES.length - 1];
  }
  function markAt(week) {
    for (var i = 0; i < MARKS.length; i++) if (MARKS[i].week === week) return MARKS[i];
    return null;
  }

  global.Pregnancy = {
    WEEKS: WEEKS, TRIMESTERS: TRIMESTERS, MARKS: MARKS, STAGES: STAGES,
    trimesterOf: trimesterOf, stageOf: stageOf, markAt: markAt
  };
})(typeof window !== 'undefined' ? window : globalThis);
