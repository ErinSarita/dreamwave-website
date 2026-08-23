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

  /* What the baby can take in, and when.
   *
   * This is the band where prenatal and perinatal psychology lives, and it is
   * also where the evidence is at its most uneven, so the two are kept apart.
   * The hearing findings are solid and old: the ear is built around week
   * eighteen, outside sound reaches in by about twenty-three, and from
   * twenty-six to twenty-eight the fetus responds to sound and can tell the
   * mother's voice from another. DeCasper and Fifer showed in 1980 that
   * newborns prefer their mother's voice, and DeCasper and Spence that a rhyme
   * recited daily in late pregnancy is recognised afterwards, the fetal heart
   * rate settling when it is heard.
   *
   * What the field around this then builds on it, that the baby is a conscious
   * and communicating self whose birth leaves lifelong imprints, reaches well
   * past what those findings establish. It is given here as a framework and
   * labelled as one, the same way the organ watches and the moon readings are.
   */
  var SENSES = [
    { key: 'quiet', name: 'before hearing', from: 1, to: 17,
      measured: 'The ear is still being built. Nothing is being heard yet.',
      ppne: 'The field treats even this stretch as relational, holding that the ' +
        'mother\'s state reaches the baby chemically long before anything can ' +
        'be heard. The chemistry is real; the reading put on it is a claim.' },
    { key: 'ear', name: 'the ear is built', from: 18, to: 22,
      measured: 'The structures of the ear have formed by about week eighteen. ' +
        'Function comes later than the anatomy.',
      ppne: 'Talking and singing to the belly is often begun here. It does no ' +
        'harm and it is a way of starting something in the person doing it.' },
    { key: 'sound', name: 'outside sound reaches in', from: 23, to: 25,
      measured: 'Hearing sharpens around week twenty-three and outside sounds ' +
        'begin to arrive. The mother\'s voice carries through her body as well ' +
        'as through the air, which is why it comes across most strongly.',
      ppne: 'This is where deliberate voice work is usually taught: the same ' +
        'song or rhyme, often, so it becomes familiar rather than novel.' },
    { key: 'knows', name: 'responds, and knows her voice', from: 26, to: 31,
      measured: 'From about weeks twenty-six to twenty-eight the fetus reliably ' +
        'responds to sound and can discriminate the mother\'s voice from ' +
        'others, showing a marked preference for hers.',
      ppne: 'Held to be the beginning of relationship rather than mere ' +
        'reception. The preference is measured; what it means to the baby is ' +
        'the part nobody can ask about.' },
    { key: 'learns', name: 'listening and remembering', from: 32, to: 40,
      measured: 'A rhyme recited daily through the last weeks is recognised ' +
        'after birth, and the fetal heart rate settles on hearing it. Exposure ' +
        'to one language or two shapes how a newborn\'s brain encodes speech ' +
        'sounds.',
      ppne: 'The strongest ground the field has. Learning before birth is not ' +
        'in dispute; the question is how much of a self is doing the learning.' }
  ];

  /* The framework itself, stated plainly and separately. */
  var PPNE = {
    name: 'Prenatal and perinatal psychology',
    what: 'A field, and a teaching certificate from APPPAH, built on the claim ' +
      'that the primary period runs from before conception through the first ' +
      'year, and that what happens in it shapes a person afterwards.',
    holds: 'Its central assertions are that a baby before and around birth is ' +
      'conscious, sentient and aware with a sense of self, able to perceive, ' +
      'communicate and learn; that early experience is shaped by the mother\'s ' +
      'mindset, support, diet, emotions and birth circumstances; and that the ' +
      'mother and baby bond is foundational. It teaches that difficult births ' +
      'leave imprints which can show later as trouble with stress, ' +
      'self-regulation, attachment and learning.',
    evidence: 'Parts of this are well established. Fetal hearing, the ' +
      'preference for the mother\'s voice, learning a rhyme before birth, and ' +
      'associations between prenatal maternal stress and later infant ' +
      'development are all measured findings with decades behind them.',
    caution: 'The larger claims are not settled in the same way. That a baby ' +
      'holds a sense of self, that birth leaves retrievable imprints, and that ' +
      'specific later difficulties trace to specific birth events all go ' +
      'beyond what the research shows. Worth knowing as a framework people ' +
      'work within, and worth holding more loosely than the hearing studies.',
    useful: 'What survives either way is practical and gentle: your voice ' +
      'reaches the baby and is preferred, repetition is what makes something ' +
      'familiar, and stress in pregnancy is worth taking seriously as a health ' +
      'matter in its own right rather than as something to feel guilty about.'
  };

  function senseOf(week) {
    for (var i = 0; i < SENSES.length; i++) {
      if (week >= SENSES[i].from && week <= SENSES[i].to) return SENSES[i];
    }
    return SENSES[SENSES.length - 1];
  }

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
    SENSES: SENSES, PPNE: PPNE, senseOf: senseOf,
    trimesterOf: trimesterOf, stageOf: stageOf, markAt: markAt
  };
})(typeof window !== 'undefined' ? window : globalThis);
