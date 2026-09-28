// 출제·채점 로직 점검: node tools/test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(dir + '/index.html', 'utf8');
const script = html.split("<script>\n'use strict';")[1].split('// ───────── 화면 공통')[0];
const mem = {};
const ctx = { window: {}, localStorage: { getItem: k => mem[k] || null, setItem: (k, v) => { mem[k] = v; } }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(dir + '/data.js', 'utf8'), ctx);
vm.runInContext(script + `;this.T = { buildExam, gradeQuestion, calcScore, GRADES, SUBJECT_ORDER, examKey, DATA, store };`, ctx);
const T = ctx.T;
let problems = 0;
for (const s of T.SUBJECT_ORDER) for (const g of T.GRADES) {
  const key = T.examKey(s, g);
  const pool = s === 'memo' ? null : T.DATA[s][g].groups.reduce((a, gr) => a + gr.items.length, 0);
  const cycleTries = s === 'memo' ? 5 : Math.min(...T.DATA[s][g].groups.map(gr => Math.floor(gr.items.length / gr.count)));
  const seen = new Set(); let repeatsInCycle = 0, sameAsPrev = 0, prev = '';
  for (let t = 0; t < 40; t++) {
    const ex = T.buildExam(key);
    if (ex.questions.length !== 10) { console.log('COUNT', key, ex.questions.length); problems++; }
    const ids = ex.questions.map(q => JSON.stringify([q.q, q.t, q.ch, q.v, q.type === 'mb' ? '' : q.parts]));
    if (ids.join() === prev) sameAsPrev++;
    prev = ids.join();
    if (t < cycleTries) ids.forEach(id => { if (seen.has(id)) repeatsInCycle++; seen.add(id); });
    ex.questions.forEach(q => { if (!q.parts.length || q.parts.some(p => !String(p).trim())) { console.log('EMPTY PART', key); problems++; } });
    const full = T.calcScore({ results: ex.questions.map(q => T.gradeQuestion(q, q.parts)), overrides: {} });
    const zero = T.calcScore({ results: ex.questions.map(q => T.gradeQuestion(q, q.parts.map(() => ''))), overrides: {} });
    if (full !== 100 || zero !== 0) { console.log('SCORE', key, full, zero); problems++; }
  }
  if (sameAsPrev) { console.log('SAME AS PREVIOUS', key, sameAsPrev); problems++; }
  if (repeatsInCycle) { console.log('REPEAT WITHIN CYCLE', key, repeatsInCycle); problems++; }
  console.log(key.padEnd(16), `| 문제은행 ${pool == null ? '계시록 본문 전체' : pool + '문항'} | 중복 없이 연속 ${cycleTries}회+ 새 문제`);
}
console.log('problems:', problems);
