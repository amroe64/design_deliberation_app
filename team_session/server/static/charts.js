/* Live results charts for the admin view, styled after the IDETC 2026 slides.
   renderCharts(D) takes one plain data object (built by the server or the prototype)
   and returns HTML with hand-drawn SVG charts. No chart library needed. */
'use strict';
(function(){
const CC = {caucus:'#332288', facilitated:'#44AA99', summary_only:'#117733', unmediated:'#CC6677'};
const RC = {ME:'#332288', MF:'#44AA99', HF:'#117733'};
const RN = {ME:'Mechanical', MF:'Manufacturing', HF:'Human Factors'};
const AX = '#9aa0ad', GRID = '#e6e8ef', INK = '#1f232b', MUT = '#5b6070';
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const ci = a => a.length > 1 ? 1.96 * sd(a) / Math.sqrt(a.length) : 0;
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const f2 = x => x == null ? '—' : (+x).toFixed(2);
const jit = (id, k) => { const v = Math.sin((+id + 1) * 12.9898 + (k || 0) * 78.233) * 43758.5453; return v - Math.floor(v) - 0.5; };
const T = (x, y, s, o) => { o = o || {}; return `<text x="${x}" y="${y}" font-size="${o.size || 12}" fill="${o.fill || MUT}" text-anchor="${o.anchor || 'start'}" font-weight="${o.weight || 400}" ${o.rot ? `transform="rotate(${o.rot} ${x} ${y})"` : ''} ${o.serif ? 'font-family="Source Serif 4, Cambria, Georgia, serif"' : ''}>${E(s)}</text>`; };
const L = (x1, y1, x2, y2, o) => { o = o || {}; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.c || AX}" stroke-width="${o.w || 1}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''} ${o.cap ? 'stroke-linecap="round"' : ''}/>`; };
const svg = (w, h, inner, label) => `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${E(label || '')}" style="display:block;font-family:Carlito,Calibri,'Source Sans 3',sans-serif">${inner}</svg>`;
const card = (title, sub, body, opts) => `<div class="ch-card ${opts && opts.wide ? 'wide' : ''}" data-key="${E(opts.key)}" data-title="${E(title)}" data-sub="${E(sub)}" data-kicker="${E(opts.kicker || '')}"><div class="ch-h"><div><div class="ch-kicker">${opts && opts.kicker ? E(opts.kicker) : ''}</div><h3>${title}</h3>${sub ? `<p class="ch-sub">${sub}</p>` : ''}</div><span class="ch-acts">${opts && opts.tip ? opts.tip : ''}<button type="button" class="ch-dl" data-key="${E(opts.key)}" aria-label="Download this chart" title="Download this chart"><i class="ic ic-download"></i></button></span></div>${body}</div>`;
const empty = msg => `<div class="ch-empty">${E(msg || 'Fills in as teams finish.')}</div>`;
const legend = items => `<div class="ch-legend">${items.map(([c, l, shape]) => `<span><i style="background:${c};${shape === 'line' ? 'height:3px;border-radius:2px' : ''}"></i>${E(l)}</span>`).join('')}</div>`;
const yTicks = (y0, y1, n) => { const out = [], step = (y1 - y0) / n; for (let i = 0; i <= n; i++) out.push(+(y0 + step * i).toFixed(2)); return out; };

/* ---------- RQ1: fraction of optimal value, one dot per team ---------- */
function rq1(D){
  const C = D.conds.filter(c => c.teams.length);
  if (!C.length) return empty();
  const W = 1100, H = 400, ml = 56, mr = 200, mt = 36, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
  const all = C.flatMap(c => c.teams.map(t => t.frac));
  const ymin = Math.max(0, Math.min(0.3, Math.floor((Math.min(...all, D.naive_frac) - 0.05) * 10) / 10)), ymax = 1.05;
  const Y = v => mt + ph - (v - ymin) / (ymax - ymin) * ph, bw = pw / D.conds.length;
  let g = '';
  yTicks(ymin, 1, Math.round((1 - ymin) / 0.1)).forEach(v => { g += L(ml, Y(v), ml + pw, Y(v), {c:GRID}) + T(ml - 8, Y(v) + 4, v.toFixed(1), {anchor:'end', size:11}); });
  const ref = (v, lab, dash, w) => { g += L(ml, Y(v), ml + pw + 6, Y(v), {c:'#4a5060', dash, w:w || 1.2}) + T(ml + pw + 10, Y(v) + 4, lab, {size:11.5, fill:'#3b4050'}); };
  ref(1, 'full-information optimum', null, 1.4);
  ref(D.single_frac, `best single engineer (${D.single_frac.toFixed(2)})`, '2 4');
  ref(D.naive_frac, `never-talked team (${D.naive_frac.toFixed(2)})`, '6 4');
  D.conds.forEach((c, i) => {
    const cx = ml + bw * i + bw / 2;
    g += T(cx, H - mb + 20, c.label, {anchor:'middle', size:12.5, fill:INK});
    g += T(cx, H - mb + 36, `${c.teams.length} team${c.teams.length === 1 ? '' : 's'}`, {anchor:'middle', size:11});
    if (!c.teams.length) return;
    c.teams.forEach(t => { g += `<circle cx="${cx + jit(t.id) * bw * 0.55}" cy="${Y(t.frac) + jit(t.id, 3) * 3}" r="4.6" fill="${c.color}" fill-opacity=".45" stroke="${c.color}" stroke-opacity=".6"><title>Team ${t.id}: ${t.frac.toFixed(2)} (${t.pts} pts)</title></circle>`; });
    const m = mean(c.teams.map(t => t.frac));
    g += L(cx - bw * 0.32, Y(m), cx + bw * 0.32, Y(m), {c:c.color, w:7, cap:1});
    g += T(cx, mt - 12, m.toFixed(2), {anchor:'middle', size:20, weight:700, fill:c.color, serif:1});
  });
  g += L(ml, mt, ml, mt + ph) + T(16, mt + ph / 2, 'fraction of optimal value', {rot:-90, anchor:'middle', size:12});
  return svg(W, H, g, 'Fraction of optimal value by deliberation type');
}

/* ---------- RQ2: pooling index with 95% CI ---------- */
function rq2(D){
  const C = D.conds.filter(c => c.teams.length);
  if (!C.length) return empty();
  const W = 520, H = 330, ml = 46, mr = 14, mt = 26, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
  const vals = C.flatMap(c => c.teams.map(t => t.pooling));
  const ymin = Math.min(0, Math.floor(Math.min(...vals) * 5) / 5), ymax = 1.12;
  const Y = v => mt + ph - (v - ymin) / (ymax - ymin) * ph, bw = pw / D.conds.length;
  let g = '';
  yTicks(ymin, 1, Math.round((1 - ymin) / 0.2)).forEach(v => { g += L(ml, Y(v), ml + pw, Y(v), {c:GRID}) + T(ml - 7, Y(v) + 4, v.toFixed(1), {anchor:'end', size:11}); });
  g += L(ml, Y(1), ml + pw, Y(1), {c:'#4a5060', dash:'6 4', w:1.2}) + T(ml + 6, Y(1) - 6, 'full pooling', {size:11});
  D.conds.forEach((c, i) => {
    const x = ml + bw * i + bw * 0.18, w = bw * 0.64, cx = x + w / 2;
    g += T(cx, H - mb + 20, c.label, {anchor:'middle', size:12.5, fill:INK});
    if (!c.teams.length) return;
    const a = c.teams.map(t => t.pooling), m = mean(a), e = ci(a), y0 = Y(Math.max(0, ymin)), ym = Y(m);
    g += `<rect x="${x}" y="${Math.min(ym, y0)}" width="${w}" height="${Math.abs(y0 - ym)}" rx="3" fill="${c.color}"><title>${c.label}: ${m.toFixed(2)} ± ${e.toFixed(2)} (95% CI, ${a.length} teams)</title></rect>`;
    if (e > 0){
      /* keep the interval inside the chart; a capped end gets an arrow instead of a bar */
      const hi = Math.min(m + e, ymax), lo = Math.max(m - e, ymin), cutH = m + e > ymax, cutL = m - e < ymin;
      g += L(cx, Y(lo), cx, Y(hi), {c:INK, w:1.4});
      g += cutH ? `<path d="M${cx - 6} ${Y(hi) + 8} L${cx} ${Y(hi)} L${cx + 6} ${Y(hi) + 8}" fill="none" stroke="${INK}" stroke-width="1.4"/>` : L(cx - 9, Y(hi), cx + 9, Y(hi), {c:INK, w:1.4});
      g += cutL ? `<path d="M${cx - 6} ${Y(lo) - 8} L${cx} ${Y(lo)} L${cx + 6} ${Y(lo) - 8}" fill="none" stroke="${INK}" stroke-width="1.4"/>` : L(cx - 9, Y(lo), cx + 9, Y(lo), {c:INK, w:1.4});
    }
    const inside = Math.abs(y0 - ym) > 26;
    g += T(cx, inside ? ym + 20 : ym - 8, m.toFixed(2), {anchor:'middle', size:15, weight:700, fill:inside ? '#fff' : c.color});
  });
  g += L(ml, Y(0), ml + pw, Y(0), {c:AX}) + L(ml, mt, ml, mt + ph);
  g += T(14, mt + ph / 2, 'pooling index (0 = shared table only)', {rot:-90, anchor:'middle', size:11.5});
  return svg(W, H, g, 'Pooling index by deliberation type');
}

/* ---------- RQ3: hidden "worth more" features funded, by discipline, + decoys line ---------- */
function rq3(D){
  const C = D.conds.filter(c => c.teams.length);
  if (!C.length) return empty();
  const W = 560, H = 330, ml = 46, mr = 46, mt = 22, mb = 46, pw = W - ml - mr, ph = H - mt - mb;
  const Y = v => mt + ph - v * ph, YD = v => mt + ph - (v / 3) * ph, bw = pw / D.conds.length;
  let g = '';
  [0, .2, .4, .6, .8, 1].forEach(v => { g += L(ml, Y(v), ml + pw, Y(v), {c:GRID}) + T(ml - 7, Y(v) + 4, v.toFixed(1), {anchor:'end', size:11}); });
  [0, 1, 2, 3].forEach(v => { g += T(ml + pw + 8, YD(v) + 4, v, {size:11, fill:'#333'}); });
  const pts = [];
  D.conds.forEach((c, i) => {
    const gx = ml + bw * i + bw * 0.12, gw = bw * 0.76, b = gw / 3;
    g += T(ml + bw * i + bw / 2, H - mb + 20, c.label, {anchor:'middle', size:12.5, fill:INK});
    if (!c.teams.length) return;
    ['ME', 'MF', 'HF'].forEach((r, k) => {
      const v = mean(c.teams.map(t => t.gems[r]).filter(x => x != null)) || 0;
      g += `<rect x="${gx + b * k + 1.5}" y="${Y(v)}" width="${b - 3}" height="${Y(0) - Y(v)}" rx="2" fill="${RC[r]}" fill-opacity="${k === 1 ? .85 : .9}"><title>${c.label} · ${RN[r]}: ${pct(v)} of their hidden "worth more" features funded</title></rect>`;
    });
    pts.push([ml + bw * i + bw / 2, YD(mean(c.teams.map(t => t.decoys)))]);
  });
  if (pts.length > 1) g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
  pts.forEach(p => { g += `<path d="M${p[0]} ${p[1] - 6} L${p[0] + 5.5} ${p[1] + 4} L${p[0] - 5.5} ${p[1] + 4} Z" fill="${INK}"/>`; });
  g += L(ml, Y(0), ml + pw, Y(0)) + L(ml, mt, ml, mt + ph) + L(ml + pw, mt, ml + pw, mt + ph);
  g += T(14, mt + ph / 2, 'share of hidden "worth more" features funded', {rot:-90, anchor:'middle', size:11});
  g += T(W - 8, mt + ph / 2, '"worth less" features funded (of 3)', {rot:90, anchor:'middle', size:11});
  return svg(W, H, g, 'Hidden features funded by discipline and decoys funded') +
    legend([[RC.ME, 'Mechanical'], [RC.MF, 'Manufacturing'], [RC.HF, 'Human Factors'], [INK, '"Worth less" funded (dashed, right axis)', 'line']]);
}

/* ---------- The four steps: % of findings still alive at each step ---------- */
function steps(D){
  const C = D.conds.filter(c => c.teams.length);
  if (!C.length) return empty();
  const S = [['spoken','1. Spoken'], ['heard','2. Heard'], ['integrated','3. Integrated'], ['actioned','4. Actioned']];
  const W = 560, H = 300, ml = 46, mr = 150, mt = 20, mb = 40, pw = W - ml - mr, ph = H - mt - mb;
  const X = i => ml + pw * i / 3, Y = v => mt + ph - v * ph;
  let g = '';
  [0, .25, .5, .75, 1].forEach(v => { g += L(ml, Y(v), ml + pw, Y(v), {c:GRID}) + T(ml - 7, Y(v) + 4, pct(v), {anchor:'end', size:11}); });
  S.forEach(([k, l], i) => { g += L(X(i), mt, X(i), mt + ph, {c:GRID}) + T(X(i), H - mb + 22, l, {anchor:'middle', size:12.5, fill:INK}); });
  const ends = [];
  C.forEach(c => {
    const F = c.teams.reduce((a, t) => a + t.facts, 0) || 1;
    const v = S.map(([k]) => c.teams.reduce((a, t) => a + t.steps[k], 0) / F);
    g += `<polyline points="${v.map((y, i) => `${X(i)},${Y(y)}`).join(' ')}" fill="none" stroke="${c.color}" stroke-width="3" stroke-linejoin="round"/>`;
    v.forEach((y, i) => { g += `<circle cx="${X(i)}" cy="${Y(y)}" r="4.5" fill="#fff" stroke="${c.color}" stroke-width="2.5"><title>${c.label} · ${S[i][1]}: ${pct(y)}</title></circle>`; });
    ends.push([Y(v[3]), c, v[3]]);
  });
  ends.sort((a, b) => a[0] - b[0]);
  let last = -99;
  ends.forEach(([y0, c, v]) => { const y = Math.max(y0, last + 16); last = y; if (Math.abs(y - y0) > 2) g += L(X(3) + 5, y0, X(3) + 10, y, {c:c.color}); g += T(X(3) + 12, y + 4, `${c.label} ${pct(v)}`, {size:11.5, weight:700, fill:c.color}); });
  return svg(W, H, g, 'Findings that survive each of the four steps');
}

/* ---------- Points lost, stacked from 0 to 448 ---------- */
function pointsLost(D){
  const C = D.conds.filter(c => c.teams.length);
  if (!C.length) return empty();
  const SEG = [['final','Final score', null], ['other','Final pick: budget / other', '#c9ccd6'], ['wrong','Final pick: wrong info', '#e2a33b'],
    ['ni','Not integrated', '#d77a86'], ['nh','Not heard', '#b04a5a'], ['ns','Not spoken', '#6f2232']];
  const W = 1100, rowH = 46, ml = 160, mr = 110, mt = 22, H = mt + C.length * rowH + 36, pw = W - ml - mr;
  const tot = Math.max(D.opt, ...C.map(c => { const m = k => Math.max(0, mean(c.teams.map(t => t.lost[k])) || 0); return (mean(c.teams.map(t => t.pts)) || 0) + m('other') + m('wrong') + m('ni') + m('nh') + m('ns'); }));
  const X = v => ml + v / tot * pw;
  let g = '';
  [0, 100, 200, 300, 400, D.opt].forEach(v => { g += L(X(v), mt - 4, X(v), mt + C.length * rowH, {c:GRID}) + T(X(v), mt + C.length * rowH + 16, v, {anchor:'middle', size:11}); });
  g += L(X(D.naive_pts), mt - 6, X(D.naive_pts), mt + C.length * rowH, {c:'#4a5060', dash:'6 4'}) + T(X(D.naive_pts), mt - 8, `shared table only (${D.naive_pts})`, {anchor:'middle', size:10.5});
  C.forEach((c, i) => {
    const m = k => mean(c.teams.map(t => t.lost[k])) || 0;
    const vals = {final:mean(c.teams.map(t => t.pts)), other:Math.max(0, m('other')), wrong:m('wrong'), ni:m('ni'), nh:m('nh'), ns:m('ns')};
    const y = mt + i * rowH + 8, h = rowH - 18;
    g += T(ml - 10, y + h / 2 + 5, c.label, {anchor:'end', size:13, fill:INK, weight:700});
    let x = 0;
    SEG.forEach(([k, l, col]) => {
      const v = vals[k]; if (!(v > 0)) return;
      g += `<rect x="${X(x)}" y="${y}" width="${Math.max(0, X(x + v) - X(x))}" height="${h}" fill="${col || c.color}" ${k === 'final' ? '' : 'fill-opacity=".92"'}><title>${c.label} · ${l}: ${v.toFixed(0)} points</title></rect>`;
      if (X(x + v) - X(x) > 30) g += T((X(x) + X(x + v)) / 2, y + h / 2 + 4, v.toFixed(0), {anchor:'middle', size:11.5, fill:k === 'other' ? INK : '#fff', weight:700});
      x += v;
    });
    if (m('other') < -0.5) g += T(ml - 10, y + h / 2 + 18, `+${(-m('other')).toFixed(0)} pts by luck`, {anchor:'end', size:10.5, fill:'#117733'});
  });
  return svg(W, H, g, 'Points lost at each step') + legend(SEG.map(([k, l, col]) => [col || '#255E4B', k === 'final' ? 'Final score (condition color)' : l]));
}

/* ---------- Liked it vs got it right ---------- */
function satisfaction(D){
  const C = D.conds.filter(c => c.teams.some(t => t.sat != null));
  if (!C.length) return empty('Fills in as students finish the survey.');
  const W = 520, H = 330, ml = 52, mr = 20, mt = 20, mb = 48, pw = W - ml - mr, ph = H - mt - mb;
  const pts = C.map(c => { const ts = c.teams.filter(t => t.sat != null); return {c, x:mean(ts.map(t => t.sat)), y:mean(c.teams.map(t => t.frac)), h:mean(ts.map(t => t.felt_heard)), n:c.teams.length}; });
  const xmin = 1, xmax = 5, ymin = Math.max(0, Math.min(0.4, Math.floor((Math.min(...pts.map(p => p.y)) - .1) * 10) / 10)), ymax = 1;
  const X = v => ml + (v - xmin) / (xmax - xmin) * pw, Y = v => mt + ph - (v - ymin) / (ymax - ymin) * ph;
  let g = '';
  [1, 2, 3, 4, 5].forEach(v => { g += L(X(v), mt, X(v), mt + ph, {c:GRID}) + T(X(v), H - mb + 18, v, {anchor:'middle', size:11}); });
  yTicks(ymin, ymax, Math.round((ymax - ymin) / .1)).forEach(v => { g += L(ml, Y(v), ml + pw, Y(v), {c:GRID}) + T(ml - 7, Y(v) + 4, v.toFixed(1), {anchor:'end', size:11}); });
  g += T(ml + pw, mt + ph - 8, 'liked it more →', {anchor:'end', size:11, fill:MUT}) + T(ml + 8, mt + 12, '↑ better design', {size:11, fill:MUT});
  pts.forEach(p => {
    p.r = 7 + Math.sqrt(p.n) * 2.2;
    g += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r}" fill="${p.c.color}" fill-opacity=".78" stroke="#fff" stroke-width="2"><title>${p.c.label}: satisfaction ${p.x.toFixed(1)}/5, ${pct(p.h)} felt heard, quality ${p.y.toFixed(2)}</title></circle>`;
  });
  const lab = [...pts].sort((a, b) => Y(a.y) - Y(b.y)); let lastY = mt + 26;
  lab.forEach(p => {
    const ly = Math.max(lastY, Y(p.y) - 4); lastY = ly + 16;
    const right = X(p.x) < ml + pw * 0.55, lx = right ? Math.min(ml + pw - 4, X(p.x) + 70) : Math.max(ml + 4, X(p.x) - 70);
    g += L(X(p.x) + (right ? p.r : -p.r), Y(p.y), lx + (right ? -3 : 3), ly - 4, {c:p.c.color});
    g += T(lx, ly, `${p.c.label} · ${p.x.toFixed(1)}/5 · ${pct(p.h)} heard`, {anchor:right ? 'start' : 'end', size:11.5, weight:700, fill:p.c.color});
  });
  g += T(ml + pw / 2, H - 12, 'satisfaction with the discussion (1–5)', {anchor:'middle', size:12});
  g += T(14, mt + ph / 2, 'fraction of optimal value', {rot:-90, anchor:'middle', size:11.5});
  return svg(W, H, g, 'Satisfaction versus design quality');
}

/* ---------- Horizontal 100% bars (progress, ratings) ---------- */
function stackRows(rows, segs, W){
  W = W || 560;
  const ml = 120, mr = 50, rowH = 34, H = rows.length * rowH + 8, pw = W - ml - mr;
  let g = '';
  rows.forEach((r, i) => {
    const tot = segs.reduce((a, [k]) => a + (r.v[k] || 0), 0), y = 4 + i * rowH, h = rowH - 12;
    g += T(ml - 10, y + h / 2 + 5, r.label, {anchor:'end', size:12.5, fill:INK, weight:700});
    if (!tot){ g += `<rect x="${ml}" y="${y}" width="${pw}" height="${h}" rx="4" fill="${GRID}"/>`; g += T(ml + 8, y + h / 2 + 4, 'nothing yet', {size:11}); return; }
    let x = 0;
    segs.forEach(([k, l, col]) => {
      const v = r.v[k] || 0; if (!v) return;
      const w = v / tot * pw;
      g += `<rect x="${ml + x}" y="${y}" width="${w}" height="${h}" fill="${col}"><title>${r.label} · ${l}: ${v} (${pct(v / tot)})</title></rect>`;
      if (w > 26) g += T(ml + x + w / 2, y + h / 2 + 4, v, {anchor:'middle', size:11, fill:'#fff', weight:700});
      x += w;
    });
    g += T(ml + pw + 8, y + h / 2 + 4, tot, {size:11.5});
  });
  return svg(W, H, g, 'stacked bars') + legend(segs.map(([k, l, col]) => [col, l]));
}

/* ---------- Small multiples: messages ---------- */
function messages(D){
  const C = D.conds.filter(c => c.msgs.count);
  if (!C.length) return empty('Fills in as students send messages.');
  const M = [['per_person','Messages per person', v => v.toFixed(1)], ['words','Words per message', v => v.toFixed(0)], ['secs','Seconds spent writing', v => v.toFixed(0)]];
  const W = 1100, H = 210, gap = 40, pw = (W - gap * 2) / 3;
  let g = '';
  M.forEach(([k, l, fmt], j) => {
    const x0 = j * (pw + gap), vals = C.map(c => c.msgs[k] || 0), mx = Math.max(...vals, 1e-9);
    g += T(x0, 14, l, {size:12.5, weight:700, fill:INK});
    C.forEach((c, i) => {
      const y = 28 + i * 40, w = (pw - 110) * (c.msgs[k] || 0) / mx;
      g += T(x0, y + 15, c.label, {size:11.5});
      g += `<rect x="${x0 + 104}" y="${y + 2}" width="${Math.max(2, w)}" height="18" rx="3" fill="${c.color}"/>`;
      g += T(x0 + 108 + w, y + 16, fmt(c.msgs[k] || 0), {size:11.5, fill:INK, weight:700});
    });
  });
  return svg(W, Math.max(H, 40 + C.length * 40), g, 'Message statistics');
}

/* ---------- KPI callouts and insight boxes (like the slide's right column) ---------- */
function kpis(D){
  const C = D.conds.filter(c => c.teams.length), all = C.flatMap(c => c.teams);
  const tiles = [];
  tiles.push([`${D.totals.finished}<small> / ${D.totals.teams}</small>`, '#255E4B', 'teams finished', `${D.totals.done_students} of ${D.totals.students} students are done`]);
  if (all.length){
    const un = C.find(c => c.key === 'unmediated'), best = [...C].sort((a, b) => mean(b.teams.map(t => t.frac)) - mean(a.teams.map(t => t.frac)))[0];
    const mb = mean(best.teams.map(t => t.frac));
    if (un && best.key !== 'unmediated'){ const d = mb - mean(un.teams.map(t => t.frac)); tiles.push([`${d >= 0 ? '+' : ''}${d.toFixed(2)}`, best.color, `more of the available value with ${best.label} than with no mediator`, `${best.label} averages ${mb.toFixed(2)} of the best design`]); }
    else tiles.push([mb.toFixed(2), best.color, `of the best design for ${best.label}, the top type so far`, '']);
    const beat = all.filter(t => t.frac > D.single_frac + 1e-9).length / all.length;
    tiles.push([pct(beat), '#44AA99', 'of teams beat the best design any one engineer could do alone', `best single engineer = ${D.single_frac.toFixed(2)}`]);
    const fh = all.filter(t => t.felt_heard != null);
    if (fh.length) tiles.push([pct(mean(fh.map(t => t.felt_heard))), '#117733', 'of students felt heard (4 or 5 out of 5)', '']);
    const worse = all.filter(t => t.frac < D.naive_frac - 1e-9).length;
    tiles.push([worse, worse ? '#CC6677' : '#5b6070', `team${worse === 1 ? '' : 's'} did worse than never talking at all`, `never-talked team = ${D.naive_frac.toFixed(2)}`]);
  }
  return `<div class="ch-kpis">${tiles.map(([v, c, l, s]) => `<div class="ch-kpi"><b style="color:${c}">${v}</b><span>${E(l)}</span>${s ? `<em>${E(s)}</em>` : ''}</div>`).join('')}</div>`;
}
function insights(D){
  const C = D.conds.filter(c => c.teams.length);
  if (C.length < 2) return '';
  const act = c => c.teams.reduce((a, t) => a + t.steps.actioned, 0) / (c.teams.reduce((a, t) => a + t.facts, 0) || 1);
  const byAct = [...C].sort((a, b) => act(b) - act(a)), hi = byAct[0], lo = byAct[byAct.length - 1];
  const S = C.filter(c => c.teams.some(t => t.sat != null));
  const sat = c => mean(c.teams.filter(t => t.sat != null).map(t => t.sat));
  const q = c => mean(c.teams.map(t => t.frac));
  let b2 = '';
  if (S.length >= 2){
    const happy = [...S].sort((a, b) => sat(b) - sat(a))[0], good = [...S].sort((a, b) => q(b) - q(a))[0];
    b2 = happy.key === good.key
      ? `<b style="color:${happy.color}">${E(happy.label)}</b> is both the best liked (${sat(happy).toFixed(1)}/5) and the best scoring (${q(happy).toFixed(2)}) so far.`
      : `<b style="color:${happy.color}">${E(happy.label)}</b> is the best liked (${sat(happy).toFixed(1)}/5) but scores ${q(happy).toFixed(2)}. <b style="color:${good.color}">${E(good.label)}</b> scores best (${q(good).toFixed(2)}) with ${sat(good).toFixed(1)}/5 satisfaction.`;
  }
  return `<div class="ch-ins"><div class="ch-box"><h4 style="color:${hi.color}">Where the hidden findings got through</h4>
      <p><b style="color:${hi.color}">${E(hi.label)}</b> teams carried ${pct(act(hi))} of their hidden findings all the way into the final design, against ${pct(act(lo))} for <b style="color:${lo.color}">${E(lo.label)}</b>.</p></div>
    ${b2 ? `<div class="ch-box dark"><h4>Liked it vs. got it right</h4><p>${b2}</p></div>` : ''}</div>`;
}

window.renderCharts = function(D, ti){
  ti = ti || (() => '');
  const t = new Date(D.updated || Date.now());
  const stamp = t.toLocaleTimeString([], {hour:'numeric', minute:'2-digit', second:'2-digit'});
  const finished = D.conds.reduce((a, c) => a + c.teams.length, 0);
  const progSegs = [['card','Reading brief','#9aa0ad'], ['writing','Writing','#44AA99'], ['waiting','Waiting','#e2a33b'], ['final','Deciding','#332288'], ['survey','Survey','#5b6070'], ['done','Done','#117733']];
  const rateSegs = [['Agree','Agree','#117733'], ['Partly','Partly','#e2a33b'], ['Disagree','Disagree','#CC6677']];
  const med = D.conds.filter(c => c.key !== 'unmediated');
  window.__CH_D = D;
  return `<div class="ch-root"><div class="ch-tools"><div class="ch-live" style="margin:0">${(typeof ARCH !== 'undefined' && ARCH) ? 'Saved copy · ' : `<span class="ch-dot"></span>Live · updated ${E(stamp)} · `}${finished} finished team${finished === 1 ? '' : 's'} counted${D.consent_only ? ' · consenting teams only' : ''}</div>
    <span class="ch-tbtns"><button type="button" class="ch-report xp-btn" data-preset=""><i class="ic ic-download"></i>Build a report</button><button type="button" class="ch-report xp-btn ghost" data-preset="slides">Slide deck</button><button type="button" class="ch-report xp-btn ghost" data-preset="images">Images</button></span></div>
  ${kpis(D)}
  ${insights(D)}
  <div class="ch-grid">
    ${card('Which deliberation approach yields the best designs?', 'Each dot is one team. Thick line = average. Higher is better.', rq1(D), {key:'rq1', kicker:'RQ1', wide:1, tip:ti('ch_rq1')})}
    ${card('How much private information reached the final design?', 'Pooling index with 95% confidence intervals.', rq2(D), {key:'rq2', kicker:'RQ2', tip:ti('ch_rq2')})}
    ${card('Hidden features funded, and how many "worth less" ones slipped in', 'Bars: share of each discipline\'s hidden "worth more" features in the final set. Dashed line: "worth less" features funded.', rq3(D), {key:'rq3', kicker:'RQ3', tip:ti('ch_rq3')})}
    ${card('Where findings get lost: the four steps', 'Share of all hidden findings still alive at each step.', steps(D), {key:'steps', kicker:'Four steps', tip:ti('ch_steps')})}
    ${card('Liked it vs. got it right', 'Each bubble is a deliberation type. Bigger bubble = more teams.', satisfaction(D), {key:'sat', kicker:'Experience', tip:ti('ch_sat')})}
    ${card('Points lost at each step (average team)', 'From 0 to the best possible 448 points. The colored part is what the team kept.', pointsLost(D), {key:'points', kicker:'Points', wide:1, tip:ti('ch_points')})}
    ${card('Where everyone is right now', 'Every student in an analyzed team, by step. Updates live.', stackRows(D.conds.map(c => ({label:c.label, v:c.progress})), progSegs), {key:'progress', kicker:'Live', tip:ti('ch_progress')})}
    ${card('How students rated the Mediator\'s cards', 'Private ratings on Mediator drafts and recaps.', med.length ? stackRows(med.map(c => ({label:c.label, v:c.ratings})), rateSegs) : empty('No Mediator types in this session.'), {key:'ratings', kicker:'Mediator', tip:ti('ch_ratings')})}
    ${card('How much people wrote', 'Real students only; simulated students are left out of writing time.', messages(D), {key:'msgs', kicker:'Messages', wide:1, tip:ti('ch_msgs')})}
  </div></div>`;
};
})();

/* ---------- Live team timelines (admin Live tab) ---------- */
(function(){
  const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rnd = st => +((st || '').match(/\d+/) || [0])[0];
  const mmss = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function segments(rounds, tm){
    tm = Object.assign({card:5, round1:6, round:5, final:1, survey:4}, tm || {});
    const s = [{k:'brief', l:'Read brief', m:tm.card, t:'g'}];
    for (let n = 1; n <= rounds; n++){ s.push({k:'r' + n, l:'Round ' + n, m:n === 1 ? tm.round1 : tm.round, t:'s'}); s.push({k:'m' + n, l:'Mediator', m:1, t:'m'}); }
    s.push({k:'decide', l:'Decide', m:tm.final, t:'g'}, {k:'survey', l:'Survey', m:tm.survey, t:'g'});
    return s;
  }
  /* Which block a team is in, and how full it is (share of members past it). */
  function stage(t, S){
    const st = t.steps, n = st.length || 1, at = k => S.findIndex(x => x.k === k);
    if (st.every(s => s === 'done')) return {idx:S.length, frac:1};
    if (st.some(s => s === 'card')) return {idx:0, frac:st.filter(s => s !== 'card').length / n};
    if (!st.some(s => /^(post|wait)/.test(s))){
      if (st.some(s => s === 'final')) return {idx:at('decide'), frac:st.filter(s => s !== 'final').length / n};
      return {idx:at('survey'), frac:st.filter(s => s === 'done').length / n};
    }
    const r = Math.max(...st.map(rnd)), waiting = st.filter(s => s === 'wait' + r).length;
    if (waiting === n) return {idx:at('m' + r), frac:t.pending ? 0.5 : 1};
    return {idx:at('r' + r), frac:waiting / n};
  }
  window.renderTimelines = function(teams, rounds, opt){
    opt = opt || {};
    const ti = opt.ti || (() => ''), S = segments(rounds, opt.timers), total = S.reduce((a, s) => a + s.m, 0);
    const cum = []; S.reduce((a, s, i) => (cum[i] = a, a + s.m), 0);
    const head = `<div class="tl-row tl-head"><div></div><div class="tl-bar">${S.map(s => `<div class="tl-lab" style="flex:${s.m}">${s.t === 'm' ? 'M' : E(s.l)}</div>`).join('')}</div><div class="tl-side">Time · pace</div></div>`;
    const parts = {};
    const rows = teams.map(t => {
      const g = stage(t, S), done = g.idx >= S.length, med = t.mediated !== false;
      const actual = done ? total : cum[g.idx] + g.frac * S[g.idx].m, el = t.elapsed / 60, diff = el - actual;
      let pace = ['On pace', 'ok'];
      if (done) pace = ['Done', 'ok']; else if (el < 0.3) pace = ['Starting', 'gray'];
      else if (diff > 4) pace = [`${Math.round(diff)} min behind`, 'bad']; else if (diff > 1.5) pace = [`${Math.round(diff)} min behind`, 'warn'];
      else if (diff < -1.5) pace = ['Ahead', 'blue'];
      const bar = S.map((s, i) => {
        const f = i < g.idx ? 100 : i === g.idx ? Math.round(g.frac * 100) : 0;
        const cls = `tl-seg tl-${s.t}${s.t === 'm' && !med ? ' tl-none' : ''}${i === g.idx && !done ? ' cur' : ''}`;
        const tip = s.t === 'm' && !med ? 'Messages revealed (no Mediator)' : s.l;
        return `<div class="${cls}" style="flex:${s.m}" title="${E(tip)}${i === g.idx && !done ? ` · ${f}% of the team past it` : ''}"><i style="width:${f}%"></i></div>`;
      }).join('');
      const now = done ? '' : `<b class="tl-now" style="left:calc(${Math.min(el / total, 1) * 100}% - 1px)" title="Where the suggested schedule says they should be"></b>`;
      const flags = (t.spare ? ' <span class="st warn">Spare</span>' : '') + (t.nonconsent ? ' <span class="st gray">No consent</span>' : '');
      parts[t.id] = {bar:`<div class="tl-bar">${bar}${now}</div>`, side:`<div class="tl-side"><b>${mmss(t.elapsed)}</b> <span class="st ${pace[1]}">${pace[0]}</span></div>`, diff:done ? -999 : diff};
      return `<div class="tl-row"><div class="tl-name"><a href="#" data-act="${opt.logAct || 'admteam'}" data-team="${t.id}"><b>Team ${t.id}</b></a>${flags}<span>${E(opt.hideCond ? 'type hidden' : t.label)}</span></div>
        <div class="tl-bar">${bar}${now}</div>
        <div class="tl-side"><b>${mmss(t.elapsed)}</b> <span class="st ${pace[1]}">${pace[0]}</span></div></div>`;
    }).join('');
    if (opt.parts) return {parts, total, head:`<div class="tl-bar">${S.map(s => `<div class="tl-lab" style="flex:${s.m}">${s.t === 'm' ? 'M' : E(s.l)}</div>`).join('')}</div>`,
      legend:'<span class="ch-legend"><span><i style="background:#9aa0ad"></i>Same for all</span><span><i style="background:#44AA99"></i>Students writing</span><span><i style="background:#2A2E3B"></i>Mediator writing</span><span><i style="background:#CC6677;width:3px"></i>Suggested pace</span></span>'};
    return `<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Team timelines${ti('timelines')}</h3>
      <span class="ch-legend" style="margin:0"><span><i style="background:#9aa0ad"></i>Same for all</span><span><i style="background:#44AA99"></i>Students writing</span><span><i style="background:#2A2E3B"></i>Mediator writing</span><span><i style="background:#CC6677;width:3px"></i>Suggested pace</span></span></div>
      <p class="small muted">Block widths follow the ${total}-minute schedule from the step timers in Setup. The current block fills as teammates finish it. Players see a countdown for each step and get reminders at 1 minute left and at time's up. Nobody is cut off.</p>
      <div class="tl">${head}${rows || '<p class="muted">No teams yet.</p>'}</div></div>`;
  };
})();
