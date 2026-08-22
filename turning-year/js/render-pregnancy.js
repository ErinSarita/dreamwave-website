/* render-pregnancy.js — the forty weeks drawn round. */
(function (global) {
  'use strict';
  var Preg = global.Pregnancy;
  var CX = 500, CY = 500;

  var R = {
    hub: 150,
    triIn: 158, triOut: 230, triLabel: 194,
    stageIn: 238, stageOut: 300, stageLabel: 269,
    weekIn: 308, weekOut: 356, weekNum: 332,
    markTick: 364, markLabel: 384
  };
  var COLOUR = { first: '#c96a9a', second: '#6b9e5a', third: '#4f8fb8' };
  var STAGE_COLOUR = { pre: '#8d8ab5', embryo: '#c96a9a', fetal: '#6b9e5a',
                       viable: '#d8a13a', term: '#4f8fb8' };

  function polar(r, a) {
    var t = (a - 90) * Math.PI / 180;
    return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function sector(r1, r2, a1, a2) {
    var p1 = polar(r2, a1), p2 = polar(r2, a2), p3 = polar(r1, a2), p4 = polar(r1, a1);
    var big = (a2 - a1) > 180 ? 1 : 0;
    return 'M' + f(p1[0]) + ' ' + f(p1[1]) +
      'A' + r2 + ' ' + r2 + ' 0 ' + big + ' 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
      'L' + f(p3[0]) + ' ' + f(p3[1]) +
      'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
  }
  function tangent(a) { return (a > 90 && a < 270) ? a + 180 : a; }
  function rot(a, x, y) { return 'rotate(' + f(tangent(a)) + ' ' + f(x) + ' ' + f(y) + ')'; }

  function render() {
    var n = Preg.WEEKS, step = 360 / n, parts = [];
    function edge(i) { return i * step; }
    function mid(i) { return (i + 0.5) * step; }

    Preg.TRIMESTERS.forEach(function (t) {
      var a1 = edge(t.from - 1), a2 = edge(t.to);
      parts.push('<path class="pg-tri" data-tri="' + t.key + '" d="' +
        sector(R.triIn, R.triOut, a1, a2) + '" fill="' + COLOUR[t.key] +
        '" fill-opacity=".3" stroke="' + COLOUR[t.key] + '" stroke-width="1" ' +
        'stroke-opacity=".7" style="cursor:pointer"><title>' + esc(t.name) +
        ' · weeks ' + t.from + ' to ' + t.to + ' · tap to read it</title></path>');
      var c = (a1 + a2) / 2, lp = polar(R.triLabel, c);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="15" font-family="var(--serif)" ' +
        'fill="' + COLOUR[t.key] + '" pointer-events="none" transform="' +
        rot(c, lp[0], lp[1]) + '">' + esc(t.name.split(' ')[0]) + '</text>');
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1] + 17) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10" fill="var(--ink-3)" ' +
        'pointer-events="none" transform="' + rot(c, lp[0], lp[1] + 17) + '">' +
        t.from + '–' + t.to + '</text>');
    });

    Preg.STAGES.forEach(function (s) {
      var a1 = edge(s.from - 1), a2 = edge(s.to);
      parts.push('<path d="' + sector(R.stageIn, R.stageOut, a1, a2) + '" fill="' +
        STAGE_COLOUR[s.key] + '" fill-opacity=".22" stroke="var(--line-soft)" ' +
        'stroke-width=".8" pointer-events="none"/>');
      if (a2 - a1 < 22) return;
      var c = (a1 + a2) / 2, lp = polar(R.stageLabel, c);
      parts.push('<text x="' + f(lp[0]) + '" y="' + f(lp[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="10.5" fill="var(--ink-2)" ' +
        'pointer-events="none" transform="' + rot(c, lp[0], lp[1]) + '">' +
        esc(s.name) + '</text>');
    });

    parts.push('<path d="' + sector(R.weekIn, R.weekOut, 0, 359.99) +
      '" fill="var(--bg-2)" fill-opacity=".5" stroke="var(--line-soft)" stroke-width=".8"/>');
    for (var i = 0; i < n; i++) {
      var w = i + 1, m = mid(i);
      parts.push('<path class="pg-week" data-week="' + w + '" d="' +
        sector(R.weekIn, R.weekOut, edge(i), edge(i + 1)) + '" fill="transparent" ' +
        'stroke="var(--line-soft)" stroke-width=".5" style="cursor:pointer"/>');
      var q = polar(R.weekNum, m);
      parts.push('<text x="' + f(q[0]) + '" y="' + f(q[1]) + '" text-anchor="middle" ' +
        'dominant-baseline="middle" font-size="12.5" font-family="var(--serif)" ' +
        'fill="var(--ink)" pointer-events="none" transform="' + rot(m, q[0], q[1]) + '">' +
        w + '</text>');
    }

    /* the weeks worth naming, ticked and labelled outside the ring */
    Preg.MARKS.forEach(function (mk) {
      var m = mid(mk.week - 1);
      var p1 = polar(R.weekOut, m), p2 = polar(R.markTick, m);
      parts.push('<path d="M' + f(p1[0]) + ' ' + f(p1[1]) + 'L' + f(p2[0]) + ' ' +
        f(p2[1]) + '" stroke="var(--sun)" stroke-width="1.4" opacity=".8" ' +
        'pointer-events="none"/>');
      var lp = polar(R.markLabel, m);
      parts.push('<text class="pg-mark" data-week="' + mk.week + '" x="' + f(lp[0]) +
        '" y="' + f(lp[1]) + '" text-anchor="' + (m > 180 ? 'end' : 'start') +
        '" dominant-baseline="middle" font-size="10.5" fill="var(--sun)" ' +
        'style="cursor:pointer" transform="' + rot(m, lp[0], lp[1]) + '">' +
        esc(mk.label) + '</text>');
    });

    parts.push('<circle cx="' + CX + '" cy="' + CY + '" r="' + R.hub +
      '" fill="var(--bg)" opacity=".82"/>');
    parts.push('<g id="pg-hub"></g>');
    parts.push('<path id="pg-sel" d="" fill="var(--ink)" fill-opacity=".13" ' +
      'stroke="var(--ink)" stroke-width="1" stroke-opacity=".55" opacity="0" ' +
      'pointer-events="none"/>');
    return { svg: parts.join('') };
  }

  function hub(lines) {
    var out = '', y = CY - 40;
    lines.forEach(function (l) {
      out += '<text x="' + CX + '" y="' + y + '" text-anchor="middle" font-size="' +
        l.size + '" ' + (l.serif ? 'font-family="var(--serif)" ' : '') +
        'fill="' + (l.colour || 'var(--ink-2)') + '">' + esc(l.text) + '</text>';
      y += l.gap || 22;
    });
    return out;
  }

  function highlight(root, week) {
    var el = root.querySelector('#pg-sel');
    if (!el) return;
    if (!week) { el.setAttribute('opacity', '0'); return; }
    var step = 360 / Preg.WEEKS;
    el.setAttribute('d', sector(R.triIn - 6, R.weekOut + 5, (week - 1) * step, week * step));
    el.setAttribute('opacity', '.9');
  }

  global.PregnancyView = { render: render, hub: hub, highlight: highlight, COLOUR: COLOUR };
})(typeof window !== 'undefined' ? window : globalThis);
