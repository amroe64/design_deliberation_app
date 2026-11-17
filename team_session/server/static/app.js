/* Team Design Session: browser side. All state lives on the server; this file only
   shows the person's own slice and sends what they do back. */
'use strict';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- Info icons: short, plain explanations ---------- */
const TIPS = {
  /* live */
  joined:'Everyone who typed the class code. "Yes" and "no" are their answers to the consent question.',
  finished:'Teams where every member has finished the survey.',
  stuck:'Teams where someone has waited more than 2 minutes for a teammate to post. You may want to check on them.',
  ai:'How many times the Mediator was asked to write something, how long it took on average, and how many times it was slow or failed.',
  lobby:'The waiting room. Students join here and wait until you form teams.',
  add_bots:'Adds pretend students who answer with sample messages. Use them to test or demo the app.',
  undo_bots:'Removes the pretend students you added last. Only works before teams are formed.',
  clear_bots:'Removes every pretend student. Real students stay. Only works before teams are formed.',
  form:'Closes the lobby and puts everyone into random teams of 3. Students who said yes and no go on separate teams.',
  whole_class:'Controls that change every student\'s screen at once.',
  pause:'Freezes everyone. Students can read but cannot send until you resume.',
  broadcast:'Shows a yellow message at the top of every student\'s screen, like a time warning.',
  attention:'Students who pressed "Need help", and students who joined after teams were formed.',
  timers:'How long each step should take. Players see a countdown, and the app reminds them at 1 minute left and when time is up. These times also set the widths of the team timeline bars.',
  watch:'Pick any player, real or simulated, and see their exact screen as it changes. Dark Admin labels add what only researchers know: the hidden truth of each finding and how far it got, how each message was scored, true values, and time on the step.',
  feed:'Every entry people send, newest at the top, the moment they send it: messages with their picks, card ratings, final votes and survey answers. Click an ID to see everything that person did, or a team to open its log.',
  fpause:'Freezes the list so it stops moving while you read. New entries are still saved and counted. Press Resume to catch up.',
  typing_now:'Drafts people have typed but not sent yet. They update each time someone pauses typing for about 1.5 seconds.',
  teams:'Live status of every team and every member.',
  hide_types:'Hides which deliberation type each team has, so you don\'t treat teams differently while watching.',
  sim:'Moves the pretend students forward one step. Real students are not affected.',
  fullsim:'Plays a whole session with simulated students, no clicking needed. Each one gets a persona (Engaged, Average, Low effort, Trusts the table, Misreads results, Slow) that sets how much they share, how clearly, whether they believe teammates, and how fast they work. 1× runs at real class speed using the step timers; 15× finishes a session in about 2 minutes.',
  close_round:'Moves a team on without the missing messages, for example if someone left or their phone died. This is marked in the data.',
  spare:'A team of 1 or 2 leftover students. They do the activity, but they are left out of the results.',
  nonconsent:'Everyone on this team said no to research use. They do the activity, but their data is left out of the results.',
  /* people */
  people:'Everyone who joined. Click an ID to see everything that person did.',
  events:'How many things this person did that were saved (taps, answers, messages, and so on).',
  msgs:'How many messages this person sent.',
  in_app:'How long since this person joined.',
  /* setup */
  class_code:'The code students type to join. It is also in the QR code.',
  rounds:'How many times each team posts before the final decision. The simulation uses 3; the class plan uses 2.',
  types:'Which ways of running the discussion to use. Teams get them evenly, in a random order.',
  headcount:'If fewer students than this join, the app uses only the types you tick here, so each type still gets enough teams.',
  mediator:'Which Mediator runs this session: the rule-based stand-in for testing, or a model on VT ARC. Pick it before forming teams; it stays fixed for the session.',
  new_session:'Starts over with an empty lobby and a new session ID. Old data stays saved.',
  /* results */
  consent_only:'When ticked, the tables only count teams where everyone said yes to sharing their data.',
  steps:'Follows each team\'s 9 secret findings to see how far each one got: said, seen, used, and kept in the final answer.',
  spoken:'The owner shared the finding and said which way it goes (worth more or worth less). Just naming the feature doesn\'t count.',
  heard:'A teammate had a message or Mediator card with the finding on their screen for at least 2 seconds. In caucus, only Mediator cards count.',
  integrated:'After seeing it, a teammate used it: they repeated it, changed their picks because of it, or the Mediator put it in a draft or recap.',
  actioned:'The final set follows the finding: "worth more" features are in, "worth less" features are out.',
  extra:'Extra checks that don\'t depend on the step before. Use them to double-check the four steps.',
  mentioned:'The owner named the feature at all, even without saying whether it is worth more or less.',
  to_mediator:'Caucus only. The owner told the Mediator in their private chat.',
  relayed:'A Mediator message passed the finding on after the owner said it.',
  heard_recalled:'Heard, and a teammate also ticked it in the memory check at the end. A stricter version of "heard."',
  recalled:'A teammate ticked this finding in the memory check at the end of the survey.',
  final_follows:'The final set matches the finding, even if the team got there by luck.',
  points:'How many points each step cost. 448 is the best possible score. 216 is what you get from the shared table alone.',
  lost_spoken:'Points lost because findings were never shared.',
  lost_heard:'Points lost because shared findings were not seen by teammates.',
  lost_integrated:'Points lost because teammates saw findings but did not use them.',
  lost_wrong:'Points lost because the team followed a wrong claim, like calling a "worth more" feature worth less.',
  lost_other:'Points lost on the final pick for other reasons, like budget math. Below zero means the team got lucky.',
  final_score:'The real point value of the team\'s final set, out of 448.',
  wrong_claims:'How many wrong claims (wrong direction on a tested feature) the final set followed.',
  outcome:'How good each team\'s final design was, by deliberation type.',
  teams_done:'Teams that finished, out of all teams with this deliberation type.',
  pct_best:'The final set\'s real value as a percent of the best possible (448 points).',
  pooling:'0 means the team only used the shared table. 1 means it used every secret finding. Below 0 means talking made it worse.',
  gems:'How many of the 6 "worth more" features made the final set. Higher is better.',
  decoys:'How many of the 3 "worth less" features made the final set. Lower is better.',
  accepted:'On average, how many of the 3 members said yes to the final decision.',
  talked:'Teams where someone said they talked outside the app. Their chat log may be missing part of the conversation.',
  downloads:'Save the data to your computer to analyze it.',
  results_csv:'One row per team: final set, score, the four steps, and points lost.',
  facts_csv:'One row per secret finding per team, with yes or no for each step.',
  messages_csv:'Every message and Mediator card, and who saw each one.',
  participants_csv:'One row per person: ID, consent, team, role, and survey answers.',
  events_csv:'Every single action each person took, with times.',
  ai_calls_csv:'Every request sent to the real AI: the prompt, the reply, its reasoning, the model, the time, tokens, and any error. Empty with the stand-in.',
  json:'All of the data in one file.',
  db:'The whole database file. It includes everyone, even students who said no, so keep it private.',
  coders:'Sheets for two people to check the app\'s automatic codes by hand.',
  coding_sample:'A random 20% of messages for two people to code by hand. It is the same 20% every time.',
  coding_all:'Every message, for coding by hand.',
  each_team:'One row per finished team. Click a team number to see its full log.',
  score:'The real point value of the final set, out of 448.',
  lost_sharing:'Points lost because findings were not spoken, heard, or used.',
  lost_final:'Points lost on the final pick, from wrong info or budget math.',
  flags:'Warnings about a team, like talking out loud or a round you closed.',
  team_facts:'This team\'s 9 secret findings and which steps each one passed.',
  team_log:'Everything saved for this team, in order.',
  seen_by:'Who had this on their screen for at least 2 seconds.',
  projector:'A big-screen view for the lecture hall: the join code and QR code, then team progress.',
  timelines:'One bar per team, split into the same steps for every type. The current step fills as teammates finish it. The red line shows where the suggested schedule says the team should be by now. Click a team to open its log.',
  ch_tab:'Live charts like the IDETC slides, filled in with this class. They update by themselves as teams finish.',
  ch_rq1:'Each dot is one finished team. Height = how close its final design came to the best possible (1.0). The thick line is the average. Dashed lines show a team that never talked, and the best any one engineer could do alone.',
  ch_rq2:'How much of the hidden information made it into the final design. 0 = only the shared table was used, 1 = everything was used. The thin lines show how sure we can be (95% confidence).',
  ch_rq3:'For each discipline, the share of its hidden "worth more" features the team bought. The dashed line counts "worth less" features the team bought anyway (fewer is better).',
  ch_steps:'Out of all hidden findings, the share still alive at each step: said, seen, used, and kept in the final answer. A steep drop shows where a type loses information.',
  ch_sat:'Each bubble is one deliberation type. Further right = students liked the discussion more. Higher = better final design. The label shows the share who felt heard.',
  ch_points:'The average team, drawn from 0 to the best possible 448 points. The colored part is the score it kept. The other parts show where the rest of the points were lost.',
  ch_progress:'Where every student is right now, by deliberation type. Useful for spotting a type that is running slow.',
  ch_ratings:'How students privately rated the Mediator\'s drafts and recaps: agree, partly, or disagree.',
  ch_msgs:'How much students wrote: messages per person, words per message, and seconds spent writing each message.',
};
const ti = k => TIPS[k] ? `<span class="tip" tabindex="0" role="button" data-k="${k}" aria-label="What is this? ${esc(TIPS[k])}">i</span>` : '';
let tipBox = null, tipK = null;
function showTip(el){
  if (!tipBox){ tipBox = document.createElement('div'); tipBox.id = 'tipbox'; document.body.appendChild(tipBox); }
  tipK = el.dataset.k; tipBox.textContent = TIPS[tipK]; tipBox.style.display = 'block';
  const r = el.getBoundingClientRect(), w = Math.min(260, innerWidth - 16);
  tipBox.style.width = w + 'px';
  tipBox.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
  let y = r.bottom + 8; tipBox.style.top = y + 'px';
  if (y + tipBox.offsetHeight > innerHeight - 8) tipBox.style.top = Math.max(8, r.top - 8 - tipBox.offsetHeight) + 'px';
}
function hideTip(){ if (tipBox) tipBox.style.display = 'none'; tipK = null; }
function reTip(){ if (!tipK) return; const el = document.querySelector(`.tip[data-k="${tipK}"]`); if (el) showTip(el); else hideTip(); }
document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('.tip'); if (t) showTip(t); });
document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('.tip') && document.activeElement !== e.target) hideTip(); });
document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('.tip'); if (t) showTip(t); });
document.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('.tip')) hideTip(); });
document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('.tip'); if (t){ e.preventDefault(); e.stopPropagation(); showTip(t); } else hideTip(); }, true);
window.addEventListener('scroll', () => { if (tipK) reTip(); }, true);

const fmtT = sec => { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; };
const roundOf = st => +((st || '').match(/\d+/) || [0])[0];
const qs = new URLSearchParams(location.search);
const MODE = location.pathname.startsWith('/admin') ? 'admin' : location.pathname.startsWith('/projector') ? 'projector' : location.pathname.startsWith('/watch') ? 'watch' : 'student';
const WATCH = MODE === 'watch';
let ARCH = null;                       // the saved session being looked at, or null for the live one
const ARCHQ = new URLSearchParams(location.search).get('arch');
const ARCH_ID = () => WATCH ? ARCHQ : (ARCH && ARCH.id);
if (WATCH) document.documentElement.classList.add('is-watch');
if (MODE === 'projector') document.documentElement.classList.add('is-proj');
const TOKEN_KEY = 'tds_token' + (qs.get('seat') ? '_' + qs.get('seat') : '');   // ?seat=2 lets you test several phones in one browser
let CT = null;           // public task content
let BUDGET = 57, FEAT = {};

async function api(path, body, method){
  if (ARCH_ID() && !body && !method && path.startsWith('/api/admin/') && !path.startsWith('/api/admin/saved')) path = '/api/admin/saved/' + ARCH_ID() + '/api/' + path.slice(11);
  const opt = {method: method || (body ? 'POST' : 'GET'), headers:{'Content-Type':'application/json'}};
  if (ADMIN) opt.headers['x-admin'] = ADMIN;
  if (body) opt.body = JSON.stringify(body);
  const r = await fetch(path, opt);
  if (!r.ok){ let m = r.statusText; try { m = (await r.json()).detail || m; } catch(_){} const e = new Error(m); e.status = r.status; throw e; }
  return r.json();
}
function keepUI(fn){
  const a = document.activeElement, id = a && a.id, s0 = a && a.selectionStart, s1 = a && a.selectionEnd;
  const scrolls = ['p-brief','p-chat','p-guide','w-list','w-slot','w-wallbox'].map(k => [k, (document.getElementById(k) || {}).scrollTop]);
  const y = window.scrollY;
  fn();
  scrolls.forEach(([k, v]) => { const el = document.getElementById(k); if (el && v != null) el.scrollTop = v; });
  window.scrollTo(0, y);
  if (id){ const el = document.getElementById(id); if (el){ el.focus(); try { if (s0 != null) el.setSelectionRange(s0, s1); } catch(_){} } }
}
function cost(set){ return (set || []).reduce((a, id) => a + FEAT[id].price, 0); }
function setBlock(set){
  set = set || [];
  return `<ul class="setlist">${set.map(id => `<li><span><span class="fid">${id}</span> ${esc(FEAT[id].name)}</span><span>$${FEAT[id].price}</span></li>`).join('')}
    <li><span>Total</span><span>$${cost(set)} of $${BUDGET}</span></li></ul>`;
}
function sharedTable(){
  return `<table><thead><tr><th>ID</th><th>Feature</th><th class="num">Price</th><th class="num">Table value</th></tr></thead><tbody>
  ${CT.features.map(f => `<tr><td class="fid">${f.id}</td><td>${esc(f.name)}<div class="small muted">${esc(f.plain)}</div></td><td class="num">$${f.price}</td><td class="num">${f.shared}</td></tr>`).join('')}</tbody></table>`;
}
const ROLE_COLOR = {ME:'var(--ME)', MF:'var(--MF)', HF:'var(--HF)'};

/* ===================================================================== */
/* LIVE CONNECTION                                                        */
/* ===================================================================== */
let WS = null, wsTimer = null, refreshTimer = null, onlineBanner = '';
function connectWS(params, onMsg){
  try { WS && WS.close(); } catch(_){}
  const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?' + params;
  WS = new WebSocket(url);
  WS.onopen = () => { if (onlineBanner){ onlineBanner = ''; onMsg({t:'update'}); } };
  WS.onmessage = ev => { try { onMsg(JSON.parse(ev.data)); } catch(_){} };
  WS.onclose = () => { onlineBanner = 'Reconnecting…'; renderSoon(); clearTimeout(wsTimer); wsTimer = setTimeout(() => connectWS(params, onMsg), 2500); };
}
setInterval(() => { try { WS && WS.readyState === 1 && WS.send('ping'); } catch(_){} }, 20000);
let renderQueued = false;
function renderSoon(){ if (!renderQueued){ renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); } }

/* ===================================================================== */
/* STUDENT                                                                */
/* ===================================================================== */
let TOKEN = null, V = null;
const L = {tab:'brief', lastStep:null, text:'', compose:null, tapped:[], comment:'', rdraft:{}, joinErr:'', code:qs.get('code') || '', tabSince:Date.now(), seenStart:{}, busy:false};

async function act(type, data, opts){
  if (!TOKEN || WATCH) return;
  try {
    const v = await api('/api/act', {token:TOKEN, type, ...(data || {})});
    if (!(opts && opts.quiet)){ V = v; render(); }
  } catch(e){ if (e.status === 404) resetSeat(); }
}
function track(type, data){ act(type, data, {quiet:true}); }
function resetSeat(){ localStorage.removeItem(TOKEN_KEY); TOKEN = null; V = null; render(); }
async function refreshMe(){
  if (!TOKEN) return;
  try { V = await api('/api/me?token=' + encodeURIComponent(TOKEN)); render(); }
  catch(e){ if (e.status === 404) resetSeat(); }
}
const snapTimers = {};
function snap(key, fn){ clearTimeout(snapTimers[key]); snapTimers[key] = setTimeout(fn, 1500); }

function stepNames(cond, rounds){
  const n = ['Read your brief'];
  for (let i = 1; i <= rounds; i++) n.push(cond === 'caucus' ? (i === 1 ? 'Private chat' : 'Review the draft') : `Discussion round ${i}`);
  return n.concat(['Final decision', 'Survey', 'Done']);
}
function stepIndex(step, rounds){ return step === 'card' ? 0 : step === 'final' ? rounds + 1 : step === 'survey' ? rounds + 2 : step === 'done' ? rounds + 3 : roundOf(step); }
function todo(tm){
  const s = tm.me.step, n = roundOf(s), c = tm.cond;
  if (s === 'card') return 'Read your brief, then answer the questions at the bottom.';
  if (s.startsWith('post')){
    if (c === 'caucus') return n === 1 ? 'Tell the Mediator what you know, and pick features.' : "Rate the Mediator's draft and say what should change.";
    if (c === 'facilitated') return `Answer the Mediator's question and update your picks (round ${n}).`;
    return `Post your message for round ${n} and update your picks.`;
  }
  if (s.startsWith('wait')) return tm.pending ? 'The Mediator is writing. Please wait.' : "Waiting for your teammates. Please don't talk out loud.";
  if (s === 'final') return "Read the team's final decision and say if you accept it.";
  if (s === 'survey') return 'Answer the short survey on your own.';
  return 'All done. Thank you!';
}
function introText(c){
  if (c === 'caucus') return "This chat is private: only you and the Mediator see it. The Mediator is an AI tool.\n\nTell me which features you think the team should buy. Also tell me anything from your testing that the shared table gets wrong.";
  if (c === 'facilitated') return "Everyone on your team sees this chat. The Mediator is an AI tool that will ask the team a question each round. Each round, everyone posts one message with their picks. Messages appear once all three of you have posted.";
  if (c === 'summary_only') return "Everyone on your team sees this chat. Each round, everyone posts one message with their picks. After each round, the Mediator (an AI tool) posts a short, neutral recap of who said what.\n\nThe team's decision is the features at least 2 of you pick in the last round.";
  return "Everyone on your team sees this chat. Each round, everyone posts one message with their picks. Messages appear once all three of you have posted.\n\nThe team's decision is the features at least 2 of you pick in the last round.";
}
function likert(group, key, val){
  return `<div class="lik">${[1,2,3,4,5].map(v => `<button data-act="lik" data-g="${group}" data-k="${key}" data-v="${v}" class="${val === v ? 'on' : ''}" aria-label="${v}">${v}</button>`).join('')}</div>
    <div class="likl"><span>Strongly disagree</span><span>Strongly agree</span></div>`;
}
function banners(){
  const s = V.session;
  return `${onlineBanner ? `<div class="banner paused">${onlineBanner}</div>` : ''}${s.paused ? '<div class="banner paused"><i class="ic ic-pause"></i>Paused by the researcher. Please wait.</div>' + pauseOverlay() : ''}${s.broadcast ? `<div class="banner bc"><i class="ic ic-mega"></i>${esc(s.broadcast)}</div>` : ''}`;
}

function renderJoin(){
  return `<header class="top"><h1>Team Design Session</h1></header>
  <div class="card"><h2>Join your class session</h2><p class="muted">Type the class code on the screen.</p>
    <form data-form="join"><input class="code" type="text" id="code" maxlength="8" autocomplete="off" placeholder="CODE" value="${esc(L.code)}">
    ${L.joinErr ? `<div class="err">${esc(L.joinErr)}</div>` : ''}<button class="btn" type="submit" ${L.busy ? 'disabled' : ''}>Join</button></form>
    <p class="small muted" style="margin-top:10px">No account or name needed.</p></div>`;
}
function renderConsent(){
  return `<header class="top"><h1>Team Design Session</h1></header>${banners()}
  <div class="card"><h2>Before you start</h2>
    <p>Today you'll work in a team of three on a short design task in this app. Everyone in class does the same activity.</p>
    <p>We are also studying how teams share information. Some teams will get help from an AI tool and some will not.</p>
    <p>If you say yes, we will use what you do in the app for research. That includes your answers, your messages, what you type (even if you don't send it), what you tap, and how long each step takes. Your name is never collected. Saying no does not affect your grade, and you still do the activity.</p>
    <button class="btn btn-big" data-act="consent" data-yes="1">Yes, you can use my answers</button>
    <button class="linkbtn" data-act="consent" data-yes="0">No, just do the activity</button>
    <p class="small muted" style="margin-top:10px">Your participant ID: <b>${V.pid}</b></p></div>`;
}
function renderLobby(){
  if (V.late) return `<header class="top"><h1>Team Design Session</h1></header>${banners()}
    <div class="card wait"><h2>The session has already started</h2><p class="muted">A researcher will set you up in a moment. Please stay on this screen.</p>
    <p class="small">Your participant ID: <b>${V.pid}</b></p></div>`;
  const n = V.session.joined;
  return `<header class="top"><h1>Team Design Session</h1></header>${banners()}
    <div class="card wait"><h2>You're in</h2><p class="muted">Waiting for class to start. You'll get your role and team when it does.</p>
    <p class="small">Your participant ID: <b>${V.pid}</b></p><div class="dots"><i></i><i></i><i></i></div>
    <p><b>${n}</b> ${n === 1 ? 'person has' : 'people have'} joined.</p></div>`;
}
function phaseBar(tm){
  const rounds = V.session.rounds, names = stepNames(tm.cond, rounds), i = stepIndex(tm.me.step, rounds);
  return `<div class="phasebar">
    <div class="pb-top"><span class="who-pill" style="background:${ROLE_COLOR[tm.role]}">${esc(tm.label)}</span>
      <span class="pb-step">Step ${i+1} of ${names.length} · ${names[i]}</span>
      <button class="help ${V.help ? 'on' : ''}" data-act="help">${V.help ? 'Help is coming' : 'Need help'}</button></div>
    <div class="pb-todo">${todo(tm)}</div>
    <div class="steps">${names.map((_,k) => `<div class="${k <= i ? 'done' : ''}"></div>`).join('')}</div>${timerNow()}${banners()}</div>`;
}
function briefPanel(tm){
  const RO = CT.roles[tm.role], me = tm.me, canInsert = me.step.startsWith('post');
  let h = `<div class="card"><div class="ptitle">My role brief</div><h2>${RO.name}</h2><p class="muted">${RO.goal}</p>
    <h3>The task</h3>
    <p>Your team is choosing features for a <b>low-cost home blood-pressure and blood-oxygen monitor</b>. There are 12 possible features. <b>The team can spend at most $${BUDGET}.</b> All 12 would cost $126. Pick the set with the <b>most total value</b> at $${BUDGET} or less.</p>
    <p class="small muted">Value is in benefit points. More points means more good for the people who use the monitor.</p>
    <h3>Your role</h3><p>${RO.intro}</p></div>
  <div class="card"><h3 style="margin-top:0">Shared table</h3><p class="small muted">All three teammates see this same table. Some values in it may be wrong.</p>${sharedTable()}</div>
  <div class="card"><div class="private" style="--rc:${ROLE_COLOR[tm.role]}"><span class="tag"><i class="ic ic-lock"></i>Only you can see this</span>
    <p class="small" style="margin-top:2px">Teammates cannot see your brief unless you tell them.</p>
    ${tm.facts.map(fc => `<div class="fact"><span class="fx">${fc.id}</span><div><b>${fc.f} ${esc(FEAT[fc.f].name)}:</b> ${esc(fc.raw)}</div>
      </div>`).join('')}
    <p class="small" style="margin-bottom:0">Nobody else on your team ran these tests. What do your results mean for the table? That is for you to work out.</p></div></div>`;
  if (me.step === 'card'){
    const c = me.chk, done = c.role && c.see && CT.pre.every(([k]) => me.pre[k]);
    h += `<div class="card"><h3 style="margin-top:0">Two quick questions</h3>
      <div class="q"><b>1. What is your role?</b><div class="opt">${CT.role_keys.map(k => `<button data-act="chk" data-k="role" data-v="${k}" class="${c.role === k ? 'on' : ''}">${CT.roles[k].short}</button>`).join('')}</div>
        ${c.role ? (c.role === tm.role ? '<div class="good">Correct.</div>' : `<div class="fix">Not quite. You are the ${RO.name}.</div>`) : ''}</div>
      <div class="q"><b>2. Can your teammates see this brief?</b><div class="opt">${[['yes','Yes'],['no','No']].map(([v,l]) => `<button data-act="chk" data-k="see" data-v="${v}" class="${c.see === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        ${c.see ? (c.see === 'no' ? '<div class="good">Correct. Only you can see it.</div>' : '<div class="fix">Not quite. Only you can see your brief. Teammates only learn it if you tell them.</div>') : ''}</div>
      <h3>Before you start (1 minute)</h3>${CT.pre.map(([k, q]) => `<div class="q">${esc(q)}${likert('pre', k, me.pre[k])}</div>`).join('')}
      <button class="btn" data-act="ready" ${done && !V.session.paused ? '' : 'disabled'}>I'm ready</button></div>`;
  }
  return h;
}
function pickRows(me){
  const c = cost(me.picks);
  return CT.features.map(f => { const on = me.picks.includes(f.id), dim = !on && c + f.price > BUDGET;
      return `<label class="pick ${dim ? 'dim' : ''}"><input type="checkbox" data-act="pick" data-id="${f.id}" ${on ? 'checked' : ''} ${dim ? 'disabled' : ''}>
        <div><div class="nm"><span class="fid">${f.id}</span> ${esc(f.name)}</div><div class="ds">Table value ${f.shared}</div></div><div class="pr">$${f.price}</div></label>`; }).join('');
}
function picker(me, label){
  const c = cost(me.picks), over = c > BUDGET;
  return `<div class="card" style="padding:10px 12px"><div class="btxt"><b>${label}</b><b class="${over ? 'over' : ''}">$${c} of $${BUDGET}${over ? ' · over budget' : ''}</b></div>
    <div class="bar ${over ? 'over' : ''}"><i style="width:${Math.min(100, c/BUDGET*100)}%"></i></div>${pickRows(me)}</div>`;
}
function countTxt(t){ const n = (t || '').length, m = (CT.msg_max || 300); return `${n} / ${m} characters${n >= m ? ' · limit reached' : m - n <= 40 ? ' · ' + (m - n) + ' left' : ''}`; }
/* The vote (picks) and the reasons (message) go out together as one submission. */
function receipt(me, shared, text){
  const c = cost(me.picks), over = c > BUDGET, t = (text || '').trim(), words = t ? t.split(/\s+/).length : 0;
  return `<div class="lab">What you are sending ${shared ? 'to your team' : 'to the Mediator'}</div>
    <div class="pk-line ${me.picks.length && !over ? '' : 'miss'}"><i>${me.picks.length && !over ? '✓' : '!'}</i><span><b>Vote:</b> ${me.picks.length ? me.picks.map(x => `<span class="pk-chip">${x}</span>`).join('') + ` $${c} of $${BUDGET}` : 'no features picked yet'}${over ? ' · over budget' : ''}</span></div>
    <div class="pk-line"><i>–</i><span><b>Left out:</b> ${(typeof FEATURES !== 'undefined' ? FEATURES : CT.features).filter(f => !me.picks.includes(f.id)).map(f => f.id).join(' ') || 'nothing'}</span></div>
    <div class="pk-line ${t ? '' : 'miss'}"><i>${t ? '✓' : '!'}</i><span><b>Reasons:</b> ${t ? `${words} word${words === 1 ? '' : 's'} · "${esc(t.length > 60 ? t.slice(0, 60) + '…' : t)}"` : 'no message yet'}</span></div>`;
}
function sendHint(me, paused, text){
  return paused ? 'Paused by the researcher.' : cost(me.picks) > BUDGET ? 'Your vote is over budget. Untick a feature.' : !(text || '').trim() ? 'Write your reasons to send.' : 'Both parts are sent together, in one go.';
}
/* opt: {shared, cond, round, rounds, paused, text} */
function packet(me, o){
  const fb = o.cond === 'caucus' && o.round > 1, c = cost(me.picks), over = c > BUDGET, hasPicks = me.picks.length && !over, hasText = !!(o.text || '').trim();
  const msgTitle = o.cond === 'caucus' && fb ? 'What should change, and why?' : o.cond === 'facilitated' ? "Your answer to the Mediator's question" : 'Why these, and why not the others?';
  return `<div class="packet ${o.shared ? 'team' : 'priv'}">
    <div class="pk-head"><div>${o.shared ? '<i class="ic ic-team"></i>Your submission to the team' : '<i class="ic ic-lock"></i>Your private submission to the Mediator'}</div><span>Round ${o.round} of ${o.rounds}</span></div>
    <div class="pk-intro"><b>Your picks are your vote. In your message, explain <u>why you picked these</u> and <u>why you left the others out</u>, using what's in your brief.</b>${o.shared ? ' Teammates see both parts after all 3 send.' : ' Only the Mediator sees this.'}</div>
    <div class="pk-body">
      <div class="pk-step ${hasPicks ? 'ok' : ''}"><div class="pk-num">${hasPicks ? '✓' : '1'}</div>
        <div class="pk-title"><b>${fb ? 'Your preferred set' : 'Your vote'}</b><b class="${over ? 'over' : ''}" style="font-size:13.5px">$${c} of $${BUDGET}${over ? ' · over budget' : ''}</b></div>
        <p class="pk-sub">Tick the features you want, within the budget.</p>
        <div class="bar ${over ? 'over' : ''}"><i style="width:${Math.min(100, c/BUDGET*100)}%"></i></div>${pickRows(me)}</div>
      <div class="pk-step ${hasText ? 'ok' : ''}" id="pk-msgstep"><div class="pk-num">${hasText ? '✓' : '2'}</div>
        <div class="pk-title"><b>${msgTitle}</b></div>
        <p class="pk-sub">${fb ? 'Say what you would add or drop from the draft, and why. Use your own findings if they help.' : `Say what makes your picks worth it, and what is wrong with the ones you skipped. Use your test results, in your own words. Keep it short: ${(CT.msg_max || 300)} characters at most.`}</p>
        <textarea id="composer" data-act="text" maxlength="${(CT.msg_max || 300)}" placeholder="I picked … because … I left out … because …">${esc(o.text || '')}</textarea><div class="pk-count" id="pkcount">${countTxt(o.text)}</div></div>
    </div>
    <div class="pk-receipt" id="pkreceipt">${receipt(me, o.shared, o.text)}</div>
    <div class="pk-send"><button class="btn" id="sendbtn" data-act="send" data-n="${o.round}" ${(!hasText || over || o.paused) ? 'disabled' : ''}>${o.shared ? 'Send vote + message to team' : 'Send vote + message to Mediator'}</button>
      <p class="small muted" id="sendhint">${sendHint(me, o.paused, o.text)}</p></div></div>`;
}
/* update the parts of the card that depend on the text, without redrawing (keeps the keyboard open) */
function packetLive(me, shared, paused, text){
  const rc = document.getElementById('pkreceipt'), hn = document.getElementById('sendhint'), st = document.getElementById('pk-msgstep');
  if (rc) rc.innerHTML = receipt(me, shared, text); if (hn) hn.textContent = sendHint(me, paused, text);
  const ct = document.getElementById('pkcount'); if (ct){ ct.textContent = countTxt(text); const left = (CT.msg_max || 300) - text.length; ct.className = 'pk-count' + (left <= 0 ? ' full' : left <= 40 ? ' near' : ''); }
  if (st){ const ok = !!text.trim(); st.classList.toggle('ok', ok); st.querySelector('.pk-num').textContent = ok ? '✓' : '2'; }
}
function rateRow(tm, e){
  const v = tm.me.ratings[e.id];
  const draft = L.rdraft[e.id] ?? tm.me.rdraft[e.id] ?? '';
  return `<div class="rate"><div class="small muted">Your rating is private.</div>
    <div class="opt">${['Agree','Partly','Disagree'].map(x => `<button data-act="rate" data-mid="${e.id}" data-v="${x}" class="${v === x ? 'on' : ''}">${x}</button>`).join('')}</div>
    <input type="text" id="rc-${e.id}" data-act="rdraft" data-mid="${e.id}" placeholder="Optional: what's missing or wrong?" value="${esc(draft)}"></div>`;
}
function thread(tm){
  const rows = [`<div class="bub sys"><div class="who">How this works</div>${esc(introText(tm.cond))}</div>`];
  tm.items.forEach(e => {
    if (e.kind === 'message'){
      const mine = e.who === tm.role;
      rows.push(`<div class="bub ${mine ? 'me' : 'mate'}" data-mid="${e.id}" ${mine ? '' : `style="--rc:${ROLE_COLOR[e.who]}"`}><div class="who">${mine ? 'You' : esc(tm.mates[e.who] ? tm.mates[e.who].label : e.who)} · round ${e.round}</div>${esc(e.text)}${e.set && e.set.length ? `<div class="sentset">Vote: ${e.set.map(x => `<span class="pk-chip" style="--pbg:#E6E8EF">${x}</span>`).join('')} $${cost(e.set)}</div>` : ''}</div>`);
    } else if (e.kind === 'question'){
      rows.push(`<div class="aicard" data-mid="${e.id}"><div class="ah"><span>Question · written by the Mediator (AI)</span><span>Round ${e.round}</span></div><div class="ab">${esc(e.text)}</div></div>`);
    } else if (e.kind === 'recap' || e.kind === 'draft'){
      const title = e.kind === 'recap' ? 'Recap' : tm.cond === 'caucus' ? (e.version === 'Final' ? 'Final team decision' : 'Draft team decision') : 'Team decision';
      rows.push(`<div class="aicard" data-mid="${e.id}"><div class="ah"><span>${title} · written by the Mediator (AI)</span><span>${esc(e.version || '')} · ${e.t}</span></div>
        <div class="ab">${esc(e.text)}${e.set ? setBlock(e.set) : ''}</div><div class="based">Based on input from: ${esc(e.based_on)}. No one's words are quoted.</div>${rateRow(tm, e)}</div>`);
    } else if (e.kind === 'final'){
      rows.push(`<div class="bub sys"><div class="who">Team decision · majority vote</div>These are the features at least 2 of 3 people picked in the last round.${setBlock(e.set)}</div>`);
    }
  });
  return `<div class="thread">${rows.join('')}</div>`;
}
function waiting(tm, n){
  const done = Object.entries(tm.mates).filter(([k, m]) => m.step === 'wait' + n || roundOf(m.step) > n || ['final','survey','done'].includes(m.step)).map(([k]) => k);
  const last = n === V.session.rounds, c = tm.cond;
  const what = c === 'caucus' ? (last ? 'the final decision' : 'a draft') : c === 'facilitated' ? (last ? 'the team decision' : 'its next question') : 'a recap';
  return `<div class="card wait">${tm.pending ? `<h2>The Mediator is thinking</h2><div class="dots"><i></i><i></i><i></i></div><p class="muted">It is writing ${what}. This can take a little while.</p>`
    : `<h2>Waiting for your teammates</h2><p class="muted">${c === 'caucus' ? 'The Mediator writes a draft once all three of you have sent your message.' : "Everyone sees the round's messages once all three of you have posted."}</p>
       <div class="mates">${Object.keys(tm.mates).map(k => `<span class="mate ${done.includes(k) ? 'ok' : ''}">${done.includes(k) ? '✓ ' : ''}${CT.roles[k].short}</span>`).join('')}</div>`}</div>`;
}
function chatPanel(tm){
  const shared = CT.cond[tm.cond].shared, me = tm.me;
  let h = `<div class="ptitle">${shared ? 'Team chat' : 'Mediator chat'}</div>
    <div class="chanhead ${shared ? 'team' : 'priv'}">${shared ? '<i class="ic ic-team"></i>Team — all 3 members see this' : '<i class="ic ic-lock"></i>Private — only you and the Mediator'}</div>
    <div class="card">${me.step === 'card' ? '<p class="muted">The chat opens after you read your brief.</p>' : thread(tm)}</div>`;
  if (me.step.startsWith('wait')) h += waiting(tm, roundOf(me.step));
  if (me.step.startsWith('post')) h += packet(me, {shared, cond:tm.cond, round:roundOf(me.step), rounds:V.session.rounds, paused:V.session.paused, text:L.text});
  return h;
}
function guidePanel(tm){
  const me = tm.me, c = tm.cond, med = CT.cond[c].mediator, paused = V.session.paused;
  let h = `<div class="ptitle">Guide</div><div class="card"><b>What to do now</b><p>${todo(tm)}</p>
    <p class="small muted">${c === 'caucus' ? 'Your messages go only to the Mediator. Your teammates never see them.' : 'Your messages go to your whole team.'} Please don't talk out loud or try to find your teammates in the room. Only what you write in the app counts.</p>
    <p class="small muted" style="margin-bottom:0">Your participant ID: <b>${V.pid}</b>. Give this to a researcher if you need help.</p></div>`;
  if (me.step === 'final'){
    h += `<div class="card"><h2>Team decision</h2>${setBlock(tm.final)}<h3>Can you accept this as the team's decision?</h3><p class="muted small">Your answer is private.</p>
      <textarea data-act="comment" id="endorse-c" placeholder="Optional: why?">${esc(L.comment)}</textarea>
      <div class="btns"><button class="btn" data-act="endorse" data-yes="1" ${paused ? 'disabled' : ''}>Yes, I accept</button><button class="btn ghost" data-act="endorse" data-yes="0" ${paused ? 'disabled' : ''}>No</button></div></div>`;
  }
  if (me.step === 'survey'){
    const items = CT.post_common.concat(med ? CT.post_ai : []);
    const complete = items.every(([k]) => me.sv[k]) && me.sv.leak;
    h += `<div class="card"><h2>Survey</h2><p class="muted small">On your own. About 2 minutes.</p>
      ${CT.post_common.map(([k,q]) => `<div class="q">${esc(q)}${likert('sv', k, me.sv[k])}</div>`).join('')}
      <div class="q">Did you talk to a teammate outside the app?<div class="opt">${['No','A little','A lot'].map(v => `<button data-act="leak" data-v="${v}" class="${me.sv.leak === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      ${med ? `<h3>About the Mediator</h3>${CT.post_ai.map(([k,q]) => `<div class="q">${esc(q)}${likert('sv', k, me.sv[k])}</div>`).join('')}` : ''}
      <h3>Which of these did a teammate raise?</h3><p class="small muted">Check all that apply. Some were never said.</p>
      ${tm.recall_items.map(x => `<label class="pick"><input type="checkbox" data-act="recall" data-id="${x.id}" ${me.recall.includes(x.id) ? 'checked' : ''}><div>${esc(x.text)}</div></label>`).join('')}
      <button class="btn" data-act="survey" ${complete && !paused ? '' : 'disabled'}>Submit survey</button></div>`;
  }
  if (me.step === 'done') h += `<div class="card wait"><h2>All done. Thank you!</h2><p>Your team's final design:</p>${setBlock(tm.final)}
    <p class="small muted" style="margin-top:10px">Please stay quiet until everyone finishes. We'll explain the study at the end.</p></div>`;
  return h;
}
function defaultTab(step){ return step === 'card' ? 'brief' : ['final','survey','done'].includes(step) ? 'guide' : 'chat'; }
function renderStudent(){
  if ((!TOKEN && !WATCH) || !V) return renderJoin();
  if (V.consent === null) return renderConsent();
  if (!V.team) return renderLobby();
  const tm = V.team, step = tm.me.step;
  if (tm.timer && tm.timer.server_now !== L.lastSrvNow){ L.lastSrvNow = tm.timer.server_now; L.clockOff = tm.timer.server_now * 1000 - Date.now(); }
  if (L.lastStep !== step){
    const nt = defaultTab(step);
    if (L.lastStep !== null && nt !== L.tab){ track('tab', {from:L.tab, to:nt, ms_on_prev:Date.now() - L.tabSince, auto:true}); L.tabSince = Date.now(); }
    if (L.lastStep === null) L.tabSince = Date.now();
    L.lastStep = step; L.tab = nt;
    if (step.startsWith('post')){ L.text = tm.me.text || ''; L.compose = null; L.tapped = []; }
    L.comment = tm.me.comment || '';
  }
  const tb = (k, l, dot) => `<button data-act="tab" data-tab="${k}" class="${L.tab === k ? 'on' : ''}">${l}${dot ? '<span class="dot"></span>' : ''}</button>`;
  return phaseBar(tm) + `<div class="tabsbar">${tb('brief','Brief')}${tb('chat', CT.cond[tm.cond].shared ? 'Team' : 'Mediator', L.tab !== 'chat' && step.startsWith('post'))}${tb('guide','Guide', L.tab !== 'guide' && ['final','survey'].includes(step))}</div>
    <div class="panels"><section class="panel ${L.tab === 'brief' ? 'on' : ''}" id="p-brief">${briefPanel(tm)}</section>
    <section class="panel ${L.tab === 'chat' ? 'on' : ''}" id="p-chat">${chatPanel(tm)}</section>
    <section class="panel ${L.tab === 'guide' ? 'on' : ''}" id="p-guide">${guidePanel(tm)}</section></div>`;
}

/* "Heard": a teammate message or Mediator card on screen for 2+ seconds */
let IO = null;
function observeSeen(){
  if (!('IntersectionObserver' in window)) return;
  if (IO) IO.disconnect();
  if (!V || !V.team) return;
  IO = new IntersectionObserver(entries => entries.forEach(en => {
    const k = en.target.dataset.mid;
    if (en.isIntersecting){ if (!L.seenStart[k]) L.seenStart[k] = Date.now(); } else if (L.seenStart[k] !== -1) delete L.seenStart[k];
  }), {threshold:0.5});
  document.querySelectorAll('#p-chat [data-mid]').forEach(el => { if (!el.classList.contains('me')) IO.observe(el); });
}
setInterval(() => {
  if (MODE !== 'student' || document.hidden || !V || !V.team) return;
  Object.entries(L.seenStart).forEach(([mid, t0]) => { if (t0 > 0 && Date.now() - t0 >= 2000){ L.seenStart[mid] = -1; track('seen', {msg:mid}); } });
}, 500);

function studentClick(which, b){
  const tm = V && V.team, me = tm && tm.me;
  switch (which){
    case 'consent': return act_('consent', {yes:b.dataset.yes === '1'});
    case 'help': return act_('help');
    case 'tab': if (L.tab !== b.dataset.tab){ track('tab', {from:L.tab, to:b.dataset.tab, ms_on_prev:Date.now() - L.tabSince}); L.tab = b.dataset.tab; L.tabSince = Date.now(); render(); window.scrollTo(0,0); } return;
    case 'chk': return act_('chk', {k:b.dataset.k, v:b.dataset.v});
    case 'lik': return act_('lik', {g:b.dataset.g, k:b.dataset.k, v:+b.dataset.v});
    case 'leak': return act_('leak', {v:b.dataset.v});
    case 'ready': return act_('ready');
    case 'insfact': {
      const tag = `[${b.dataset.fact}] `;
      if (!L.compose){ L.compose = {start:Date.now(), keys:0, back:0, pastes:0}; track('typing_start', {field:'message'}); }
      L.text = (L.text && !L.text.endsWith(' ') ? L.text + ' ' : L.text) + tag; L.tapped.push(b.dataset.fact);
      track('insert_fact', {fact:b.dataset.fact}); snap('msg', () => track('draft_snapshot', {text:L.text}));
      L.tab = 'chat'; render(); const el = document.getElementById('composer'); if (el){ el.focus(); el.setSelectionRange(el.value.length, el.value.length); } return;
    }
    case 'send': {
      clearTimeout(snapTimers.msg);
      const cp = L.compose || {};
      const data = {text:L.text.trim(), n:+b.dataset.n, compose_ms:cp.start ? Date.now() - cp.start : null, keys:cp.keys || 0, backspaces:cp.back || 0, pastes:cp.pastes || 0, tapped:L.tapped};
      track('send_click', {chars:L.text.trim().length});
      L.text = ''; L.compose = null; L.tapped = [];
      return act_('send', data);
    }
    case 'rate': { const mid = b.dataset.mid; clearTimeout(snapTimers['rc' + mid]); return act_('rate', {msg:mid, v:b.dataset.v, comment:L.rdraft[mid] ?? (me.rdraft[mid] || '')}); }
    case 'endorse': clearTimeout(snapTimers.comment); return (async () => { if (L.comment.trim() && L.comment !== (me.comment || '')) await act('comment', {text:L.comment}, {quiet:true}); act_('endorse', {yes:b.dataset.yes === '1'}); })();
    case 'survey': return act_('survey');
  }
}
function act_(t, d){ return act(t, d); }

/* ===================================================================== */
/* ADMIN                                                                  */
/* ===================================================================== */
let ADMIN = localStorage.getItem('tds_admin');
const A = {showGuide:(() => { try { return localStorage.getItem('tds_guide_seen') !== '1'; } catch(_){ return false; } })(), watchPid:null, watchMode:'screen', wf:{cond:'', kind:'', team:'', q:''}, wall:null, wstats:null, fq:'', fteam:'', fnobots:false, fpause:false, fkinds:new Set(['msg','rate','acc','sv']), tab:'live', st:null, results:null, people:null, person:null, team:null, flash:'', q:'', hideCond:false, consentOnly:true, pinErr:'', auto:false};
let admTimer = null;
function admSoon(ms){ clearTimeout(admTimer); admTimer = setTimeout(refreshAdmin, ms || 400); }
async function refreshAdmin(){
  if (!ADMIN) return render();
  try {
    A.st = await api('/api/admin/state'); A.stAt = Date.now();
    if (MODE === 'projector' && pjMode(A.st) === 'results' && Date.now() - PJ.chartsAt > 4000){ PJ.chartsAt = Date.now(); PJ.charts = await api('/api/admin/charts?consent_only=0'); }
    if (A.tab === 'results') A.results = await api('/api/admin/results?consent_only=' + (A.consentOnly ? 1 : 0));
    if (A.tab === 'charts') A.charts = await api('/api/admin/charts?consent_only=' + (A.consentOnly ? 1 : 0));
    if (A.tab === 'watch'){ A.wall = await api('/api/admin/wall'); A.wstats = A.watchPid ? await api('/api/admin/watch/' + encodeURIComponent(A.watchPid)) : null; }
    if (A.tab === 'feed'){ A.feed = await api('/api/admin/feed'); if (!A.fpause || !A.feedShown) A.feedShown = A.feed; }
    if (A.tab === 'saved') A.saved = await api('/api/admin/saved');
    if (A.tab === 'ai') A.ai = await api('/api/admin/ai');
    if (A.tab === 'setup' && !A.models && !ARCH) A.models = await api('/api/admin/models');
    if (A.tab === 'people' && !A.person) A.people = await api('/api/admin/people');
    if (A.tab === 'people' && A.person) A.person = await api('/api/admin/person/' + A.person.pid);
    if (A.team) A.team = await api('/api/admin/team/' + A.team.id);
  } catch(e){ if (e.status === 401){ ADMIN = null; localStorage.removeItem('tds_admin'); } }
  if (A.tab === 'watch' && A.wRendered && document.getElementById(A.watchMode === 'wall' ? 'w-wallbox' : 'w-list')) return patchWatch();
  render();
  A.wRendered = A.tab === 'watch';
}
async function adm(type, data){
  if (ARCH){ A.flash = 'This is a saved session, so nothing can be changed. Go back to the live session first.'; render(); setTimeout(() => { A.flash = ''; render(); }, 3500); return; }
  try { const r = await api('/api/admin/act', {type, ...(data || {})}); if (r.msg){ A.flash = r.msg; setTimeout(() => { A.flash = ''; render(); }, 3500); } }
  catch(e){ A.flash = 'Error: ' + e.message; }
  refreshAdmin();
}
const exp = name => `/api/admin/${ARCH ? 'saved/' + ARCH.id + '/' : ''}export/${name}?admin=${encodeURIComponent(ADMIN)}&consent_only=${A.consentOnly ? 1 : 0}`;
const condLabel = c => ({caucus:'Caucus', facilitated:'Guided discussion', summary_only:'Summary only', unmediated:'Unmediated'})[c] || c;
const STEP_NAMES = st => !st ? '—' : st === 'consent' ? 'Consent' : st === 'lobby' ? 'Lobby' : st === 'late' ? 'Late' : st === 'card' ? 'Reading brief' : st.startsWith('post') ? `Writing · round ${roundOf(st)}` : st.startsWith('wait') ? `Waiting · round ${roundOf(st)}` : st === 'final' ? 'Final decision' : st === 'survey' ? 'Survey' : st === 'done' ? 'Done' : st;

function renderPin(){
  return `<header class="top"><h1>Researcher login</h1></header>
  <div class="card"><form data-form="pin"><p class="muted">Enter the researcher PIN.</p>
    <input class="code" type="password" id="pin" maxlength="12" autocomplete="off">${A.pinErr ? `<div class="err">${esc(A.pinErr)}</div>` : ''}
    <button class="btn" type="submit">Open admin view</button></form></div>`;
}
const UIS = () => A, wFmt = x => fmtT(x);
/* =====================================================================
   v2 polish, shared by the server app and the prototype:
   editable practice size, simulation panel with pause + finished states,
   pause screen for players, cleaner Watch side panel, aligned result
   meters, and a custom dropdown list for every <select>.
   ===================================================================== */
const svLabel = k => ((CT ? CT.post_common.concat(CT.post_ai) : []).find(q => q[0] === k) || [0, k])[1];
/* ---------- v5 shared: profile rows for People, saved sessions ---------- */
/* p = {pid, bot, persona, team, role, label, cond, condText, consent, step, events, msgs, inApp (seconds)} */
function personRow(p, hide){
  const nm = p.label || 'Not on a team yet';
  return `<button type="button" class="pp" data-act="person" data-pid="${p.pid}" style="--rc:${ROLE_COLOR[p.role] || '#8b91a0'}">
    <span class="pp-av"><i class="ic ic-user"></i></span>
    <span class="pp-id"><b>${esc(nm)}</b><small>${p.pid} · ${p.bot ? 'Simulated' + (p.persona ? ' · ' + esc(p.persona) : '') : 'Real student'}</small></span>
    <span class="pp-pills">
      ${p.team != null ? `<span class="pp-pill"><i class="ic ic-team"></i>Team ${p.team}</span>` : ''}
      ${p.cond ? (hide ? '<span class="pp-pill">type hidden</span>' : `<span class="pp-pill c" style="--cc:${CONDC[p.cond]}">${esc(p.condText)}</span>`) : ''}
      <span class="pp-pill ${p.consent == null ? '' : p.consent ? 'ok' : 'no'}"><i class="ic ${p.consent === false ? 'ic-alert' : 'ic-check'}"></i>${p.consent == null ? 'Consent not answered' : p.consent ? 'Consent' : 'No consent'}</span>
      <span class="pp-pill"><i class="ic ic-flag"></i>${esc(p.step)}</span></span>
    <span class="pp-nums"><span title="Messages sent"><i class="ic ic-chat"></i>${p.msgs}</span><span title="Things they did in the app"><i class="ic ic-pulse"></i>${p.events}</span><span title="Time in the app"><i class="ic ic-clock"></i>${wFmt(p.inApp)}</span></span>
    <span class="pp-go" aria-hidden="true">›</span></button>`;
}
const ppLegend = () => `<p class="pp-legend"><span><i class="ic ic-chat"></i>messages sent</span><span><i class="ic ic-pulse"></i>things they did</span><span><i class="ic ic-clock"></i>time in the app</span></p>`;
const svWhen = t => new Date(t * 1000).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'});
function archBanner(a){
  return a ? `<div class="practice arch"><span><i class="ic ic-folder"></i><b>Saved session:</b> ${esc(a.name)} · saved ${svWhen(a.saved_at)}. You are looking at a saved copy. Every tab works, but nothing can be changed.</span>
    <button class="mini" data-act="closesaved">Back to the live session</button></div>` : '';
}
/* o = {list, arch, defName, canSave, note, zip(m) -> html} */
function savedTabHTML(o){
  const L = o.list;
  return `${o.arch ? '' : `<div class="card"><h3 style="margin-top:0">Save this session</h3>
      <div class="inline"><input type="text" id="savename" maxlength="60" value="${esc(o.defName)}" aria-label="Name for the saved session" style="flex:1;min-width:220px;margin:0">
        <button class="mini dark" data-act="savesess" ${o.canSave ? '' : 'disabled title="Nothing to save yet"'}><i class="ic ic-folder"></i>Save as a folder</button></div>
      ${o.canSave ? '' : '<p class="small muted" style="margin:8px 0 0">Nothing to save yet. Students need to join first.</p>'}</div>`}
    <div class="card"><h3 style="margin-top:0">Saved sessions · ${L ? L.length : '…'}</h3><p class="small muted">${o.note}</p>
      ${!L ? '<p class="muted">Loading…</p>' : !L.length ? '<p class="muted" style="margin:14px 0 4px">No saved sessions yet.</p>' : `<div class="sv-list">${L.map(m => `<div class="sv-item ${o.arch && o.arch.id === m.id ? 'on' : ''}">
        <span class="sv-ic"><i class="ic ic-folder"></i></span>
        <div class="sv-b"><b>${esc(m.name)}</b><small>Saved ${svWhen(m.saved_at)} · ${m.joined} student${m.joined === 1 ? '' : 's'}${m.bots ? ` (${m.bots === m.joined ? 'all' : m.bots} simulated)` : ''} · ${m.finished} of ${m.teams} teams finished</small></div>
        <div class="sv-a">${o.arch && o.arch.id === m.id ? '<span class="pp-pill ok">Open now</span>' : `<button class="mini dark" data-act="opensaved" data-id="${m.id}">Open</button>`}${o.zip(m)}<button class="mini" data-act="delsaved" data-id="${m.id}">Delete</button></div></div>`).join('')}</div>`}</div>`;
}

/* ---------- v6 shared: team rows (Live session and Results) ---------- */
const stIcon = (txt, cls) => cls === 'ok' || /^(Sent|Done|Finished)/.test(txt) ? 'ic-check' : /Writ|Read/.test(txt) ? 'ic-chat' : /Wait/.test(txt) ? 'ic-clock' : 'ic-flag';
const teamWho = (id, cond, condText, hide, extra) => `<div class="tr-who" style="--cc:${hide ? '#5b6070' : CONDC[cond] || '#5b6070'}"><span class="tr-av"><i class="ic ic-team3"></i></span>
    <span class="pp-id"><b>Team ${id}</b><small>${hide ? 'type hidden' : esc(condText)}</small></span>${extra || ''}</div>`;
/* t = {id, cond, condText, flags:[text], members:[{role, roleName, name, pid, status:[text, cls], help, real}], phase:[text, cls], note, actions} */
function teamRow(t, hide){
  return `<div class="tr-row live">${teamWho(t.id, t.cond, t.condText, hide)}
    <div class="tr-mem">${t.members.map(m => `<a href="#" class="tr-m" data-act="person" data-pid="${m.pid}" style="--rc:${ROLE_COLOR[m.role]}" title="Open ${m.pid}">
      <span class="tr-mav"><i class="ic ic-user"></i></span><span class="tr-mb"><b>${esc(m.roleName)} · ${esc(m.name)}${m.real ? ' <em>real</em>' : ''}${m.help ? ' <i class="ic ic-help" title="Asked for help"></i>' : ''}</b>
      <small class="${m.status[1] === 'ok' ? 'ok' : ''}"><i class="ic ${stIcon(m.status[0], m.status[1])}"></i>${m.status[0]}</small></span></a>`).join('')}</div>
    <div class="tr-st"><span class="pp-pill ${t.phase[1] === 'ok' ? 'ok' : t.phase[1] === 'warn' ? 'no' : ''}"><i class="ic ${stIcon(t.phase[0], t.phase[1])}"></i>${t.phase[0]}</span>${t.flags.map(f => `<span class="pp-pill warn">${f}</span>`).join('')}${t.note ? `<div class="tr-note"><i class="ic ic-alert"></i>${esc(t.note)}</div>` : ''}</div>
    ${t.tl ? `<div class="tr-tl">${t.tl.bar}${t.tl.side}<div class="tr-act">${t.actions}</div></div>` : `<div class="tr-act">${t.actions}</div>`}</div>`;
}
/* x = {team, cond, condText, set:[ids], score, opt, facts, steps:[spoken, heard, integrated, actioned], lostShare, lostFinal, wrong, flags:[text]} */
function teamResultRow(x, hide){
  const pct = Math.round(x.score / x.opt * 100), L = ['Spoken', 'Heard', 'Integrated', 'Actioned'];
  return `<button type="button" class="tr-row res" data-act="admteam" data-team="${x.team}" title="Open this team's log">${teamWho(x.team, x.cond, x.condText, hide)}
    <div class="tr-g"><small><i class="ic ic-check"></i>Final design</small><div class="tr-set">${x.set.map(f => `<span class="fd-chip">${f}</span>`).join('')}</div></div>
    <div class="tr-g"><small><i class="ic ic-flag"></i>Score</small><div class="tr-score"><b>${x.score}</b><span>of ${x.opt} · ${pct}%</span></div><div class="ws-mt"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>
    <div class="tr-g"><small><i class="ic ic-chat"></i>Findings that got through, of ${x.facts}</small><ol class="tr-steps">${x.steps.map((n, i) => `<li><b>${n}</b><span>${L[i]}</span><i style="--w:${x.facts ? n / x.facts * 100 : 0}%"></i></li>`).join('')}</ol></div>
    <div class="tr-g"><small><i class="ic ic-alert"></i>Points lost</small><div class="tr-lost"><span>Sharing <b>${x.lostShare}</b></span><span>Final pick <b>${x.lostFinal}</b></span></div>${x.wrong ? `<span class="tr-wrong">${x.wrong}</span>` : ''}${x.flags.map(f => `<span class="pp-pill warn">${f}</span>`).join('')}</div>
    <span class="pp-go" aria-hidden="true">›</span></button>`;
}

/* ---------- v7 shared: search that covers everything on a row, sorting, the announcement card ---------- */
const matchQ = (q, parts) => { const h = parts.filter(Boolean).join(' ').toLowerCase(); return String(q || '').toLowerCase().split(/\s+/).filter(Boolean).every(w => h.includes(w)); };
const SORT_DESC = new Set(['score','spoken','actioned','lost','behind','msgs','events','time']);
const sortState = (key, opts) => ((UIS().sorts || {})[key]) || {by:opts[0][0], dir:1};
function sortBar(key, opts){
  const s = sortState(key, opts);
  return `<div class="sortbar"><span>Sort by</span>${opts.map(([k, l]) => `<button type="button" data-act="sortby" data-k="${key}" data-by="${k}" class="${s.by === k ? 'on' : ''}" title="${s.by === k ? 'Click to flip the order' : ''}">${l}${s.by === k ? `<i class="ic ${s.dir > 0 ? 'ic-up' : 'ic-down'}"></i>` : ''}</button>`).join('')}</div>`;
}
function sortRows(key, arr, opts, get){
  const s = sortState(key, opts), g = get[s.by]; if (!g) return arr;
  return [...arr].sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'string' || typeof y === 'string' ? String(x).localeCompare(String(y), undefined, {numeric:true}) : x - y) * s.dir; });
}
function sortClick(b){ const U = UIS(), k = b.dataset.k, by = b.dataset.by; U.sorts = U.sorts || {}; const c = U.sorts[k]; U.sorts[k] = c && c.by === by ? {by, dir:-c.dir} : {by, dir:SORT_DESC.has(by) ? -1 : 1}; }
const LIVE_OPTS = [['id','Team'],['type','Type'],['behind','Most behind']], LIVE_GET = {id:t => t.id, type:t => t.condText, behind:t => t.tl ? t.tl.diff : 0};
const RES_OPTS = [['team','Team'],['score','Score'],['type','Type'],['spoken','Spoken'],['actioned','Actioned'],['lost','Points lost']];
const RES_GET = {team:x => x.team, score:x => x.score, type:x => x.condText, spoken:x => x.steps[0], actioned:x => x.steps[3], lost:x => x.lostShare + x.lostFinal};
const PP_OPTS = [['id','ID'],['role','Role'],['team','Team'],['type','Type'],['msgs','Messages'],['events','Activity'],['time','Time in app']];
const PP_GET = {id:p => p.pid, role:p => p.label || '~', team:p => p.team == null ? 9999 : p.team, type:p => p.condText || '~', msgs:p => p.msgs, events:p => p.events, time:p => p.inApp};
/* o = {paused, broadcast} */
function broadcastCard(o){
  const quick = ['Please stay in the app. No talking out loud.', 'Read every message before you send.', 'Tap Need help if something is not working.'];
  return `<div class="card bc-card"><div class="bc-head"><span class="bc-ic"><i class="ic ic-mega"></i></span>
      <div class="bc-t"><h3>Message everyone${ti('broadcast')}</h3></div>
      <span class="bc-pause"><button class="mini" data-act="pause">${o.paused ? '<i class="ic ic-play"></i>Resume everyone' : '<i class="ic ic-pause"></i>Pause everyone'}</button>${ti('pause')}</span></div>
    <form data-form="bcast" class="bc-form"><input type="text" id="bcast" maxlength="160" placeholder="Type a message for every phone" aria-label="Message for every phone"><button type="submit" class="bc-send"><i class="ic ic-send"></i>Send</button></form>
    <div class="bc-quick"><small>Or send a ready-made one</small>${quick.map(m => `<button type="button" data-act="bc" data-msg="${esc(m)}">${esc(m)}</button>`).join('')}</div>
    <div class="bc-now"><small>On every phone right now</small>${o.broadcast ? `<div class="bc-banner"><i class="ic ic-mega"></i><span>${esc(o.broadcast)}</span><button type="button" data-act="bc" data-msg="">Clear</button></div>` : '<div class="bc-none">No banner is showing.</div>'}</div></div>`;
}

/* ---------- v8: entrance animations play only for a moment after a click or on first load ---------- */
(function(){
  const timers = {};
  function flag(cls, ms){ const app = document.getElementById('app'); if (!app) return; app.classList.add(cls); clearTimeout(timers[cls]); timers[cls] = setTimeout(() => app.classList.remove(cls), ms); }
  const IN = new Set(['admtab','opensaved','closesaved','person','peopleback','admteam','admback','teamback','watchfrom','admin','startfresh','practice']);
  const ROWS = new Set(['sortby','wpane','wmode','watchpick','wnext']);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (IN.has(a)) flag('anim-in', 700); else if (ROWS.has(a)) flag('anim-rows', 600); else if (a === 'guide') flag('anim-open', 600); }, true);
  const first = () => { flag('anim-in', 900); flag('anim-open', 900); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', first); else first();
})();

/* ---------- v9 shared: the "AI status" tab ---------- */
const AI_OPTS = [['new','Newest'],['slow','Slowest'],['waited','Longest wait'],['tokens','Most tokens']];
const AI_GET = {new:x => x.i, slow:x => x.model_s, waited:x => x.wait_s, tokens:x => x.tok_in + x.tok_out};
['new','slow','waited','tokens'].forEach(k => SORT_DESC.add(k));
const aiNum = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n));
const aiBytes = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : Math.round(n) + ' B';
const aiSec = s => s == null ? '—' : s >= 60 ? wFmt(s) : (s < 10 ? s.toFixed(1) : Math.round(s)) + ' s';
function aiAgg(L){
  const q = (arr, p) => { if (!arr.length) return null; const a = [...arr].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
  const ms = L.map(x => x.model_s), ws = L.map(x => x.wait_s), sum = k => L.reduce((a, x) => a + (x[k] || 0), 0);
  const t0 = L.length ? Math.min(...L.map(x => x.ts)) : 0, perMin = {}, tokMin = {};
  L.forEach(x => { const m = Math.floor((x.ts - t0) / 60); perMin[m] = (perMin[m] || 0) + 1; tokMin[m] = (tokMin[m] || 0) + x.tok_in + x.tok_out; });
  const mins = L.length ? Math.max(...Object.keys(perMin).map(Number)) + 1 : 0;
  return {n:L.length, ok:L.filter(x => x.status === 'ok').length, timeouts:L.filter(x => x.status === 'timeout').length, errors:L.filter(x => x.status === 'error').length,
    med:q(ms, .5), p95:q(ms, .95), max:ms.length ? Math.max(...ms) : null, waitMax:ws.length ? Math.max(...ws) : null, waitMed:q(ws, .5),
    tokIn:sum('tok_in'), tokOut:sum('tok_out'), bOut:sum('bytes_out'), bIn:sum('bytes_in'), est:L.some(x => x.est),
    series:Array.from({length:mins}, (_, m) => perMin[m] || 0), peakCalls:Math.max(0, ...Object.values(perMin)), peakTok:Math.max(0, ...Object.values(tokMin))};
}
/* D = {config, now, totals, log, session} */
/* Reply times measured on ARC's shared service with gpt-oss-120b-thinking-low (design_deliberation_A-v2.1):
   quick = results_brubaker_original (~7-8 s per call), busy = the later results/ runs (~2 min per call). */
const AI_SPEED = {quick:8, busy:120};
/* One color and icon per section, so the sections are easy to tell apart. */
const AI_SEC = {test:['#255E4B','ic-pulse'], setup:['#2A2E3B','ic-sliders'], req:['#2B7F72','ic-send'], load:['#4C5BA8','ic-gauge'], plan:['#9A6400','ic-team3'], turns:['#5b6070','ic-list']};
const aiHead = (k, title, right) => `<div class="ai-h"><span class="ai-hic"><i class="ic ${AI_SEC[k][1]}"></i></span><h3>${title}</h3>${right ? `<span class="ai-hr">${right}</span>` : ''}</div>`;
const aiCard = (k, cls, inner) => `<div class="card ai-sec ${cls || ''}" style="--sc:${AI_SEC[k][0]}">${inner}</div>`;
const aiTestCard = (T, busy) => aiCard('test', 'ai-test', `${aiHead('test', 'Before class: test the AI', `<button class="mini dark" data-act="aitest" ${busy ? 'disabled' : ''}><i class="ic ic-pulse"></i>${busy ? 'Testing…' : 'Test the AI'}</button>`)}
    <p class="small muted" style="margin:0">Sends one short real request from this server. Run it on the lecture-day network.</p>
  ${T ? `<div class="ai-verdict ${T.ok ? 'ok' : 'bad'}"><i class="ic ${T.ok ? 'ic-check' : 'ic-alert'}"></i><span>${T.standin ? esc(T.note || '')
    : T.ok ? `<b>Working.</b> ${esc(T.model_returned || T.model)} answered in ${aiSec(T.seconds)}${T.finish_reason ? `, finish: ${esc(T.finish_reason)}` : ''}.`
    : `<b>Not working.</b> ${esc(T.error || 'No answer.')}`}${T.at ? ` <small class="muted">Tested at ${new Date(T.at * 1000).toLocaleTimeString()}.</small>` : ''}</span></div>` : ''}`);
/* Wait against the cutoff: the bar fills to the wait, the line marks the cutoff. */
const aiWaitBar = (label, per, wait, cut, scale) => { const ok = wait <= cut;
  return `<div class="ai-wb ${ok ? 'ok' : 'bad'}"><div class="ai-wb-l"><b>${label}</b><small>${aiSec(per)} per reply</small></div>
    <div class="ai-wb-t"><i style="width:${Math.min(100, wait / scale * 100)}%"></i><u style="left:${cut / scale * 100}%" title="Cutoff: ${cut} s"></u></div>
    <div class="ai-wb-v"><b>${aiSec(wait)}</b><small>${ok ? 'fits' : 'too long'}</small></div></div>`; };
function aiTabHTML(D){
  if (!D) return '<p class="muted">Loading…</p>';
  const U = UIS(), C = D.config, L = D.log || [], A = aiAgg(L), S = D.session, R = D.requests || null, BF = D.totals.by_failure || {};
  const tile = (v, l, ic, cls) => `<div class="stat ai-stat ${cls || ''}"><i class="ic ${ic}"></i><b>${v}</b><span>${l}</span></div>`;
  const kv = (k, v, h, cls) => `<div class="ai-kv ${cls || ''}"><span>${k}</span><b>${v}</b>${h ? `<small>${h}</small>` : ''}</div>`;
  const fb = D.totals.fallbacks || 0, modelCap = C.arc_model_cap || 10, keyCap = C.arc_key_cap || 20;
  const counts = o => Object.entries(o || {}).map(([k, v]) => `${esc(k)} ${v}`).join(' · ') || '—';
  const T = C.test || window.AI_TEST_LOCAL;
  // what a class would need
  const N = Math.max(3, Math.min(600, parseInt(U.aiN, 10) || Math.max(S.joined, 90))), teams = Math.floor(N / 3), medTeams = Math.round(teams * S.mediated_share), turns = medTeams * S.rounds;
  const per = A.n ? {i:A.tokIn / A.n, o:A.tokOut / A.n} : {i:1500, o:300};
  const waves = Math.max(1, Math.ceil(medTeams / C.concurrency));
  const cases = [...(C.real && A.n ? [['This session', A.med]] : []), ['ARC quick', AI_SPEED.quick], ['ARC busy', AI_SPEED.busy]];
  const scale = Math.max(C.timeout_s * 1.35, ...cases.map(([, s]) => waves * s));
  const busyOk = waves * AI_SPEED.busy <= C.timeout_s;
  const maxBar = Math.max(1, ...A.series);
  // top status strip: what is answering, and is it healthy
  const state = !C.real ? 'idle' : (T && !T.ok) || fb ? 'bad' : T && T.ok ? 'ok' : 'live';
  const stateText = !C.real ? 'Stand-in (no AI)' : state === 'bad' ? 'Live model · needs attention' : state === 'ok' ? 'Live model · working' : 'Live model · not tested yet';
  const health = R && R.n ? `<div class="ai-health" title="${R.answered} answered, ${R.errors} failed"><i style="flex:${R.answered}"></i>${R.errors ? `<i class="bad" style="flex:${R.errors}"></i>` : ''}</div>` : '';
  return `<div class="ai-hero ${state}">
      <span class="ai-light"></span>
      <div class="ai-hero-t"><b>${stateText}</b><span>${C.real ? `${esc(C.model)}${C.arc ? ' on VT ARC · VT network or VPN only · ARC logs what it is sent' : ` · ${esc(C.endpoint)}`}` : 'Fixed rules inside the app. Nothing is sent anywhere. Pick a model on the Setup tab.'}</span></div>
      <div class="ai-hero-c">${C.real && T ? `<span class="${T.ok ? '' : 'bad'}"><i class="ic ${T.ok ? 'ic-check' : 'ic-alert'}"></i>Last test ${T.ok ? aiSec(T.seconds) : 'failed'}</span>` : ''}
        <span><i class="ic ic-list"></i>${D.totals.calls} turn${D.totals.calls === 1 ? '' : 's'}</span><span class="${fb ? 'bad' : ''}"><i class="ic ic-alert"></i>${fb} stand-in</span></div></div>
    ${aiTestCard(T, window.AI_TEST_BUSY)}
    <div class="stats ai-stats">${tile(D.now.flight, 'Running right now', 'ic-pulse', D.now.flight ? 'live' : '')}${tile(D.now.waiting, 'Waiting in line', 'ic-clock', D.now.waiting ? 'warn' : '')}${tile(D.totals.calls, 'Mediator turns so far', 'ic-chat')}
      ${tile(fb, 'Stand-in had to answer', 'ic-alert', fb ? 'bad' : 'good')}${tile(aiSec(A.med), 'Typical reply time', 'ic-gauge')}${tile(aiSec(A.max), 'Slowest reply', 'ic-up')}</div>
    <div class="ai-grid">
      ${aiCard('setup', '', `${aiHead('setup', 'What the AI is set up as')}
        ${kv('Mediator', esc(C.mediator))}${kv('Model', C.model ? esc(C.model) : 'none (rule-based stand-in)', 'Change it on the Setup tab, before teams are formed.')}${kv('Where calls go', C.endpoint ? esc(C.endpoint) : 'nowhere, it runs inside the app', C.arc ? 'VT network or VT VPN only.' : '')}
        ${kv('Turns at the same time', `at most ${C.concurrency}`, C.concurrency > modelCap ? `ARC allows only ${modelCap} per model per key. Lower AI_CONCURRENCY.` : `ARC allows ${modelCap} per model and ${keyCap} in flight per key. Use this key for nothing else during class.`, C.concurrency > modelCap ? 'bad' : '')}
        ${kv('Give up after', `${C.timeout_s} seconds`, `For a whole turn, retries included. Then ${esc(C.fallback)} answers instead, and the turn is marked.`)}
        ${C.reasoning ? kv('Reasoning effort', esc(C.reasoning)) : ''}${C.max_tokens ? kv('Longest reply allowed', `${C.max_tokens} tokens`, 'Reasoning counts toward this. Too low gives empty replies.') : ''}
        ${C.request_timeout_s ? kv('One request waits up to', `${C.request_timeout_s} seconds`) : ''}${C.temperature != null ? kv('Temperature', `${C.temperature}`) : ''}
        ${C.real ? kv('If a request fails', 'up to 4 tries', 'Busy: wait 1, 2, 4 s. ARC gateway timeout: wait 15, 30, 45 s. Missing model or bad key: stop.') : ''}
        ${kv('When it is called', `once per team per round, ${S.rounds} rounds`, 'Only for types with a Mediator. Unmediated teams never call it.')}`)}
      ${aiCard('req', '', `${aiHead('req', 'Requests to the model', R && R.n ? `${R.n} sent` : '')}
        ${health}
        ${R && R.n ? `${kv('Requests sent', `${R.n}`, `${R.answered} answered · ${R.errors} failed. One turn can take several requests.`)}
          ${kv('Retries', `${R.retries}`, 'Busy, network or gateway errors that were tried again.')}
          ${kv('Repairs', `${R.repairs}`, 'Re-asks after a missing or over-budget bundle.')}
          ${kv('Empty replies', `${R.empty}`, R.empty ? 'Reasoning used up the token limit. If this keeps happening, raise MEDIATOR_MAX_TOKENS.' : 'None so far.', R.empty ? 'bad' : '')}
          ${kv('How replies ended', counts(R.finish), '"length" means cut off at the token limit.', (R.finish || {}).length ? 'bad' : '')}
          ${kv('Model that answered', counts(R.models), 'As reported by the server. Should stay the same all study.', Object.keys(R.models || {}).length > 1 ? 'bad' : '')}
          ${R.errors ? kv('Errors by kind', counts(R.error_kinds), 'gateway: ARC gave up on its backend · busy: too many at once · vpn: not on the VT network · setup: bad key or missing model') : ''}`
        : `<p class="small muted">${C.real ? 'No requests yet. They start when a team finishes a round.' : 'The stand-in answers inside the app, so nothing is sent.'}</p>`}
        ${kv('Stand-in answered', `${fb} turn${fb === 1 ? '' : 's'}`, fb ? `${BF.timeout || 0} took too long · ${BF.network || 0} network or ARC problem · ${BF.model || 0} no valid bundle. Exclude these teams from the primary analysis.` : 'Every turn was answered by the Mediator.', fb ? 'bad' : '')}`)}
      ${aiCard('load', '', `${aiHead('load', 'Load so far')}
        ${kv('Busiest minute', `${A.peakCalls} turn${A.peakCalls === 1 ? '' : 's'} · ${aiNum(A.peakTok)} tokens`)}
        ${kv('Most running at once', `${D.totals.peak_flight || 0} of ${C.concurrency} allowed`)}${kv('Longest wait in line', aiSec(A.waitMax))}
        ${kv('Reply time', A.n ? `${aiSec(A.med)} typical · ${aiSec(A.p95)} for the slow 5%` : '—')}
        ${kv('Tokens', `${aiNum(A.tokIn)} sent · ${aiNum(A.tokOut)} received`, A.n ? `About ${aiNum(A.tokIn / A.n)} in and ${aiNum(A.tokOut / A.n)} out per turn.${A.est ? ' Estimates.' : ''}` : '')}
        ${kv('Data', `${aiBytes(A.bOut)} sent · ${aiBytes(A.bIn)} received`)}
        ${A.series.length ? `<div class="ai-chart" role="img" aria-label="Turns in each minute of the session"><small>Turns in each minute of the session</small><div class="ai-bars">${A.series.map((v, i) => `<i style="height:${Math.max(4, v / maxBar * 100)}%;--d:${Math.min(i, 40) * 15}ms" class="${v ? '' : 'z'}" title="Minute ${i + 1}: ${v} turn${v === 1 ? '' : 's'}"></i>`).join('')}</div><div class="ai-ax"><span>min 1</span><span>min ${A.series.length}</span></div></div>` : ''}`)}</div>
    ${aiCard('plan', 'ai-plan', `${aiHead('plan', 'What a real class would need')}
      <p class="small muted" style="margin-top:0">Worst case: every team finishes a round at the same moment. Reply times on ARC's shared service ranged from about ${AI_SPEED.quick} s to about ${aiSec(AI_SPEED.busy)} in the simulation's runs.</p>
      <div class="inline" style="margin-bottom:10px"><span>Students in the class:</span><span class="numstep"><button type="button" data-act="ain" data-d="-15" aria-label="15 fewer">−</button><input class="pn-in ai-in" id="ain" type="text" inputmode="numeric" maxlength="3" value="${N}" aria-label="Students in the class"><button type="button" data-act="ain" data-d="15" aria-label="15 more">+</button></span></div>
      <div class="ai-plan-g">${kv('Teams', `${teams}`, `${medTeams} of them use the Mediator.`)}${kv('Mediator turns in the session', `${turns}`, `${medTeams} teams × ${S.rounds} rounds. Repairs and retries add requests.`)}
        ${kv('Turns landing together', `up to ${medTeams}`, `Only ${C.concurrency} run at once, so they go in ${waves} wave${waves === 1 ? '' : 's'}.`)}
        ${kv('Tokens for the session', `about ${aiNum(turns * (per.i + per.o))}`, `${aiNum(turns * per.i)} sent · ${aiNum(turns * per.o)} received.`)}</div>
      <div class="ai-waits"><div class="ai-waits-h"><span>How long the last team waits</span><span class="ai-cut"><u></u>${C.timeout_s} s cutoff</span></div>
        ${cases.map(([l, s]) => aiWaitBar(l, s, waves * s, C.timeout_s, scale)).join('')}</div>
      <div class="ai-verdict ${busyOk ? 'ok' : 'bad'}"><i class="ic ${busyOk ? 'ic-check' : 'ic-alert'}"></i><span>${busyOk ? `<b>This fits, even on a busy day.</b> The last team waits about ${aiSec(waves * AI_SPEED.busy)} in the worst case.`
        : `<b>On a busy day, the shared service is too slow for this class.</b> Plan on a dedicated model (ARC Open OnDemand or vLLM), or test with "Test the AI" and a practice run at the class's day and hour. More turns at once (AI_CONCURRENCY, at most ${modelCap}) or a longer cutoff (AI_TIMEOUT) only help a little.`}</span></div>`)}
    ${aiCard('turns', '', `${aiHead('turns', `Every turn · ${L.length}`)}
      ${L.length ? `${sortBar('ai', AI_OPTS)}<div class="ai-log">${sortRows('ai', L, AI_OPTS, AI_GET).slice(0, 80).map(x => `<div class="ai-row ${x.status}" style="--cc:${U.hideCond ? '#5b6070' : CONDC[x.cond]}">
        <span class="ai-t">#${x.i}</span><span class="ai-team"><i class="ic ic-team3"></i>Team ${x.team}</span><span class="pp-pill ${U.hideCond ? '' : 'c'}">${U.hideCond ? 'type hidden' : esc(typeof condLabel === 'function' ? condLabel(x.cond) : condLbl(x.cond))}</span>
        <span class="ai-kind">${esc(x.kind)} · round ${x.round}</span>
        <span class="pp-pill ${x.status === 'ok' ? 'ok' : 'no'}"><i class="ic ${x.status === 'ok' ? 'ic-check' : 'ic-alert'}"></i>${x.status === 'ok' ? 'OK' : x.status === 'timeout' ? 'Took too long, stand-in answered' : x.status === 'network' ? 'Network or ARC problem, stand-in answered' : x.status === 'model' ? 'No valid bundle, stand-in answered' : 'Error, stand-in answered'}</span>
        <span class="ai-n" title="Time waiting in line"><i class="ic ic-clock"></i>${aiSec(x.wait_s)} wait</span><span class="ai-n" title="How long the turn took, retries and repairs included"><i class="ic ic-pulse"></i>${aiSec(x.model_s)} reply</span>
        <span class="ai-n" title="Tokens sent and received${x.est ? ' (estimate)' : ''}"><i class="ic ic-chat"></i>${aiNum(x.tok_in)} in · ${aiNum(x.tok_out)} out${x.est ? ' <em>est.</em>' : ''}</span>
        ${x.requests > 1 || x.repairs || x.retries ? `<span class="ai-n" title="Requests this turn took"><i class="ic ic-list"></i>${x.requests} requests${x.repairs ? ` · ${x.repairs} repair${x.repairs === 1 ? '' : 's'}` : ''}${x.retries ? ` · ${x.retries} retr${x.retries === 1 ? 'y' : 'ies'}` : ''}</span>` : ''}
        ${x.empty ? `<span class="ai-n bad-t" title="Replies with no text"><i class="ic ic-alert"></i>${x.empty} empty</span>` : ''}${x.finish === 'length' ? '<span class="ai-n bad-t">cut off at token limit</span>' : ''}
        ${x.error ? `<span class="ai-err">${esc(x.error)}</span>` : ''}</div>`).join('')}</div>${L.length > 80 ? `<p class="small muted">Showing 80 of ${L.length}.</p>` : ''}` : '<p class="muted">No turns yet. The Mediator is called when a team finishes a round.</p>'}`)}`;
}

const PN = () => Math.max(1, Math.min(150, parseInt(UIS().practiceN, 10) || 12));
function botAdder(where){
  return `<span class="numstep"><button type="button" data-act="pn" data-d="-3" aria-label="3 fewer">−</button><input class="pn-in" id="pn-${where}" type="text" inputmode="numeric" maxlength="3" value="${PN()}" aria-label="How many simulated students"><button type="button" data-act="pn" data-d="3" aria-label="3 more">+</button></span>`;
}
document.addEventListener('change', e => { const t = e.target; if (t.id !== 'ain') return; const v = parseInt(t.value, 10); if (v > 0){ UIS().aiN = Math.max(3, Math.min(600, v)); render(); } });
document.addEventListener('input', e => { const t = e.target; if (!t.classList || !t.classList.contains('pn-in') || t.classList.contains('ai-in')) return;
  const v = parseInt(t.value, 10); if (v > 0){ UIS().practiceN = Math.min(150, v); document.querySelectorAll('.pn-in').forEach(o => { if (o !== t) o.value = PN(); }); } });
document.addEventListener('focusout', e => { const t = e.target; if (t.classList && t.classList.contains('pn-in') && !t.classList.contains('ai-in')) t.value = PN(); });

/* o = {on, speed, sp, canStart, total, paused, teams, finished} */
function simPanelHTML(o){
  const done = o.teams > 0 && o.finished >= o.teams, run = o.on && !done;
  const lo = Math.max(1, Math.round(o.total / (o.speed || 1))), hi = Math.max(lo + 1, Math.round(o.total * 2.3 / (o.speed || 1)));
  const status = done ? `<span class="simlive done"><i></i>Finished</span> · all ${o.teams} teams are done.`
    : run && o.paused ? `<span class="simlive pau"><i></i>Paused</span> · nobody can move on, real or simulated, until you press Resume.`
    : run ? `<span class="simlive"><i></i>Running at ${o.speed}×</span> · ${o.finished} of ${o.teams} teams finished. About ${lo} to ${hi} min at this speed.`
    : 'Add simulated students, then press Run.';
  const seg = `<span class="seg">${[[1,'1× real class'],[5,'5×'],[15,'15×'],[40,'40×']].map(([v, l]) => `<button data-act="simspeed" data-v="${v}" class="${(run ? o.speed : o.sp) === v ? 'on' : ''}">${l}</button>`).join('')}</span>`;
  const btns = done ? `<button class="simgo alt" data-act="admtab" data-tab="charts">See the charts</button><button class="simgo" data-act="startfresh">Start fresh</button>`
    : run ? `${seg}<button class="simgo alt" data-act="pause">${o.paused ? '<i class="ic ic-play"></i>Resume' : '<i class="ic ic-pause"></i>Pause'}</button><button class="simgo stop" data-act="autorun" data-v="0"><i class="ic ic-stop"></i>Stop</button>`
    : `${botAdder('sim')}<button class="simgo alt" data-act="addbots" data-n="pn">Add</button>${seg}<button class="simgo" data-act="autorun" data-v="${o.sp}" ${o.canStart ? '' : 'disabled title="Add simulated students first"'}><i class="ic ic-play"></i>Run</button>`;
  return `<div class="card simcard ${run && !o.paused ? 'on' : ''}"><div class="simrow"><div><h3 style="margin:0">Full simulation${ti('fullsim')}</h3>
      <p class="small muted" style="margin:4px 0 0">${status}</p></div><div class="inline">${btns}</div></div></div>`;
}
const pauseOverlay = () => `<div class="pause-ov" role="status" aria-live="polite"><div class="pause-card"><span class="pause-ic"><i class="ic ic-pause"></i></span><h2>Session paused</h2><p>The researcher paused the session for everyone. Your work is saved. Please wait. It will pick up right where you left off.</p></div></div>`;

/* results tables: number, meter and percent line up in every row */
function fb(a, b){ if (!b) return '<span class="muted">—</span>'; const p = Math.round(a / b * 100);
  return `<div class="fbar"><span class="fb-n"><b>${a}</b> of ${b}</span><span class="fb-t"><i style="width:${p}%"></i></span><span class="fb-p">${p}%</span></div>`; }

/* ---------- Watch players: the side panel ---------- */
function wStats(){
  const U = UIS(), x = U.wstats; if (!U.watchPid) return '<p class="muted">Pick a player on the left to watch their screen live.</p>'; if (!x) return '<p class="muted">Loading…</p>';
  const pane = U.wPane || 'now', c = x.counts || {};
  const sv = Object.entries(x.survey || {}).filter(([k]) => k !== 'leak');
  const box = (title, hint, body) => `<section class="ws-box"><h4>${title}</h4>${hint ? `<p class="ws-hint">${hint}</p>` : ''}${body}</section>`;
  const meter = (label, val, pct) => `<div class="ws-meter"><div class="ws-ml"><span>${label}</span><b>${val}</b></div><div class="ws-mt"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div></div>`;
  const tile = (n, l) => `<div class="ws-tile ${n ? '' : 'z'}"><b>${n}</b><span>${l}</span></div>`;
  const head = `<div class="ws-head" style="--rc:${ROLE_COLOR[x.role] || '#5b6070'}"><span class="ws-av"><i class="ic ic-user"></i></span>
      <div><b class="ws-name">${x.label ? esc(x.label) : esc(x.pid)}</b><div class="ws-sub">${x.team != null ? 'Team ' + x.team + ' · ' : ''}${esc(x.pid)}</div></div></div>
    <div class="ws-pills">${x.cond ? (U.hideCond ? '<span class="ws-pill">type hidden</span>' : `<span class="ws-pill c" style="--cc:${CONDC[x.cond]}">${esc(x.cond_label)}</span>`) : ''}
      <span class="ws-pill">${x.bot ? 'Simulated' + (x.persona ? ' · ' + esc(x.persona) : '') : 'Real student · ' + (x.online ? 'online' : 'offline')}</span>
      <span class="ws-pill">Consent: ${x.consent == null ? 'not answered' : x.consent ? 'yes' : 'no'}</span>
      <span class="ws-pill step">${esc(STEP_HUMAN(x.step))}${x.target_mins ? ` · ${tickT(x.on_step, x.rate)} of ${wFmt(x.target_mins * 60)}` : ''}</span></div>
    <div class="seg ws-seg">${[['now','Overview'],['said',`Messages${x.messages ? ' · ' + x.messages.length : ''}`],['log','Activity']].map(([k, l]) => `<button type="button" data-act="wpane" data-v="${k}" class="${pane === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let h = '';
  if (pane === 'now'){
    if (x.findings) h += box('Secret findings', 'Only this player has these.',
      x.findings.map(f => `<div class="ws-f"><div class="ws-ft"><span><b>${f.f}</b> ${esc(f.name)}</span><span class="ws-dir ${f.dir > 0 ? 'up' : 'dn'}">really ${dirWord(f.dir)}</span></div>
        <ol class="ws-track"><li class="${f.spoken ? 'on' : ''}">Said</li><li class="${f.heard ? 'on' : ''}">Seen</li><li class="${f.integrated ? 'on' : ''}">Used</li><li class="${f.actioned ? 'on' : ''}">In final</li></ol>
        ${!f.spoken && f.mentioned ? '<div class="ws-note">Named it, but did not say if it is worth more or less.</div>' : ''}</div>`).join(''));
    if (x.picks) h += box('Picks right now', '', `<div class="ws-chips">${x.picks.length ? x.picks.map(f => `<span class="fd-chip">${f}</span>`).join('') : '<span class="muted">No picks yet</span>'}</div>
      ${meter('Budget used', `$${x.cost} of $${x.budget}`, x.cost / x.budget * 100)}${meter('Real value of these picks', `${x.picks_value} of ${x.opt} · ${Math.round(x.picks_value / x.opt * 100)}%`, x.picks_value / x.opt * 100)}
      ${x.draft ? `<p class="ws-hint" style="margin:10px 0 4px">Typing now (not sent yet):</p><div class="fd-draft">${esc(x.draft)}</div>` : ''}`);
    h += box('Behavior', '', `<div class="ws-tiles">${tile(c.pick, 'Pick changes')}${tile(c.tab, 'Tab switches')}${tile(c.left_app, 'Left the app')}${tile(c.paste_blocked, 'Paste tries')}${tile(c.copy_blocked, 'Copy tries')}${tile(c.time_warning, 'Time reminders')}${tile(c.help, 'Help requests')}</div>`);
  }
  if (pane === 'said'){
    h += box('Messages sent', x.messages && x.messages.length ? `${x.messages.length} message${x.messages.length === 1 ? '' : 's'} · ${x.words} words` : '',
      (x.messages || []).map(m => `<div class="ws-msg"><small>Round ${m.round}${m.private ? ' · private to the Mediator' : ''}</small>${esc(m.text)}</div>`).join('') || '<p class="muted small" style="margin:6px 0 0">Nothing sent yet.</p>');
    if (x.ratings && Object.keys(x.ratings).length) h += box('Ratings of Mediator cards', '', `<div class="ws-chips">${Object.values(x.ratings).map(v => `<span class="fd-chip">${esc(v)}</span>`).join('')}</div>`);
    if (x.endorse != null) h += box('Final decision vote', '', `<b>${x.endorse ? 'Accepts the final design' : 'Does not accept the final design'}</b>`);
    if (sv.length) h += box('Survey answers', '', `<div class="ws-kv">${sv.map(([k, v]) => `<span>${esc(svLabel(k))}</span><b>${esc(v)}${+v >= 1 && +v <= 5 ? ' of 5' : ''}</b>`).join('')}<span>Talked outside the app</span><b>${esc((x.survey || {}).leak || '—')}</b></div>
      ${x.recall && x.recall.length ? `<p class="ws-hint" style="margin:10px 0 4px">Findings they remember hearing:</p><div class="ws-chips">${x.recall.map(r => `<span class="fd-chip">${esc(r)}</span>`).join('')}</div>` : ''}`);
  }
  if (pane === 'log'){
    if (x.mates) h += box('Teammates', 'Click one to watch them.', x.mates.map(m => `<button type="button" class="w-p" data-act="watchpick" data-pid="${m.pid}"><i class="w-dot" style="background:${ROLE_COLOR[m.role]}"></i><span class="w-nm"><b>${esc(m.label)}</b><small>${m.pid}${m.bot ? ' · sim' : ' · real'}</small></span><span class="w-st">${esc(STEP_HUMAN(m.step))}</span></button>`).join(''));
    h += box('Latest activity', 'Newest first. Times count from when they joined.', `<div class="ws-log">${(x.events || []).slice(-12).reverse().map(e => `<div><time>${wFmt(e.ts - x.joined_at)}</time><span>${describe(e)}</span></div>`).join('') || '<span class="muted">Nothing yet.</span>'}</div>
      <button type="button" class="mini" style="margin-top:10px" data-act="person" data-pid="${x.pid}">Open the full log</button>`);
  }
  return head + h;
}

/* ---------- custom dropdown list for every <select> (mouse and keyboard; touch keeps the phone's own picker) ---------- */
(function(){
  let pop = null, cur = null, curKey = null, lastPtr = 'mouse';
  const all = () => [...document.querySelectorAll('select')];
  function close(refocus){ if (pop){ pop.remove(); pop = null; } if (cur){ cur.classList.remove('dd-open'); if (refocus && cur.isConnected) cur.focus(); } cur = null; }
  function place(){
    if (!pop || !cur || !cur.isConnected) return close();
    const r = cur.getBoundingClientRect(), vh = window.innerHeight, below = vh - r.bottom - 12, above = r.top - 12, up = below < 180 && above > below;
    const w = Math.max(r.width, 200);
    Object.assign(pop.style, {minWidth:w + 'px', maxWidth:Math.max(w, Math.min(420, window.innerWidth - 16)) + 'px', left:Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px', maxHeight:Math.max(140, Math.min(340, up ? above : below)) + 'px'});
    if (up){ pop.style.top = ''; pop.style.bottom = (vh - r.top + 6) + 'px'; } else { pop.style.bottom = ''; pop.style.top = (r.bottom + 6) + 'px'; }
  }
  function open(sel){
    close(); if (sel.disabled) return;
    cur = sel; curKey = sel.id ? '#' + sel.id : all().indexOf(sel); sel.classList.add('dd-open'); sel.focus();
    pop = document.createElement('div'); pop.className = 'dd-pop'; pop.setAttribute('role', 'listbox');
    pop.innerHTML = [...sel.options].map((o, i) => { const t = o.textContent, k = t.indexOf(' · ');
      return `<button type="button" role="option" aria-selected="${i === sel.selectedIndex}" class="dd-o ${i === sel.selectedIndex ? 'on' : ''}" data-i="${i}" ${o.disabled ? 'disabled' : ''}><span>${k > 0 ? `<b>${esc(t.slice(0, k))}</b><i>${esc(t.slice(k))}</i>` : esc(t)}</span></button>`; }).join('');
    document.body.appendChild(pop); place();
    const on = pop.querySelector('.dd-o.on'); if (on) on.scrollIntoView({block:'nearest'});
  }
  function pick(i){
    let sel = cur && cur.isConnected ? cur : typeof curKey === 'string' ? document.querySelector(curKey) : all()[curKey];
    close(true); if (!sel || !sel.options[i]) return;
    if (sel.selectedIndex !== i){ sel.selectedIndex = i; sel.dispatchEvent(new Event('input', {bubbles:true})); sel.dispatchEvent(new Event('change', {bubbles:true})); }
  }
  document.addEventListener('pointerdown', e => { lastPtr = e.pointerType || 'mouse'; }, true);
  document.addEventListener('mousedown', e => {
    if (pop && pop.contains(e.target)) return;
    const sel = e.target.closest && e.target.closest('select');
    if (!sel || sel.multiple || lastPtr === 'touch'){ close(); return; }
    e.preventDefault(); if (cur === sel) close(true); else open(sel);
  }, true);
  document.addEventListener('click', e => { const o = pop && e.target.closest && e.target.closest('.dd-o'); if (o && pop.contains(o)){ e.preventDefault(); e.stopPropagation(); pick(+o.dataset.i); } }, true);
  document.addEventListener('keydown', e => {
    if (pop){
      const os = [...pop.querySelectorAll('.dd-o:not([disabled])')], i = os.indexOf(document.activeElement), start = os.indexOf(pop.querySelector('.dd-o.on'));
      if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); return close(true); }
      if (e.key === 'Tab') return close();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); const n = i < 0 ? Math.max(0, start) : Math.max(0, Math.min(os.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))); if (os[n]) os[n].focus(); return; }
      if ((e.key === 'Enter' || e.key === ' ') && i >= 0){ e.preventDefault(); return pick(+os[i].dataset.i); }
      return;
    }
    const sel = e.target && e.target.tagName === 'SELECT' && !e.target.multiple ? e.target : null;
    if (sel && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')){ e.preventDefault(); open(sel); const on = pop && (pop.querySelector('.dd-o.on') || pop.querySelector('.dd-o')); if (on) on.focus(); }
  }, true);
  window.addEventListener('resize', () => close());
  window.addEventListener('scroll', e => { if (pop && e.target !== pop && !(pop.contains && e.target.nodeType === 1 && pop.contains(e.target))) place(); }, true);
})();

/* =====================================================================
   Making the admin side easy for a first-time researcher:
   grouped tabs with a one-line "what is this", a run sheet that walks
   through a class session, a practice-data badge, a welcome guide,
   and helpful empty screens. Shared by the server app and the prototype.
   ===================================================================== */
const TAB_GROUPS = [
  ['Run the session', [['live','Live session'], ['watch','Watch players'], ['ai','AI status']]],
  ['See results', [['charts','Charts'], ['results','Results & data'], ['people','People'], ['saved','Saved sessions']]],
  ['Before class', [['setup','Setup']]],
];
function tabsHTML(cur){
  return `<nav class="tabs2" aria-label="Admin sections">${TAB_GROUPS.map(([g, ts]) => `<div class="tg"><span class="tg-l">${g}</span><div class="tg-b">${ts.map(([k, l]) =>
    `<button data-act="admtab" data-tab="${k}" class="${cur === k ? 'on' : ''}" aria-current="${cur === k ? 'page' : 'false'}">${l}</button>`).join('')}</div></div>`).join('')}</nav>`;
}
/* G = {lobbyOpen, joined, answered, teams, finished, bots, real, hideCond, help, paused, auto, mediator, rounds, totalMin, code, setupSeen, collapsed} */
function runSheet(G){
  const S1 = G.setupSeen || G.joined > 0 || G.teams > 0, S2 = G.joined > 0 || G.teams > 0, S4 = !G.lobbyOpen && G.teams > 0, S5 = S4 && G.finished >= G.teams;
  const steps = [
    {t:'Check the setup', done:S1, d:`Mediator: <b>${esc(G.mediator)}</b> · ${G.rounds} rounds · about <b>${G.totalMin} min</b> per session · deliberation types ${G.hideCond ? 'hidden' : '<b>showing</b>'}.`,
      a:`<button class="mini" data-act="admtab" data-tab="setup">Open Setup</button>${!G.hideCond ? '<button class="mini" data-act="hidecond">Hide types for class</button>' : ''}`},
    {t:'Show the join screen', done:S2, d:`Put the projector view on the big screen. Students scan the QR code or go to this site and type <b>${esc(G.code)}</b>. No names or accounts.`,
      a:G.projectorBtn},
    {t:'Wait for students to join', done:S4, d:G.lobbyOpen ? `<b>${G.joined}</b> joined · <b>${G.answered}</b> answered the consent question.` : `${G.joined} joined.`,
      a:G.lobbyOpen ? '' : ''},
    {t:'Form the teams', done:S4, d:G.lobbyOpen ? 'This closes the lobby and puts everyone into teams of 3 with a deliberation type. Late arrivals can still be added after.' : `${G.teams} teams formed.`,
      a:G.lobbyOpen ? `<button class="mini dark" data-act="formsure" ${G.answered ? '' : 'disabled title="Wait until someone answers consent"'}>Form teams</button>` : ''},
    {t:'Keep an eye on things', done:S5, d:S4 ? `<b>${G.finished} of ${G.teams}</b> teams finished${G.help ? ` · <b class="bad-t">${G.help} asking for help</b>` : ''}${G.paused ? ' · <b>paused</b>' : ''}.` : 'Once teams are formed, watch their screens here.',
      a:S4 ? `<button class="mini" data-act="admtab" data-tab="watch">Watch players</button><button class="mini" data-act="pause">${G.paused ? 'Resume everyone' : 'Pause everyone'}</button>` : ''},
    {t:'Wrap up and save the results', done:false, d:'',
      a:G.teams ? `<button class="mini dark" data-act="gotoreport">Build a report</button><button class="mini" data-act="admtab" data-tab="results">Download data</button><button class="mini" data-act="admtab" data-tab="saved">Save this session</button>` : ''},
  ];
  const now = steps.findIndex(s => !s.done);
  return `<div class="card runsheet ${G.collapsed ? 'col' : ''}"><div class="rs-h"><h3 style="margin:0">Run sheet</h3><span class="small muted">${now < 0 ? 'All done' : `Step ${now + 1} of ${steps.length}`}</span>
      <button class="xp-link" data-act="rstoggle">${G.collapsed ? 'Show' : 'Hide'}</button></div>
    ${G.collapsed ? '' : `<ol class="rs">${steps.map((s, i) => `<li class="${s.done ? 'done' : i === now ? 'now' : ''}"><span class="rs-n">${s.done ? '✓' : i + 1}</span><div class="rs-b"><b>${s.t}</b>${i === now || !s.done ? `${s.d ? `<p>${s.d}</p>` : ''}${s.a ? `<div class="rs-a">${s.a}</div>` : ''}` : ''}</div></li>`).join('')}</ol>`}</div>`;
}
const projBar = code => `<div class="projbar"><span class="pj-ic"><i class="ic ic-screen"></i></span><div class="pj-t"><b>Projector screen</b><small>QR code and class code <b>${esc(code)}</b>, then team progress.</small></div><a class="pj-go" href="/projector" target="_blank" rel="noopener"><i class="ic ic-screen"></i>Open projector view</a></div>`;
/* ---------- Section look for every admin tab (same style as the AI status tab) ----------
   Each kind of card keeps one color and one line icon everywhere, picked by its title.
   Runs after each admin render. Only touches cards at the top level of the page, so the
   student screens mirrored inside Watch players are left exactly as students see them. */
const SEC_COLORS = {green:'#255E4B', slate:'#2A2E3B', teal:'#2B7F72', indigo:'#4C5BA8', amber:'#9A6400', rose:'#B4475A', gray:'#5b6070'};
const SEC_MAP = [   // title starts with -> [color, icon]
  ['Run sheet','green','ic-flag'], ['Full simulation','indigo','ic-play'], ['Lobby is open','teal','ic-user'], ['Message everyone','amber',null],
  ['Needs attention','rose','ic-bell'], ['Teams','slate','ic-team3'], ['Team timelines','slate','ic-team3'],
  ['Watch players','teal','ic-eye'], ['Live feed','teal','ic-chat'], ['Typing now','teal','ic-chat'],
  ['Which teams count','slate','ic-check'], ['The four steps','green','ic-flag'], ['Points lost','rose','ic-down'], ['Design outcome','indigo','ic-gauge'],
  ['Downloads','teal','ic-download'], ['Copy the data','teal','ic-download'], ['Build a report','indigo','ic-download'], ['Each team','slate','ic-team3'],
  ['People','teal','ic-user'], ['Everything they did','slate','ic-list'], ['Time on each step','amber','ic-clock'],
  ['Save this session','green','ic-folder'], ['Saved sessions','indigo','ic-folder'],
  ['Session','slate','ic-sliders'], ['Deliberation types','slate','ic-team3'], ['Headcount','amber','ic-user'], ['Step timers','amber','ic-clock'], ['Mediator','green','ic-chat'], ['New session','rose','ic-play'], ['Start over','rose','ic-stop'],
  ['Findings','green','ic-flag'], ['Everything saved','slate','ic-list'],
];
const SEC_STATS = [['Joined','ic-user'], ['Teams finished','ic-check'], ['Teams waiting','ic-clock'], ['AI calls','ic-chat']];
function decorateSections(root){
  if (!root) return;
  root.querySelectorAll(':scope > .card').forEach(card => {
    if (card.dataset.sec || /\b(ai-sec|empty|proj)\b/.test(card.className)) return;
    const h = card.querySelector('h3');
    if (!h) return;
    const title = (h.firstChild ? h.firstChild.textContent : h.textContent).trim();
    const m = SEC_MAP.find(([p]) => title.startsWith(p)), icon = m ? m[2] : 'ic-list';
    card.dataset.sec = '1';
    card.classList.add('sec');
    card.style.setProperty('--sc', SEC_COLORS[m ? m[1] : 'gray']);
    let d = 0; for (let e = h.parentElement; e && e !== card; e = e.parentElement) d++;
    const top = d <= 2;                                   // a heading near the top of the card
    if (!icon || !top || card.querySelector('.bc-ic')) return;
    const wrap = document.createElement('div');
    wrap.className = 'sec-h';
    wrap.innerHTML = `<span class="sec-ic"><i class="ic ${icon}"></i></span>`;
    h.parentElement.insertBefore(wrap, h);
    wrap.appendChild(h);
  });
  root.querySelectorAll(':scope > .stats > .stat:not(.ai-stat)').forEach(s => {
    const t = ((s.querySelector('span') || {}).textContent || '').trim(), m = SEC_STATS.find(([p]) => t.startsWith(p));
    if (m && !s.querySelector(':scope > .ic')){ s.classList.add('sec-stat'); s.insertAdjacentHTML('afterbegin', `<i class="ic ${m[1]}"></i>`); }
  });
}
/* Status strips for the two tabs with a real state to show. Same look as the AI status strip. */
const liveHero = G => {
  const state = G.help || G.stuck ? 'bad' : G.paused ? 'live' : G.running ? 'ok' : 'idle';
  const title = G.paused ? 'Paused' : G.running ? (G.auto ? `Running · simulation at ${G.auto}×` : 'Running')
    : G.lobbyOpen ? 'Lobby open · waiting for students' : G.teams && G.finished >= G.teams ? 'All teams finished' : 'Stopped';
  return `<div class="ai-hero sec-hero ${state}"><span class="ai-light"></span>
    <div class="ai-hero-t"><b>${title}</b><span>Class code ${esc(G.code)} · ${esc(G.mediator)}</span></div>
    <div class="ai-hero-c"><span class="${G.help ? 'bad' : ''}"><i class="ic ic-bell"></i>${G.help} asking for help</span>${G.stuck ? `<span class="bad"><i class="ic ic-clock"></i>${G.stuck} waiting over 2 min</span>` : ''}
      <span><i class="ic ic-eye"></i>Types ${G.hideCond ? 'hidden' : 'showing'}</span></div></div>`;
};
const setupHero = G => `<div class="ai-hero sec-hero ${G.locked ? 'live' : 'ok'}"><span class="ai-light"></span>
    <div class="ai-hero-t"><b>${G.locked ? 'Locked for this session' : 'Ready to edit'}</b><span>${G.locked ? 'Teams have been formed. Step timers can still change.' : 'Check everything here before forming teams.'}</span></div>
    <div class="ai-hero-c"><span><i class="ic ic-user"></i>Code ${esc(G.code)}</span><span><i class="ic ic-list"></i>${G.rounds} rounds</span><span><i class="ic ic-chat"></i>${esc(G.mediator)}</span></div></div>`;
function practiceBadge(G){
  if (!G.bots) return '';
  return `<div class="practice"><span><b>Practice data:</b> this session has ${G.bots} simulated student${G.bots === 1 ? '' : 's'}${G.real ? ` and ${G.real} real` : ''}. Start fresh before a real class.</span>
    <button class="mini" data-act="startfresh">Start fresh</button></div>`;
}
function guideModal(){
  return `<div class="xp-ov guide-ov" data-act="guideclose"><div class="xp-dlg guide" role="dialog" aria-label="How to use this page" data-act="noop">
    <div class="xp-dh"><h3>Welcome to the admin page</h3><button type="button" class="xp-btn ghost" data-act="guideclose">Close</button></div>
    <div class="guide-b"><p>This is where you run a class session and look at the results. Here's how a session goes:</p>
      <ol class="rs">
        <li><span class="rs-n">1</span><div class="rs-b"><b>Before class: check Setup</b><p>Class code, deliberation types, timers and the Mediator.</p></div></li>
        <li><span class="rs-n">2</span><div class="rs-b"><b>Show the join screen</b><p>Put the Projector view on the big screen. Students join on their phones with the code.</p></div></li>
        <li><span class="rs-n">3</span><div class="rs-b"><b>Form teams</b><p>One button puts everyone into teams of 3 and starts the session.</p></div></li>
        <li><span class="rs-n">4</span><div class="rs-b"><b>Watch</b><p>See any player's screen live and answer help requests.</p></div></li>
        <li><span class="rs-n">5</span><div class="rs-b"><b>Save the results</b><p>Download the data and build a report from the Charts tab.</p></div></li>
      </ol>
      <p class="small muted">The <b>Run sheet</b> on the Live session tab keeps track of where you are. Every <b>i</b> icon explains that part in one line.</p>
      <div class="guide-try"><div><b>New here? Try a practice run.</b><p class="small muted" style="margin:2px 0 0">Adds simulated students and plays a whole session in a few minutes, so you can see every screen fill up. Nothing real is touched.</p><div class="guide-n"><span>Simulated students:</span>${botAdder('guide')}</div></div>
        <button class="xp-btn" data-act="practice">Start a practice run</button></div></div>
    <div class="xp-foot"><button class="xp-btn ghost" data-act="guideclose">I'll look around</button></div></div></div>`;
}
const emptyState = (title, text, actions) => `<div class="card empty"><h3>${title}</h3><p class="muted">${text}</p>${actions ? `<div class="rs-a" style="justify-content:center">${actions}</div>` : ''}</div>`;
const GUIDE_SEEN = () => { try { return localStorage.getItem('tds_guide_seen') === '1'; } catch(_){ return true; } };
const GUIDE_MARK = () => { try { localStorage.setItem('tds_guide_seen', '1'); } catch(_){} };
const SETUP_SEEN = () => { try { return localStorage.getItem('tds_setup_seen') === '1'; } catch(_){ return false; } };
const SETUP_MARK = () => { try { localStorage.setItem('tds_setup_seen', '1'); } catch(_){} };
const RS_COL = () => { try { return localStorage.getItem('tds_rs_col') === '1'; } catch(_){ return false; } };
const RS_SET = v => { try { localStorage.setItem('tds_rs_col', v ? '1' : '0'); } catch(_){} };

function renderAdmin(){
  if (!ADMIN) return renderPin();
  const st = A.st; if (!st) return '<p class="muted">Loading…</p>';
  if (A.team) return teamView();
  let h = `<header class="top"><h1>Admin <span class="clock" style="font-weight:400">· session ${st.session}</span></h1>
    <span class="inline">${onlineBanner ? '<b style="color:var(--bad)">reconnecting…</b>' : ''}<button class="mini guide-btn" data-act="guide" title="How to use this page">Guide</button><span class="bigclock" role="timer" aria-label="Session clock"><span class="bc-lab">Session<br>clock</span><b id="admclock" class="${st.clock == null ? 'idle' : ''}">${st.clock == null ? 'Not started' : fmtT(st.clock + (Date.now() - A.stAt) / 1000 * (st.clock_rate || 0))}</b>${st.auto_speed && st.clock_rate ? `<span class="bc-sim">${st.auto_speed}× sim</span>` : st.clock != null && !st.clock_rate ? '<span class="bc-sim stopped">stopped</span>' : ''}</span></span></header>
    ${tabsHTML(A.tab)}${archBanner(ARCH)}${A.flash ? `<div class="banner" style="margin-bottom:12px">${esc(A.flash)}</div>` : ''}`;
  if (A.tab === 'live') h += adminLive(st);
  if (A.tab === 'feed') h += adminFeed();
  if (A.tab === 'watch') h += adminWatch();
  if (A.tab === 'people') h += A.person ? personView() : peopleList();
  if (A.tab === 'setup') h += setupHero({locked:!st.lobby_open, code:st.settings.class_code, rounds:st.settings.rounds, mediator:st.mediator}) + adminSetup(st);
  if (A.tab === 'results') h += adminResults();
  if (A.tab === 'ai') h += aiTabHTML(A.ai);
  if (A.tab === 'saved') h += savedTabHTML({list:A.saved, arch:ARCH, defName:st.session, canSave:st.joined > 0, note:'Stored on the server in <b>data/saved</b>.',
    zip:m => `<a class="mini" href="/api/admin/saved/${m.id}/zip?admin=${encodeURIComponent(ADMIN)}"><i class="ic ic-download"></i>Download folder (.zip)</a>`});
  if (A.showGuide) h += guideModal();
  if (A.tab === 'charts' && !st.finished) h += emptyState('No results yet', 'Charts fill in when the first team finishes.', st.teams.length ? '<button class="mini" data-act="admtab" data-tab="live">Back to the session</button>' : '<button class="mini dark" data-act="practice">Start a practice run</button>');
  else if (A.tab === 'charts') h += `<div class="inline" style="justify-content:space-between;margin-bottom:6px"><span class="small muted">${ti('ch_tab')} Charts count finished, non-spare teams.</span><label class="chip"><input type="checkbox" id="consentonly" ${A.consentOnly ? 'checked' : ''}> Consenting teams only</label></div>` + (A.charts ? window.renderCharts(A.charts, ti) : '<p class="muted">Loading…</p>');
  return h;
}
function simPanel(on, speed, canStart, total){
  const sp = A.simSpeed || 15;
  return `<div class="card simcard ${on ? 'on' : ''}"><div class="simrow"><div><h3 style="margin:0">Full simulation${ti('fullsim')}</h3>
      <p class="small muted" style="margin:4px 0 0">${on ? `<span class="simlive"><i></i>Running at ${speed}×</span> · a full session takes about ${Math.max(1, Math.round(total / speed * 10) / 10)} min at this speed. Watch the Charts tab fill up.`
        : 'Add simulated students, then press Run.'}</p></div>
    <div class="inline"><span class="seg">${[[1,'1× real class'],[5,'5×'],[15,'15×'],[40,'40×']].map(([v, l]) => `<button data-act="simspeed" data-v="${v}" class="${(on ? speed : sp) === v ? 'on' : ''}">${l}</button>`).join('')}</span>
      ${on ? '<button class="simgo stop" data-act="autorun" data-v="0"><i class="ic ic-stop"></i>Stop</button>' : `<button class="simgo" data-act="autorun" data-v="${sp}" ${canStart ? '' : 'disabled title="Add simulated students first"'}><i class="ic ic-play"></i>Run</button>`}</div></div></div>`;
}
function adminLive(st){
  const tmr = Object.assign({}, TIMER_DEFAULTS, st.settings.timers || {}), nR = st.settings.rounds;
  const totalMin = tmr.card + tmr.round1 + tmr.round * (nR - 1) + nR + tmr.final + tmr.survey;
  const G = {lobbyOpen:st.lobby_open, joined:st.joined, answered:st.answered, teams:st.teams.length, finished:st.finished, bots:st.bots, real:st.joined - st.bots,
    hideCond:A.hideCond, help:(st.helps || []).length, paused:st.paused, auto:st.auto_speed, mediator:st.mediator, rounds:nR, totalMin, code:st.settings.class_code,
    setupSeen:SETUP_SEEN(), collapsed:RS_COL(), projectorBtn:'<a class="mini dark" href="/projector" target="_blank" rel="noopener">Open projector view</a>'};
  let h = (ARCH ? '' : liveHero({...G, running:!!st.clock_rate, stuck:st.stuck}) + projBar(G.code) + practiceBadge(G) + runSheet(G) + simPanelHTML({on:!!st.auto_speed, speed:st.auto_speed, sp:A.simSpeed || 15, canStart:st.joined > 0 || st.teams.length > 0, total:totalMin, paused:st.paused, teams:st.teams.length, finished:st.finished})) + `<div class="stats">
    <div class="stat"><b>${st.joined}</b><span>Joined (${st.yes} yes · ${st.no} no)${ti('joined')}</span></div>
    <div class="stat"><b>${st.finished} / ${st.teams.length}</b><span>Teams finished${ti('finished')}</span></div>
    <div class="stat"><b style="color:${st.stuck ? 'var(--warn)' : 'inherit'}">${st.stuck}</b><span>Teams waiting over 2 min${ti('stuck')}</span></div>
    <div class="stat"><b>${st.stats.calls}</b><span>AI calls · ${st.stats.avg_s == null ? '—' : st.stats.avg_s + 's avg'} · ${st.stats.queue} in queue · ${st.stats.timeouts} timeouts · ${st.stats.fallbacks} fallbacks${ti('ai')}</span></div></div>`;
  if (st.lobby_open){
    h += `<div class="card"><h3 style="margin-top:0">Lobby is open${ti('lobby')}</h3>
      ${A.hideCond ? '' : `<div class="types-note"><span><b>Deliberation types are showing.</b> Hide them before a real class.</span><button class="mini" data-act="hidecond">Hide types</button></div>`}
      <p class="small muted">${st.answered} of ${st.joined} answered consent.</p>
      <div class="inline">
      ${st.last_batch ? `<button class="mini" data-act="undobots">Undo last add (${st.last_batch})</button>${ti('undo_bots')}` : ''}
      ${st.bots ? `<button class="mini" data-act="clearbots">Remove all simulated (${st.bots})</button>${ti('clear_bots')}` : ''}
      <button class="mini dark" data-act="form" ${st.answered ? '' : 'disabled'}>Close lobby and form teams</button>${ti('form')}</div></div>`;
  }
  h += broadcastCard({paused:st.paused, broadcast:st.broadcast});
  if (st.helps.length || st.late.length){
    h += `<div class="card" style="border-color:#f0d58a"><h3 style="margin-top:0">Needs attention${ti('attention')}</h3>
      ${st.helps.map(x => `<div class="inline"><i class="ic ic-help"></i><b>${x.team != null ? 'Team ' + x.team + ' · ' : ''}${esc(x.label)} (${x.pid})</b> asked for help <button class="mini" data-act="resolve" data-pid="${x.pid}">Mark handled</button></div>`).join('')}
      ${st.late.map(x => `<div class="inline"><i class="ic ic-user"></i><b>Late arrival ${x.pid}</b> (${x.consent ? 'consented' : x.consent === false ? 'no consent' : 'no consent answer'}) ${x.consent !== null ? `<button class="mini" data-act="solo" data-pid="${x.pid}">Give solo version</button>` : ''}</div>`).join('')}</div>`;
  }
  if (st.teams.length){
    const rowsOf = TL => sortRows('live', st.teams.map(t => ({tl:TL.parts[t.id], id:t.id, cond:t.cond, condText:condLabel(t.cond), flags:[t.spare ? 'Spare' : '', t.nonconsent ? 'No consent' : '', t.late ? 'Late' : ''].filter(Boolean), phase:t.phase, note:t.note,
      members:['ME','MF','HF'].filter(r => t.members[r] && t.members[r].pid).map(r => { const m = t.members[r]; return {role:r, roleName:CT.roles[r] ? CT.roles[r].short : r, name:m.pseudo, pid:m.pid, status:m.status, help:m.help, real:!m.bot}; }),
      actions:`<button class="mini tb" data-act="admteam" data-team="${t.id}" title="Everything this team wrote and did"><i class="ic ic-list"></i>Log</button>${t.phase[0] !== 'Finished' && !t.pending ? `<button class="mini tb warn" data-act="close" data-team="${t.id}" title="Moves the team on without missing messages. Logged."><i class="ic ic-skip"></i>Close round</button>` : ''}`})), LIVE_OPTS, LIVE_GET).map(t => teamRow(t, A.hideCond)).join('');
    const TL = window.renderTimelines(st.teams.map(t => ({id:t.id, label:condLabel(t.cond), mediated:t.cond !== 'unmediated', steps:t.steps, pending:t.pending, elapsed:t.elapsed + (Date.now() - A.stAt) / 1000 * (t.done ? 0 : (st.clock_rate || 0)), spare:t.spare, nonconsent:t.nonconsent, done:t.done})), st.settings.rounds, {ti, hideCond:A.hideCond, timers:st.settings.timers, parts:true});
    h += `<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Teams${ti('timelines')}</h3>
      <span><button class="mini" data-act="hidecond">${A.hideCond ? 'Show types' : 'Hide types'}</button>${ti('hide_types')}<button class="mini" data-act="sim">Simulate one step</button>${ti('sim')}</span></div>
      <div class="tr-top">${sortBar('live', LIVE_OPTS)}${TL.legend}</div>
      <div class="tr-tlhead">${TL.head}<div class="tl-side">Time · pace</div><div></div></div>
      <div class="tr-list tight">${rowsOf(TL)}</div></div>`;
  }
  return h;
}
/* ---------- projector: one big screen for the room. Join -> Progress -> Results ---------- */
const PJ_TIPS = [
  'Take your time. Careful work matters more than speed.',
  'Stay in the app. Only what you write in the app counts.',
  'Read every message before you send yours.',
  'Stuck? Tap Need help and a researcher will come to you.',
  'Please finish every step, including the short survey at the end.',
  'Done early? Thank you. Please wait quietly for the other teams.',
];
const PJ = {mode:(() => { try { return localStorage.getItem('tds_pj_mode') || 'auto'; } catch(_){ return 'auto'; } })(), types:false, lastFin:null, toast:'', toastAt:0, charts:null, chartsAt:0};
const PJ_NAMES = {join:'Join', work:'Progress', results:'Results'};
function pjStepIdx(s, R){ if (!s || s === 'card') return 0; if (s.startsWith('post')) return 2 * roundOf(s) - 1; if (s.startsWith('wait')) return 2 * roundOf(s); return ({final:2 * R + 1, survey:2 * R + 2, done:2 * R + 3})[s] ?? 0; }
const pjAuto = st => st.lobby_open ? 'join' : st.teams.length && st.finished >= st.teams.length ? 'results' : 'work';
const pjMode = st => PJ.mode === 'auto' ? pjAuto(st) : PJ.mode;
const pjPct = x => `${Math.round((x || 0) * 100)}%`;
function pjControls(st){
  const m = pjMode(st), b = (k, l) => `<button data-act="pjmode" data-v="${k}" class="${PJ.mode === k ? 'on' : ''}">${l}</button>`;
  return `<div class="pj-ctl"><a class="pj-cb" href="/admin">← Back to admin</a>
    <span class="seg pj-seg">${b('auto', 'Auto' + (PJ.mode === 'auto' ? ' · ' + PJ_NAMES[m] : ''))}${b('join', 'Join')}${b('work', 'Progress')}${b('results', 'Results')}</span>
    ${m === 'results' ? `<button class="pj-cb ${PJ.types ? 'on' : ''}" data-act="pjtypes">${PJ.types ? 'Hide' : 'Show'} deliberation types</button>` : ''}
    <button class="pj-cb" data-act="pjfull"><i class="ic ic-screen"></i>${document.fullscreenElement ? 'Exit full screen' : 'Full screen'}</button>${Date.now() - (PJ.fsHint || 0) < 6000 ? '<span class="pj-hint">This browser blocked it. Press F11.</span>' : ''}</div>`;
}
const pjBanner = st => st.broadcast ? `<div class="pj-banner"><i class="ic ic-mega"></i>${esc(st.broadcast)}</div>` : '';
function pjJoin(st){
  return `<div class="pj pj-join"><div class="pj-kick">Join the session</div>
    <div class="pj-joinrow"><div id="qr"></div><div class="pj-how"><div class="pj-l">Scan the code, or go to</div><div class="pj-url">${esc(location.host)}</div>
      <div class="pj-l">and type</div><div class="pj-code">${esc(st.settings.class_code)}</div></div></div>
    <div class="pj-count"><b>${st.joined}</b> ${st.joined === 1 ? 'person has' : 'people have'} joined</div>${pjBanner(st)}</div>`;
}
function pjWork(st){
  const R = st.settings.rounds, tot = 2 * R + 3, T = st.teams, left = T.length - st.finished;
  const where = {card:0, write:0, wait:0, final:0, survey:0, done:0}; let sum = 0, n = 0;
  T.forEach(t => t.steps.forEach(s => { sum += pjStepIdx(s, R) / tot; n++; const k = s.startsWith('post') ? 'write' : s.startsWith('wait') ? 'wait' : s; if (k in where) where[k]++; }));
  if (PJ.lastFin != null && st.finished > PJ.lastFin){
    PJ.toast = left === 0 ? 'Every team is done!' : st.finished === 1 ? 'The first team just finished!' : st.finished * 2 >= T.length && (st.finished - 1) * 2 < T.length ? 'Halfway there!' : `Another team finished. ${left} to go!`;
    PJ.toastAt = Date.now();
  }
  PJ.lastFin = st.finished;
  const W = [['card','Reading the brief'],['write','Writing'],['wait','Waiting for teammates'],['final','Final decision'],['survey','Survey'],['done','Done']];
  return `<div class="pj pj-work">
    ${Date.now() - PJ.toastAt < 8000 ? `<div class="pj-toast"><i class="ic ic-check"></i>${PJ.toast}</div>` : ''}
    <div class="pj-big">${st.finished} of ${T.length} teams finished</div>
    <div class="pj-sub">${left ? `${left} team${left === 1 ? '' : 's'} still working. Keep going!` : 'Every team is done. Thank you!'}</div>
    <div class="pj-bar"><i style="width:${n ? sum / n * 100 : 0}%"></i></div><div class="pj-barl"><span>Class progress</span><b>${pjPct(n ? sum / n : 0)}</b></div>
    <div class="pj-where">${W.map(([k, l]) => `<span><b>${where[k]}</b>${l}</span>`).join('')}</div>
    <div class="pj-teams">${T.map(t => { const p = t.steps.length ? t.steps.reduce((a, s) => a + pjStepIdx(s, R), 0) / (t.steps.length * tot) : 0;
      return `<div class="pj-team ${t.done ? 'done' : ''}"><span>${t.done ? '<i class="ic ic-check"></i>' : ''}Team ${t.id}</span><i style="--p:${Math.round(p * 100)}%"></i></div>`; }).join('')}</div>
    ${left ? `<div class="pj-tip"><i class="ic ic-flag"></i><span>${PJ_TIPS[Math.floor(Date.now() / 12000) % PJ_TIPS.length]}</span></div>` : ''}
    ${pjBanner(st)}<div class="pj-clock">Session time ${st.clock == null ? '0:00' : fmtT(st.clock)}</div></div>`;
}
function pjResults(st){
  const D = PJ.charts;
  if (!D) return '<div class="pj"><div class="pj-sub">Loading the results…</div></div>';
  const all = D.conds.flatMap(c => c.teams.map(t => ({...t, c})));
  if (!all.length) return `<div class="pj"><div class="pj-big">Results show up here</div><div class="pj-sub">as soon as the first team finishes.</div></div>`;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const avg = mean(all.map(t => t.frac)), best = Math.max(...all.map(t => t.frac));
  const facts = all.reduce((a, t) => a + t.facts, 0), used = all.reduce((a, t) => a + t.steps.actioned, 0);
  const fh = all.filter(t => t.felt_heard != null).map(t => t.felt_heard);
  const rows = [['Best possible design', 1, 'top'], ['Best team in the room', best, ''], ['Your class, on average', avg, 'you'], ['Best one engineer could do alone', D.single_frac, ''], ['Using only the shared table', D.naive_frac, '']].sort((a, b) => b[1] - a[1]);
  const opt = (D.opt_set || []).map(id => FEAT[id]).filter(Boolean), cost = opt.reduce((a, f) => a + f.price, 0);
  const notAll = D.totals.finished < D.totals.teams;
  return `<div class="pj pj-res"><div class="pj-kick">How did your class do?</div>
    <div class="pj-big">Your designs reached <span class="pj-hl">${pjPct(avg)}</span> of the best possible design</div>
    ${notAll ? `<div class="pj-sub">So far: ${D.totals.finished} of ${D.totals.teams} teams finished.</div>` : ''}
    <div class="pj-cmp">${rows.map(([l, v, k]) => `<div class="pj-cr ${k}"><span>${l}</span><div class="pj-cb2"><i style="width:${v * 100}%"></i></div><b>${pjPct(v)}</b></div>`).join('')}</div>
    <div class="pj-dots"><div class="pj-dl">Each dot is one team</div><div class="pj-scale">${all.map(t => `<i style="left:${t.frac * 100}%" title="Team ${t.id}"></i>`).join('')}<span style="left:0">0%</span><span style="left:50%">50%</span><span style="left:100%">100%</span></div></div>
    <div class="pj-facts"><div class="pj-fact"><b>${facts ? pjPct(used / facts) : '—'}</b><span>of everyone's secret test results ended up in a final design</span></div>
      ${fh.length ? `<div class="pj-fact"><b>${pjPct(mean(fh))}</b><span>of you felt heard by your team</span></div>` : ''}
      <div class="pj-fact"><b>${all.length}</b><span>team${all.length === 1 ? '' : 's'} counted</span></div></div>
    <div class="pj-lesson">Each of you had test results that no one else on your team had. The best design needs all of them.</div>
    ${opt.length ? `<div class="pj-opt"><div class="pj-dl">The best possible design · $${cost}</div><div class="pj-chips">${opt.map(f => `<span><b>${f.id}</b>${esc(f.name)}</span>`).join('')}</div></div>` : ''}
    ${PJ.types ? `<div class="pj-types">${D.conds.filter(c => c.teams.length).map(c => `<div class="pj-cr"><span><i class="pj-sw" style="background:${c.color}"></i>${esc(c.label)} · ${c.teams.length} team${c.teams.length === 1 ? '' : 's'}</span><div class="pj-cb2"><i style="width:${mean(c.teams.map(t => t.frac)) * 100}%;background:${c.color}"></i></div><b>${pjPct(mean(c.teams.map(t => t.frac)))}</b></div>`).join('')}</div>` : ''}
    <div class="pj-thanks">Thank you for taking part!</div></div>`;
}
/* The control bar lives outside #app so the once-a-second redraw never swaps a button out from under a click. */
function pjCtl(st){
  let c = document.getElementById('pjctl');
  if (!st){ if (c) c.remove(); return; }
  if (!c){ c = document.createElement('div'); c.id = 'pjctl'; document.body.appendChild(c); }
  const h = pjControls(st); if (c._h !== h){ c.innerHTML = h; c._h = h; }
}
function pjPage(st){
  const m = pjMode(st);
  return m === 'join' ? pjJoin(st) : m === 'results' ? pjResults(st) : pjWork(st);
}
(function(){   // projector controls show while the mouse moves, then fade so they are not on the big screen
  if (MODE !== 'projector') return;
  let t = null; const wake = () => { document.body.classList.add('pj-awake'); clearTimeout(t); t = setTimeout(() => document.body.classList.remove('pj-awake'), 3000); };
  document.addEventListener('mousemove', wake); document.addEventListener('keydown', wake);
  document.addEventListener('fullscreenchange', () => render());
  if (document.body) wake(); else document.addEventListener('DOMContentLoaded', wake);
})();
function projectorBody(st){
  if (st.lobby_open) return `<div class="card proj"><div class="muted" style="font-size:22px">Go to <b>${esc(location.host)}</b> and enter</div><div class="big">${esc(st.settings.class_code)}</div><div id="qr"></div><div class="huge">${st.joined} joined</div></div>`;
  return `<div class="card proj"><div class="huge">${st.finished} of ${st.teams.length} teams done</div><div class="muted" style="font-size:22px">Session time ${st.clock == null ? '' : fmtT(st.clock)}</div>
    ${st.broadcast ? `<div class="banner" style="font-size:26px">${esc(st.broadcast)}</div>` : ''}<div class="muted">Please stay in the app. Don't look for your teammates in the room.</div></div>`;
}
function timerSetup(t){
  t = Object.assign({}, TIMER_DEFAULTS, t);
  const f = (k, l) => `<label>${l}<span class="tm-in"><input type="number" id="tm_${k}" min="0.5" max="30" step="0.5" value="${t[k]}"> min</span></label>`;
  const total = t.card + t.round1 + t.round * Math.max(0, ((A.st && A.st.settings.rounds) || 2) - 1) + ((A.st && A.st.settings.rounds) || 2) + t.final + t.survey;
  return `<div class="card"><h3 style="margin-top:0">Step timers${ti('timers')}</h3>
    <p class="small muted">Nobody is cut off when time runs out.</p>
    <label class="chip"><input type="checkbox" id="tm_on" ${t.on ? 'checked' : ''}> Show timers and automatic reminders</label>
    <div class="tm-grid">${f('card','Read brief')}${f('round1','Round 1')}${f('round','Later rounds')}${f('final','Final decision')}${f('survey','Survey')}</div>
    <p class="small muted">Whole session: about <b>${total} min</b> including about 1 min per round for the Mediator.</p>
    <button class="mini dark" data-act="savetimers">Save timers</button></div>`;
}
/* Setup tab: pick the Mediator for this session (stand-in or an ARC model). Locked once teams exist. */
function mediatorCard(st){
  const M = A.models;
  const head = `<div class="card"><h3 style="margin-top:0">Mediator${ti('mediator')}</h3><p class="small">Running now: <b>${esc(st.mediator)}</b></p>`;
  if (!M) return head + (ARCH ? '</div>' : '<p class="small muted">Loading the model list…</p></div>');
  const listed = M.models || [], sim = new Set(M.simulated || []), cur = M.current;
  const opts = [M.standin, ...(cur !== M.standin && !listed.includes(cur) ? [cur] : []), ...listed];
  const pick = A.medPick && opts.includes(A.medPick) ? A.medPick : cur;
  const label = id => id === M.standin ? 'Stand-in (no AI)' : id + (sim.has(id) ? ' · used in the simulation' : '') + (id === cur ? ' · current' : '');
  const info = id => { if (id === M.standin) return 'Fixed rules, no AI. Nothing is sent anywhere.';
    const b = M.catalog[id] || M.unknown;
    return `Up to ${b.max_tokens} tokens per reply, reasoning included. Waits up to ${b.timeout} s per request.`
      + (sim.has(id) ? ' The simulation ran this model on this task.' : M.catalog[id] ? ' Not tried on this task yet.' : ' Not in the model table, so it gets safe defaults. Not tried on this task yet.')
      + (listed.length && !listed.includes(id) ? ' ARC does not list this model right now.' : ''); };
  const T = A.medTest;
  return head + `${!M.available ? '<p class="small muted">This server has no ARC key, so only the stand-in can run. Add ARC_API_KEY and ARC_API_BASE to team_session/.env and restart the server.</p>' : ''}
    ${M.error ? `<div class="ai-verdict bad"><i class="ic ic-alert"></i><span><b>Could not get ARC's model list.</b> ${esc(M.error)}</span></div>` : ''}
    ${M.note ? `<div class="ai-verdict bad"><i class="ic ic-alert"></i><span>${esc(M.note)}</span></div>` : ''}
    <div class="inline" style="margin-top:8px"><select id="medsel" aria-label="Mediator model" ${M.locked ? 'disabled' : ''}>${opts.map(id => `<option value="${esc(id)}" ${id === pick ? 'selected' : ''}>${esc(label(id))}</option>`).join('')}</select>
      <button class="mini" data-act="medtest" ${A.medBusy ? 'disabled' : ''}><i class="ic ic-pulse"></i>${A.medBusy ? 'Testing…' : 'Test this model'}</button>
      <button class="mini dark" data-act="meduse" ${M.locked || pick === cur ? 'disabled' : ''}>Use this model</button>
      ${M.available ? '<button class="mini" data-act="medrefresh">Refresh list</button>' : ''}</div>
    <p class="small muted">${esc(info(pick))}</p>
    ${T && T.model === pick ? `<div class="ai-verdict ${T.ok ? 'ok' : 'bad'}"><i class="ic ${T.ok ? 'ic-check' : 'ic-alert'}"></i><span>${T.standin ? esc(T.note || '')
      : T.ok ? `<b>Working.</b> ${esc(T.model_returned || T.model)} answered in ${aiSec(T.seconds)}${T.finish_reason ? `, finish: ${esc(T.finish_reason)}` : ''}.` : `<b>Not working.</b> ${esc(T.error || 'No answer.')}`}</span></div>` : ''}
    <p class="small muted">${M.locked ? 'Locked because teams have been formed. Start a new session to change it.' : 'Pick it before forming teams. It stays the same for the whole session and is saved with the data.'}</p></div>`;
}
function adminSetup(st){
  const s = st.settings, locked = !st.lobby_open, keys = ['caucus','facilitated','summary_only','unmediated'];
  return `<div class="card"><h3 style="margin-top:0">Session</h3>
      <div class="inline"><label>Class code${ti('class_code')} <input type="text" id="ccode" value="${esc(s.class_code)}" style="width:120px" ${locked ? 'disabled' : ''}></label>
      <label>Discussion rounds${ti('rounds')} <input type="number" id="rounds" min="1" max="4" value="${s.rounds}" ${locked ? 'disabled' : ''}></label></div>
      <h3>Deliberation types${ti('types')}</h3><div class="inline">${keys.map(c => `<label class="chip"><input type="checkbox" class="cc" value="${c}" ${s.conds.includes(c) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${condLabel(c)}</label>`).join('')}</div>
      <h3>Headcount rule (decide before class)${ti('headcount')}</h3>
      <div class="inline">If fewer than <input type="number" id="thresh" min="0" max="500" value="${s.threshold}" ${locked ? 'disabled' : ''}> students join, use only:</div>
      <div class="inline" style="margin-top:6px">${keys.map(c => `<label class="chip"><input type="checkbox" class="fb" value="${c}" ${s.fallback.includes(c) ? 'checked' : ''} ${locked ? 'disabled' : ''}> ${condLabel(c)}</label>`).join('')}</div>
      <button class="mini dark" data-act="savesetup" style="margin-top:10px" ${locked ? 'disabled' : ''}>Save settings</button>
      <p class="small muted">${locked ? 'Locked because teams have been formed.' : ''}</p></div>
    ${timerSetup(s.timers || TIMER_DEFAULTS)}
    ${mediatorCard(st)}
    <div class="card"><h3 style="margin-top:0">New session${ti('new_session')}</h3>
      <button class="mini" data-act="newsession">Start a new session</button></div>`;
}
/* Results: the four steps as one small card per type (bars step down from Spoken to Actioned),
   and the extra checks as a shaded grid. Both fit the page width, so nothing scrolls sideways.
   rows = [{label, cond, n, s:[spoken, heard, integrated, actioned], ex:{mentioned, to_mediator, relayed, heard_recalled, recalled, final_follows}}]
   (an ex value of null means the check does not apply to that type) */
const STEP_NAMES4 = [['Spoken','spoken'], ['Heard','heard'], ['Integrated','integrated'], ['Actioned','actioned']];
const EXTRA_CHECKS = [['Mentioned','mentioned','mentioned'], ['To Mediator','to_mediator','to_mediator'], ['Relayed by AI','relayed','relayed'],
  ['Heard + recalled','heard_recalled','heard_recalled'], ['Recalled','recalled','recalled'], ['Final follows','final_follows','final_follows']];
function stepsBlock(rows, tip, hide){
  if (!rows.length) return {steps:'<p class="muted">No finished teams yet.</p>', extra:''};
  const pc = (a, n) => n ? Math.round(a / n * 100) : 0;
  const col = r => hide ? '#5b6070' : (CONDC[r.cond] || '#5b6070');
  const legend = `<div class="fn-legend">${STEP_NAMES4.map(([l, k], i) => `<span><b>${i + 1}</b>${l}${tip(k)}</span>`).join('<i class="fn-arrow"></i>')}</div>`;
  const cards = rows.map(r => `<div class="fn-card" style="--cc:${col(r)}">
      <div class="fn-h"><i class="fn-dot"></i><b>${esc(r.label)}</b><small>${r.n} finding${r.n === 1 ? '' : 's'}</small></div>
      <div class="fn-cols">${r.s.map((v, i) => { const p = pc(v, r.n), drop = i ? r.s[i - 1] - v : 0;
        return `<div class="fn-col" title="${STEP_NAMES4[i][0]}: ${v} of ${r.n}"><span class="fn-v">${p}%</span><div class="fn-bar"><i style="height:${Math.max(p, 2)}%;--d:${i * 70}ms"></i></div>
          <small>${STEP_NAMES4[i][0]}</small><em>${v} of ${r.n}${drop > 0 ? ` <u>−${drop}</u>` : ''}</em></div>`; }).join('')}</div>
      <div class="fn-foot">In the final design: <b>${pc(r.s[3], r.n)}%</b></div></div>`).join('');
  const cols = `minmax(118px,1.3fr) repeat(${rows.length}, minmax(0,1fr))`;
  const grid = `<div class="hm" style="grid-template-columns:${cols}">
      <div class="hm-h"></div>${rows.map(r => `<div class="hm-h hm-t" style="--cc:${col(r)}" title="${esc(r.label)}"><i class="fn-dot"></i>${esc(r.label)}</div>`).join('')}
      ${EXTRA_CHECKS.map(([l, k, t]) => `<div class="hm-r">${l}${tip(t)}</div>${rows.map(r => { const v = r.ex[k];
        if (v == null) return '<div class="hm-cell na" title="Does not apply to this type">—</div>';
        const p = pc(v, r.n);
        return `<div class="hm-cell ${p >= 55 ? 'hi' : ''}" style="--p:${p}" title="${l}: ${v} of ${r.n}"><b>${p}%</b><small>${v} of ${r.n}</small></div>`; }).join('')}`).join('')}</div>`;
  return { steps: legend + `<div class="fn-grid">${cards}</div>`, extra: grid };
}
function adminResults(){
  const R = A.results; if (!R) return '<p class="muted">Loading…</p>';
  const f1 = (x, d) => x == null ? '—' : (+x).toFixed(d || 0);
  const pts = x => x == null ? '—' : `${(+x).toFixed(0)}`;
  const SB = stepsBlock(R.by_condition.map(c => ({label:c.label, cond:c.cond, n:c.facts, s:[c.spoken, c.heard, c.integrated, c.actioned],
    ex:{mentioned:c.mentioned, to_mediator:c.cond === 'caucus' ? c.disclosed_to_mediator : null, relayed:c.cond !== 'unmediated' ? c.relayed_by_ai : null,
        heard_recalled:c.heard_and_recalled, recalled:c.recalled, final_follows:c.final_follows}})), ti, A.hideCond);
  return `<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Which teams count</h3>
      <span><label class="chip"><input type="checkbox" id="consentonly" ${A.consentOnly ? 'checked' : ''}> Consenting teams only</label>${ti('consent_only')}</span></div>
      <p class="small muted">Spare and late teams are left out of these tables, but they are in the exports and the database.
      ${R.excluded_leak ? `<b style="color:var(--warn)">${R.excluded_leak} team(s) said they talked outside the app.</b> Their chat log may be missing part of the conversation; see the "Talked out loud" flag below.` : ''}</p></div>
    <div class="card"><h3 style="margin-top:0">The four steps, by deliberation type${ti('steps')}</h3>
      <p class="small muted">A finding counts at a step only if it passed the step before.</p>
      ${SB.steps}
      <h3>Extra checks${ti('extra')}</h3>
      <p class="small muted">Each is counted on its own. A dash means it does not apply.</p>
      ${SB.extra}</div>
    <div class="card"><h3 style="margin-top:0">Points lost at each step (average per team)${ti('points')}</h3>
      <p class="small muted">Best possible is ${R.opt.v} points; the shared table alone gives ${R.naive.v}. Below zero means a team got lucky.</p>
      <div style="overflow-x:auto"><table class="admtbl"><thead><tr><th>Type</th><th class="num">Not spoken${ti('lost_spoken')}</th><th class="num">Not heard${ti('lost_heard')}</th><th class="num">Not integrated${ti('lost_integrated')}</th><th class="num">Final pick: wrong info${ti('lost_wrong')}</th><th class="num">Final pick: budget / other${ti('lost_other')}</th><th class="num">Final score${ti('final_score')}</th><th class="num">Wrong claims acted on${ti('wrong_claims')}</th></tr></thead><tbody>
      ${R.by_condition.map(c => `<tr><td><b>${c.label}</b></td><td class="num">${pts(c.lost_not_spoken)}</td><td class="num">${pts(c.lost_not_heard)}</td><td class="num">${pts(c.lost_not_integrated)}</td><td class="num">${pts(c.lost_to_wrong_info)}</td><td class="num">${pts(c.lost_to_budget_math_or_other)}</td><td class="num">${pts(c.pts_final)} / ${R.opt.v}</td><td class="num">${f1(c.wrong_claims_acted_on, 1)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3 style="margin-top:0">Design outcome by deliberation type${ti('outcome')}</h3>
      <div style="overflow-x:auto"><table class="admtbl"><thead><tr><th>Type</th><th class="num">Teams done${ti('teams_done')}</th><th class="num">% of best${ti('pct_best')}</th><th class="num">Pooling index${ti('pooling')}</th><th class="num">Gems (of 6)${ti('gems')}</th><th class="num">Decoys (of 3)${ti('decoys')}</th><th class="num">Accepted (of 3)${ti('accepted')}</th><th class="num">Talked out loud${ti('talked')}</th></tr></thead><tbody>
      ${R.by_condition.map(c => `<tr><td><b>${c.label}</b></td><td class="num">${c.done} / ${c.teams}</td><td class="num">${f1(c.pct_best)}${c.pct_best == null ? '' : '%'}</td><td class="num">${f1(c.pooling, 2)}</td><td class="num">${f1(c.gems, 1)}</td><td class="num">${f1(c.decoys, 1)}</td><td class="num">${f1(c.accepts, 1)}</td><td class="num">${c.talked_outside_app} teams</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><h3 style="margin-top:0">Downloads${ti('downloads')}</h3><div class="inline">
      <a class="mini" href="${exp('results.csv')}">Results CSV (with points)</a>${ti('results_csv')}<a class="mini" href="${exp('facts.csv')}">Findings CSV</a>${ti('facts_csv')}<a class="mini" href="${exp('messages.csv')}">Messages CSV</a>${ti('messages_csv')}
      <a class="mini" href="${exp('participants.csv')}">Participants CSV</a>${ti('participants_csv')}<a class="mini" href="${exp('events.csv')}">All events CSV</a>${ti('events_csv')}<a class="mini" href="${exp('ai_calls.csv')}">AI calls CSV</a>${ti('ai_calls_csv')}<a class="mini" href="${exp('all.json')}">Everything (JSON)</a>${ti('json')}
      <a class="mini dark" href="${exp('database.sqlite3')}">Whole database (.sqlite3)</a>${ti('db')}</div>
      <h3>For the two human coders${ti('coders')}</h3><div class="inline"><a class="mini dark" href="${exp('coding_sample.csv')}">Coding sheet: random 20% of messages</a>${ti('coding_sample')}<a class="mini" href="${exp('coding_all.csv')}">Coding sheet: all messages</a>${ti('coding_all')}</div>
      <p class="small muted">Each row shows the app's codes next to blank columns for coder 1 and coder 2. The 20% sample is the same every time you download it for this session. After coding, fix the Findings CSV where the coders disagree with the app, and re-run <code>analysis/points_from_findings.py</code> to get corrected points.</p>
      <p class="small muted">CSV and JSON follow the "consenting teams only" switch. The database file has everything from every session, including students who said no, so keep it private.</p></div>
    <div class="card"><h3 style="margin-top:0">Each team${ti('each_team')}</h3>
      ${R.teams.length ? `${sortBar('res', RES_OPTS)}<div class="tr-list">${sortRows('res', R.teams.map(x => ({team:x.team, cond:x.condition, condText:condLabel(x.condition), set:String(x.final_set || '').split(' ').filter(Boolean), score:x.true_value, opt:R.opt.v, facts:x.facts,
        steps:[x.spoken, x.heard, x.integrated, x.actioned], lostShare:x.lost_not_spoken + x.lost_not_heard + x.lost_not_integrated, lostFinal:x.lost_at_final_pick, wrong:x.wrong_claims_acted_on ? `${x.lost_to_wrong_info} from wrong info` : '',
        flags:[x.talked_outside_app ? 'Talked out loud' : '', x.closed_by_researcher ? 'Round closed' : '', x.mediator_fallbacks ? 'Stand-in answered' : ''].filter(Boolean)})), RES_OPTS, RES_GET).map(x => teamResultRow(x, A.hideCond)).join('')}</div>` : '<p class="muted">No team has finished yet.</p>'}</div>`;
}
function teamView(){
  const T = A.team;
  return `<button class="mini" data-act="teamback">← Back</button>
  <header class="top"><h1>Team ${T.id} log</h1><span class="clock">${condLabel(T.cond)}${T.spare ? ' · spare' : ''}${T.nonconsent ? ' · no consent' : ''}</span></header>
  <div class="card small"><b>${condLabel(T.cond)}:</b> ${esc(T.about)}</div>
  <div class="card"><h3 style="margin-top:0">Findings${ti('team_facts')}</h3><div style="overflow-x:auto"><table class="admtbl"><thead><tr><th>Finding</th><th>Feature</th><th>Mentioned${ti('mentioned')}</th><th>1. Spoken${ti('spoken')}</th><th>To Mediator${ti('to_mediator')}</th><th>Relayed${ti('relayed')}</th><th>2. Heard${ti('heard')}</th><th>Recalled${ti('recalled')}</th><th>3. Integrated${ti('integrated')}</th><th>4. Actioned${ti('actioned')}</th><th>Final follows${ti('final_follows')}</th></tr></thead>
    <tbody>${T.facts.map(x => `<tr><td><b>${x.fact}</b></td><td>${x.feature} (${x.direction})</td>${['mentioned','spoken','disclosed_to_mediator','relayed_by_ai','heard','recalled','integrated','actioned','final_follows'].map(k => `<td>${x[k] === 1 ? '✓' : x[k] === '' ? '—' : '·'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3 style="margin-top:0">Everything saved${ti('team_log')}</h3>
    <div style="overflow-x:auto"><table class="admtbl"><thead><tr><th>Time</th><th>Round</th><th>Who</th><th>Kind</th><th>Text</th><th>Set</th><th>Seen by${ti('seen_by')}</th></tr></thead><tbody>
    ${T.log.map(e => `<tr><td class="num">${e.t}</td><td>${e.round}</td><td>${esc(e.label)}${e.pid ? `<div class="pseudo"><a href="#" data-act="person" data-pid="${e.pid}">${e.pid}</a></div>` : ''}</td><td>${e.kind}${e.private ? ' · private' : ''}${e.mediator_error ? ' · <span class="st warn">fallback</span>' : ''}</td><td style="white-space:pre-wrap">${esc(e.text)}</td><td>${(e.set || []).join(' ')}</td><td>${(e.seen_by || []).join(' ')}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function peopleList(){
  const q = A.q.trim().toUpperCase(), P = (A.people || []).filter(p => matchQ(A.q, [p.pid, p.label, p.team != null ? 'team ' + p.team : 'no team', A.hideCond ? '' : condLabel(p.cond), p.bot ? 'simulated sim' : 'real student', p.persona, STEP_NAMES(p.step), p.consent == null ? '' : p.consent ? 'consent yes' : 'no consent']));
  return `<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">People · ${(A.people || []).length}${ti('people')}</h3><a class="mini" href="${exp('events.csv')}">Download all events (CSV)</a></div>
    <input type="text" id="peopleq" placeholder="Search anything on a row: ID, role, nickname, team, type, step. Try caucus, team 4 or mechanical" value="${esc(A.q)}" style="margin-bottom:4px">${ppLegend()}${sortBar('people', PP_OPTS)}
    <div class="pp-list">${sortRows('people', P.map(p => ({...p, condText:condLabel(p.cond), step:STEP_NAMES(p.step), inApp:p.in_app})), PP_OPTS, PP_GET).map(p => personRow(p, A.hideCond)).join('') || '<p class="muted">No one yet.</p>'}</div></div>`;
}
function describe(ev){
  const d = ev.details || {}, q = x => `“${esc(String(x ?? '').slice(0, 400))}${String(x ?? '').length > 400 ? '…' : ''}”`;
  switch (ev.type){
    case 'join': return d.late ? 'Joined late (lobby was closed)' : 'Joined the session';
    case 'consent': return `${d.yes ? 'Said YES' : 'Said NO'} to research use · ${fmtT((d.ms_on_screen || 0) / 1000)} on the consent screen`;
    case 'placed': return `Placed on Team ${d.team} as ${esc(CT.roles[d.role] ? CT.roles[d.role].short : d.role)} — ${esc(d.nickname)} · ${condLabel(d.condition)}${d.spare ? ' · spare team' : ''}`;
    case 'step_start': return `Started: <b>${STEP_NAMES(d.step)}</b>`;
    case 'tab': return `${d.auto ? 'Screen moved to' : 'Switched tab'} ${esc(d.from)} → ${esc(d.to)} (${fmtT((d.ms_on_prev || 0) / 1000)} on ${esc(d.from)})`;
    case 'answer': return `${esc(String(d.block).replace('_',' '))}: ${esc(d.item)} = <b>${esc(String(d.value))}</b>${d.correct === false ? ' (wrong)' : d.correct ? ' (right)' : ''}`;
    case 'check': case 'pre': return esc(d.text || ev.type);
    case 'insert_fact': return `Tapped “+ Add” on fact <b>${esc(d.fact)}</b>`;
    case 'typing_start': return 'Started typing a message';
    case 'draft_snapshot': return `Paused typing (${esc(String(d.field || '').replace(/:.*/, ''))}, ${d.chars} chars): ${q(d.text)}`;
    case 'paste': return `Pasted ${d.chars} chars: ${q(d.text)}`;
    case 'time_warning': return d.level === 'time_up' ? `Time's up reminder shown (${esc(d.step)})` : `1 minute left reminder shown (${esc(d.step)})`;
    case 'paste_blocked': return `<i class="ic ic-alert"></i>Tried to paste (${d.chars} chars, blocked)${d.text ? ': ' + q(d.text) : ''}`;
    case 'copy_blocked': return `<i class="ic ic-alert"></i>Tried to copy (blocked)${d.text ? ': ' + q(d.text) : ''}`;
    case 'pick': return `${d.on ? 'Picked' : 'Unpicked'} <b>${esc(d.feature)}</b> → ${esc(d.picks || 'none')} ($${d.cost})`;
    case 'send_click': return `Pressed send (${d.chars} chars)`;
    case 'message': return `<b>Sent ${d.private ? 'to the Mediator' : 'to the team'}</b> (round ${d.round}): ${q(d.text)}<div class="pseudo">Picks ${(d.set || []).join(' ') || 'none'}${d.compose_ms != null ? ` · writing took ${fmtT(d.compose_ms / 1000)} · ${d.keys ?? 0} keys · ${d.backspaces ?? 0} backspaces · ${d.pastes ?? 0} pastes` : ''}</div>`;
    case 'seen': return `Had message ${esc(d.msg)} on screen for 2+ seconds`;
    case 'rating': return `Rated card ${esc(d.card)}: <b>${esc(d.text)}</b>`;
    case 'endorse': return `<b>${esc(d.text)}</b> the final decision`;
    case 'survey': return 'Submitted the survey';
    case 'help': return d.on ? 'Asked for help' : 'Cancelled help request';
    case 'help_resolved_by_researcher': return 'Researcher marked help as handled';
    case 'left_app': return '<i class="ic ic-alert"></i>Left the app (switched app or locked phone)';
    case 'returned_to_app': return `Came back after ${fmtT((d.away_ms || 0) / 1000)}`;
    case 'round_closed_by_researcher': return `<i class="ic ic-alert"></i>Round ${d.round} closed by the researcher before they posted`;
    case 'skipped': return '<i class="ic ic-alert"></i>Final/survey closed by the researcher';
    default: return esc(ev.type);
  }
}
function personView(){
  const p = A.person, ev = p.events, t0 = p.joined_at;
  const n = t => ev.filter(e => e.type === t).length, msgs = ev.filter(e => e.type === 'message');
  const sum = k => msgs.reduce((a, m) => a + (+m.details[k] || 0), 0);
  const away = ev.filter(e => e.type === 'returned_to_app').reduce((a, e) => a + (e.details.away_ms || 0), 0);
  const steps = ev.filter(e => e.type === 'step_start'), nowS = Date.now() / 1000;
  let prev = t0;
  return `<button class="mini" data-act="peopleback">← All people</button> <button class="mini dark" data-act="watchfrom" data-pid="${p.pid}">Watch their screen live</button>
  <header class="top"><h1>${p.pid}${p.bot ? ` <span class="clock">(simulated${p.persona ? ' · ' + esc(p.persona) : ''})</span>` : ''}</h1></header>
  <div class="stats">
    <div class="stat"><b>${p.team != null ? 'Team ' + p.team : '—'}</b><span>${esc(p.label || 'Not placed')}${p.cond ? ' · ' + (A.hideCond ? 'type hidden' : condLabel(p.cond)) : ''}</span></div>
    <div class="stat"><b>${p.consent == null ? '—' : p.consent ? 'Yes' : 'No'}</b><span>Consent</span></div>
    <div class="stat"><b>${fmtT(nowS - t0)}</b><span>Since joining · ${STEP_NAMES(p.step)}</span></div>
    <div class="stat"><b>${msgs.length}</b><span>Messages · ${msgs.reduce((a, m) => a + (m.details.text || '').length, 0)} chars sent</span></div>
    <div class="stat"><b>${sum('keys')} / ${sum('backspaces')}</b><span>Keys / backspaces · ${n('paste')} pastes</span></div>
    <div class="stat"><b>${n('draft_snapshot')}</b><span>Typing pauses saved · ${n('insert_fact')} facts tapped</span></div>
    <div class="stat"><b>${n('pick')}</b><span>Pick changes · ${n('tab')} tab switches</span></div>
    <div class="stat"><b>${n('left_app')}</b><span>Times left the app · ${fmtT(away / 1000)} away</span></div></div>
  <div class="card"><h3 style="margin-top:0">Time on each step</h3>${steps.length ? `<table class="admtbl"><tbody>${steps.map((e, i) => { const end = steps[i+1] ? steps[i+1].ts : (e.details.step === 'done' ? e.ts : nowS);
      return `<tr><td>${STEP_NAMES(e.details.step)}</td><td class="num">${e.details.step === 'done' ? '—' : fmtT(end - e.ts)}${!steps[i+1] && e.details.step !== 'done' ? ' <span class="muted">(still going)</span>' : ''}</td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">Not placed on a team yet.</p>'}</div>
  <div class="card"><h3 style="margin-top:0">Everything they did · ${ev.length} events</h3>
    <p class="small muted">Time is since joining. "+s" is the gap since their previous action. Typing is saved each time they pause for 1.5 seconds, so you can see drafts they changed or never sent.</p>
    <div style="overflow-x:auto"><table class="admtbl"><thead><tr><th class="num">Time</th><th class="num">Gap</th><th>Step</th><th>What happened</th></tr></thead><tbody>
    ${ev.map(e => { const gap = e.ts - prev; prev = e.ts; return `<tr><td class="num">${fmtT(e.ts - t0)}</td><td class="num muted">+${gap.toFixed(1)}s</td><td class="small">${STEP_NAMES(e.step)}</td><td>${describe(e)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
}
/* ---------- Live feed: every entry as people send it ---------- */
const FEED_GROUPS = [['msg','Messages'],['rate','Card ratings'],['acc','Accept / decline'],['sv','Brief checks & surveys'],['ai','Mediator & final']];
const feedGroup = k => k === 'message' ? 'msg' : k === 'rating' ? 'rate' : k === 'endorse' ? 'acc' : ['check','pre','survey'].includes(k) ? 'sv' : 'ai';
const roleColor = w => ['ME','MF','HF'].includes(w) ? `var(--${w})` : 'var(--med)';
function feedBody(e){
  const pills = (e.set || []).map(f => `<span class="fd-chip">${esc(f)}</span>`).join('');
  const ans = o => Object.entries(o || {}).map(([k, v]) => `<span class="fd-chip">${esc(k)}: <b>${esc(v)}</b></span>`).join('');
  switch (e.kind){
    case 'message': return `<div class="fd-text">${esc(e.text)}</div>
      <div class="fd-meta">${pills ? `Picks ${pills} <b>$${e.cost}</b> of $57` : 'No picks'}${e.facts.length ? ` · Facts mentioned ${e.facts.map(f => `<span class="fd-chip fact">${esc(f)}</span>`).join('')}` : ''}${e.private ? ' · <span class="fd-priv">Private to Mediator</span>' : ''}${e.compose_s ? ` · took ${fmtT(e.compose_s)} to write` : ''}</div>`;
    case 'rating': return `<div class="fd-text">${esc(e.text)}</div>`;
    case 'endorse': return `<div class="fd-text"><b style="color:${e.accepted ? 'var(--ok)' : 'var(--bad)'}">${e.accepted ? 'Accepts' : 'Does not accept'}</b> the final decision${e.text && e.text.includes(':') ? ': ' + esc(e.text.split(': ').slice(1).join(': ')) : ''}</div>`;
    case 'survey': return `<div class="fd-text">Post-survey sent</div><div class="fd-meta">${ans(e.answers)}${e.recall && e.recall.length ? ` · Recalled ${e.recall.map(f => `<span class="fd-chip fact">${esc(f)}</span>`).join('')}` : ''}</div>`;
    case 'pre': return `<div class="fd-text">Pre-survey sent</div><div class="fd-meta">${ans(e.answers)}</div>`;
    default: return `<div class="fd-text">${e.version ? `<b>${esc(e.version)}:</b> ` : ''}${esc(e.text)}</div>${pills ? `<div class="fd-meta">Set ${pills} <b>$${e.cost}</b></div>` : ''}`;
  }
}
const FEED_NAMES = {message:'Message', rating:'Card rating', endorse:'Final vote', survey:'Survey', pre:'Pre-survey', check:'Brief check', draft:'AI draft', question:'AI question', recap:'AI recap', final:'Final decision'};
function adminFeed(){
  const F = A.feedShown || A.feed; if (!F) return '<p class="muted">Loading…</p>';
  const q = A.fq.trim().toLowerCase(), teams = [...new Set(F.items.map(e => e.team).concat(F.typing.map(t => t.team)))].sort((a, b) => a - b);
  const keep = e => (A.fteam === '' || e.team === +A.fteam) && !(A.fnobots && e.bot) && (!q || (e.pid || '').toLowerCase().includes(q) || (e.text || '').toLowerCase().includes(q));
  const items = F.items.filter(e => A.fkinds.has(feedGroup(e.kind)) && keep(e)), typing = F.typing.filter(keep);
  const fresh = A.feed && A.feedShown ? A.feed.total - A.feedShown.total : 0;
  const first = !A.feedSeen; A.feedSeen = A.feedSeen || new Set();
  const rows = items.map(e => {
    const isNew = !first && !A.feedSeen.has(e.id); A.feedSeen.add(e.id);
    return `<div class="fd-row${isNew ? ' new' : ''}">
      <div class="fd-time"><b>${e.clock != null ? fmtT(e.clock) : '—'}</b><span>${e.round === 'end' ? 'End' : e.round === '-' || e.round == null ? '' : e.round === 0 ? 'Start' : 'Round ' + e.round}</span></div>
      <div class="fd-main"><div class="fd-head"><span class="who-pill" style="background:${roleColor(e.who)}">${esc(e.label)}</span>
        ${e.pid ? `<a href="#" data-act="person" data-pid="${e.pid}">${e.pid}</a>${e.bot ? ' <span class="muted small">(sim)</span>' : ''}` : ''}
        <a href="#" data-act="admteam" data-team="${e.team}" class="muted">Team ${e.team}</a><span class="muted small">${A.hideCond ? '' : '· ' + condLabel(e.cond)}</span>
        <span class="fd-kind">${FEED_NAMES[e.kind] || e.kind}</span></div>${feedBody(e)}</div></div>`;
  }).join('');
  return `<div class="card"><div class="inline" style="justify-content:space-between"><h3 style="margin:0">Live feed${ti('feed')}</h3>
      <span class="inline"><span class="small muted">${items.length} shown of ${F.total}</span>
      <button class="mini ${A.fpause ? 'dark' : ''}" data-act="fpause">${A.fpause ? `<i class="ic ic-play"></i>Resume${fresh > 0 ? ` (${fresh} new)` : ''}` : '<i class="ic ic-pause"></i>Pause feed'}</button>${ti('fpause')}</span></div>
    <div class="fd-filters">
      <select id="fteam"><option value="">All teams</option>${teams.map(t => `<option value="${t}" ${String(t) === A.fteam ? 'selected' : ''}>Team ${t}</option>`).join('')}</select>
      <input type="text" id="fq" placeholder="Search a participant ID or words" value="${esc(A.fq)}">
      <label class="chip"><input type="checkbox" id="fnobots" ${A.fnobots ? 'checked' : ''}> Hide simulated</label></div>
    <div class="fd-filters">${FEED_GROUPS.map(([k, l]) => `<label class="chip"><input type="checkbox" class="fkind" value="${k}" ${A.fkinds.has(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
  <div class="card"><h3 style="margin-top:0">Typing now · ${typing.length}${ti('typing_now')}</h3>
    ${typing.length ? `<div class="fd-typing">${typing.map(t => `<div class="fd-tcard"><div class="fd-head"><span class="who-pill" style="background:${roleColor(t.who)}">${esc(t.label)}</span>
      <a href="#" data-act="person" data-pid="${t.pid}">${t.pid}</a><span class="muted small">Team ${t.team} · Round ${t.round}</span></div>
      <div class="fd-draft">${esc(t.text)}<span class="fd-caret"></span></div></div>`).join('')}</div>` : '<p class="muted small" style="margin:0">Nobody has an unsent draft right now.</p>'}</div>
  <div class="card fd-list">${rows || '<p class="muted">Nothing sent yet. Entries show up here the moment someone sends them.</p>'}</div>`;
}
/* ---------- Automatic step timers for players ---------- */
const TIMER_DEFAULTS = {on:true, card:5, round1:6, round:5, final:1, survey:4};
/* What the player should be doing now, and how many minutes it should take. null = no timer (waiting / done). */
function stepGoal(step, timers, shared){
  const t = Object.assign({}, TIMER_DEFAULTS, timers || {});
  if (!t.on) return null;
  if (step === 'card') return {key:'card', what:'Read your brief and answer the questions', send:"press I'm ready", m:t.card};
  if (/^post\d+$/.test(step)){ const n = +step.slice(4);
    return {key:step, what:`Round ${n}: send your vote + message`, send:`send your Round ${n} vote and message`, m:n === 1 ? t.round1 : t.round}; }
  if (step === 'final') return {key:'final', what:'Accept or decline the final decision', send:'answer about the final decision', m:t.final};
  if (step === 'survey') return {key:'survey', what:'Finish the short survey', send:'finish the survey', m:t.survey};
  return null;
}
const mmssT = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/* left = seconds left (negative = over time) */
const warnAt = g => Math.min(60, g.m * 60 * 0.4);   // 1 minute, or 40% of a very short step
function timerLevel(left, g){ return left <= 0 ? 'over' : left <= (g ? warnAt(g) : 60) ? 'warn' : 'ok'; }
function timerHTML(g, left, paused, waitingText){
  if (!g) return waitingText ? `<div id="stimer" class="stimer wait"><div class="st-row"><span class="st-ico">✓</span><span class="st-lab">${waitingText}</span></div></div>` : '<div id="stimer"></div>';
  if (paused) return `<div id="stimer" class="stimer paused"><div class="st-row"><span class="st-ico"><i class="ic ic-pause"></i></span><span class="st-lab">${g.what}</span><b class="st-left">Paused</b></div><div class="st-bar"><i style="width:${Math.max(0, Math.min(100, left / (g.m * 60) * 100))}%"></i></div></div>`;
  const lv = timerLevel(left, g), pct = Math.max(0, Math.min(100, left / (g.m * 60) * 100));
  const right = lv === 'over' ? `Time's up${left < -5 ? ` · +${mmssT(-left)}` : ''}` : `${mmssT(left)} left`;
  const sub = lv === 'over' ? `Please ${g.send} now.` : lv === 'warn' ? `Almost out of time. Finish up and ${g.send}.` : `Suggested time: ${g.m} min`;
  return `<div id="stimer" class="stimer ${lv}" role="timer" aria-live="${lv === 'ok' ? 'off' : 'assertive'}">
    <div class="st-row"><span class="st-ico">${lv === 'over' ? '<i class="ic ic-bell"></i>' : '<i class="ic ic-clock"></i>'}</span><span class="st-lab">${g.what}</span><b class="st-left">${right}</b></div>
    <div class="st-bar"><i style="width:${pct}%"></i></div><div class="st-sub">${sub}</div></div>`;
}
let TOAST_T = null;
function timeToast(lv, g, left){
  let el = document.getElementById('ttoast');
  if (!el){ el = document.createElement('div'); el.id = 'ttoast'; el.addEventListener('click', () => el.classList.remove('show')); document.body.appendChild(el); }
  el.className = 'ttoast ' + lv;
  el.innerHTML = lv === 'over' ? `<b><i class="ic ic-bell"></i>Time's up</b><span>Please ${g.send} now.</span>` : `<b><i class="ic ic-clock"></i>${left > 50 ? '1 minute' : Math.round(left) + ' seconds'} left</b><span>Finish up and ${g.send}.</span>`;
  requestAnimationFrame(() => el.classList.add('show'));
  try { if (navigator.vibrate) navigator.vibrate(lv === 'over' ? [180, 90, 180] : 160); } catch(_){}
  clearTimeout(TOAST_T); TOAST_T = setTimeout(() => el.classList.remove('show'), 6000);
}
/* Called every second. ctx = {g, start(ms), paused, waitingText, stepKey, onWarn(level)} */
const TIMER_SEEN = {};
function tickTimer(ctx){
  const el = document.getElementById('stimer'); if (!el) return;
  if (!ctx || !ctx.g){ const html = timerHTML(null, 0, false, ctx && ctx.waitingText); if (el.outerHTML !== html) el.outerHTML = html; return; }
  const left = ctx.g.m * 60 - (ctx.now - ctx.start) / 1000;
  el.outerHTML = timerHTML(ctx.g, left, ctx.paused, null);
  if (ctx.paused) return;
  const lv = timerLevel(left, ctx.g), k = ctx.stepKey;
  if (lv !== 'ok' && TIMER_SEEN[k + lv] === undefined){
    const fresh = left > -30 && (lv === 'over' || left > 0);   // don't pop old warnings after a reload
    TIMER_SEEN[k + lv] = 1;
    if (lv === 'over') TIMER_SEEN[k + 'warn'] = 1;
    if (fresh && !WATCH){ timeToast(lv, ctx.g, left); if (ctx.onWarn) ctx.onWarn(lv, Math.round(left)); }
  }
}
function serverNow(){ return Date.now() + (L.clockOff || 0); }
function timerCtx(){
  if ((MODE !== 'student' && !WATCH) || !V || !V.team) return null;
  const tm = V.team, step = tm.me.step, g = stepGoal(step, V.session.timers, CT.cond[tm.cond].shared);
  const waitingText = /^wait\d/.test(step) ? `You sent your Round ${step.slice(4)} message. Waiting for your teammates.` : step === 'done' ? 'All done. Thank you!' : '';
  return {g, start:((tm.timer && tm.timer.start) || 0) * 1000, now:serverNow(), paused:V.session.paused, waitingText, stepKey:V.pid + ':' + step,
    onWarn:(lv, left) => track('time_warning', {level:lv === 'over' ? 'time_up' : '1_min_left', step, seconds_left:left})};
}
function timerNow(){ const c = timerCtx(); if (!c) return ''; return timerHTML(c.g, c.g ? c.g.m * 60 - (c.now - c.start) / 1000 : 0, c.paused, c.waitingText); }
setInterval(() => { if (MODE === 'student' || WATCH) tickTimer(timerCtx()); }, 1000);

/* =====================================================================
   WATCH: admins see exactly what one player sees, live and read-only,
   plus a thin admin-only layer (dark labels) the player never gets.
   ===================================================================== */
let W = null, WT = null;
const WPID = qs.get('pid'), WHIDE = qs.get('hide') === '1';
function watchSoon(ms){ clearTimeout(WT); WT = setTimeout(refreshWatch, ms || 250); }
async function refreshWatch(){
  if (!ADMIN || !WPID) return render();
  try {
    const [v, w] = await Promise.all([api('/api/admin/view/' + encodeURIComponent(WPID)), api('/api/admin/watch/' + encodeURIComponent(WPID))]);
    V = v; W = w;
    if (V.team){ L.text = V.team.me.draft || ''; if (L.lastStep !== V.team.me.step && !L.tabPicked) L.tab = /^post|^wait|final/.test(V.team.me.step) ? 'chat' : V.team.me.step === 'survey' || V.team.me.step === 'done' ? 'guide' : 'brief'; }
  } catch(e){ if (e.status === 401){ ADMIN = null; } W = {error:e.message}; }
  render();
}
/* a time that keeps counting in the browser between updates (at the session's speed; 0 = paused) */
const tickT = (sec, rate, done) => `<span class="w-tick" data-s="${sec || 0}" data-r="${done ? 0 : (rate ?? 1)}" data-t0="${Date.now()}">${fmtT(sec || 0)}</span>`;
setInterval(() => document.querySelectorAll('.w-tick').forEach(el => { el.textContent = fmtT(+el.dataset.s + (Date.now() - +el.dataset.t0) / 1000 * +el.dataset.r); }), 1000);
const STEP_HUMAN = st => !st ? '—' : st === 'consent' ? 'Consent screen' : st === 'lobby' ? 'In the lobby' : st === 'card' ? 'Reading the brief' : /^post/.test(st) ? `Writing round ${st.slice(4)}` : /^wait/.test(st) ? `Sent round ${st.slice(4)}, waiting` : st === 'final' ? 'Final decision' : st === 'survey' ? 'Survey' : st === 'done' ? 'Done' : st;
const CONDC = {caucus:'#332288', facilitated:'#44AA99', summary_only:'#117733', unmediated:'#CC6677'};
const dirWord = d => d > 0 ? 'worth more' : 'worth less';
function watchStrip(){
  if (!W || W.error) return `<div class="wstrip"><b>Admin view</b> ${W && W.error ? esc(W.error) : 'Loading…'}</div>`;
  const tgt = W.target_mins, pct = tgt ? Math.min(100, (W.on_step || 0) / (tgt * 60) * 100) : 0, over = tgt && W.on_step > tgt * 60;
  return `<div class="wstrip" role="note" aria-label="Admin-only information">
    <div class="ws-row"><span class="ws-tag">Admin view · read-only · players never see this bar or dark labels</span></div>
    <div class="ws-row ws-main">
      <b>${esc(W.pid)}</b>
      ${W.team != null ? `<span>Team ${W.team}</span>` : ''}
      ${W.cond ? (WHIDE ? '<span class="ws-cond" style="--cc:#5b6070">type hidden</span>' : `<span class="ws-cond" style="--cc:${CONDC[W.cond]}">${esc(W.cond_label)}</span>`) : ''}
      ${W.label ? `<span>${esc(W.label)}</span>` : ''}
      <span class="ws-kind ${W.bot ? 'sim' : 'real'}">${W.bot ? 'Simulated' + (W.persona ? ' · ' + esc(W.persona) : '') : 'Real student'}</span>
      ${!W.bot ? `<span class="ws-on ${W.online ? 'on' : ''}">${W.online ? 'Online' : 'Offline'}</span>` : ''}
      ${W.consent === false ? '<span class="ws-warn">No consent</span>' : ''}${W.help ? '<span class="ws-warn">Asked for help</span>' : ''}${W.spare ? '<span class="ws-warn">Spare team</span>' : ''}
    </div>
    <div class="ws-row ws-step"><span>${esc(STEP_HUMAN(W.step))}</span>${tgt ? `<span class="ws-bar ${over ? 'over' : ''}"><i style="width:${pct}%"></i></span><span>${tickT(W.on_step, W.rate)} of ${fmtT(tgt * 60)}${over ? ' · over' : ''}</span>` : ''}
      ${W.picks ? `<span class="ws-val">Picks now worth <b>${W.picks_value}</b> / ${W.opt}</span>` : ''}${W.final_value != null ? `<span class="ws-val">Final worth <b>${W.final_value}</b> / ${W.opt}</span>` : ''}</div>
  </div>`;
}
function watchPage(){
  if (!ADMIN) return '<div class="card"><h2>Admin view</h2><p>Open the admin page and log in first, in this same browser. Then open Watch players.</p></div>';
  if (!WPID) return '<p class="muted">No player chosen.</p>';
  if (!V) return watchStrip() + '<p class="muted">Loading their screen…</p>';
  return watchStrip() + renderStudent();
}
const admLab = (html, cls) => `<div class="adm-lab ${cls || ''}"><span class="adm-k">Admin</span>${html}</div>`;
/* add the admin-only labels into the player's real screen */
function watchDecorate(){
  const app = document.getElementById('app'); if (!app || !W || W.error) return;
  app.querySelectorAll('textarea, input').forEach(el => { if (el.type === 'checkbox' || el.type === 'radio') el.disabled = true; else el.readOnly = true; });
  const F = Object.fromEntries((W.findings || []).map(x => [x.id, x]));
  app.querySelectorAll('.fact').forEach(el => { const id = (el.querySelector('.fx') || {}).textContent, x = F[id]; if (!x) return;
    const chip = (k, l) => `<span class="adm-chip ${x[k] ? 'yes' : ''}">${x[k] ? '✓' : '·'} ${l}</span>`;
    el.insertAdjacentHTML('beforeend', admLab(`Hidden truth: <b>${x.f} is ${dirWord(x.dir)}</b> than the table says.<div class="adm-chips">${chip('spoken', 'Spoken')}${chip('heard', 'Heard')}${chip('integrated', 'Used')}${chip('actioned', 'In final')}</div>${!x.spoken && x.mentioned ? ' <span class="adm-note">named, but no direction yet</span>' : ''}`)); });
  app.querySelectorAll('label.pick input[data-id]').forEach(inp => { const id = inp.dataset.id, ds = inp.closest('label').querySelector('.ds'); if (ds && W.true) ds.insertAdjacentHTML('beforeend', ` <span class="adm-in">true ${W.true[id]}</span>`); });
  app.querySelectorAll('[data-mid]').forEach(el => { const c = (W.claims || {})[el.dataset.mid]; if (!c) return;
    el.insertAdjacentHTML('beforeend', admLab(c.length ? 'Scored as: ' + c.map(([f, d]) => `<b>${f} ${dirWord(d)}</b>`).join(', ') : 'Scored as: <b>no clear claim</b> (no feature with a direction word)', 'small')); });
  const rc = app.querySelector('#pkreceipt');
  if (rc && W.picks_value != null) rc.insertAdjacentHTML('afterend', admLab(`These picks are worth <b>${W.picks_value}</b> of ${W.opt} (${Math.round(W.picks_value / W.opt * 100)}%) using the true values.`, 'pad'));
}

/* ---------- admin page: Watch players tab ---------- */
let WFRAME = null;
function placeWatchFrame(){
  const slot = document.getElementById('w-slot');
  if (!slot){ if (WFRAME) WFRAME.style.display = 'none'; return; }
  if (!WFRAME){ WFRAME = document.createElement('iframe'); WFRAME.className = 'w-frame'; WFRAME.title = 'Live player screen'; document.body.appendChild(WFRAME); }
  const src = '/watch?pid=' + encodeURIComponent(A.watchPid || '') + (A.hideCond ? '&hide=1' : '') + (ARCH ? '&arch=' + ARCH.id : '');
  if (A.watchPid && WFRAME.dataset.src !== src){ WFRAME.src = src; WFRAME.dataset.src = src; }
  const r = slot.getBoundingClientRect();
  Object.assign(WFRAME.style, {display:A.watchPid ? 'block' : 'none', position:'absolute', left:(r.left + window.scrollX + slot.clientLeft) + 'px', top:(r.top + window.scrollY + slot.clientTop) + 'px', width:slot.clientWidth + 'px', height:slot.clientHeight + 'px'});
}
window.addEventListener('resize', () => { if (MODE === 'admin') placeWatchFrame(); });
window.addEventListener('scroll', () => { if (MODE === 'admin' && WFRAME && WFRAME.style.display !== 'none') placeWatchFrame(); }, {passive:true});
function wFiltered(){
  const P = (A.wall && A.wall.players) || [], f = A.wf;
  return P.filter(p => (!f.cond || p.cond === f.cond) && (!f.kind || (f.kind === 'real' ? !p.bot : p.bot)) && (!f.team || String(p.team) === f.team) && matchQ(f.q, [p.pid, p.label, 'team ' + p.team, A.hideCond ? '' : condLabel(p.cond), p.bot ? 'simulated sim' : 'real student', p.persona, STEP_HUMAN(p.step)]));
}
function wList(){
  const P = wFiltered();
  if (!P.length) return '<p class="muted small" style="padding:10px">No players match. Players show up here once teams are formed.</p>';
  const byTeam = {}; P.forEach(p => (byTeam[p.team] = byTeam[p.team] || []).push(p));
  return Object.entries(byTeam).map(([t, ps]) => `<div class="w-team"><div class="w-th"><b>Team ${t}</b><span class="w-cond" style="--cc:${A.hideCond ? '#5b6070' : CONDC[ps[0].cond]}">${A.hideCond ? 'type hidden' : condLabel(ps[0].cond)}</span></div>
    ${ps.map(p => `<button type="button" class="w-p ${p.pid === A.watchPid ? 'on' : ''}" data-act="watchpick" data-pid="${p.pid}">
      <i class="w-dot" style="background:${ROLE_COLOR[p.role]}"></i><span class="w-nm"><b>${esc(p.label)}</b><small>${p.pid}${p.bot ? ' · sim' + (p.persona ? ' · ' + esc(p.persona) : '') : ' · real'}</small></span>
      <span class="w-st">${esc(STEP_HUMAN(p.step))}${!p.bot ? `<i class="w-online ${p.online ? 'on' : ''}" title="${p.online ? 'Online' : 'Offline'}"></i>` : ''}</span></button>`).join('')}</div>`).join('');
}
function wWall(){
  const P = wFiltered();
  if (!P.length) return '<p class="muted">No players match.</p>';
  return `<div class="w-wall">${P.map(p => { const tgt = p.target_mins, over = tgt && p.on_step > tgt * 60;
    return `<button type="button" class="w-card ${over ? 'over' : ''}" data-act="watchpick" data-pid="${p.pid}" style="--rc:${ROLE_COLOR[p.role]};--cc:${A.hideCond ? '#5b6070' : CONDC[p.cond]}">
      <div class="w-ch"><span class="w-cond">${A.hideCond ? 'type hidden' : condLabel(p.cond)}</span><span class="w-team">Team ${p.team}</span>${!p.bot ? `<span class="w-live ${p.online ? 'on' : ''}">${p.online ? 'online' : 'offline'}</span>` : ''}</div>
      <b class="w-name">${esc(p.label)}</b>
      <div class="w-meta">${p.pid} · ${p.bot ? 'simulated' + (p.persona ? ' · ' + esc(p.persona) : '') : 'real student'}</div>
      <div class="w-step">${esc(STEP_HUMAN(p.step))}${tgt ? ` · ${tickT(p.on_step, A.wall.rate)} / ${fmtT(tgt * 60)}` : ''}</div>
      ${p.draft ? `<div class="fd-draft">${esc(p.draft)}<span class="fd-caret"></span></div>` : p.last ? `<div class="w-last">“${esc(p.last.length > 140 ? p.last.slice(0, 140) + '…' : p.last)}”</div>` : ''}
      <div class="small">${p.picks.length ? p.picks.map(f => `<span class="fd-chip">${f}</span>`).join(' ') + ` <b style="white-space:nowrap">$${p.cost}</b>` : '<span class="muted">no picks</span>'}</div></button>`; }).join('')}</div>`;
}
function wPicker(){
  const P = wFiltered(); if (!P.length) return '';
  const i = P.findIndex(p => p.pid === A.watchPid);
  return `<div class="w-picker"><button type="button" class="w-nav" data-act="wnext" data-d="-1" aria-label="Previous player">‹</button>
    <select id="wf-pick" aria-label="Player to watch"><option value="">Pick a player…</option>${P.map(p => `<option value="${p.pid}" ${p.pid === A.watchPid ? 'selected' : ''}>Team ${p.team} · ${esc(p.label)} · ${p.bot ? 'sim' : 'real'} · ${esc(STEP_HUMAN(p.step))}</option>`).join('')}</select>
    <button type="button" class="w-nav" data-act="wnext" data-d="1" aria-label="Next player">›</button></div>`;
}
function wGo(pid){ A.watchPid = pid; A.wstats = null; A.wRendered = false; render(); refreshAdmin(); }
function adminWatch(){
  if (A.wall && !A.wall.players.length) return emptyState('Nobody to watch yet', 'Players show up here once teams are formed.', '<button class="mini" data-act="admtab" data-tab="live">Go to the session</button><button class="mini dark" data-act="practice">Start a practice run</button>');
  const P = (A.wall && A.wall.players) || [], teams = [...new Set(P.map(p => p.team))].sort((a, b) => a - b), f = A.wf;
  const conds = [...new Set(P.map(p => p.cond))];
  return `<div class="card"><div class="inline" style="justify-content:space-between;flex-wrap:wrap;gap:10px"><h3 style="margin:0">Watch players${ti('watch')}</h3>
      <span class="seg"><button data-act="wmode" data-v="screen" class="${A.watchMode === 'screen' ? 'on' : ''}">One screen</button><button data-act="wmode" data-v="wall" class="${A.watchMode === 'wall' ? 'on' : ''}">Wall (everyone)</button></span></div>
    <div class="fd-filters"><select id="wf-cond"><option value="">All conditions</option>${conds.map(c => `<option value="${c}" ${f.cond === c ? 'selected' : ''}>${A.hideCond ? 'Type ' + (conds.indexOf(c) + 1) : condLabel(c)}</option>`).join('')}</select>
      <select id="wf-kind"><option value="">Real and simulated</option><option value="real" ${f.kind === 'real' ? 'selected' : ''}>Real students only</option><option value="sim" ${f.kind === 'sim' ? 'selected' : ''}>Simulated only</option></select>
      <select id="wf-team"><option value="">All teams</option>${teams.map(t => `<option value="${t}" ${f.team === String(t) ? 'selected' : ''}>Team ${t}</option>`).join('')}</select>
      <input type="text" id="wf-q" placeholder="Search: ID, role, team, type, step" value="${esc(f.q)}"></div></div>
  ${A.watchMode === 'wall' ? `<div id="w-wallbox">${wWall()}</div>` : `${wPicker()}<div class="w-grid"><div class="card w-list" id="w-list">${wList()}</div>
    <div class="w-phone"><div class="w-ph-head">${A.watchPid ? `Live screen · ${esc(A.watchPid)}` : 'Live screen'}</div><div id="w-slot" class="w-slot">${A.watchPid ? '' : '<p class="muted" style="padding:20px">Pick a player to see their screen.</p>'}</div></div>
    <div class="card w-stats" id="w-stats">${wStats()}</div></div>`}`;
}
/* live updates without reloading the player's screen */
function patchWatch(){
  const l = document.getElementById('w-list'), s = document.getElementById('w-stats'), w = document.getElementById('w-wallbox');
  if (l) l.innerHTML = wList(); if (s) s.innerHTML = wStats(); if (w) w.innerHTML = wWall();
  const pk = document.querySelector('.w-picker'); if (pk && document.activeElement !== document.getElementById('wf-pick')) pk.outerHTML = wPicker();
  placeWatchFrame();
}
let autoTimer = null;
/* Big admin clock: ticks every second without redrawing the page */
setInterval(() => { const el = document.getElementById('admclock'); if (el && A.st && A.st.clock != null) el.textContent = fmtT(A.st.clock + (Date.now() - A.stAt) / 1000 * (A.st.clock_rate || 0)); }, 1000);
function adminClick(which, b){
  if (which === 'pjmode'){ PJ.mode = b.dataset.v; try { localStorage.setItem('tds_pj_mode', PJ.mode); } catch(_){} PJ.chartsAt = 0; return refreshAdmin(); }
  if (which === 'pjtypes'){ PJ.types = !PJ.types; return render(); }
  if (which === 'pjfull'){ if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => { PJ.fsHint = Date.now(); render(); setTimeout(render, 6000); }); return; }
  switch (which){
    case 'noop': return;
    case 'aitest': if (ARCH) return; window.AI_TEST_BUSY = true; render(); return api('/api/admin/ai_test', {}).then(r => { window.AI_TEST_LOCAL = r; }).catch(e => { window.AI_TEST_LOCAL = {ok:false, error:e.message}; }).finally(() => { window.AI_TEST_BUSY = false; refreshAdmin(); });
    case 'medtest': { const sel = document.getElementById('medsel'), model = sel ? sel.value : null; A.medPick = model; A.medBusy = true; A.medTest = null; render();
      return api('/api/admin/ai_test', {model}).then(r => { A.medTest = r; }).catch(e => { A.medTest = {ok:false, model, error:e.message}; }).finally(() => { A.medBusy = false; render(); }); }
    case 'meduse': { const sel = document.getElementById('medsel'); if (!sel) return; const model = sel.value; A.models = null; A.medPick = null; return adm('mediator', {model}); }
    case 'medrefresh': A.models = null; return refreshAdmin();
    case 'ain': { const U = UIS(), cur = parseInt(U.aiN, 10) || +((document.getElementById('ain') || {}).value) || 90; U.aiN = Math.max(3, Math.min(600, cur + (+b.dataset.d))); return render(); }
    case 'sortby': sortClick(b); return render();
    case 'savesess': { const nm = (document.getElementById('savename') || {}).value || ''; b.disabled = true; b.textContent = 'Saving…';
      return api('/api/admin/saved', {name:nm}).then(r => { A.flash = `Saved "${r.name}". Open it any time from this tab.`; }).catch(e => { A.flash = 'Could not save: ' + e.message; }).then(() => { refreshAdmin(); setTimeout(() => { A.flash = ''; render(); }, 4000); }); }
    case 'opensaved': { const m = (A.saved || []).find(x => x.id === b.dataset.id); if (!m) return; ARCH = m;
      Object.assign(A, {tab:'charts', watchPid:null, wstats:null, wall:null, person:null, team:null, people:null, results:null, charts:null, feed:null, feedShown:null, wRendered:false, showGuide:false}); window.scrollTo(0, 0); return refreshAdmin(); }
    case 'closesaved': ARCH = null; Object.assign(A, {tab:'saved', watchPid:null, wstats:null, wall:null, person:null, team:null, people:null, results:null, charts:null, feed:null, feedShown:null, wRendered:false}); return refreshAdmin();
    case 'delsaved': { if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Click again to delete'; b.classList.add('warnbtn'); return; } const id = b.dataset.id;
      return api('/api/admin/saved/' + id, null, 'DELETE').then(() => { if (ARCH && ARCH.id === id) ARCH = null; refreshAdmin(); }); }
    case 'pn': A.practiceN = Math.max(1, Math.min(150, PN() + (+b.dataset.d))); return render();
    case 'wpane': A.wPane = b.dataset.v; return patchWatch();
    case 'guide': A.showGuide = true; return render();
    case 'guideclose': A.showGuide = false; GUIDE_MARK(); return render();
    case 'rstoggle': RS_SET(!RS_COL()); return render();
    case 'formsure': if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Yes, form teams now'; b.classList.add('warnbtn'); return; } return adm('form');
    case 'startfresh': if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Click again: new empty session'; return; } return adm('new_session');
    case 'practice': A.showGuide = false; GUIDE_MARK(); A.tab = 'live'; return adm('addbots', {n:PN()}).then(() => adm('autorun', {speed:15})).then(() => { A.flash = 'Practice run started at 15× speed. Follow the run sheet, then try Watch players and Charts.'; render(); setTimeout(() => { A.flash = ''; render(); }, 6000); });
    case 'gotoreport': A.tab = 'charts'; A.wRendered = false; return refreshAdmin().then(() => setTimeout(() => window.ChartExport && window.ChartExport.openBuilder(), 250));
    case 'admtab': if (b.dataset.tab === 'setup'){ SETUP_MARK(); A.models = null; } A.wRendered = false; A.tab = b.dataset.tab; A.person = null; return refreshAdmin();
    case 'addbots': return adm('addbots', {n:b.dataset.n === 'pn' ? PN() : +b.dataset.n});
    case 'undobots': return adm('undobots');
    case 'clearbots': if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Click again to remove all'; return; } return adm('clearbots');
    case 'form': return adm('form');
    case 'pause': return adm('pause');
    case 'bc': return adm('broadcast', {msg:b.dataset.msg});
    case 'resolve': return adm('resolve', {pid:b.dataset.pid});
    case 'solo': return adm('solo', {pid:b.dataset.pid});
    case 'close': if (confirmClose(b)) return adm('close', {team:+b.dataset.team}); return;
    case 'sim': return adm('sim');
    case 'simspeed': if (A.st && A.st.auto_speed) return adm('autorun', {speed:+b.dataset.v}); A.simSpeed = +b.dataset.v; return render();
    case 'autorun': return adm('autorun', {speed:+b.dataset.v});
    case 'hidecond': A.hideCond = !A.hideCond; return render();
    case 'admteam': A.team = {id:+b.dataset.team}; return refreshAdmin();
    case 'teamback': A.team = null; return refreshAdmin();
    case 'person': A.tab = 'people'; A.team = null; A.person = {pid:b.dataset.pid}; return refreshAdmin();
    case 'fpause': A.fpause = !A.fpause; if (!A.fpause) A.feedShown = A.feed; return render();
    case 'watchpick': A.watchPid = b.dataset.pid; A.wstats = null; A.watchMode = 'screen'; A.tab = 'watch'; A.wRendered = false; render(); return refreshAdmin();
    case 'wnext': { const P = wFiltered(); if (!P.length) return; const i = P.findIndex(p => p.pid === A.watchPid), d = +b.dataset.d; return wGo(P[(i < 0 ? 0 : (i + d + P.length) % P.length)].pid); }
    case 'wmode': A.watchMode = b.dataset.v; A.wRendered = false; return render();
    case 'watchfrom': A.watchPid = b.dataset.pid; A.tab = 'watch'; A.watchMode = 'screen'; A.wRendered = false; A.person = null; render(); return refreshAdmin();
    case 'peopleback': A.person = null; return refreshAdmin();
    case 'newsession': if (b.dataset.sure !== '1'){ b.dataset.sure = '1'; b.textContent = 'Click again to confirm'; return; } return adm('new_session');
    case 'savetimers': { const v = k => +document.getElementById('tm_' + k).value;
      return adm('timers', {on:document.getElementById('tm_on').checked, card:v('card'), round1:v('round1'), round:v('round'), final:v('final'), survey:v('survey')}); }
    case 'savesetup': return adm('settings', {class_code:document.getElementById('ccode').value, rounds:+document.getElementById('rounds').value,
      threshold:+document.getElementById('thresh').value, conds:[...document.querySelectorAll('.cc:checked')].map(x => x.value), fallback:[...document.querySelectorAll('.fb:checked')].map(x => x.value)});
  }
}
function confirmClose(b){ if (b.dataset.sure === '1') return true; b.dataset.sure = '1'; b.textContent = 'Click again to close'; setTimeout(() => { b.dataset.sure = ''; b.textContent = 'Close round'; }, 3000); return false; }

/* ===================================================================== */
/* RENDER + EVENTS                                                        */
/* ===================================================================== */
function render(){
  keepUI(() => {
    const app = document.getElementById('app');
    let html;
    if (!CT) html = '<p class="muted">Loading…</p>';
    else if (MODE === 'student') html = renderStudent();
    else if (WATCH) html = watchPage();
    else if (MODE === 'projector') html = !ADMIN ? '<a class="mini" href="/admin">← Back to admin</a><p>Open the admin page first, in this browser.</p>' : A.st ? pjPage(A.st) : 'Loading…';
    else html = renderAdmin();
    app.classList.toggle('wide', (MODE !== 'student' && !WATCH) || !!(V && V.team));
    app.innerHTML = html;
    if (MODE === 'admin' && ADMIN) decorateSections(app);
    if (MODE === 'projector') pjCtl(ADMIN && A.st ? A.st : null);
    const qr = document.getElementById('qr');
    if (qr && window.QRCode && A.st){ try { const qs = MODE === 'projector' ? 320 : 220; new QRCode(qr, {text:location.origin + '/?code=' + encodeURIComponent(A.st.settings.class_code), width:qs, height:qs}); } catch(_){} }
    if (MODE === 'student') observeSeen();
    if (WATCH) watchDecorate();
    if (MODE === 'admin') placeWatchFrame();
  });
  reTip();
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (['pick','text','comment','recall','rdraft'].includes(a)) return;
  if (b.tagName === 'A' && b.getAttribute('href') === '#') e.preventDefault();
  if (WATCH){ if (a === 'tab'){ L.tabPicked = true; studentClick(a, b); } return; }
  if (MODE === 'student') studentClick(a, b); else adminClick(a, b);
});
document.addEventListener('change', e => {
  if (e.target.id === 'medsel'){ A.medPick = e.target.value; A.medTest = null; return render(); }
  const t = e.target;
  if (t.id === 'wf-pick'){ if (t.value) wGo(t.value); return; }
  if (t.id === 'wf-cond' || t.id === 'wf-kind' || t.id === 'wf-team'){ A.wf[t.id.slice(3)] = t.value; return patchWatch(); }
  if (t.id === 'fteam'){ A.fteam = t.value; return render(); }
  if (t.id === 'fnobots'){ A.fnobots = t.checked; return render(); }
  if (t.classList.contains('fkind')){ t.checked ? A.fkinds.add(t.value) : A.fkinds.delete(t.value); return render(); }
  if (t.id === 'consentonly'){ A.consentOnly = t.checked; return refreshAdmin(); }
  if (MODE !== 'student' || !V || !V.team) return;
  if (t.dataset.act === 'pick') return act('pick', {id:t.dataset.id, on:t.checked});
  if (t.dataset.act === 'recall') return act('recall', {id:t.dataset.id, on:t.checked});
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'code'){ L.code = t.value; return; }
  if (t.id === 'wf-q'){ A.wf.q = t.value; return patchWatch(); }
  if (t.id === 'fq'){ A.fq = t.value; return render(); }
  if (t.id === 'peopleq'){ A.q = t.value; return render(); }
  if (MODE !== 'student') return;
  if (t.dataset.act === 'text'){
    if (!L.compose){ L.compose = {start:Date.now(), keys:0, back:0, pastes:0}; track('typing_start', {field:'message'}); }
    L.text = t.value;
    const btn = document.getElementById('sendbtn'); if (btn && V && V.team) btn.disabled = !t.value.trim() || cost(V.team.me.picks) > BUDGET || V.session.paused;
    if (V && V.team) packetLive(V.team.me, CT.cond[V.team.cond].shared, V.session.paused, L.text);
    snap('msg', () => track('draft_snapshot', {text:L.text}));
  }
  if (t.dataset.act === 'comment'){ L.comment = t.value; snap('comment', () => track('comment', {text:L.comment})); }
  if (t.dataset.act === 'rdraft'){ const mid = t.dataset.mid; L.rdraft[mid] = t.value; snap('rc' + mid, () => track('rdraft', {msg:mid, text:L.rdraft[mid]})); }
});
document.addEventListener('keydown', e => {
  if (MODE !== 'student' || e.target.id !== 'composer' || !L.compose) return;
  if (e.key === 'Backspace' || e.key === 'Delete') L.compose.back++; else if (e.key.length === 1) L.compose.keys++;
});
/* Players cannot copy, cut, paste or drag text. Admin pages are not affected. Every try is logged. */
let clipTimer = null;
function clipNote(msg){ let el = document.getElementById('clipnote'); if (!el){ el = document.createElement('div'); el.id = 'clipnote'; el.className = 'clipnote'; document.body.appendChild(el); }
  el.textContent = msg; el.style.display = 'block'; clearTimeout(clipTimer); clipTimer = setTimeout(() => { el.style.display = 'none'; }, 2600); }
function blockClip(e){
  if (MODE !== 'student' || e.target.id === 'code') return;
  e.preventDefault();
  const paste = e.type === 'paste' || e.type === 'drop', txt = paste ? ((e.clipboardData || e.dataTransfer) && (e.clipboardData || e.dataTransfer).getData('text')) || '' : String(window.getSelection() || '');
  if (TOKEN) track(paste ? 'paste_blocked' : 'copy_blocked', {how:e.type, field:e.target.id || e.target.dataset.act || e.target.tagName.toLowerCase(), chars:txt.length, text:txt.slice(0, 500)});
  clipNote(paste ? 'Pasting is turned off. Please type it in your own words.' : 'Copying is turned off. Please put it in your own words.');
}
['copy','cut','paste','drop'].forEach(t => document.addEventListener(t, blockClip, true));
document.addEventListener('dragstart', e => { if (MODE === 'student') e.preventDefault(); }, true);
document.addEventListener('contextmenu', e => { if (MODE === 'student' && !/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); }, true);
document.addEventListener('beforeinput', e => { if (MODE === 'student' && /insertFromPaste|insertFromDrop/.test(e.inputType || '') && e.target.id !== 'code'){ e.preventDefault(); clipNote('Pasting is turned off. Please type it in your own words.'); } }, true);
if (MODE === 'student') document.body.classList.add('noclip');
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (MODE !== 'student' || !TOKEN) return;
  if (document.hidden){ hiddenAt = Date.now(); track('left_app'); }
  else { track('returned_to_app', {away_ms:Date.now() - hiddenAt}); refreshMe(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target.dataset.form;
  if (f === 'join'){
    L.busy = true; render();
    try { const r = await api('/api/join', {code:document.getElementById('code').value}); TOKEN = r.token; localStorage.setItem(TOKEN_KEY, TOKEN); V = r.view; L.joinErr = '';
      connectWS('token=' + encodeURIComponent(TOKEN), onStudentMsg); }
    catch(err){ L.joinErr = err.message; }
    L.busy = false; render();
  }
  if (f === 'pin'){
    try { const r = await api('/api/admin/login', {pin:document.getElementById('pin').value}); ADMIN = r.admin; localStorage.setItem('tds_admin', ADMIN); A.pinErr = '';
      connectWS('admin=' + encodeURIComponent(ADMIN), onAdminMsg); refreshAdmin(); }
    catch(err){ A.pinErr = err.message; render(); }
  }
  if (f === 'bcast') adm('broadcast', {msg:document.getElementById('bcast').value});
});
let meTimer = null;
function onStudentMsg(m){ clearTimeout(meTimer); meTimer = setTimeout(refreshMe, 120); }
function onAdminMsg(m){ if (m.t === 'tick' && A.tab !== 'live' && A.tab !== 'charts' && MODE !== 'projector') return; admSoon(m.t === 'tick' ? 50 : 500); }

(async function boot(){
  CT = await api('/api/content'); BUDGET = CT.budget; CT.features.forEach(f => FEAT[f.id] = f);
  if (MODE === 'student'){
    TOKEN = localStorage.getItem(TOKEN_KEY);
    if (TOKEN){ await refreshMe(); if (TOKEN) connectWS('token=' + encodeURIComponent(TOKEN), onStudentMsg); }
    setInterval(() => { if (TOKEN && WS && WS.readyState !== 1) refreshMe(); }, 5000);   // fallback if live updates drop
  } else if (WATCH){
    if (ADMIN){ connectWS('admin=' + encodeURIComponent(ADMIN), m => { if (m.t !== 'tick') watchSoon(200); }); await refreshWatch(); setInterval(() => { if (!WS || WS.readyState !== 1) refreshWatch(); }, 4000); }
  } else if (ADMIN){
    connectWS('admin=' + encodeURIComponent(ADMIN), onAdminMsg);
    await refreshAdmin();
    setInterval(() => { if (WS && WS.readyState !== 1) refreshAdmin(); }, 5000);
  }
  render();
})();
