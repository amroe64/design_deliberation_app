/* Chart and report export for the admin Charts tab.
   - Every chart card gets a Download menu (PNG, JPG, SVG, PDF, CSV).
   - "Build a report" opens a builder: pick and order the items, page size, layout, title and format.
   Everything is made in the browser from the charts' own SVG. No libraries.
   Formats: PDF, PowerPoint (.pptx), Word (.docx), PNG, JPG, SVG, HTML, CSV, and a zip of everything. */
'use strict';
(function(){
const GREEN = '#255E4B', INK = '#1f232b', MUT = '#5b6070', LINE = '#e6e8ef', DARK = '#2A2E3B';
const SANS = "Carlito, Calibri, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif", SERIF = "'Source Serif 4', Cambria, Georgia, 'Times New Roman', serif";
const X = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug = s => String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'chart';
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };

/* ---------------- text measuring and wrapping ---------------- */
const MC = document.createElement('canvas').getContext('2d');
function tw(text, size, bold, serif){ MC.font = `${bold ? '700 ' : ''}${size}px ${serif ? SERIF : SANS}`; return MC.measureText(text).width; }
function wrap(text, maxW, size, bold, serif){
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' '), lines = []; let cur = '';
  words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (cur && tw(t, size, bold, serif) > maxW){ lines.push(cur); cur = w; } else cur = t; });
  if (cur) lines.push(cur);
  return lines;
}
const txt = (x, y, s, o) => `<text x="${x}" y="${y}" font-family="${o.serif ? SERIF : SANS}" font-size="${o.size}" font-weight="${o.bold ? 700 : 400}" fill="${o.fill || INK}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${X(s)}</text>`;

/* ---------------- read the live Charts tab ---------------- */
const root = () => document.querySelector('.ch-root');
function items(){
  const R = root(); if (!R) return [];
  const out = [];
  if (R.querySelector('.ch-kpis')) out.push({key:'kpis', title:'Summary numbers', kind:'kpis'});
  if (R.querySelector('.ch-ins')) out.push({key:'insights', title:'Key insights', kind:'insights'});
  R.querySelectorAll('.ch-card[data-key]').forEach(el => out.push({key:el.dataset.key, title:el.dataset.title, kind:'chart', wide:el.classList.contains('wide')}));
  return out;
}

/* Each item becomes one self-contained SVG block, BW units wide. Returns {w, h, body} */
const BW = 1000, PAD = 30;
function blockChart(el){
  const title = el.dataset.title, sub = el.dataset.sub, kicker = el.dataset.kicker;
  let y = PAD, g = '';
  if (kicker){ g += txt(PAD, y + 12, kicker.toUpperCase(), {size:13, bold:1, fill:GREEN, ls:1}); y += 24; }
  wrap(title, BW - 2 * PAD, 24, 1, 1).forEach(l => { g += txt(PAD, y + 22, l, {size:24, bold:1, serif:1}); y += 30; });
  if (sub){ y += 2; wrap(sub, BW - 2 * PAD, 15).forEach(l => { g += txt(PAD, y + 15, l, {size:15, fill:MUT}); y += 21; }); }
  y += 12;
  const svgs = [...el.querySelectorAll('svg')].filter(s => s.getAttribute('viewBox'));
  if (!svgs.length){
    const e = el.querySelector('.ch-empty'); g += txt(BW / 2, y + 40, e ? e.textContent : 'No data yet', {size:16, fill:MUT, anchor:'middle'}); y += 80;
  }
  svgs.forEach(s => {
    const [, , vw, vh] = s.getAttribute('viewBox').split(/[\s,]+/).map(Number), w = BW - 2 * PAD, h = vh * w / vw;
    g += `<svg x="${PAD}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}" font-family="${X(SANS)}">${s.innerHTML}</svg>`;
    y += h + 10;
  });
  const leg = [...el.querySelectorAll('.ch-legend span')].map(sp => { const i = sp.querySelector('i'); return {c:i ? (i.style.background || i.style.backgroundColor) : MUT, line:i && i.style.height === '3px', l:sp.textContent.trim()}; });
  if (leg.length){
    let x = PAD; y += 6;
    leg.forEach(it => { const w = 22 + tw(it.l, 14) + 22; if (x + w > BW - PAD){ x = PAD; y += 24; }
      g += it.line ? `<rect x="${x}" y="${y + 6}" width="14" height="3" rx="1.5" fill="${it.c}"/>` : `<rect x="${x}" y="${y}" width="14" height="14" rx="3" fill="${it.c}"/>`;
      g += txt(x + 21, y + 12, it.l, {size:14, fill:MUT}); x += w; });
    y += 26;
  }
  y += PAD - 8;
  return {w:BW, h:y, body:`<rect x="1" y="1" width="${BW - 2}" height="${y - 2}" rx="18" fill="#fff" stroke="${LINE}" stroke-width="2"/>${g}`};
}
function blockKpis(){
  const tiles = [...root().querySelectorAll('.ch-kpi')], n = tiles.length || 1, gap = 14, tw_ = (BW - gap * (n - 1)) / n;
  let g = '', maxH = 0;
  tiles.forEach((t, i) => {
    const x = i * (tw_ + gap), b = t.querySelector('b'), big = b ? b.textContent.trim() : '', col = b ? b.style.color || INK : INK;
    const lab = wrap((t.querySelector('span') || {}).textContent || '', tw_ - 32, 14), sub = wrap((t.querySelector('em') || {}).textContent || '', tw_ - 32, 12);
    let y = 22, inner = txt(x + 16, y + 34, big, {size:34, bold:1, serif:1, fill:col}); y += 50;
    lab.forEach(l => { inner += txt(x + 16, y + 14, l, {size:14, fill:INK}); y += 19; });
    sub.forEach(l => { inner += txt(x + 16, y + 14, l, {size:12, fill:MUT}); y += 16; });
    y += 16; maxH = Math.max(maxH, y);
    g += `<g data-h="${y}">${inner}</g>`.replace('<g', `<rect x="${x + 1}" y="1" width="${tw_ - 2}" height="__H__" rx="14" fill="#fff" stroke="${LINE}" stroke-width="2"/><g`);
  });
  g = g.split('__H__').join(maxH - 2);
  return {w:BW, h:maxH, body:g};
}
function blockInsights(){
  const boxes = [...root().querySelectorAll('.ch-box')], n = boxes.length || 1, gap = 16, bw = (BW - gap * (n - 1)) / n;
  let g = '', maxH = 0; const parts = [];
  boxes.forEach((b, i) => {
    const dark = b.classList.contains('dark'), h4 = b.querySelector('h4'), x = i * (bw + gap);
    let y = 26, inner = txt(x + 22, y + 18, h4 ? h4.textContent : '', {size:19, bold:1, serif:1, fill:dark ? '#f2a7b3' : (h4 && h4.style.color) || GREEN}); y += 34;
    wrap((b.querySelector('p') || {}).textContent || '', bw - 44, 15).forEach(l => { inner += txt(x + 22, y + 15, l, {size:15, fill:dark ? '#fff' : INK}); y += 21; });
    y += 20; maxH = Math.max(maxH, y); parts.push([x, dark, inner]);
  });
  parts.forEach(([x, dark, inner]) => { g += `<rect x="${x}" y="0" width="${bw}" height="${maxH}" rx="16" fill="${dark ? DARK : '#E6E8EF'}"/>${inner}`; });
  return {w:BW, h:maxH, body:g};
}
function block(key){
  if (key === 'kpis') return blockKpis();
  if (key === 'insights') return blockInsights();
  const el = root().querySelector(`.ch-card[data-key="${key}"]`);
  return el ? blockChart(el) : null;
}
const blockSVG = (b, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w * (scale || 1))}" height="${Math.round(b.h * (scale || 1))}" viewBox="0 0 ${b.w} ${b.h}">${b.body}</svg>`;

/* ---------------- "How this chart is made": plain-language methods + the numbers behind each chart ---------------- */
const MONO = "Consolas, Menlo, 'DejaVu Sans Mono', monospace";
const st = a => { a = (a || []).filter(x => x != null && !isNaN(x)); const n = a.length; if (!n) return {n:0};
  const m = a.reduce((x, y) => x + y, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0, h = n > 1 ? 1.96 * sd / Math.sqrt(n) : 0;
  return {n, m, sd, lo:m - h, hi:m + h, min:Math.min(...a), max:Math.max(...a)}; };
const f2 = v => v == null || isNaN(v) ? '—' : (+v).toFixed(2), f1 = v => v == null || isNaN(v) ? '—' : (+v).toFixed(1), pc = v => v == null || isNaN(v) ? '—' : Math.round(v * 100) + '%', f0 = v => v == null || isNaN(v) ? '—' : String(Math.round(v));
const condsWith = D => (D.conds || []).filter(c => c.teams.length);
function scope(D){
  const n = condsWith(D).reduce((a, c) => a + c.teams.length, 0), ex = D.excluded || {};
  const parts = [`${n} finished team${n === 1 ? '' : 's'} counted`];
  if (ex.spare) parts.push(`${ex.spare} leftover "spare" team${ex.spare === 1 ? '' : 's'} left out`);
  if (D.consent_only) parts.push(ex.nonconsent ? `${ex.nonconsent} team${ex.nonconsent === 1 ? '' : 's'} without consent left out` : 'only teams where everyone consented');
  if (D.simulated_students) parts.push(`includes ${D.simulated_students} SIMULATED student${D.simulated_students === 1 ? '' : 's'} (not real data)`);
  return parts.join(' · ') + '.';
}
function METHOD(key, D){
  const C = condsWith(D), OPT = D.opt || 448, NAIVE = D.naive_pts || 216, SINGLE = D.single_pts || Math.round((D.single_frac || 0) * OPT);
  const by = (fn, head, fmt) => ({head:['Type', 'Teams', ...head], rows:C.map(c => [c.label, String(c.teams.length), ...fn(c).map((v, i) => (fmt[i] || f2)(v))])});
  switch (key){
    case 'rq1': return {
      what:['Each dot is one team. Its height is how good the team\'s final design was, compared with the best design possible. The thick line is the average for that deliberation type.',
            'Dots are spread sideways only so they don\'t sit on top of each other. Their height is exact.'],
      formula:[`score = total true value of the final set ÷ ${OPT}`, `${OPT} = value of the best possible set within the $57 budget`,
               `"never-talked team" line = ${NAIVE} ÷ ${OPT} = ${f2(NAIVE / OPT)} (best set using only the shared table)`, `"best single engineer" line = ${SINGLE} ÷ ${OPT} = ${f2(SINGLE / OPT)} (best set one person could find with only their own findings)`],
      table:by(c => { const s = st(c.teams.map(t => t.frac)); return [s.m, s.sd, s.min, s.max]; }, ['Average', 'Spread (SD)', 'Lowest', 'Highest'], []),
      caveats:['"True value" uses the researcher\'s answer key: the correct values for the 9 features that have hidden findings, and the shared table for the other 3.', 'With few teams per type, averages can move a lot when one more team finishes.']};
    case 'rq2': return {
      what:['How much of the hidden information made it into the final design. 0 means the team did no better than using the shared table alone. 1 means they used everything there was to know.',
            'Bars are the average for each type. The black lines are 95% confidence intervals: a rough range for where the true average likely is. Short lines = more certain.'],
      formula:[`pooling = (team value − ${NAIVE}) ÷ (${OPT} − ${NAIVE})`, 'average = sum of team scores ÷ number of teams', '95% interval = average ± 1.96 × SD ÷ √(number of teams)'],
      table:by(c => { const s = st(c.teams.map(t => t.pooling)); return [s.m, s.sd, s.lo, s.hi]; }, ['Average', 'SD', '95% low', '95% high'], []),
      caveats:['The interval uses the normal approximation. With fewer than about 10 teams it is only a rough guide, and it can be wider than the chart; capped ends are drawn as arrows.', 'A negative score means the team did worse than if they had never talked.']};
    case 'rq3': return {
      what:['Bars: for each discipline, how many of its hidden "worth more" features ended up in the final design, as a share. Each discipline has 2 of these.',
            'Dashed line (right axis): how many of the 3 hidden "worth less" features (decoys) the team still paid for. Lower is better.'],
      formula:['bar = (number of that discipline\'s 2 "worth more" features in the final set) ÷ 2, averaged over teams', 'dashed line = number of the 3 "worth less" features in the final set, averaged over teams'],
      table:by(c => { const g = r => st(c.teams.map(t => t.gems && t.gems[r])).m; return [g('ME'), g('MF'), g('HF'), st(c.teams.map(t => t.decoys)).m]; }, ['Mechanical', 'Manufacturing', 'Human Factors', '"Worth less" funded'], [pc, pc, pc, f2]),
      caveats:['Only teams that had someone in that role count toward that discipline\'s bar.']};
    case 'steps': return {
      what:['Each team has up to 9 hidden findings (3 per person). The lines follow them through four steps and show what share is still alive at each one. A finding can only reach a step if it reached the step before.'],
      formula:['Spoken: its owner wrote it with the right direction (e.g. "F05 is worth more"). Just naming the feature does not count.',
               'Heard: a message or Mediator card stating it was on a teammate\'s screen for 2+ seconds (Caucus: only Mediator cards count).',
               'Integrated: after hearing it, a teammate repeated it correctly, or moved their picks its way, or a Mediator draft/recap stated it.',
               'Actioned: the final set follows it ("worth more" feature kept in, "worth less" feature left out).',
               'share at a step = findings that reached it ÷ all findings, summed over the type\'s teams'],
      table:by(c => { const tot = c.teams.reduce((a, t) => a + t.facts, 0), s = k => c.teams.reduce((a, t) => a + t.steps[k], 0) / (tot || 1); return [tot, s('spoken'), s('heard'), s('integrated'), s('actioned')]; },
               ['Findings', 'Spoken', 'Heard', 'Integrated', 'Actioned'], [f0, pc, pc, pc, pc]),
      caveats:['"Spoken" and "Integrated" are found by reading the words automatically (keywords + direction words). This misses some phrasings, like numbers with no direction word. Two people hand-check a sample of messages; use those codes for final results.', '"Heard" means it was on screen, not proof it was read. The survey recall question backs it up.']};
    case 'sat': return {
      what:['Each bubble is one deliberation type. Further right = students liked the discussion more. Higher = better final designs. Bigger bubble = more teams.', 'The label shows the average satisfaction and the share of students who felt heard.'],
      formula:['satisfaction = average answer to "I am satisfied with how the discussion went" (1–5): each team\'s average, then averaged over teams', 'felt heard = share of students who answered 4 or 5 to "I felt heard by my team"', `design score = same as RQ1 (team value ÷ ${OPT})`],
      table:by(c => { const s = st(c.teams.map(t => t.sat)), h = st(c.teams.map(t => t.felt_heard)), q = st(c.teams.map(t => t.frac)); return [s.m, h.m, q.m]; }, ['Satisfaction (1–5)', 'Felt heard', 'Design score'], [f1, pc, f2]),
      caveats:['Survey answers come only from students who finished the survey.']};
    case 'points': return {
      what:[`Starts from the best possible score (${OPT} points) and shows where an average team lost points. The colored bar is what the team kept. Each dark segment is points lost at one step.`],
      formula:[`best after a step = best set you could pick knowing the true value of only the findings that reached that step (shared table for the rest)`,
               `lost: not spoken = ${OPT} − best after Spoken`, 'lost: not heard = best after Spoken − best after Heard', 'lost: not integrated = best after Heard − best after Integrated',
               'final pick = best after Integrated − actual final value, split into:', '  wrong info = loss from acting on claims that pointed the wrong way', '  budget / other = the rest (negative = the team got lucky)'],
      table:by(c => { const m = k => st(c.teams.map(t => t.lost && t.lost[k])).m; return [st(c.teams.map(t => t.pts)).m, m('ns'), m('nh'), m('ni'), m('wrong'), m('other')]; },
               ['Kept', 'Not spoken', 'Not heard', 'Not integrated', 'Wrong info', 'Budget / other'], [f0, f0, f0, f0, f0, f0]),
      caveats:['Values are averages over teams, so the parts may not add up exactly to the total because of rounding.', 'This uses the same automatic step detection as the four-steps chart.']};
    case 'progress': return {
      what:['A live snapshot: how many students in counted teams are on each step right now.'],
      formula:['count of students on each step at the moment the report was made'],
      table:{head:['Type', 'Reading brief', 'Writing', 'Waiting', 'Deciding', 'Survey', 'Done'], rows:(D.conds || []).map(c => [c.label, ...['card', 'writing', 'waiting', 'final', 'survey', 'done'].map(k => String((c.progress || {})[k] || 0))])},
      caveats:['This changes every second during a session.']};
    case 'ratings': return {
      what:['After each Mediator draft or recap, students privately rated it Agree, Partly or Disagree. This counts every rating.'],
      formula:['count of each answer, all ratings in counted teams'],
      table:{head:['Type', 'Agree', 'Partly', 'Disagree', 'Agree share'], rows:(D.conds || []).filter(c => c.key !== 'unmediated').map(c => { const r = c.ratings || {}, t = (r.Agree || 0) + (r.Partly || 0) + (r.Disagree || 0); return [c.label, String(r.Agree || 0), String(r.Partly || 0), String(r.Disagree || 0), t ? pc((r.Agree || 0) / t) : '—']; })},
      caveats:['Guided discussion has no drafts or recaps to rate, so it shows no ratings.']};
    case 'msgs': return {
      what:['How much students wrote, by deliberation type.'],
      formula:['messages per person = messages sent ÷ students', 'words per message = average number of words (split on spaces)', 'seconds writing = average time from the first key press to Send, real students only'],
      table:{head:['Type', 'Messages', 'Per person', 'Words / message', 'Seconds writing'], rows:(D.conds || []).filter(c => c.msgs && c.msgs.count).map(c => [c.label, String(c.msgs.count), f1(c.msgs.per_person), f0(c.msgs.words), c.msgs.secs ? f0(c.msgs.secs) : '—'])},
      caveats:['Rounds closed by the researcher are left out. Simulated students are left out of writing time.']};
    case 'kpis': return {
      what:['Headline numbers. Each tile is explained below.'],
      formula:['teams finished = teams with a final decision where every member is done',
               '"+x more of the available value" = average design score of the best type − average for Unmediated',
               `beat the best single engineer = share of teams with design score > ${f2(SINGLE / OPT)}`,
               'felt heard = share of students who answered 4 or 5 to "I felt heard by my team"',
               `did worse than never talking = teams with design score < ${f2(NAIVE / OPT)}`],
      caveats:['"Best type" is whichever type has the highest average so far; with few teams this can change.']};
    case 'insights': return {
      what:['Two short sentences written automatically from the numbers.'],
      formula:['"carried into the final design" = findings that reached Actioned ÷ all findings, for the type with the highest and lowest share',
               '"best liked" = highest average satisfaction; "best scoring" = highest average design score'],
      caveats:['These are descriptions, not tests of significance.']};
  }
  return null;
}
function noteBlock(key, D, level){
  const M = METHOD(key, D); if (!M) return null;
  const W = BW, P = 30, iw = W - 2 * P;
  let y = 26, g = '';
  g += txt(P, y + 14, 'HOW THIS CHART IS MADE', {size:13, bold:1, fill:GREEN, ls:1}); y += 28;
  M.what.forEach(p => { wrap(p, iw, 15).forEach(l => { g += txt(P, y + 15, l, {size:15}); y += 21; }); y += 6; });
  if (M.formula && M.formula.length){
    const lines = []; M.formula.forEach(f => wrap(f, iw - 32, 14).forEach((l, i) => lines.push((i ? '   ' : '') + l)));
    const bh = 18 + lines.length * 21;
    g += `<rect x="${P}" y="${y}" width="${iw}" height="${bh}" rx="10" fill="#f3f5f8" stroke="${LINE}"/>`;
    lines.forEach((l, i) => { g += `<text x="${P + 16}" y="${y + 26 + i * 21}" font-family="${X(MONO)}" font-size="13.5" fill="${INK}" xml:space="preserve">${X(l)}</text>`; });
    y += bh + 12;
  }
  if (level === 'full' && M.table && M.table.rows.length){
    const head = M.table.head, n = head.length, first = Math.min(240, iw * .3), cw = (iw - first) / (n - 1), rh = 26;
    const cx = i => i === 0 ? P + 10 : P + first + cw * (i - 1) + cw - 10;
    g += txt(P, y + 14, 'The numbers behind it', {size:14, bold:1}); y += 24;
    g += `<rect x="${P}" y="${y}" width="${iw}" height="${rh}" fill="#E6E8EF" rx="6"/>`;
    head.forEach((h, i) => { g += txt(cx(i), y + 18, h, {size:12.5, bold:1, fill:MUT, anchor:i ? 'end' : null}); }); y += rh;
    M.table.rows.forEach((r, k) => { if (k % 2) g += `<rect x="${P}" y="${y}" width="${iw}" height="${rh}" fill="#fafbfc"/>`;
      r.forEach((v, i) => { g += txt(cx(i), y + 18, v, {size:13.5, bold:!i, anchor:i ? 'end' : null}); }); y += rh; });
    y += 10;
  }
  if (level === 'full' && M.caveats && M.caveats.length){
    g += txt(P, y + 14, 'Keep in mind', {size:14, bold:1}); y += 22;
    M.caveats.forEach(c => { wrap(c, iw - 18, 13.5).forEach((l, i) => { g += (i ? '' : `<circle cx="${P + 5}" cy="${y + 10}" r="2.5" fill="${MUT}"/>`) + txt(P + 16, y + 14, l, {size:13.5, fill:MUT}); y += 19; }); y += 3; });
  }
  wrap('Data: ' + scope(D), iw, 12.5).forEach(l => { g += txt(P, y + 16, l, {size:12.5, fill:MUT}); y += 17; });
  y += 20;
  return {w:W, h:y, body:`<rect x="1" y="1" width="${W - 2}" height="${y - 2}" rx="14" fill="#fbfcfd" stroke="${LINE}" stroke-width="2" stroke-dasharray="6 5"/>${g}`};
}
/* chart + its note, kept together as one block */
function withNote(b, key, D, level){
  if (!level || level === 'none') return b;
  const n = noteBlock(key, D, level); if (!n) return b;
  return {w:BW, h:b.h + 12 + n.h, body:`${b.body}<g transform="translate(0 ${b.h + 12})">${n.body}</g>`};
}
/* Methods appendix: definitions and settings, split into page-sized blocks */
function appendixBlocks(D){
  const OPT = D.opt || 448, NAIVE = D.naive_pts || 216, SINGLE = D.single_pts || Math.round((D.single_frac || 0) * OPT);
  const secs = [
    ['About this data', [`Session ${D.session || '—'} · report made ${new Date().toLocaleString()}.`, `Mediator used: ${D.mediator || '—'}. Discussion rounds: ${D.rounds || '—'}.`, scope(D),
      D.simulated_students ? 'IMPORTANT: this session includes simulated students. Their behavior is made up by the app to test it. Do not report these numbers as findings.' : 'All students counted were real participants.']],
    ['The task', [`Teams of three (Mechanical, Manufacturing, Human Factors) pick features for a home blood-pressure monitor. 12 features, $57 budget, all 12 cost $126.`,
      'Everyone sees the same shared value table. Each person also has 3 private test results: 2 show a feature is worth more than the table says, 1 shows a feature is worth less.',
      `Best possible set: ${OPT} points. Best set using only the shared table: ${NAIVE} points. Best set any one person could find alone: ${SINGLE} points.`]],
    ['Deliberation types', ['Caucus: each person writes privately to the Mediator, which drafts a plan; the Mediator writes the final decision.',
      'Guided discussion: the team chats; the Mediator asks a question between rounds and writes the final decision.',
      'Summary only: the team chats; the Mediator posts a neutral recap after each round; the final set is the features at least 2 of 3 pick in the last round.',
      'Unmediated: the team chats with no Mediator; the final set is the features at least 2 of 3 pick in the last round.']],
    ['Which teams count', ['A team counts once it has a final decision. Leftover "spare" teams of 1–2 people are always left out. With "Consenting teams only" on, teams of students who said no to research use are left out.',
      'Every chart uses the same teams, so numbers can be compared across charts.']],
    ['How messages are scored', ['A finding is "spoken" only when a message names the feature and gives a direction in the same sentence (worth more / keep / need, or worth less / drop / skip). Naming a feature alone does not count.',
      'This is done automatically with word lists, so it misses some phrasings. Before reporting results, two people should hand-code a sample of messages (export: coding sample CSV) and check agreement.']],
    ['Statistics used', ['Averages are plain means over teams (each team counts once). SD is the sample standard deviation (n − 1).',
      '95% intervals use mean ± 1.96 × SD ÷ √n. With small n this is approximate; a t-based interval or a bootstrap is better for the final paper.',
      'Charts show descriptions only. No significance tests are run here.']],
  ];
  const blocks = []; let cur = null;
  const start = () => { cur = {g:'', y:30}; cur.g += txt(30, 54, blocks.length ? 'Methods (continued)' : 'Methods and definitions', {size:26, bold:1, serif:1}); cur.y = 80; };
  const finish = () => { blocks.push({w:BW, h:cur.y + 20, body:`<rect x="1" y="1" width="${BW - 2}" height="${cur.y + 18}" rx="18" fill="#fff" stroke="${LINE}" stroke-width="2"/>${cur.g}`}); };
  start();
  secs.forEach(([h, ps]) => {
    const lines = ps.map(p => wrap(p, BW - 76, 15)), need = 34 + lines.reduce((a, l) => a + l.length * 21 + 8, 0);
    if (cur.y + need > 1250){ finish(); start(); }
    cur.g += txt(30, cur.y + 20, h, {size:18, bold:1, fill:GREEN}); cur.y += 32;
    lines.forEach(ls => { cur.g += `<circle cx="38" cy="${cur.y + 10}" r="3" fill="${GREEN}"/>`; ls.forEach(l => { cur.g += txt(52, cur.y + 15, l, {size:15}); cur.y += 21; }); cur.y += 8; });
    cur.y += 6;
  });
  finish();
  return blocks;
}

/* ---------------- pages ---------------- */
const PAGES = {
  letter:  {label:'Letter, portrait', w:1275, h:1650, pt:[612, 792]},
  letterL: {label:'Letter, landscape', w:1650, h:1275, pt:[792, 612]},
  a4:      {label:'A4, portrait', w:1240, h:1754, pt:[595, 842]},
  a4L:     {label:'A4, landscape', w:1754, h:1240, pt:[842, 595]},
  slide:   {label:'Slides 16:9', w:1920, h:1080, pt:[960, 540]},
};
const LAYOUTS = {
  flow:  'Document (charts flow down the pages)',
  one:   'One item per page',
  two:   'Two items per page',
  grid:  '2 × 2 grid per page',
  long:  'One long image (no pages)',
};
function headerSVG(o, W){
  let g = `<rect x="0" y="0" width="${W}" height="10" fill="${GREEN}"/>`, y = 70;
  wrap(o.title, W - 160, 40, 1, 1).forEach(l => { g += txt(80, y, l, {size:40, bold:1, serif:1}); y += 48; });
  if (o.subtitle){ wrap(o.subtitle, W - 160, 18).forEach(l => { g += txt(80, y, l, {size:18, fill:MUT}); y += 26; }); }
  return {g, h:y + 6};
}
const footerSVG = (o, W, H, n, N) => `<line x1="80" y1="${H - 56}" x2="${W - 80}" y2="${H - 56}" stroke="${LINE}" stroke-width="2"/>`
  + txt(80, H - 28, o.footer || 'Design Deliberation Study · Virginia Tech', {size:15, fill:MUT}) + (o.pageNums ? txt(W - 80, H - 28, `Page ${n} of ${N}`, {size:15, fill:MUT, anchor:'end'}) : '');
const place = (b, x, y, w, h) => { const s = Math.min(w / b.w, h / b.h), bw = b.w * s, bh = b.h * s;
  return `<svg x="${x + (w - bw) / 2}" y="${y}" width="${bw}" height="${bh}" viewBox="0 0 ${b.w} ${b.h}">${b.body}</svg>`; };
/* Lay the chosen blocks out into pages. Returns [{w, h, svg}] */
function layout(o){
  const D = window.__CH_D || {};
  const blocks = o.keys.map(k => { const b = block(k); return b ? withNote(b, k, D, o.explain) : null; }).filter(Boolean);
  if (o.appendix) blocks.push(...appendixBlocks(D));
  if (o.layout === 'long'){
    const W = 1400, M = 60, head = o.header ? headerSVG(o, W) : {g:'', h:30};
    let y = head.h + 10, g = head.g;
    blocks.forEach(b => { const s = (W - 2 * M) / b.w; g += place(b, M, y, W - 2 * M, b.h * s); y += b.h * s + 28; });
    y += 70; g += footerSVG({...o, pageNums:false}, W, y, 1, 1);
    return [{w:W, h:y, svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="100%" height="100%" fill="#EFF1F5"/>${g}</svg>`}];
  }
  const P = PAGES[o.page] || PAGES.letter, W = P.w, H = P.h, M = 80, top = 50, bot = 80, gap = 26;
  const pages = []; let cur = null;
  const newPage = first => { const head = first && o.header ? headerSVG(o, W) : {g:`<rect x="0" y="0" width="${W}" height="10" fill="${GREEN}"/>`, h:top}; cur = {g:head.g, y:head.h + 10, y0:head.h + 10, n:0}; pages.push(cur); };
  newPage(true);
  const areaW = W - 2 * M, bottom = () => H - bot - 10;
  if (o.layout === 'flow'){
    blocks.forEach(b => {
      let s = areaW / b.w, h = b.h * s;
      const full = bottom() - (top + 10);
      if (h > full){ s = full / b.h; h = full; }
      if (cur.y + h > bottom() && cur.n) newPage(false);
      if (cur.y + h > bottom()){ s = (bottom() - cur.y) / b.h; h = b.h * s; }
      cur.g += place(b, M, cur.y, areaW, h); cur.y += h + gap; cur.n++;
    });
  } else {
    const per = o.layout === 'one' ? 1 : o.layout === 'two' ? 2 : 4;
    blocks.forEach((b, i) => {
      if (i && i % per === 0) newPage(false);
      const k = i % per, y0 = cur.y0, availH = bottom() - y0;
      if (per === 4){
        const cw = (areaW - gap) / 2, ch = (availH - gap) / 2, cx = M + (k % 2) * (cw + gap), cy = y0 + Math.floor(k / 2) * (ch + gap);
        cur.g += place(b, cx, cy, cw, ch);
      } else {
        const ch = (availH - gap * (per - 1)) / per;
        cur.g += place(b, M, y0 + k * (ch + gap), areaW, ch);
      }
      cur.n++;
    });
  }
  const N = pages.length;
  return pages.map((p, i) => ({w:W, h:H, svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#ffffff"/>${p.g}${footerSVG(o, W, H, i + 1, N)}</svg>`}));
}

/* ---------------- raster + file writers ---------------- */
function svgToCanvas(svg, w, h, scale){
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); res(c); };
    img.onerror = () => rej(new Error('Could not draw the chart'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
const canvasBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
const blobBytes = async b => new Uint8Array(await b.arrayBuffer());
const enc = new TextEncoder();
const u8 = s => typeof s === 'string' ? enc.encode(s) : s;
function concat(parts){ const n = parts.reduce((a, p) => a + p.length, 0), out = new Uint8Array(n); let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; }); return out; }

/* PDF: one JPEG per page, sized to the page in points */
function makePDF(pages){
  const parts = [], offs = []; let pos = 0;
  const add = d => { d = u8(d); parts.push(d); pos += d.length; };
  const obj = (n, body) => { offs[n] = pos; add(`${n} 0 obj\n`); body.forEach(add); add('\nendobj\n'); };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const N = pages.length, kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`]);
  pages.forEach((p, i) => {
    const pn = 3 + i * 3, cn = pn + 1, im = pn + 2, [W, H] = p.pt;
    obj(pn, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${cn} 0 R >>`]);
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    obj(cn, [`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`]);
    obj(im, [`<< /Type /XObject /Subtype /Image /Width ${p.px[0]} /Height ${p.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`, p.jpg, '\nendstream']);
  });
  const xref = pos, total = 3 + N * 3;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob([concat(parts)], {type:'application/pdf'});
}

/* ZIP (stored, no compression) */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = d => { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = CRC[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function makeZip(files, type){
  const local = [], central = []; let off = 0;
  const le = (n, b) => { const a = new Uint8Array(b); for (let i = 0; i < b; i++) a[i] = (n >>> (8 * i)) & 255; return a; };
  files.forEach(f => {
    const name = enc.encode(f.name), data = u8(f.data), crc = crc32(data);
    const head = concat([le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), name]);
    local.push(head, data);
    central.push(concat([le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(off, 4), name]));
    off += head.length + data.length;
  });
  const cd = concat(central);
  return new Blob([...local, cd, concat([le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cd.length, 4), le(off, 4), le(0, 2)])], {type:type || 'application/zip'});
}

/* PowerPoint: one picture per slide */
function makePPTX(imgs, P){
  const EMU = 12700, cx = Math.round(P.pt[0] * EMU), cy = Math.round(P.pt[1] * EMU), N = imgs.length;
  const ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const rel = (id, type, target) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`;
  const rels = r => H + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${r}</Relationships>`;
  const emptyTree = '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>';
  const files = [
    {name:'[Content_Types].xml', data:H + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>`
      + `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>`
      + imgs.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('') + '</Types>'},
    {name:'_rels/.rels', data:rels(rel('rId1', 'officeDocument', 'ppt/presentation.xml'))},
    {name:'ppt/presentation.xml', data:H + `<p:presentation ${ns}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${imgs.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${cx}" cy="${cy}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`},
    {name:'ppt/_rels/presentation.xml.rels', data:rels(rel('rId1', 'slideMaster', 'slideMasters/slideMaster1.xml') + rel('rId2', 'theme', 'theme/theme1.xml') + imgs.map((_, i) => rel(`rId${i + 3}`, 'slide', `slides/slide${i + 1}.xml`)).join(''))},
    {name:'ppt/slideMasters/slideMaster1.xml', data:H + `<p:sldMaster ${ns}>${emptyTree}<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`},
    {name:'ppt/slideMasters/_rels/slideMaster1.xml.rels', data:rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml') + rel('rId2', 'theme', '../theme/theme1.xml'))},
    {name:'ppt/slideLayouts/slideLayout1.xml', data:H + `<p:sldLayout ${ns} type="blank">${emptyTree}<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`},
    {name:'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data:rels(rel('rId1', 'slideMaster', '../slideMasters/slideMaster1.xml'))},
    {name:'ppt/theme/theme1.xml', data:H + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Study"><a:themeElements><a:clrScheme name="Study"><a:dk1><a:srgbClr val="1F232B"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="255E4B"/></a:dk2><a:lt2><a:srgbClr val="EFF1F5"/></a:lt2><a:accent1><a:srgbClr val="332288"/></a:accent1><a:accent2><a:srgbClr val="44AA99"/></a:accent2><a:accent3><a:srgbClr val="117733"/></a:accent3><a:accent4><a:srgbClr val="CC6677"/></a:accent4><a:accent5><a:srgbClr val="2A2E3B"/></a:accent5><a:accent6><a:srgbClr val="9AA0AD"/></a:accent6><a:hlink><a:srgbClr val="255E4B"/></a:hlink><a:folHlink><a:srgbClr val="255E4B"/></a:folHlink></a:clrScheme>`
      + `<a:fontScheme name="Study"><a:majorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
      + `<a:fmtScheme name="Study"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`},
  ];
  imgs.forEach((png, i) => {
    files.push({name:`ppt/media/image${i + 1}.png`, data:png});
    files.push({name:`ppt/slides/_rels/slide${i + 1}.xml.rels`, data:rels(rel('rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml') + rel('rId2', 'image', `../media/image${i + 1}.png`))});
    files.push({name:`ppt/slides/slide${i + 1}.xml`, data:H + `<p:sld ${ns}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:pic><p:nvPicPr><p:cNvPr id="2" name="Page ${i + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`});
  });
  return makeZip(files, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

/* Word: one picture per page, page size and margins set to match */
function makeDOCX(imgs, P){
  const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', EMU = 12700, TW = 20;
  const pw = P.pt[0] * TW, ph = P.pt[1] * TW, m = 360, cw = (P.pt[0] - 36) * EMU, ch = (P.pt[1] - 36) * EMU;
  const pic = (i) => `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(cw)}" cy="${Math.round(ch)}"/><wp:docPr id="${i + 1}" name="Page ${i + 1}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${i + 1}" name="page${i + 1}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImg${i + 1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(cw)}" cy="${Math.round(ch)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  const brk = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  const body = imgs.map((_, i) => pic(i)).join(brk);
  const files = [
    {name:'[Content_Types].xml', data:H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:'_rels/.rels', data:H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/_rels/document.xml.rels', data:H + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + imgs.map((_, i) => `<Relationship Id="rImg${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i + 1}.png"/>`).join('') + '</Relationships>'},
    {name:'word/document.xml', data:H + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="${pw}" w:h="${ph}"${P.pt[0] > P.pt[1] ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${m}" w:right="${m}" w:bottom="${m}" w:left="${m}" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`},
  ];
  imgs.forEach((png, i) => files.push({name:`word/media/page${i + 1}.png`, data:png}));
  return makeZip(files, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

/* ---------------- CSV data behind each chart ---------------- */
const csvCell = v => { v = v == null ? '' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const toCSV = rows => rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
const avg = a => { a = a.filter(x => x != null && !isNaN(x)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : null; };
const TEAMCOLS = {
  rq1:['frac'], rq2:['pooling'], rq3:['gems.ME', 'gems.MF', 'gems.HF', 'decoys'], steps:['facts', 'steps.spoken', 'steps.heard', 'steps.integrated', 'steps.actioned'],
  sat:['sat', 'felt_heard', 'frac'], points:['pts', 'lost.ns', 'lost.nh', 'lost.ni', 'lost.wrong', 'lost.other'],
};
const get = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
function csvFor(key){
  const D = window.__CH_D; if (!D) return 'no data\n';
  const C = D.conds || [];
  if (TEAMCOLS[key]){
    const cols = TEAMCOLS[key], rows = [['section', 'type', 'team', 'n_teams', ...cols]];
    C.forEach(c => rows.push(['by type', c.label, '', c.teams.length, ...cols.map(k => avg(c.teams.map(t => get(t, k))))]));
    C.forEach(c => c.teams.forEach(t => rows.push(['by team', c.label, t.id, 1, ...cols.map(k => get(t, k))])));
    return toCSV(rows);
  }
  const flat = (field) => { const ks = [...new Set(C.flatMap(c => Object.keys(c[field] || {})))]; return toCSV([['type', ...ks], ...C.map(c => [c.label, ...ks.map(k => (c[field] || {})[k] ?? 0)])]); };
  if (key === 'progress') return flat('progress');
  if (key === 'ratings') return flat('ratings');
  if (key === 'msgs') return flat('msgs');
  if (key === 'kpis') return toCSV([['value', 'label', 'note'], ...[...root().querySelectorAll('.ch-kpi')].map(t => [(t.querySelector('b') || {}).textContent, (t.querySelector('span') || {}).textContent, (t.querySelector('em') || {}).textContent])]);
  if (key === 'insights') return toCSV([['heading', 'text'], ...[...root().querySelectorAll('.ch-box')].map(b => [(b.querySelector('h4') || {}).textContent, (b.querySelector('p') || {}).textContent])]);
  return 'no data\n';
}

/* ---------------- saving (with a fallback for phones and embedded views) ---------------- */
let DL = null, dlTried = false;
async function viewerDownloads(){
  if (dlTried) return DL; dlTried = true;
  try { if (window.claude && typeof window.claude.use === 'function') DL = await window.claude.use('downloads'); } catch (_){ DL = null; }
  return DL;
}
async function save(blob, name){
  const dl = await viewerDownloads();
  if (dl){
    try { await dl.save({filename:name, data:blob}); return; }
    catch (err){
      const code = err && err.code;
      if (code === 'declined') return toast('Download cancelled.');
      if (code === 'rate_limited') return toast('One download at a time. Try again in a moment.');
      if (code === 'rejected_extension' || code === 'extension_not_enabled') return toast('That file type cannot be saved here. Try PDF or PNG.');
      if (code === 'too_large') return toast('That file is too big to save here. Try fewer items or PNG instead.');
      /* unavailable or anything else: fall back to a normal browser download below */
    }
  }
  plainSave(blob, name);
}
function toast(msg){
  let el = document.getElementById('xp-note');
  if (!el){ el = document.createElement('div'); el.id = 'xp-note'; document.body.appendChild(el); }
  el.className = 'xp-note show'; el.innerHTML = `<span>${X(msg)}</span><button type="button" class="xp-x" aria-label="Close">×</button>`;
  el.querySelector('.xp-x').onclick = () => el.classList.remove('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 5000);
}
function plainSave(blob, name){
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  note(name, url, blob.type);
}
function note(name, url, type){
  let el = document.getElementById('xp-note');
  if (!el){ el = document.createElement('div'); el.id = 'xp-note'; document.body.appendChild(el); }
  el.className = 'xp-note show';
  el.innerHTML = `<span>Downloading <b>${X(name)}</b></span><button type="button" class="xp-open">Didn't start? Open it</button><button type="button" class="xp-x" aria-label="Close">×</button>`;
  el.querySelector('.xp-x').onclick = () => el.classList.remove('show');
  el.querySelector('.xp-open').onclick = () => viewer(name, url, type);
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 9000);
}
function viewer(name, url, type){
  const ov = document.createElement('div'); ov.className = 'xp-ov';
  const inner = /^image\//.test(type) ? `<img src="${url}" alt="${X(name)}"><p class="xp-hint">On a phone: press and hold the picture, then Save.</p>`
    : type === 'application/pdf' ? `<iframe src="${url}" title="${X(name)}"></iframe>`
    : `<p class="xp-hint">This file type can't be shown here.</p>`;
  ov.innerHTML = `<div class="xp-view"><div class="xp-vh"><b>${X(name)}</b><span><a class="xp-btn" href="${url}" download="${X(name)}" target="_blank" rel="noopener">Download</a><button type="button" class="xp-btn ghost xp-close">Close</button></span></div>${inner}</div>`;
  ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('.xp-close')) ov.remove(); });
  document.body.appendChild(ov);
}

/* ---------------- build files ---------------- */
async function renderPages(o){ const pages = layout(o); return pages; }
async function exportFiles(o){
  const P = PAGES[o.page] || PAGES.letter, base = slug(o.title) + '_' + stamp();
  const pages = await renderPages(o);
  const scale = o.layout === 'long' ? 1.5 : (o.format === 'pptx' || o.format === 'docx' ? 1.25 : 1.5);
  const raster = async (type, q) => Promise.all(pages.map(async p => blobBytes(await canvasBlob(await svgToCanvas(p.svg, p.w, p.h, scale), type, q))));
  const multi = (ext, datas) => datas.length === 1 ? {blob:new Blob([datas[0]], {type:ext === 'svg' ? 'image/svg+xml' : 'image/' + (ext === 'jpg' ? 'jpeg' : ext)}), name:`${base}.${ext}`}
    : {blob:makeZip(datas.map((d, i) => ({name:`${base}_page${String(i + 1).padStart(2, '0')}.${ext}`, data:d}))), name:`${base}_${ext}.zip`};
  switch (o.format){
    case 'pdf': {
      const jp = await Promise.all(pages.map(async p => { const c = await svgToCanvas(p.svg, p.w, p.h, scale); return {jpg:await blobBytes(await canvasBlob(c, 'image/jpeg', .92)), px:[c.width, c.height],
        pt:o.layout === 'long' ? [p.w * .5, p.h * .5] : P.pt}; }));
      return [{blob:makePDF(jp), name:`${base}.pdf`}];
    }
    case 'png': return [multi('png', await raster('image/png'))];
    case 'jpg': return [multi('jpg', await raster('image/jpeg', .92))];
    case 'svg': return [multi('svg', pages.map(p => enc.encode(p.svg)))];
    case 'pptx': return [{blob:makePPTX(await raster('image/png'), o.layout === 'long' ? {pt:[pages[0].w * .5, pages[0].h * .5]} : P), name:`${base}.pptx`}];
    case 'docx': return [{blob:makeDOCX(await raster('image/png'), o.layout === 'long' ? {pt:[pages[0].w * .5, pages[0].h * .5]} : P), name:`${base}.docx`}];
    case 'html': {
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${X(o.title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#E6E8EF;font-family:${SANS}}.pg{max-width:1100px;margin:24px auto;box-shadow:0 4px 18px rgba(0,0,0,.12);background:#fff}.pg svg{display:block;width:100%;height:auto}@media print{body{background:#fff}.pg{margin:0;box-shadow:none;page-break-after:always;max-width:none}}@page{size:${P.pt[0]}pt ${P.pt[1]}pt;margin:0}</style></head><body>${pages.map(p => `<div class="pg">${p.svg}</div>`).join('')}</body></html>`;
      return [{blob:new Blob([html], {type:'text/html'}), name:`${base}.html`}];
    }
    case 'csv': {
      const fs = o.keys.map(k => ({name:`${slug(itemTitle(k))}.csv`, data:csvFor(k)}));
      return [fs.length === 1 ? {blob:new Blob([fs[0].data], {type:'text/csv'}), name:`${base}.csv`} : {blob:makeZip(fs), name:`${base}_data.zip`}];
    }
    case 'all': {
      const files = [];
      for (const k of o.keys){ const b = block(k); if (!b) continue; const s = blockSVG(b), nm = slug(itemTitle(k));
        files.push({name:`svg/${nm}.svg`, data:s});
        files.push({name:`png/${nm}.png`, data:await blobBytes(await canvasBlob(await svgToCanvas(s, b.w, b.h, 2), 'image/png'))});
        files.push({name:`csv/${nm}.csv`, data:csvFor(k)}); }
      const jp = await Promise.all(pages.map(async p => { const c = await svgToCanvas(p.svg, p.w, p.h, 1.5); return {jpg:await blobBytes(await canvasBlob(c, 'image/jpeg', .92)), px:[c.width, c.height], pt:o.layout === 'long' ? [p.w * .5, p.h * .5] : P.pt}; }));
      files.push({name:`report.pdf`, data:await blobBytes(makePDF(jp))});
      return [{blob:makeZip(files), name:`${base}_everything.zip`}];
    }
  }
}
const itemTitle = k => (items().find(i => i.key === k) || {}).title || k;

/* single chart download */
async function single(key, fmt){
  const b = block(key); if (!b) return;
  const name = slug(itemTitle(key)) + '_' + stamp();
  if (fmt === 'csv') return save(new Blob([csvFor(key)], {type:'text/csv'}), name + '.csv');
  const s = blockSVG(b);
  if (fmt === 'svg') return save(new Blob([s], {type:'image/svg+xml'}), name + '.svg');
  const c = await svgToCanvas(s, b.w, b.h, 2);
  if (fmt === 'png') return save(await canvasBlob(c, 'image/png'), name + '.png');
  if (fmt === 'jpg') return save(await canvasBlob(c, 'image/jpeg', .94), name + '.jpg');
  if (fmt === 'pdf'){ const bn = withNote(b, key, window.__CH_D || {}, 'full'), cn = await svgToCanvas(blockSVG(bn), bn.w, bn.h, 2), jpg = await blobBytes(await canvasBlob(cn, 'image/jpeg', .94)); return save(makePDF([{jpg, px:[cn.width, cn.height], pt:[bn.w * .6, bn.h * .6]}]), name + '.pdf'); }
}

/* ---------------- UI: per-chart menu ---------------- */
const FMT1 = [['png','PNG image'], ['jpg','JPG image'], ['svg','SVG (sharp at any size)'], ['pdf','PDF with how it is made'], ['csv','Data (CSV)']];
let menu = null;
function closeMenu(){ if (menu){ menu.remove(); menu = null; } }
document.addEventListener('click', e => {
  const b = e.target.closest('.ch-dl');
  if (b){ e.preventDefault(); e.stopPropagation(); const key = b.dataset.key; closeMenu();
    menu = document.createElement('div'); menu.className = 'xp-menu';
    menu.innerHTML = `<div class="xp-mh">Download this chart</div>` + FMT1.map(([f, l]) => `<button type="button" data-f="${f}">${l}</button>`).join('');
    document.body.appendChild(menu);
    const r = b.getBoundingClientRect(), mw = 220;
    menu.style.top = (window.scrollY + r.bottom + 6) + 'px'; menu.style.left = Math.max(8, Math.min(window.scrollX + r.right - mw, window.scrollX + document.documentElement.clientWidth - mw - 8)) + 'px';
    menu.addEventListener('click', async ev => { const f = ev.target.closest('button[data-f]'); if (!f) return; closeMenu(); try { await single(key, f.dataset.f); } catch (err){ alert('Could not make the file: ' + err.message); } });
    return; }
  if (menu && !e.target.closest('.xp-menu')) closeMenu();
  const r = e.target.closest('.ch-report');
  if (r){ e.preventDefault(); openBuilder(r.dataset.preset); }
}, true);

/* ---------------- UI: report builder ---------------- */
const FORMATS = [['pdf','PDF'], ['pptx','PowerPoint (.pptx)'], ['docx','Word (.docx)'], ['png','PNG images'], ['jpg','JPG images'], ['svg','SVG images'], ['html','Web page (.html)'], ['csv','Data only (CSV)'], ['all','Everything (zip: every chart as PNG + SVG + CSV, plus the PDF)']];
const PRESETS = {
  paper:  {format:'pdf', page:'letter', layout:'flow'},
  slides: {format:'pptx', page:'slide', layout:'one'},
  images: {format:'png', page:'letter', layout:'one'},
  poster: {format:'png', page:'letter', layout:'long'},
};
const KEY = 'tds_report_v1';
function loadOpts(){
  const all = items(), saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_){ return null; } })() || {};
  const keysKnown = all.map(i => i.key), order = (saved.order || []).filter(k => keysKnown.includes(k));
  keysKnown.forEach(k => { if (!order.includes(k)) order.push(k); });
  const D = window.__CH_D || {};
  return {title:saved.title || 'Design Deliberation Study: results', subtitle:saved.subtitle ?? `Session ${D.session || ''} · ${new Date().toLocaleDateString([], {month:'long', day:'numeric', year:'numeric'})}`.replace('Session  · ', ''),
    footer:saved.footer || 'Design Deliberation Study · Grado Department of Industrial and Systems Engineering · Virginia Tech',
    format:saved.format || 'pdf', page:saved.page || 'letter', layout:saved.layout || 'flow', header:saved.header ?? true, pageNums:saved.pageNums ?? true,
    explain:saved.explain || 'full', appendix:saved.appendix ?? true,
    order, off:saved.off || []};
}
const saveOpts = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (_){} };
let B = null;
function openBuilder(preset){
  const o = loadOpts(); if (preset && PRESETS[preset]) Object.assign(o, PRESETS[preset]);
  B && B.remove();
  B = document.createElement('div'); B.className = 'xp-ov'; B.innerHTML = '<div class="xp-dlg" role="dialog" aria-label="Build a report"></div>'; document.body.appendChild(B);
  const dlg = B.querySelector('.xp-dlg');
  const opt = (arr, v) => arr.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${X(l)}</option>`).join('');
  function draw(){
    const all = items(), titles = Object.fromEntries(all.map(i => [i.key, i.title]));
    const pagesDisabled = o.layout === 'long' || o.format === 'csv';
    dlg.innerHTML = `<div class="xp-dh"><h3>Build a report</h3><button type="button" class="xp-btn ghost" data-x="close">Close</button></div>
    <div class="xp-presets"><span>Quick start:</span><button type="button" data-p="paper">Paper report (PDF)</button><button type="button" data-p="slides">Slide deck (PowerPoint)</button><button type="button" data-p="images">One image per chart (PNG)</button><button type="button" data-p="poster">One long image</button></div>
    <div class="xp-body"><div class="xp-form">
      <label>Title<input type="text" data-o="title" value="${X(o.title)}"></label>
      <label>Subtitle<input type="text" data-o="subtitle" value="${X(o.subtitle)}"></label>
      <div class="xp-row"><label>Format<select data-o="format">${opt(FORMATS, o.format)}</select></label></div>
      <div class="xp-row"><label>Layout<select data-o="layout">${opt(Object.entries(LAYOUTS), o.layout)}</select></label>
        <label>Page${pagesDisabled ? ' <em>(not used)</em>' : ''}<select data-o="page" ${pagesDisabled ? 'disabled' : ''}>${opt(Object.entries(PAGES).map(([k, v]) => [k, v.label]), o.page)}</select></label></div>
      <label>Explain each chart<select data-o="explain">${opt([['full','Full: what it shows, the math, the numbers table, caveats'], ['short','Short: what it shows and the math'], ['none','No explanations (charts only)']], o.explain)}</select></label>
      <div class="xp-row xp-checks"><label class="chip"><input type="checkbox" data-o="header" ${o.header ? 'checked' : ''}> Title at the top</label><label class="chip"><input type="checkbox" data-o="pageNums" ${o.pageNums ? 'checked' : ''}> Page numbers</label><label class="chip"><input type="checkbox" data-o="appendix" ${o.appendix ? 'checked' : ''}> Methods appendix</label></div>
      <div class="xp-lh"><b>What to include, in order</b><span><button type="button" class="xp-link" data-x="allon">All</button> · <button type="button" class="xp-link" data-x="alloff">None</button></span></div>
      <ol class="xp-list">${o.order.map((k, i) => `<li class="${o.off.includes(k) ? 'off' : ''}"><label><input type="checkbox" data-k="${k}" ${o.off.includes(k) ? '' : 'checked'}> ${X(titles[k] || k)}</label>
        <span><button type="button" class="xp-mv" data-up="${i}" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button type="button" class="xp-mv" data-dn="${i}" ${i < o.order.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button></span></li>`).join('')}</ol>
    </div><div class="xp-prev"><div class="xp-ph"><b>Preview</b><span id="xp-count"></span></div><div class="xp-thumbs" id="xp-thumbs"></div></div></div>
    <div class="xp-foot"><span class="xp-status" id="xp-status"></span><button type="button" class="xp-btn" data-x="go">Download</button></div>`;
    preview();
  }
  function opts(){ return {...o, keys:o.order.filter(k => !o.off.includes(k))}; }
  let pt = null;
  function preview(){
    clearTimeout(pt); pt = setTimeout(() => {
      const th = dlg.querySelector('#xp-thumbs'), cnt = dlg.querySelector('#xp-count'); if (!th) return;
      const q = opts();
      if (!q.keys.length){ th.innerHTML = '<p class="xp-hint">Pick at least one item.</p>'; cnt.textContent = ''; return; }
      if (o.format === 'csv'){ th.innerHTML = `<p class="xp-hint">${q.keys.length} CSV file${q.keys.length > 1 ? 's (in one zip)' : ''} with the numbers behind each item.</p>`; cnt.textContent = ''; return; }
      const pages = layout(q);
      cnt.textContent = o.layout === 'long' ? '1 long image' : `${pages.length} page${pages.length > 1 ? 's' : ''}`;
      th.innerHTML = pages.map((p, i) => `<figure class="${p.w > p.h ? 'land' : ''}${o.layout === 'long' ? ' long' : ''}"><img alt="Page ${i + 1}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(p.svg)}"><figcaption>${o.layout === 'long' ? 'Whole report' : 'Page ' + (i + 1)}</figcaption></figure>`).join('');
    }, 120);
  }
  dlg.addEventListener('input', e => { const t = e.target;
    if (t.dataset.o){ o[t.dataset.o] = t.type === 'checkbox' ? t.checked : t.value; saveOpts(o);
      if (t.tagName === 'SELECT' || t.type === 'checkbox'){ if (t.dataset.o === 'layout' && t.value !== 'long' && o.page === 'slide' && t.value === 'flow') {} draw(); } else preview(); }
    if (t.dataset.k){ o.off = t.checked ? o.off.filter(x => x !== t.dataset.k) : [...o.off, t.dataset.k]; saveOpts(o); draw(); } });
  dlg.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.p){ Object.assign(o, PRESETS[t.dataset.p]); saveOpts(o); return draw(); }
    if (t.dataset.up != null){ const i = +t.dataset.up; [o.order[i - 1], o.order[i]] = [o.order[i], o.order[i - 1]]; saveOpts(o); return draw(); }
    if (t.dataset.dn != null){ const i = +t.dataset.dn; [o.order[i + 1], o.order[i]] = [o.order[i], o.order[i + 1]]; saveOpts(o); return draw(); }
    if (t.dataset.x === 'close'){ B.remove(); B = null; return; }
    if (t.dataset.x === 'allon'){ o.off = []; saveOpts(o); return draw(); }
    if (t.dataset.x === 'alloff'){ o.off = [...o.order]; saveOpts(o); return draw(); }
    if (t.dataset.x === 'go'){
      const q = opts(), st = dlg.querySelector('#xp-status'); if (!q.keys.length){ st.textContent = 'Pick at least one item.'; return; }
      t.disabled = true; st.textContent = 'Making your file…';
      try { const out = await exportFiles(q); for (const f of out) await save(f.blob, f.name); st.textContent = 'Done.'; }
      catch (err){ st.textContent = 'Something went wrong: ' + err.message; }
      t.disabled = false;
    }
  });
  B.addEventListener('click', e => { if (e.target === B){ B.remove(); B = null; } });
  draw();
}

window.ChartExport = {single, openBuilder, exportFiles, layout, items, _zip:makeZip, _pdf:makePDF};
})();
