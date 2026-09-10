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

console.log('--- SPEC EXAMPLE 1: 4.0/6 + process 17 -> $30 (was $22 under the old +10%) ---');
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
eq('flat effort bonus $10', e1.fin.processBonus, 10);
eq('FINAL $30 (20 base + 10 effort)', e1.fin.money, 30);

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
eq('has FINAL reward line', /Reward: \$30 {2}\(base \$20 \+ \$10 effort bonus\)/.test(st), true);

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
eq('nothing stacks on the perfect score', ep.fin.processBonus, 0);
const t55=C.newTournament('FiveHalf','2026-09-01',6);
['W','W','W','W','W','D'].forEach((r,i)=>{t55.rounds[i].result=r;t55.rounds[i].proc={A:'met',B:'met',C:'met',D:'met',E:'met'}});
const e55=C.evaluate(t55);
eq('5.5/6 -> $150 + $25 effort = $175', e55.fin.money, 175);
eq('effort bonus shown', e55.fin.processBonus, 25);

console.log('--- NEW: opponent strength bonus ---');
// band boundaries (gap = opponent - player)
eq('gap +240 -> Much stronger', C.strengthBand(240).label, 'Much stronger');
eq('gap +200 -> Much stronger (inclusive)', C.strengthBand(200).label, 'Much stronger');
eq('gap +199 -> Stronger', C.strengthBand(199).label, 'Stronger');
eq('gap +76 -> Stronger (inclusive)', C.strengthBand(76).label, 'Stronger');
eq('gap +75 -> Even', C.strengthBand(75).label, 'Even');
eq('gap 0 -> Even', C.strengthBand(0).label, 'Even');
eq('gap -75 -> Even (inclusive)', C.strengthBand(-75).label, 'Even');
eq('gap -76 -> Weaker', C.strengthBand(-76).label, 'Weaker');
eq('gap -199 -> Weaker (inclusive)', C.strengthBand(-199).label, 'Weaker');
eq('gap -200 -> Much weaker', C.strengthBand(-200).label, 'Much weaker');
eq('gap -900 -> Much weaker', C.strengthBand(-900).label, 'Much weaker');

// the asymmetry is the whole point: playing down is NEVER penalised
['Weaker','Much weaker'].forEach(lbl=>{
  const b=C.STRENGTH_BANDS.find(x=>x.label===lbl);
  eq(lbl+' win = 0', b.adj.W, 0);
  eq(lbl+' draw = 0 (no penalty)', b.adj.D, 0);
  eq(lbl+' loss = 0 (no penalty)', b.adj.L, 0);
});
eq('Even band is all zero', [C.strengthBand(0).adj.W,C.strengthBand(0).adj.D,C.strengthBand(0).adj.L], [0,0,0]);
eq('Much stronger: W +0.5', C.strengthBand(240).adj.W, 0.5);
eq('Much stronger: D +0.25', C.strengthBand(240).adj.D, 0.25);
eq('Much stronger: L 0', C.strengthBand(240).adj.L, 0);
eq('Stronger: W +0.25', C.strengthBand(120).adj.W, 0.25);
eq('Stronger: D 0', C.strengthBand(120).adj.D, 0);

// ratingOf
eq('ratingOf "1560"', C.ratingOf('1560'), 1560);
eq('ratingOf blank -> null', C.ratingOf(''), null);
eq('ratingOf junk -> null', C.ratingOf('unrated'), null);
eq('ratingOf 0 -> null', C.ratingOf('0'), null);
eq('ratingOf undefined -> null', C.ratingOf(undefined), null);

// no player rating -> no adjustment at all
const tsA=C.newTournament('NoRating','2026-09-01',6);
['W','W','W','W','W','W'].forEach((r,i)=>{tsA.rounds[i].result=r;tsA.rounds[i].oppRating='1900';});
eq('no player rating -> total 0', C.strengthAdjust(tsA.rounds, '').total, 0);
eq('no player rating -> haveMine false', C.strengthAdjust(tsA.rounds, '').haveMine, false);

// The motivating case: a 1560 paired down to a 1300 — nothing is ever taken away
const tsB=C.newTournament('PlayDown','2026-09-01',6);
tsB.myRating='1560';
[['L','1300'],['D','1300'],['W','1300'],['L','1400'],['D','1400'],['W','1400']]
  .forEach(([res,rat],i)=>{tsB.rounds[i].result=res;tsB.rounds[i].oppRating=rat;});
const eB=C.evaluate(tsB);
eq('playing down: raw 3.0', eB.ts.pts, 3);
eq('playing down: bonus 0', eB.str.total, 0);
eq('playing down: adjusted == raw', eB.adjPts, 3);
eq('playing down: reward unchanged $5', eB.fin.money, 5);

// playing up earns
const tsC=C.newTournament('PlayUp','2026-09-01',6);
tsC.myRating='1560';
[['W','1800'],['D','1810'],['L','1600'],['D','1620'],['W','1550'],['L','1700']]
  .forEach(([res,rat],i)=>{tsC.rounds[i].result=res;tsC.rounds[i].oppRating=rat;});
const eC=C.evaluate(tsC);
eq('playing up: raw 3.0', eC.ts.pts, 3);
eq('playing up: bonus +0.75', eC.str.total, 0.75);
eq('playing up: adjusted 3.75', eC.adjPts, 3.75);
eq('playing up: 3.75 snaps to 4.0 -> $20', eC.fin.money, 20);
eq('playing up: 4 rated rounds counted', eC.str.rated, 6);

// the bonus reaches the consequence half of the table too
const tsD=C.newTournament('UpAndLost','2026-09-01',6);
tsD.myRating='1560';
[['L','1900'],['L','1900'],['W','1850'],['D','1880'],['L','1830'],['L','1870']]
  .forEach(([res,rat],i)=>{tsD.rounds[i].result=res;tsD.rounds[i].oppRating=rat;});
const eD=C.evaluate(tsD);
eq('up+lost: raw 1.5', eD.ts.pts, 1.5);
eq('up+lost: bonus +0.75', eD.str.total, 0.75);
eq('up+lost: adjusted 2.25 -> snaps 2.5', eD.base.equivalent, 2.5);
eq('up+lost: break lifted (was 14 days at 1.5)', eD.fin.days, 0);
eq('raw 1.5 alone would be 14 days', C.baseOutcome(1.5,6).days, 14);

// cap
const tsE=C.newTournament('Capped','2026-09-01',6);
tsE.myRating='1200';
tsE.rounds.forEach(r=>{r.result='W';r.oppRating='1900';});
const eE=C.evaluate(tsE);
eq('cap: raw earned +3.0', eE.str.raw, 3);
eq('cap: total capped at +1.0', eE.str.total, 1);
eq('cap: flagged as capped', eE.str.capped, true);

// a bonus must never manufacture a clean sweep
const tsF=C.newTournament('AlmostPerfect','2026-09-01',6);
tsF.myRating='1200';
[['W','1900'],['W','1900'],['W','1900'],['W','1900'],['W','1900'],['D','1900']]
  .forEach(([res,rat],i)=>{tsF.rounds[i].result=res;tsF.rounds[i].oppRating=rat;});
const eF=C.evaluate(tsF);
eq('5.5 + bonus does NOT reach 6/6', eF.base.super, undefined);
eq('5.5 + bonus is not the $2000 tier', eF.fin.isSuper, false);
eq('5.5 + bonus caps at the 5.5 tier', eF.base.equivalent, 5.5);
const tsG=C.newTournament('TrulyPerfect','2026-09-01',6);
tsG.myRating='1200';
tsG.rounds.forEach(r=>{r.result='W';r.oppRating='1900';});
eq('a real 6/6 still wins $2000', C.evaluate(tsG).fin.money, 2000);

// byes and unrated opponents are skipped
const tsH=C.newTournament('Mixed','2026-09-01',6);
tsH.myRating='1560';
[['B','1900'],['W','1900'],['W',''],['W','unrated'],['W','1900'],['L','1900']]
  .forEach(([res,rat],i)=>{tsH.rounds[i].result=res;tsH.rounds[i].oppRating=rat;});
const sH=C.strengthAdjust(tsH.rounds, tsH.myRating);
eq('bye earns no bonus', sH.per[0], null);
eq('unrated rounds skipped', sH.unrated, 2);
eq('rated rounds counted', sH.rated, 3);
eq('mixed total = 2 wins vs much stronger', sH.total, 1);

// migrate backfills myRating
eq('migrate adds myRating', C.migrate({id:'z',name:'old',nRounds:1,rounds:[{n:1,result:'W'}]}).myRating, '');
eq('migrate keeps an existing myRating', C.migrate({id:'z2',name:'o',nRounds:1,myRating:'1400',rounds:[]}).myRating, '1400');

// copy-as-text mentions the bonus, and never a penalty
const stC=C.summaryText(tsC, eC);
eq('summary text has the bonus line', /Strength bonus: \+0\.75/.test(stC), true);
eq('summary text has no bonus line when there is none', /Strength bonus/.test(C.summaryText(tsB, eB)), false);
eq('signed formats', [C.signed(0.5),C.signed(0),C.signed(1)], ['+0.5','0','+1']);

// the More screen documents the rule
C._go('more');
const moreHTML=d.querySelector('#moreBody').innerHTML;
eq('More explains the strength bonus', /Opponent strength bonus/.test(moreHTML), true);
eq('More states playing down is free', /never costs anything/.test(moreHTML), true);

console.log('--- NEW: four-round events have their own table ---');
const FOUR = [[4,100],[3.5,20],[3,10]];
FOUR.forEach(([p,m])=>eq(p+'/4 -> $'+m, C.baseOutcome(p,4).money, m));
eq('2.5/4 -> no reward, no consequence', [C.baseOutcome(2.5,4).money,C.baseOutcome(2.5,4).days], [0,0]);
eq('2.0/4 -> no reward, no consequence', [C.baseOutcome(2,4).money,C.baseOutcome(2,4).days], [0,0]);
eq('an even 4-round score neither pays nor costs', C.baseOutcome(2,4).kind, undefined);
eq('1.5/4 -> 7 days', C.baseOutcome(1.5,4).days, 7);
eq('1.0/4 -> 14 days', C.baseOutcome(1,4).days, 14);
eq('0.5/4 -> 30 days', C.baseOutcome(0.5,4).days, 30);
eq('0.0/4 -> 42 days', C.baseOutcome(0,4).days, 42);
eq('4-round consequences are gentler than 6-round', [C.baseOutcome(0,4).days,C.baseOutcome(0,6).days], [42,60]);

// it is a table, not a conversion
eq('4-round is not flagged scaled', C.baseOutcome(3,4).scaled, false);
eq('4-round reports its own table', C.baseOutcome(3,4).table, 4);
eq('4-round equivalent is the 4-round score', C.baseOutcome(3,4).equivalent, 3);
eq('same percentage pays less than 6 rounds', [C.baseOutcome(3,4).money,C.baseOutcome(4.5,6).money], [10,40]);
eq('scores snap to the nearest 0.5', C.baseOutcome(2.75,4).money, 10);
eq('over-max clamps', C.baseOutcome(9,4).money, 100);
eq('negative clamps', C.baseOutcome(-2,4).days, 42);

// the $2,000 needs six games
eq('4/4 is not the super tier', !!C.baseOutcome(4,4).super, false);
eq('4/4 pays $100', C.baseOutcome(4,4).money, 100);
eq('4/4 flagged as top-tier blocked', C.baseOutcome(4,4).topTierBlocked, true);
eq('3.5/4 not flagged blocked', C.baseOutcome(3.5,4).topTierBlocked, false);
eq('6/6 still $2000', C.baseOutcome(6,6).money, 2000);
eq('6/6 not flagged blocked', C.baseOutcome(6,6).topTierBlocked, false);
eq('7/7 still $2000 (harder than six)', C.baseOutcome(7,7).money, 2000);

// lengths without a table of their own still convert, and still cannot reach the top
eq('5-round converts', C.baseOutcome(3.5,5).scaled, true);
eq('5/5 sweep blocked at $150', C.baseOutcome(5,5).money, 150);
eq('3/3 sweep blocked at $150', C.baseOutcome(3,3).money, 150);
eq('5-round 3.5 -> eq 4.0 -> $20', [C.baseOutcome(3.5,5).equivalent,C.baseOutcome(3.5,5).money], [4,20]);
eq('8/8 sweep still $2000', C.baseOutcome(8,8).money, 2000);

// a 4-round tournament end to end
const tFour=C.newTournament('Four','2026-09-10',4);
eq('4 rounds created', tFour.rounds.length, 4);
tFour.rounds.forEach(r=>{r.result='W';r.proc={A:'met',B:'met',C:'met',D:'met',E:'met'}});
const e4=C.evaluate(tFour);
eq('4/4 raw', e4.ts.pts, 4);
eq('4/4 record line', C.recordLine(e4.ts), '4 wins · 0 draws · 0 losses');
eq('4/4 is not the perfect-score prize', e4.fin.isSuper, false);
eq('4/4 + perfect process = $100 + $15 = $115', e4.fin.money, 115);
eq('  (100 base + $15 effort bonus, 4-round rate)', [e4.fin.baseMoney,e4.fin.processBonus], [100,15]);
// process still waives a 4-round consequence
const tFourBad=C.newTournament('FourBad','2026-09-10',4);
['L','L','D','L'].forEach((r,i)=>{tFourBad.rounds[i].result=r;
  tFourBad.rounds[i].proc={A:'met',B:'met',C:'met',D:'star',E:'met'}});
const e4b2=C.evaluate(tFourBad);
eq('0.5/4 would be 30 days', C.baseOutcome(0.5,4).days, 30);
eq('excellent process waives it', [e4b2.fin.kind,e4b2.fin.days], ['waived',0]);

console.log('--- NEW: strength cap scales with event length ---');
eq('4 rounds -> cap +0.75', C.strengthCap(4), 0.75);
eq('5 rounds -> cap +0.75', C.strengthCap(5), 0.75);
eq('6 rounds -> cap +1.00', C.strengthCap(6), 1);
eq('8 rounds -> cap +1.25', C.strengthCap(8), 1.25);
eq('12 rounds -> cap +2.00', C.strengthCap(12), 2);
eq('1 round -> floor at +0.25', C.strengthCap(1), 0.25);
eq('junk -> treated as 6', C.strengthCap(undefined), 1);
eq('cap stays a clean quarter', [C.strengthCap(4)*4%1,C.strengthCap(8)*4%1], [0,0]);

const t4s=C.newTournament('FourStrong','2026-09-10',4);
t4s.myRating='1200';
t4s.rounds.forEach(r=>{r.result='W';r.oppRating='1900';});
const e4s=C.evaluate(t4s);
eq('4-round: earned +2.0', e4s.str.raw, 2);
eq('4-round: capped to +0.75 not +1.0', e4s.str.total, 0.75);
eq('4-round: cap reported', e4s.str.cap, 0.75);
eq('4-round: flagged capped', e4s.str.capped, true);
eq('bonus still cannot reach the top tier', e4s.fin.isSuper, false);

// same share of the event whatever the length
const share=n=>{const t=C.newTournament('S','2026-09-10',n);t.myRating='1200';
  t.rounds.forEach(r=>{r.result='W';r.oppRating='1900'});
  return Math.round(C.evaluate(t).str.total/n*1000)/10;};
eq('bonus share 6 rounds', share(6), 16.7);
eq('bonus share 4 rounds is close to it', share(4), 18.8);
eq('bonus share 8 rounds is close to it', share(8), 15.6);

// a realistic 4-round event with a bonus that matters
const t4b=C.newTournament('FourReal','2026-09-10',4);
t4b.myRating='1560';
[['W','1850'],['D','1840'],['L','1600'],['L','1620']]
  .forEach(([res,rat],i)=>{t4b.rounds[i].result=res;t4b.rounds[i].oppRating=rat;});
const e4b=C.evaluate(t4b);
eq('raw 1.5/4, bonus +0.75', [e4b.ts.pts,e4b.str.total], [1.5,0.75]);
eq('counts as 2.25/4 -> snaps 2.5', [e4b.adjPts,e4b.base.equivalent], [2.25,2.5]);
// the bonus lifts a short event out of the consequence zone into neutral
eq('raw 1.5/4 alone would be a 1-week break', [C.baseOutcome(1.5,4).money,C.baseOutcome(1.5,4).days], [0,7]);
eq('with the bonus there is no break', [e4b.fin.money,e4b.fin.days], [0,0]);

// the More screen documents both rules
C._go('more');
const moreShort=d.querySelector('#moreBody').innerHTML;
eq('More explains the round conversion', /6-round equivalent/.test(moreShort), true);
eq('More says short events cannot reach $2,000', /needs six games actually won/.test(moreShort), true);
eq('More says the cap scales', /scaled to the actual length/.test(moreShort), true);

console.log('--- NEW: process pays a flat bonus, not a percentage ---');
const P=(pts,n,proc)=>{const b=C.baseOutcome(pts,n);
  return C.finalOutcome(b,{total:proc,band:C.PROCESS_BANDS.find(x=>proc>=x.min)})};

// the point of the change: effort is worth the same at every result level
eq('3.0/6 + process 19 -> $5 + $25', P(3,6,19).money, 30);
eq('4.0/6 + process 19 -> $20 + $25', P(4,6,19).money, 45);
eq('5.0/6 + process 19 -> $75 + $25', P(5,6,19).money, 100);
eq('effort is worth $25 at every level', [P(3,6,19).money-P(3,6,13).money,
  P(4,6,19).money-P(4,6,13).money, P(5,6,19).money-P(5,6,13).money], [25,25,25]);
eq('strong process is worth $10 at every level', [P(3,6,16).money-P(3,6,13).money,
  P(4,6,16).money-P(4,6,13).money, P(5,6,16).money-P(5,6,13).money], [10,10,10]);

// a weak process still never takes money away
[13,10,3,0].forEach(q=>eq('process '+q+' pays the base only', P(4,6,q).money, 20));
eq('a weak process never goes negative', P(3,6,0).money >= C.baseOutcome(3,6).money, true);

// the neutral tier now pays for effort, where it used to pay nothing
eq('2.5/6 + process 19 -> $25 (was $0)', P(2.5,6,19).money, 25);
eq('2.5/6 + process 19 is a money outcome', P(2.5,6,19).kind, 'money');
eq('2.5/6 + process 13 -> still nothing', [P(2.5,6,13).money,P(2.5,6,13).kind], [0,'neutral']);

// a hard-fought loss finally pays: break waived AND bonus
eq('2.0/6 + process 19 -> break waived', [P(2,6,19).days,P(2,6,19).waived], [0,true]);
eq('2.0/6 + process 19 -> $25 paid too', P(2,6,19).money, 25);
eq('  and still reads as waived', P(2,6,19).kind, 'waived');
eq('0.0/6 + process 19 -> waived + $25', [P(0,6,19).days,P(0,6,19).money], [0,25]);

// effort buys off the break FIRST -- no money while games are still taken away
eq('2.0/6 + process 16 -> break halved, not waived', [P(2,6,16).days,P(2,6,16).halved], [4,true]);
eq('  no money while a break remains', P(2,6,16).money, 0);
eq('  and it reads as a hold', P(2,6,16).kind, 'hold');
eq('1.0/6 + process 16 -> 15 days, no money', [P(1,6,16).days,P(1,6,16).money], [15,0]);
// but strong process pays once the result clears the break zone
eq('2.5/6 + process 16 -> $10, no break', [P(2.5,6,16).money,P(2.5,6,16).days], [10,0]);

// nothing stacks on the perfect score
eq('6/6 + process 20 stays $2000', P(6,6,20).money, 2000);
eq('6/6 pays no effort bonus', P(6,6,20).processBonus, 0);
eq('5.5/6 does get one', P(5.5,6,20).processBonus, 25);

// four-round events use the smaller rate
eq('4-round excellent = $15', P(3,4,19).processBonus, 15);
eq('4-round strong = $6', P(3,4,16).processBonus, 6);
eq('6-round excellent = $25', P(3,6,19).processBonus, 25);
eq('3.0/4 + process 19 -> $10 + $15', P(3,4,19).money, 25);
eq('2.5/4 (neutral) + process 19 -> $15', P(2.5,4,19).money, 15);
eq('converted lengths use the 6-round rate', P(3.5,5,19).processBonus, 25);

// unscored process changes nothing
const noProc=C.finalOutcome(C.baseOutcome(4,6),{total:null,band:null});
eq('no process marks -> base only', [noProc.money,noProc.processBonus], [20,0]);

// the More screen documents it
C._go('more');
const moreFlat=d.querySelector('#moreBody').innerHTML;
eq('More shows the flat amounts', /\+\$25 \(\$15 over 4 rounds\)/.test(moreFlat), true);
eq('More explains flat not percentage', /flat amount, not a percentage/.test(moreFlat), true);
eq('More explains break-first', /Effort buys off a break/.test(moreFlat), true);

console.log('\n=== '+pass+' passed, '+fail+' failed ===');
if(errs.length){console.log('JS ERRORS:'); errs.forEach(e=>console.log('  '+e));}
process.exit(fail?1:0);
})();
