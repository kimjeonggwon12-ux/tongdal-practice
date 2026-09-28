// 시온 공부방 3개 앱의 문제은행을 읽어서(수정 없이) 연습시험 앱용 data.js 를 만든다.
const fs = require('fs'), vm = require('vm');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '시온 공부방') + '/';
const OUT = process.argv[2] || path.join(__dirname, '..', 'data.js');

// "const NAME = ..." 또는 "function NAME(...) {...}" 선언 전체를 괄호 균형으로 잘라낸다.
function grab(src, re) {
  const m = re.exec(src);
  if (!m) throw new Error('not found ' + re);
  const isFn = m[0].startsWith('function');
  let j = m.index + m[0].length, depth = 0, q = null, seen = false;
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j) - 1; continue; }
    if (c === '/' && src[j + 1] !== '/' && depth > 0 && /[(,=:]\s*$/.test(src.slice(Math.max(0, j - 3), j))) {
      // 정규식 리터럴: 다음 / 까지 건너뛴다
      let k = j + 1, cls = false;
      for (; k < src.length; k++) {
        const d = src[k];
        if (d === '\\') { k++; continue; }
        if (d === '[') cls = true; else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
      }
      j = k; continue;
    }
    if (c === '{' || c === '[' || c === '(') { depth++; seen = true; }
    else if (c === '}' || c === ']' || c === ')') {
      depth--;
      if (depth === 0 && isFn && c === '}') { j++; break; }
    } else if (depth === 0 && !isFn && (c === ';' || (c === '\n' && seen))) { j++; break; }
  }
  return src.slice(m.index, j) + ';\n';
}
const C = n => new RegExp('\\b(?:const|let|var) ' + n + ' = ');
const F = n => new RegExp('function ' + n + '\\([^)]*\\)\\s*');
const run = (code, tail) => { const ctx = { console }; vm.createContext(ctx); vm.runInContext(code + ';' + tail, ctx); return ctx.out; };

// ── 초중고 신학 (신학기초/index.html)
let s = fs.readFileSync(ROOT + '신학기초/index.html', 'utf8');
let th = run(
  ['dataParable', 'dataElem', 'dataElemFinal', 'dataMid', 'dataMidFinal', 'dataHigh', 'dataHighFinal', 'dataTotalFinal', 'gradeSections', 'gradeRangeText'].map(n => grab(s, C(n))).join(''),
  'this.out={gradeSections,gradeRangeText};');
const theology = {};
for (const g of ['grade4', 'grade3', 'grade2', 'grade1']) {
  theology[g] = {
    range: th.gradeRangeText[g],
    groups: th.gradeSections[g].map(sec => ({
      label: sec.label,
      kind: sec.label.includes('비유') ? 'parable' : sec.label.includes('제목') ? 'title' : 'final',
      items: sec.data.map(it => { const o = { q: it.q, a: it.a }; if (it.tutor && sec.label.includes('비유')) o.x = it.tutor; return o; })
    }))
  };
  // 10문항을 구간 수에 맞게 고르게 배분 (원본 buildGradeQuestions 와 같은 방식)
  const n = theology[g].groups.length, base = Math.floor(10 / n), rem = 10 % n;
  theology[g].groups.forEach((gr, i) => { gr.count = base + (i < rem ? 1 : 0); });
}

// ── 계시록 통달 (도통계시록/index.html)
s = fs.readFileSync(ROOT + '도통계시록/index.html', 'utf8');
const td = run(
  ['verses', 'quizDataStore', 'GRADE4_CHAPTERS', 'GRADE4_ALL_ITEMS', 'RICH_CHAPTERS', 'MOCK_EXCLUDE_ITEMS'].map(n => grab(s, C(n))).join('') +
  ['countWords', 'isBareVerseRef', 'splitBareBracketPrefix', 'extractG4Answers', 'splitTrailingKeyTerm', 'buildMockPoolFromQuizData', 'buildMockPoolFromRich'].map(n => grab(s, F(n))).join('') +
  grab(s, C('GRADE4_KEY_TERMS')) + grab(s, C('GRADE_MOCK_CONFIG')),
  `
  const slim = it => ({ ch: it.ch, q: it.q, t: it.template, r: it.ref || '', v: it.v });
  function chPool(ch) {
    let p = RICH_CHAPTERS[ch] ? buildMockPoolFromRich(ch) : buildMockPoolFromQuizData(ch, ch, 6);
    const ex = MOCK_EXCLUDE_ITEMS[ch];
    if (ex) p = p.filter(it => !ex.some(e => e.q === it.q && e.v === it.v));
    return p.map(slim);
  }
  const tongdal = { grade4: { range: '계 1~22장 (4급 공식 144문항)', groups: [{ label: '4급 공식 문항', count: 10, items: GRADE4_ALL_ITEMS.map(slim) }] } };
  for (const g of ['grade3', 'grade2', 'grade1']) {
    const cfg = GRADE_MOCK_CONFIG[g], tot = cfg.groups.reduce((a, b) => a + b.count, 0);
    let left = 10;
    tongdal[g] = { range: cfg.rangeLabel.replace('범위: ', ''), groups: cfg.groups.map((gr, i) => {
      const c = i === cfg.groups.length - 1 ? left : Math.round(gr.count / tot * 10); left -= c;
      const items = []; for (let ch = gr.from; ch <= gr.to; ch++) items.push(...chPool(ch));
      return { label: gr.from === gr.to ? '계 ' + gr.from + '장' : '계 ' + gr.from + '~' + gr.to + '장', count: c, items };
    }) };
  }
  this.out = { tongdal, verses };`);

// ── 계시록 암기 (index.html)
s = fs.readFileSync(ROOT + 'index.html', 'utf8');
const memo = run(['MEMO_VERSES', 'MEMO_GRADES', 'MEMO_TOP_RANGES'].map(n => grab(s, C(n))).join(''), 'this.out={MEMO_VERSES,MEMO_GRADES,MEMO_TOP_RANGES};');

let diff = 0;
for (const k in memo.MEMO_VERSES) for (const v in memo.MEMO_VERSES[k]) if (memo.MEMO_VERSES[k][v] !== (td.verses[k] || {})[v]) diff++;
console.log('두 앱 계시록 본문 차이 절 수:', diff);
for (const g in theology) console.log('신학', g, theology[g].groups.map(x => x.label + ':' + x.items.length + '→' + x.count).join(' | '));
for (const g in td.tongdal) console.log('통달', g, td.tongdal[g].groups.map(x => x.label + ':' + x.items.length + '→' + x.count).join(' | '));
console.log('암기', JSON.stringify(memo.MEMO_GRADES));

const data = { theology, tongdal: td.tongdal, memo: { grades: memo.MEMO_GRADES, top: memo.MEMO_TOP_RANGES }, verses: memo.MEMO_VERSES };
fs.writeFileSync(OUT, '// 자동 생성 파일 — 시온 공부방(신학기초 / 도통계시록 / 계시록암기) 문제은행에서 추출.\n// 원본 문제가 바뀌면 직접 고치지 말고 tools/extract.js 를 다시 실행하세요.\nwindow.EXAM_DATA = ' + JSON.stringify(data) + ';\n');
console.log('bytes', fs.statSync(OUT).size);
