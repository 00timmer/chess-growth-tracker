const fs=require('fs');
(async()=>{ const {JSDOM}=require('jsdom');
const html=fs.readFileSync(require('path').join(__dirname,'index.html'),'utf8');
const errs=[];
const dom=new JSDOM(html,{runScripts:"dangerously",url:"http://localhost/",pretendToBeVisual:true});
dom.window.addEventListener('error',e=>errs.push('window.onerror: '+e.message));
const w=dom.window, C=w.CHESS;
let pass=0,fail=0;
const eq=(name,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  if(ok)pass++;else{fail++;console.log('  FAIL '+name+'\n    got  '+JSON.stringify(got)+'\n    want '+JSON.stringify(want));}};

console.log('--- suggestScore banding (spec section 6) ---');
const M=n=>Array(n).fill('met');
eq('6 met -> 4', C.suggestScore(M(6)).score, 4);
eq('5 met+1 not -> 4', C.suggestScore([...M(5),'not']).score, 4);
eq('4 met+2 not -> 3', C.suggestScore([...M(4),'not','not']).score, 3);
eq('3 met+3 not -> 2', C.suggestScore([...M(3),'not','not','not']).score, 2);
eq('2 met -> 2', C.suggestScore([...M(2),'not','not','not','not']).score, 2);
eq('1 met -> 1', C.suggestScore(['met','not','not','not','not','not']).score, 1);
eq('0 met -> 0', C.suggestScore(Array(6).fill('not')).score, 0);
eq('unmarked ignored', C.suggestScore(['met','','','','','']).evaluated, 1);
eq('no marks -> null', C.suggestScore(['','','','','','']).score, null);
eq('6 partial -> 2 (inconsistent)', C.suggestScore(Array(6).fill('partial')).score, 2);
eq('star beats met: 4met+1star+1not -> 4', C.suggestScore([...M(4),'star','not']).score, 4);
eq('3 star+3 not -> 3 (beats 3 met+3 not = 2)', C.suggestScore(['star','star','star','not','not','not']).score, 3);
eq('3 met +3 not -> 2', C.suggestScore(['met','met','met','not','not','not']).score, 2);

console.log('--- reward table ---');
eq('4.0/6 -> $20', C.baseOutcome(4,6).money, 20);
eq('6.0/6 -> $2000 super', [C.baseOutcome(6,6).money,C.baseOutcome(6,6).super], [2000,true]);
eq('2.5/6 -> nothing', [C.baseOutcome(2.5,6).money,C.baseOutcome(2.5,6).days], [0,0]);
eq('2.0/6 -> 7 days', C.baseOutcome(2,6).days, 7);
eq('0.0/6 -> 60 days', C.baseOutcome(0,6).days, 60);
eq('5-round 3.5 -> eq 4.0', C.baseOutcome(3.5,5).equivalent, 4.0);

console.log('--- humanDays ---');
[[7,'1 week'],[14,'2 weeks'],[30,'1 month'],[42,'6 weeks'],[60,'2 months'],[4,'4 days'],[15,'15 days'],[21,'3 weeks']]
  .forEach(([d,s])=>eq('humanDays '+d, C.humanDays(d), s));

console.log('--- SPEC EXAMPLE 1: 4.0/6 + process 17 -> $22 ---');
const t1=C.newTournament('T1','2026-09-01',6);
['W','W','W','W','L','L'].forEach((r,i)=>t1.rounds[i].result=r);
t1.overrides={A:{score:4},B:{score:3},C:{score:3},D:{score:4},E:{score:3}};
const e1=C.evaluate(t1);
eq('score 4.0', e1.ts.pts, 4);
eq('record 4W0D2L', [e1.ts.w,e1.ts.d,e1.ts.l], [4,0,2]);
// NOTE: the spec's own example says "4.0/6" with a record of 3W 1D 2L, which is 3.5 points.
const tSpec=C.newTournament('spec','2026-09-01',6);
['W','W','W','D','L','L'].forEach((r,i)=>tSpec.rounds[i].result=r);
eq('spec literal record 3W1D2L = 3.5 pts', C.tournamentScore(tSpec.rounds).pts, 3.5);
eq('base $20', e1.base.money, 20);
eq('process 17/20', e1.proc.total, 17);
eq('band Strong process', e1.proc.band.label, 'Strong process');
eq('bonus +10%', e1.fin.bonusPct, 10);
eq('FINAL $22', e1.fin.money, 22);

console.log('--- SPEC EXAMPLE 2: 2.0/6 + process 19 -> waived ---');
const t2=C.newTournament('T2','2026-09-01',6);
['L','L','L','L','D','D'].forEach((r,i)=>t2.rounds[i].result=r);
t2.overrides={A:{score:4},B:{score:4},C:{score:4},D:{score:4},E:{score:3}};
const e2=C.evaluate(t2);
eq('score 1.0? no -> 1.0', e2.ts.pts, 1);
// rebuild for exactly 2.0
const t2b=C.newTournament('T2b','2026-09-01',6);
['W','W','L','L','L','L'].forEach((r,i)=>t2b.rounds[i].result=r);
t2b.overrides={A:{score:4},B:{score:4},C:{score:4},D:{score:4},E:{score:3}};
const e2b=C.evaluate(t2b);
eq('score 2.0', e2b.ts.pts, 2);
eq('base = 7 days', e2b.base.days, 7);
eq('process 19', e2b.proc.total, 19);
eq('WAIVED', [e2b.fin.waived, e2b.fin.days, e2b.fin.kind], [true,0,'waived']);

console.log('--- halving (band 15-17 + consequence) ---');
const t3=C.newTournament('T3','2026-09-01',6);
['W','W','L','L','L','L'].forEach((r,i)=>t3.rounds[i].result=r);
t3.overrides={A:{score:3},B:{score:3},C:{score:3},D:{score:4},E:{score:3}};
const e3=C.evaluate(t3);
eq('process 16', e3.proc.total, 16);
eq('7 days halved -> 4', [e3.fin.halved,e3.fin.days], [true,4]);

console.log('--- prorating when categories unevaluated ---');
const t4=C.newTournament('T4','2026-09-01',6);
t4.rounds[0].proc={A:'met'};
const p4=C.processScore(t4);
eq('1 of 5 cats', p4.scoredCats, 1);
eq('prorated flag', p4.prorated, true);
eq('total scaled to 20', p4.total, 20);

console.log('--- engine stats never affect process ---');
const t5=C.newTournament('T5','2026-09-01',6);
t5.rounds.forEach(r=>{r.result='L'; r.engine={acc:'12',blunders:'9',mistakes:'9',inacc:'9'}; r.proc={A:'met',B:'met',C:'met',D:'met',E:'met'};});
eq('all met despite awful engine = 20', C.processScore(t5).total, 20);

console.log('--- highlights ---');
const t6=C.newTournament('T6','2026-09-01',6);
t6.rounds[1].proc={D:'star'};
t6.overrides={A:{score:4},B:{score:1},C:{score:2},D:{score:4},E:{score:3}};
const h6=C.highlights(t6,C.processScore(t6));
eq('<=3 wins', h6.wins.length<=3, true);
eq('<=3 next', h6.next.length<=3, true);
eq('star captured', h6.stars.length, 1);
eq('weakest first', h6.next[0].includes('opponent threatening'), true);

console.log('--- summary text renders ---');
const st=C.summaryText(t1,e1);
eq('has FINAL reward line', /Reward: \$22/.test(st), true);

console.log('--- UI smoke: render every view ---');
const d=w.document;
C._loadSample();
['rounds','process','summary'].forEach(tab=>{
  d.querySelectorAll('.tabs button').forEach(b=>{if(b.dataset.tab===tab)b.onclick();});
  const len=d.querySelector('#tourBody').innerHTML.length;
  eq('tab '+tab+' renders', len>200, true);
});
C._go('round',{rIdx:0}); eq('round view renders', d.querySelector('#roundBody').innerHTML.length>500, true);
C._go('trends');         eq('trends renders', d.querySelector('#trendsBody').innerHTML.length>200, true);
C._go('more');           eq('more renders', d.querySelector('#moreBody').innerHTML.length>500, true);
C._go('home');           eq('home renders', d.querySelector('#homeBody').innerHTML.length>200, true);

console.log('--- persistence ---');
await new Promise(r=>setTimeout(r,400));
eq('localStorage written', !!w.localStorage.getItem('chessTracker.v1'), true);
const back=JSON.parse(w.localStorage.getItem('chessTracker.v1'));
eq('sample persisted', back.tournaments.length>0, true);

console.log('--- migrate tolerates junk ---');
const bad=C.migrate({id:'x',name:'old',rounds:[{n:1,result:'W'}]});
eq('migrate keeps declared length', bad.rounds.length, 1);
const bad2=C.migrate({id:'y',name:'old2',nRounds:6,rounds:[{n:1,result:'W'}]});
eq('migrate pads to nRounds', bad2.rounds.length, 6);
eq('migrate adds engine', typeof bad.rounds[0].engine, 'object');

console.log('--- NEW: byes + pluralisation + end date ---');
const tb=C.newTournament('Bye','2026-09-01',6);
['W','B','W','L','D','L'].forEach((r,i)=>tb.rounds[i].result=r);
const eb=C.tournamentScore(tb.rounds);
eq('bye adds 0.5', eb.pts, 3);
eq('bye not counted as W/D/L', [eb.w,eb.d,eb.l,eb.b], [2,1,2,1]);
eq('bye not "played"', eb.played, 5);
eq('record line pluralised', C.recordLine(eb), '2 wins \u00b7 1 draw \u00b7 2 losses \u00b7 1 bye');
eq('singular draw', C.recordLine({w:1,d:1,l:1,b:0}), '1 win \u00b7 1 draw \u00b7 1 loss');
eq('zero shown', C.recordLine({w:0,d:0,l:6,b:0}), '0 wins \u00b7 0 draws \u00b7 6 losses');
eq('tournament with bye completes', tb.rounds.every(r=>r.result), true);
eq('endDate 7d from 2026-09-01', /Sep 8/.test(C.endDate('2026-09-01',7)), true);
eq('endDate 0 -> empty', C.endDate('2026-09-01',0), '');
const tbEval=C.evaluate(tb);
eq('bye tournament base = 3.0 -> $5', tbEval.base.money, 5);

console.log('--- 6/6 prize is capped, lower tiers still bonus ---');
const tp=C.newTournament('Perfect','2026-09-01',6);
tp.rounds.forEach(r=>{r.result='W';r.proc={A:'met',B:'met',C:'met',D:'met',E:'met'}});
const ep=C.evaluate(tp);
eq('perfect process 20/20', ep.proc.total, 20);
eq('6/6 stays $2000', ep.fin.money, 2000);
eq('no bonus badge on 6/6', ep.fin.bonusPct, 0);
const t55=C.newTournament('FiveHalf','2026-09-01',6);
['W','W','W','W','W','D'].forEach((r,i)=>{t55.rounds[i].result=r;t55.rounds[i].proc={A:'met',B:'met',C:'met',D:'met',E:'met'}});
const e55=C.evaluate(t55);
eq('5.5/6 still bonuses to $180', e55.fin.money, 180);
eq('bonus badge shown', e55.fin.bonusPct, 20);

console.log('\n=== '+pass+' passed, '+fail+' failed ===');
if(errs.length){console.log('JS ERRORS:'); errs.forEach(e=>console.log('  '+e));}
process.exit(fail?1:0);
})();
