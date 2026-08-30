#!/usr/bin/env node
/**
 * Builds the human-review page for an ingested paper.
 *
 * The review is the gate before anything reaches the database, so this page
 * has one job: put the handful of genuine judgement calls first, and keep the
 * other ninety-odd questions one click away for spot-checking. Styling follows
 * Foundations v1 (work mode) so it reads as part of Sarthi.
 *
 *   node scripts/build-review.mjs seed/questions-gs1-2026.json
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const file = process.argv[2] ?? 'seed/questions-gs1-2026.json'
const data = JSON.parse(fs.readFileSync(path.resolve(root, file), 'utf8'))

const satoshi = fs.readFileSync(path.join(root, 'app', 'fonts', 'Satoshi-Variable.woff2')).toString('base64')

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Minimal markdown: **bold**, *italic*, "- " lists, blank-line paragraphs. */
function md(src) {
  if (!src) return ''
  const inline = (t) =>
    esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  const blocks = String(src).split(/\n{2,}/)
  return blocks
    .map((b) => {
      const lines = b.split('\n')
      if (lines.every((l) => l.trim().startsWith('- '))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.trim().slice(2))}</li>`).join('')}</ul>`
      }
      return `<p>${lines.map((l) => inline(l)).join('<br>')}</p>`
    })
    .join('')
}

const subjects = JSON.parse(fs.readFileSync(path.join(root, 'seed', 'subjects.json'), 'utf8'))
const topics = JSON.parse(fs.readFileSync(path.join(root, 'seed', 'topics.json'), 'utf8'))
const subjName = Object.fromEntries(subjects.map((s) => [s.code, s.name]))
const subjColour = Object.fromEntries(subjects.map((s) => [s.code, s.colour]))
const topicName = Object.fromEntries(topics.map((t) => [t.code, t.name]))

const qs = data.questions
const needsJudgement = qs.filter((q) => q.review_flag || q.tagging_confidence === 'low')
const flaggedNos = new Set(needsJudgement.map((q) => q.q_no))

function card(q) {
  const flagged = flaggedNos.has(q.q_no)
  const letters = ['a', 'b', 'c', 'd']
  const opts = q.options
    .map((o, i) => {
      const isKey = q.answer === letters[i]
      const isMine = q.independent_answer?.answer === letters[i]
      const marks = [isKey ? 'key' : null, isMine && !isKey ? 'mine' : null].filter(Boolean)
      return `<li class="opt${isKey ? ' opt-key' : ''}${isMine && !isKey ? ' opt-mine' : ''}">
        <span class="opt-letter">${letters[i]}</span>
        <span class="opt-text">${esc(o)}</span>
        ${marks.length ? `<span class="opt-mark">${marks.join(' · ')}</span>` : ''}
      </li>`
    })
    .join('')

  const topicChips = (q.topic_codes ?? [])
    .map(
      (c) =>
        `<span class="chip${c === q.primary_topic_code ? ' chip-primary' : ''}" title="${esc(topicName[c] ?? c)}">${esc(c)}</span>`,
    )
    .join('')

  const notes = []
  if (q.review_flag) notes.push(`<div class="note note-flag"><b>Decide</b>${md(q.review_flag)}</div>`)
  if (q.key_doubt) notes.push(`<div class="note note-flag"><b>Key not verified</b>${md(q.key_doubt)}</div>`)
  if (q.tagging_confidence === 'low')
    notes.push(`<div class="note note-flag"><b>No topic fits</b>${md(q.tagging_note)}</div>`)
  if (q.independent_answer?.ambiguity_note)
    notes.push(`<div class="note"><b>Ambiguity noted</b>${md(q.independent_answer.ambiguity_note)}</div>`)

  const ia = q.independent_answer
  const agree = ia && q.answer && ia.answer === q.answer

  return `<article class="q${flagged ? ' q-flagged' : ''}" data-flagged="${flagged}" data-q="${q.q_no}">
    <header class="q-head">
      <label class="tick"><input type="checkbox" data-check="${q.q_no}"><span></span></label>
      <span class="q-no">Q${q.q_no}</span>
      <span class="mono dot" style="--dot:${subjColour[q.subject_code] ?? '#a3a3a3'}">${esc(q.subject_code ?? '—')}</span>
      <span class="mono muted">${esc(q.format ?? '')}</span>
      <span class="mono muted right">p${q.page}</span>
    </header>
    <div class="stem">${md(q.stem)}</div>
    <ul class="opts">${opts}</ul>
    <div class="verdict">
      ${
        q.dropped_by_upsc
          ? `<span class="pill pill-flag">dropped by UPSC — excluded</span>`
          : `<span class="pill">key <b>${esc(q.answer)}</b> · ${esc(q.answer_source)}</span>
             ${ia ? `<span class="pill ${agree ? '' : 'pill-flag'}">blind check <b>${esc(ia.answer)}</b>${agree ? ' · agrees' : ' · differs'}</span>` : ''}
             ${ia?.beyond_knowledge ? `<span class="pill pill-quiet">past my cutoff</span>` : ''}`
      }
      <span class="topics">${topicChips}</span>
    </div>
    ${notes.join('')}
    ${q.explanation_md ? `<details class="expl"><summary>Explanation</summary><div>${md(q.explanation_md)}</div></details>` : ''}
  </article>`
}

const agreeCount = qs.filter((q) => q.answer && q.independent_answer?.answer === q.answer).length
const scored = qs.filter((q) => !q.dropped_by_upsc).length

const html = `<title>GS1 2026 Review</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Space+Mono:wght@400;700&display=swap">
<style>
@font-face{font-family:'Satoshi';src:url(data:font/woff2;base64,${satoshi}) format('woff2');font-weight:300 900;font-display:swap}

:root{
  --bg:#FAFAF7; --surface:#FFFFFF; --ink:#16181D; --muted:#6B7280; --line:#ECEAE4;
  --accent:#FF6B5E; --accent-deep:#E85546; --flag-bg:#FFF1EF; --key-bg:#F3F6F3; --key-line:#CBD8CB;
  --shadow:0 2px 8px rgba(22,24,29,.06);
  --display:'Bricolage Grotesque',ui-sans-serif,system-ui,sans-serif;
  --body:'Satoshi',ui-sans-serif,system-ui,sans-serif;
  --mono:'Space Mono',ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#131519; --surface:#1B1E24; --ink:#F2F0EA; --muted:#9AA1AD; --line:#2A2E37;
    --accent:#FF7D71; --accent-deep:#FF9A90; --flag-bg:#2C1F1D; --key-bg:#1B241E; --key-line:#33452F;
    --shadow:0 2px 10px rgba(0,0,0,.35);
  }
}
:root[data-theme="dark"]{
  --bg:#131519; --surface:#1B1E24; --ink:#F2F0EA; --muted:#9AA1AD; --line:#2A2E37;
  --accent:#FF7D71; --accent-deep:#FF9A90; --flag-bg:#2C1F1D; --key-bg:#1B241E; --key-line:#33452F;
  --shadow:0 2px 10px rgba(0,0,0,.35);
}

*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);line-height:1.6;margin:0;
  padding:0 20px 96px;-webkit-text-size-adjust:100%}
.wrap{max-width:820px;margin:0 auto}
.mono{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.muted{color:var(--muted)}
.right{margin-left:auto}

header.top{padding:40px 0 20px}
h1{font-family:var(--display);font-weight:800;font-size:clamp(30px,5vw,44px);line-height:1.05;
  letter-spacing:-.02em;margin:6px 0 8px;text-wrap:balance}
.sub{color:var(--muted);max-width:62ch;margin:0}

.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;margin:22px 0 8px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;box-shadow:var(--shadow)}
.stat b{font-family:var(--mono);font-weight:700;font-size:22px;display:block;font-variant-numeric:tabular-nums}
.stat span{color:var(--muted);font-size:12.5px}
.stat-flag b{color:var(--accent-deep)}

.bar{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 92%,transparent);
  backdrop-filter:blur(8px);border-bottom:1px solid var(--line);
  display:flex;gap:8px;align-items:center;padding:12px 0;margin:18px 0 0}
button.tab{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  border:1px solid var(--line);background:var(--surface);color:var(--ink);
  padding:9px 14px;border-radius:999px;cursor:pointer}
button.tab[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
button.tab:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.progress{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}

.q{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:18px;
  margin:14px 0;box-shadow:var(--shadow)}
.q-flagged{border-color:var(--accent);border-left-width:4px}
.q-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.q-no{font-family:var(--mono);font-weight:700;font-size:14px}
.dot{display:inline-flex;align-items:center;gap:5px}
.dot::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--dot)}
.tick{display:inline-flex;align-items:center;cursor:pointer}
.tick input{position:absolute;opacity:0;width:0;height:0}
.tick span{width:18px;height:18px;border:1.5px solid var(--line);border-radius:6px;display:block}
.tick input:checked+span{background:var(--ink);border-color:var(--ink);
  background-image:linear-gradient(transparent,transparent)}
.tick input:checked+span::after{content:"✓";color:var(--bg);font-size:12px;display:block;
  text-align:center;line-height:15px}
.tick input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}

.stem{margin:0 0 12px}
.stem p{margin:0 0 8px}
.stem ul{margin:6px 0;padding-left:22px}
.opts{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.opt{display:flex;gap:9px;align-items:flex-start;padding:8px 10px;border-radius:10px;
  border:1px solid transparent}
.opt-key{background:var(--key-bg);border-color:var(--key-line)}
.opt-mine{border-color:var(--accent);border-style:dashed}
.opt-letter{font-family:var(--mono);font-weight:700;font-size:12px;padding-top:2px}
.opt-text{flex:1}
.opt-mark{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);white-space:nowrap;padding-top:3px}

.verdict{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:12px}
.pill{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;
  border:1px solid var(--line);border-radius:999px;padding:5px 10px;color:var(--muted)}
.pill b{color:var(--ink);font-weight:700}
.pill-flag{border-color:var(--accent);color:var(--accent-deep);background:var(--flag-bg)}
.pill-flag b{color:var(--accent-deep)}
.pill-quiet{opacity:.7}
.topics{display:flex;gap:5px;flex-wrap:wrap;margin-left:auto}
.chip{font-family:var(--mono);font-size:10px;letter-spacing:.06em;background:var(--bg);
  border:1px solid var(--line);border-radius:6px;padding:3px 7px;color:var(--muted)}
.chip-primary{color:var(--ink);border-color:var(--muted)}

.note{margin-top:11px;padding:11px 13px;border-radius:12px;background:var(--bg);
  border:1px solid var(--line);font-size:14.5px}
.note-flag{background:var(--flag-bg);border-color:var(--accent)}
.note b{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;margin-bottom:4px;color:var(--accent-deep)}
.note p{margin:0 0 6px}
.note p:last-child{margin:0}

.expl{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}
.expl summary{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);cursor:pointer}
.expl summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.expl>div{margin-top:9px;font-size:15px}
.expl p{margin:0 0 9px}
.expl ul{margin:8px 0;padding-left:20px}
.expl li{margin-bottom:5px}

footer{margin-top:36px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:13.5px}
code{font-family:var(--mono);font-size:12.5px;background:var(--bg);border:1px solid var(--line);
  border-radius:5px;padding:1px 5px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
<header class="top">
  <div class="mono muted">${esc(data.paper)} · ${data.year} · series ${esc(data.booklet_series)} · ${esc(data.code)}</div>
  <h1>Review before this becomes study material</h1>
  <p class="sub">Every question below was transcribed from the scanned paper, checked by a second independent pass, and matched against the official UPSC provisional key. Nothing reaches the database until you say so. Work the flagged items — the rest is here for spot-checking.</p>

  <div class="stats">
    <div class="stat"><b>${qs.length}</b><span>transcribed, none missing</span></div>
    <div class="stat"><b>${agreeCount}/${scored}</b><span>key matched blind check</span></div>
    <div class="stat stat-flag"><b>${needsJudgement.length}</b><span>need your judgement</span></div>
    <div class="stat"><b>${qs.filter((q) => q.explanation_md).length}</b><span>explanations written</span></div>
  </div>
</header>

<div class="bar">
  <button class="tab" id="tab-flag" aria-pressed="true">Needs judgement (${needsJudgement.length})</button>
  <button class="tab" id="tab-all" aria-pressed="false">All ${qs.length}</button>
  <span class="progress" id="progress"></span>
</div>

<main id="list">
${qs.map(card).join('\n')}
</main>

<footer>
  <p><b>Key:</b> ${esc(data.answer_key?.source)} · Series ${esc(data.answer_key?.series)} · released ${esc(data.answer_key?.released)}. ${esc(data.answer_key?.note)}</p>
  <p>Explanations were written from subject knowledge for this bank, never copied from a published solution.</p>
  <p>When you're satisfied, tell me and I'll set <code>reviewed_by_human: true</code> and load it with <code>--confirm</code>. Your ticks are remembered in this browser only.</p>
</footer>
</div>

<script>
(function(){
  var list=document.getElementById('list');
  var tabFlag=document.getElementById('tab-flag');
  var tabAll=document.getElementById('tab-all');
  var progress=document.getElementById('progress');
  var KEY='sarthi-review-gs1-2026';

  function load(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch(e){ return {}; } }
  function save(s){ try{ localStorage.setItem(KEY,JSON.stringify(s)); }catch(e){} }
  var state=load();

  Array.prototype.forEach.call(document.querySelectorAll('[data-check]'),function(box){
    var n=box.getAttribute('data-check');
    if(state[n]) box.checked=true;
    box.addEventListener('change',function(){
      if(box.checked) state[n]=1; else delete state[n];
      save(state); paint();
    });
  });

  function paint(){
    var done=Object.keys(state).length;
    progress.textContent=done+' checked';
  }

  function show(onlyFlagged){
    Array.prototype.forEach.call(list.children,function(el){
      var f=el.getAttribute('data-flagged')==='true';
      el.style.display=(!onlyFlagged||f)?'':'none';
    });
    tabFlag.setAttribute('aria-pressed',String(onlyFlagged));
    tabAll.setAttribute('aria-pressed',String(!onlyFlagged));
  }

  tabFlag.addEventListener('click',function(){ show(true); });
  tabAll.addEventListener('click',function(){ show(false); });
  show(true); paint();
})();
</script>
`

const out = path.join(root, '.ingest', 'review-gs1-2026.html')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, html)
console.log(`wrote ${out} — ${Math.round(fs.statSync(out).size / 1024)}KB`)
console.log(`  ${qs.length} questions · ${needsJudgement.length} need judgement · ${agreeCount}/${scored} key agreement`)
