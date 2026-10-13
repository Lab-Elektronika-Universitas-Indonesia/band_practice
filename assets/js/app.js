/*
 * Resistor color code practice - application logic
 * Copyright (C) 2026 YOUR NAME HERE
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. See the LICENSE file for the full text.
 */

const COLORS = {
  black:  {name:'Black',  hex:'#1b1b1b', digit:0, mult:0, tc:250},
  brown:  {name:'Brown',  hex:'#7b4a22', digit:1, mult:1, tol:1, tc:100},
  red:    {name:'Red',    hex:'#d0302a', digit:2, mult:2, tol:2, tc:50},
  orange: {name:'Orange', hex:'#ef7a17', digit:3, mult:3, tc:15},
  yellow: {name:'Yellow', hex:'#f1d11c', digit:4, mult:4, tc:25},
  green:  {name:'Green',  hex:'#2c9a45', digit:5, mult:5, tol:0.5, tc:20},
  blue:   {name:'Blue',   hex:'#2a60d4', digit:6, mult:6, tol:0.25, tc:10},
  violet: {name:'Violet', hex:'#8a3fc9', digit:7, mult:7, tol:0.1, tc:5},
  grey:   {name:'Grey',   hex:'#8d8f92', digit:8, mult:8, tc:1},
  white:  {name:'White',  hex:'#f4f4f2', digit:9, mult:9},
  gold:   {name:'Gold',   hex:'#c9a032', mult:-1, tol:5},
  silver: {name:'Silver', hex:'#b9bdc3', mult:-2, tol:10},
};
const ORDER = Object.keys(COLORS);
const DIGIT = ['black','brown','red','orange','yellow','green','blue','violet','grey','white'];
const TOL4 = ['brown','red','gold','silver'];
const TOL5 = ['violet','blue','green','brown','red','gold'];
const TCS  = ['violet','blue','orange','yellow','red','brown'];
const E24 = [10,11,12,13,15,16,18,20,22,24,27,30,33,36,39,43,47,51,56,62,68,75,82,91];
const E96 = [100,102,105,107,110,113,115,118,121,124,127,130,133,137,140,143,147,150,154,158,162,165,169,174,178,182,187,191,196,200,205,210,215,221,226,232,237,243,249,255,261,267,274,280,287,294,301,309,316,324,332,340,348,357,365,374,383,392,402,412,422,432,442,453,464,475,487,499,511,523,536,549,562,576,590,604,619,634,649,665,681,698,715,732,750,768,787,806,825,845,866,887,909,931,953,976];
const POS = {4:[126,196,248,452], 5:[126,190,240,290,452], 6:[126,184,232,280,410,462]};
const BW = 22;

const state = {mode:'read', n:4, flipOn:true, p:null, flipped:false, answered:false,
  tol:null, tc:null, build:[], sel:0, stats:{right:0,total:0,streak:0,best:0}};
try { state.stats.best = parseInt(localStorage.getItem('rcc-best')||'0',10)||0; } catch(e){}

const $ = s => document.querySelector(s);
const pick = a => a[Math.floor(Math.random()*a.length)];
const wpick = pairs => { let t = pairs.reduce((s,p)=>s+p[1],0), r = Math.random()*t; for (const [v,w] of pairs){ if((r-=w)<0) return v; } return pairs[0][0]; };
const multColor = e => e===-2?'silver':e===-1?'gold':DIGIT[e];
const nice = x => parseFloat(x.toPrecision(4)).toString();

function fmtOhms(c){ // c = value in hundredths of an ohm
  const o = c/100;
  if (o >= 1e9) return nice(o/1e9)+' GΩ';
  if (o >= 1e6) return nice(o/1e6)+' MΩ';
  if (o >= 1e3) return nice(o/1e3)+' kΩ';
  return nice(o)+' Ω';
}
function fmtMult(e){
  const v = Math.pow(10,e);
  if (e<0) return '×'+nice(v);
  if (e>=9) return '×'+nice(v/1e9)+'G';
  if (e>=6) return '×'+nice(v/1e6)+'M';
  if (e>=3) return '×'+nice(v/1e3)+'k';
  return '×'+v;
}
const fmtTol = t => '±'+t+'%';
const fmtTc = t => t+' ppm/K';
const bodyColor = n => n===4 ? '#dcc092' : '#8db4d6';

function slotType(n,i){
  const d = n===4?2:3;
  if (i<d) return 'digit';
  if (i===d) return 'mult';
  if (i===d+1) return 'tol';
  return 'tc';
}

function genProblem(n){
  let digits, exp, tol, tc=null;
  if (n===4){
    digits = pick(E24);
    exp = wpick([[-1,1],[0,3],[1,4],[2,5],[3,5],[4,3],[5,2]]);
    tol = wpick([['gold',6],['silver',1],['brown',2],['red',1]]);
  } else {
    digits = Math.random()<.55 ? pick(E96) : pick(E24)*10;
    exp = wpick([[-2,1],[-1,2],[0,4],[1,5],[2,5],[3,3],[4,2]]);
    tol = wpick([['brown',6],['red',2],['green',1],['blue',1],['violet',1],['gold',1]]);
    if (n===6) tc = wpick([['brown',4],['red',2],['orange',1],['yellow',1],['blue',1],['violet',1]]);
  }
  const bands = String(digits).split('').map(d=>DIGIT[+d]);
  bands.push(multColor(exp), tol);
  if (tc) bands.push(tc);
  return {n, bands, c: digits*Math.pow(10,exp+2), tol, tc, digits, exp};
}

function parseValue(raw){
  let s = raw.trim().toLowerCase().replace(/ω|Ω|ohms?|\s|,/g,'').replace(/meg$/,'m');
  if (!s) return null;
  const mulOf = ch => ch==='k'?1e3 : ch==='m'?1e6 : ch==='g'?1e9 : 1;
  let m = s.match(/^(\d*)([rkmg])(\d+)$/);            // 4k7, r47, 1m5
  if (m){ const v = parseFloat((m[1]||'0')+'.'+m[3]) * mulOf(m[2]); return Math.round(v*100); }
  m = s.match(/^(\d+\.?\d*|\.\d+)([rkmg]?)$/);         // 4.7k, 470, 1m
  if (m){ const v = parseFloat(m[1]) * mulOf(m[2]); return Math.round(v*100); }
  return null;
}

function readBands(n, bands){ // returns {c, tol, tc} or null if incomplete
  if (bands.some(b=>!b)) return null;
  const d = n===4?2:3;
  const digits = parseInt(bands.slice(0,d).map(b=>COLORS[b].digit).join(''),10);
  const exp = COLORS[bands[d]].mult;
  return {c: Math.round(digits*Math.pow(10,exp+2)), tol: COLORS[bands[d+1]].tol, tc: n===6?COLORS[bands[d+2]].tc:null};
}

function meaning(n,i,color){
  const t = slotType(n,i), c = COLORS[color];
  if (t==='digit') return String(c.digit);
  if (t==='mult') return fmtMult(c.mult);
  if (t==='tol') return fmtTol(c.tol);
  return fmtTc(c.tc);
}

function resistorSVG(bands, n, opt={}){
  const pos = POS[n], flip = !!opt.flip;
  const xAt = i => flip ? 600 - pos[i] - BW : pos[i];
  const body = 'M120 30C95 30 90 45 90 80C90 115 95 130 120 130C150 130 160 120 185 120L415 120C440 120 450 130 480 130C505 130 510 115 510 80C510 45 505 30 480 30C450 30 440 40 415 40L185 40C160 40 150 30 120 30Z';
  let s = `<svg viewBox="0 0 600 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Resistor with ${n} color bands">
  <defs>
    <clipPath id="bc"><path d="${body}"/></clipPath>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".28"/>
      <stop offset=".22" stop-color="#fff" stop-opacity=".42"/>
      <stop offset=".38" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".72" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".38"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8f6d1d"/><stop offset=".45" stop-color="#f2d57a"/><stop offset="1" stop-color="#a47b22"/>
    </linearGradient>
    <linearGradient id="silver" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#8d9298"/><stop offset=".45" stop-color="#eef0f3"/><stop offset="1" stop-color="#9a9fa6"/>
    </linearGradient>
    <linearGradient id="leadg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3e7ea"/><stop offset=".5" stop-color="#a6aeb3"/><stop offset="1" stop-color="#6f777c"/>
    </linearGradient>
    <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="#ffffff" fill-opacity=".35"/><line x1="0" y1="0" x2="0" y2="7" stroke="#000" stroke-opacity=".3" stroke-width="2.5"/>
    </pattern>
  </defs>
  <rect x="0" y="76" width="110" height="8" rx="4" fill="url(#leadg)"/>
  <rect x="490" y="76" width="110" height="8" rx="4" fill="url(#leadg)"/>
  <path d="${body}" fill="${bodyColor(n)}"/>
  <g clip-path="url(#bc)">`;
  bands.forEach((b,i)=>{
    const x = xAt(i);
    if (b){
      const fill = b==='gold'?'url(#gold)':b==='silver'?'url(#silver)':COLORS[b].hex;
      s += `<rect x="${x}" y="0" width="${BW}" height="160" fill="${fill}"/>`;
    } else {
      s += `<rect x="${x}" y="0" width="${BW}" height="160" fill="url(#hatch)"/>`;
    }
  });
  s += `</g><path d="${body}" fill="url(#shade)"/><path d="${body}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="1.5"/>`;
  if (opt.interactive){
    bands.forEach((b,i)=>{
      const x = xAt(i), on = i===opt.sel;
      const label = `Band ${i+1}, ${slotType(n,i)==='tc'?'temperature coefficient':slotType(n,i)==='tol'?'tolerance':slotType(n,i)==='mult'?'multiplier':'digit'}: ${b?COLORS[b].name:'empty'}`;
      s += `<g class="slot" data-slot="${i}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${label}">
        <rect x="${x-9}" y="4" width="${BW+18}" height="152" fill="transparent"/>
        <rect class="ring" x="${x-4}" y="10" width="${BW+8}" height="140" rx="6" fill="none" style="stroke:${on?'var(--ink)':'transparent'}" stroke-width="${on?2.5:0}"/>
        ${on?`<path d="M${x+BW/2-7} 0 L${x+BW/2+7} 0 L${x+BW/2} 8Z" style="fill:var(--ink)"/>`:''}
      </g>`;
    });
  }
  return s + '</svg>';
}

function renderStats(){
  const st = state.stats;
  $('#sStreak').textContent = st.streak;
  $('#sBest').textContent = st.best;
  $('#sScore').textContent = st.right+'/'+st.total;
}
function record(ok){
  const st = state.stats;
  st.total++;
  if (ok){ st.right++; st.streak++; if (st.streak>st.best){ st.best=st.streak; try{localStorage.setItem('rcc-best',String(st.best));}catch(e){} } }
  else st.streak = 0;
  renderStats();
}

function renderControls(){
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.mode===state.mode));
  document.querySelectorAll('[data-bands]').forEach(b=>b.setAttribute('aria-pressed', +b.dataset.bands===state.n));
  $('#flipWrap').style.display = state.mode==='read' ? '' : 'none';
}

function breakdownHTML(p){
  return `<ul class="breakdown">${p.bands.map((b,i)=>`<li><span class="sw" style="background:${COLORS[b].hex}"></span>${COLORS[b].name} ${meaning(p.n,i,b)}</li>`).join('')}</ul>`;
}
function answerText(p){
  return fmtOhms(p.c)+' '+fmtTol(COLORS[p.tol].tol)+(p.tc?', '+fmtTc(COLORS[p.tc].tc):'');
}

function newProblem(){
  state.p = genProblem(state.n);
  state.flipped = state.mode==='read' && state.flipOn && Math.random()<.35;
  state.answered = false; state.tol = null; state.tc = null;
  state.build = new Array(state.n).fill(null); state.sel = 0;
  render(true);
}

function render(focus){
  renderControls();
  const p = state.p, stage = $('#stage');
  if (state.mode==='read'){
    stage.innerHTML = resistorSVG(p.bands, p.n, {flip: state.flipped});
    renderRead(focus);
  } else {
    stage.innerHTML = resistorSVG(state.build, p.n, {interactive: !state.answered, sel: state.sel});
    renderBuild();
  }
}

function renderRead(focus){
  const p = state.p, n = p.n;
  const tols = (n===4?TOL4:TOL5).slice().sort((a,b)=>COLORS[a].tol-COLORS[b].tol);
  const tcs = TCS.slice().sort((a,b)=>COLORS[a].tc-COLORS[b].tc);
  const dis = state.answered ? 'disabled' : '';
  $('#panel').innerHTML = `
    <p class="prompt">What does this resistor read?</p>
    <div class="row">
      <label class="lbl" for="val">Resistance</label>
      <input type="text" id="val" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="4.7k or 4k7" ${dis}>
      <span class="unit">Ω</span>
    </div>
    <div class="row">
      <span class="lbl" id="tolLbl">Tolerance</span>
      <div class="chips" role="group" aria-labelledby="tolLbl">
        ${tols.map(c=>`<button class="chip" data-tol="${c}" aria-pressed="${state.tol===c}" ${dis}>${fmtTol(COLORS[c].tol)}</button>`).join('')}
      </div>
    </div>
    ${n===6?`<div class="row">
      <span class="lbl" id="tcLbl">Temp. coeff.</span>
      <div class="chips" role="group" aria-labelledby="tcLbl">
        ${tcs.map(c=>`<button class="chip" data-tc="${c}" aria-pressed="${state.tc===c}" ${dis}>${fmtTc(COLORS[c].tc)}</button>`).join('')}
      </div></div>`:''}
    <div class="actions">
      ${state.answered ? '<button class="primary" id="next">Next resistor</button>' : '<button class="primary" id="check">Check answer</button><button class="ghost" id="skip">Skip</button>'}
    </div>
    <div class="feedback" id="fb" aria-live="polite"></div>
    ${state.answered?'':'<p class="hint">Enter works for checking. Values like 470, 4.7k, 4k7, 1M5, and 0R47 are all fine.</p>'}`;
  const val = $('#val');
  document.querySelectorAll('[data-tol]').forEach(b=>b.onclick=()=>{ state.tol=b.dataset.tol; document.querySelectorAll('[data-tol]').forEach(x=>x.setAttribute('aria-pressed', x===b)); });
  document.querySelectorAll('[data-tc]').forEach(b=>b.onclick=()=>{ state.tc=b.dataset.tc; document.querySelectorAll('[data-tc]').forEach(x=>x.setAttribute('aria-pressed', x===b)); });
  if (!state.answered){
    $('#check').onclick = checkRead;
    $('#skip').onclick = ()=>{ record(false); showReadResult(false, 'Skipped.', null); };
    val.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); checkRead(); }});
    if (focus && matchMedia('(pointer:fine)').matches) val.focus();
  }
}

function checkRead(){
  const p = state.p, fb = $('#fb');
  const c = parseValue($('#val').value);
  if (c===null){ fb.innerHTML = '<p class="err">Enter a value like 470, 4.7k or 4k7.</p>'; return; }
  if (!state.tol){ fb.innerHTML = '<p class="err">Pick a tolerance too.</p>'; return; }
  if (p.n===6 && !state.tc){ fb.innerHTML = '<p class="err">Pick a temperature coefficient too.</p>'; return; }
  const vOk = c===p.c, tOk = COLORS[state.tol].tol===COLORS[p.tol].tol, cOk = p.n!==6 || COLORS[state.tc].tc===COLORS[p.tc].tc;
  const ok = vOk && tOk && cOk;
  record(ok);
  const miss = [];
  if (!vOk) miss.push(`you entered ${fmtOhms(c)}`);
  if (!tOk) miss.push('tolerance is off');
  if (!cOk) miss.push('temperature coefficient is off');
  showReadResult(ok, ok ? pick(['Correct.','Nailed it.','Right on.','Correct, nice reading.']) : 'Not quite: '+miss.join(', ')+'.', $('#val').value);
}

function showReadResult(ok, msg, typed){
  state.answered = true;
  const keepTol = state.tol, keepTc = state.tc;
  renderRead(false);
  if (typed!==null) $('#val').value = typed;
  const p = state.p;
  $('#fb').innerHTML = `<div class="pop">
    <p class="verdict ${ok?'ok':'bad'}">${msg}</p>
    <p class="note">This one is ${answerText(p)}.${state.flipped?' It was shown flipped: the tolerance band sits apart from the others, so read from the far end.':''}</p>
    ${breakdownHTML(p)}</div>`;
  $('#next').onclick = newProblem;
  $('#next').focus();
}

function paletteFor(n,i){
  const t = slotType(n,i);
  if (t==='digit') return i===0 ? DIGIT.slice(1) : DIGIT;
  if (t==='mult') return [...DIGIT, 'gold', 'silver'];
  if (t==='tol') return n===4 ? TOL4 : TOL5;
  return TCS;
}
const slotNames = {digit:'digit', mult:'multiplier', tol:'tolerance', tc:'temperature coefficient'};

function renderBuild(){
  const p = state.p, n = p.n, i = state.sel, t = slotType(n,i);
  const full = state.build.every(Boolean);
  const pal = paletteFor(n,i);
  $('#panel').innerHTML = `
    <p class="prompt">Color the bands for</p>
    <p class="target">${answerText(p)}</p>
    ${state.answered ? '' : `
    <p class="note">Band ${i+1} of ${n} is the ${slotNames[t]}. Tap a band on the resistor to change which one you're setting.</p>
    <div class="palette" role="group" aria-label="Colors for band ${i+1}">
      ${pal.map(c=>`<button class="chip" data-color="${c}" aria-pressed="${state.build[i]===c}"><span><span class="sw" style="background:${COLORS[c].hex}"></span>${COLORS[c].name}</span><small>${meaning(n,i,c)}</small></button>`).join('')}
    </div>`}
    <div class="actions">
      ${state.answered ? '<button class="primary" id="next">Next value</button>'
        : `<button class="primary" id="check" ${full?'':'disabled'}>Check bands</button><button class="ghost" id="clear">Clear</button><button class="ghost" id="skip">Skip</button>`}
    </div>
    <div class="feedback" id="fb" aria-live="polite"></div>`;
  document.querySelectorAll('.slot').forEach(g=>{
    const go = ()=>{ state.sel = +g.dataset.slot; render(); const f = document.querySelector(`.slot[data-slot="${state.sel}"]`); f && f.focus(); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); }});
  });
  document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{
    state.build[state.sel] = b.dataset.color;
    const nextEmpty = state.build.findIndex((x,k)=>!x && k>state.sel);
    const anyEmpty = state.build.findIndex(x=>!x);
    state.sel = nextEmpty>=0 ? nextEmpty : anyEmpty>=0 ? anyEmpty : state.sel;
    render();
    const f = state.build.every(Boolean) ? $('#check') : document.querySelector(`[data-color]`);
    f && f.focus();
  });
  if (!state.answered){
    $('#check').onclick = checkBuild;
    $('#clear').onclick = ()=>{ state.build = new Array(n).fill(null); state.sel = 0; render(); };
    $('#skip').onclick = ()=>{ record(false); finishBuild(false, 'Skipped.', null); };
  } else {
    $('#next').onclick = newProblem;
  }
}

function checkBuild(){
  const p = state.p, got = readBands(p.n, state.build);
  if (!got) return;
  const vOk = got.c===p.c, tOk = got.tol===COLORS[p.tol].tol, cOk = p.n!==6 || got.tc===COLORS[p.tc].tc;
  const ok = vOk && tOk && cOk;
  record(ok);
  finishBuild(ok, ok ? pick(['Correct.','Those bands are right.','Spot on.']) : 'Not quite.', got);
}

function finishBuild(ok, msg, got){
  const p = state.p, mine = state.build.slice();
  state.answered = true;
  if (!ok) state.build = p.bands.slice();
  render();
  let yours = '';
  if (got && !ok){
    yours = `<p class="note">Your bands read ${fmtOhms(got.c)} ${fmtTol(got.tol)}${p.n===6?', '+fmtTc(got.tc):''}:</p>
      <ul class="breakdown">${mine.map((b,i)=>`<li><span class="sw" style="background:${COLORS[b].hex}"></span>${COLORS[b].name} ${meaning(p.n,i,b)}</li>`).join('')}</ul>`;
  }
  $('#fb').innerHTML = `<div class="pop">
    <p class="verdict ${ok?'ok':'bad'}">${msg}</p>
    ${yours}
    <p class="note" style="margin-top:.8rem">${ok?'The breakdown:':'The resistor above now shows the right bands:'}</p>
    ${breakdownHTML(p)}</div>`;
  $('#next').focus();
}

function renderChart(){
  const rows = ORDER.map(k=>{
    const c = COLORS[k];
    return `<tr><td><span class="sw" style="background:${c.hex}"></span>${c.name}</td>
      <td class="${c.digit===undefined?'dim':''}">${c.digit===undefined?'none':c.digit}</td>
      <td>${fmtMult(c.mult)}</td>
      <td class="${c.tol===undefined?'dim':''}">${c.tol===undefined?'none':fmtTol(c.tol)}</td>
      <td class="${c.tc===undefined?'dim':''}">${c.tc===undefined?'none':fmtTc(c.tc)}</td></tr>`;
  }).join('');
  $('#chart').innerHTML = `<thead><tr><th>Color</th><th>Digit</th><th>Multiplier</th><th>Tolerance</th><th>Temp. coeff.</th></tr></thead><tbody>${rows}</tbody>`;
}

document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ if(state.mode!==b.dataset.mode){ state.mode=b.dataset.mode; newProblem(); }});
document.querySelectorAll('[data-bands]').forEach(b=>b.onclick=()=>{ if(state.n!==+b.dataset.bands){ state.n=+b.dataset.bands; newProblem(); }});
$('#flip').onchange = e=>{ state.flipOn = e.target.checked; };

renderChart();
renderStats();
newProblem();
