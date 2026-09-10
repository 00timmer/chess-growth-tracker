const WebSocket=require('ws');
const http=require('http');
const get=u=>new Promise((res,rej)=>http.get(u,r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej));
const URL_=process.argv[2];
(async()=>{
  const tabs=await get('http://127.0.0.1:9222/json');
  const page=tabs.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl,{perMessageDeflate:false,maxPayload:1e8});
  let id=0; const pend=new Map(); const consoleErrs=[];
  const send=(m,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p}))});
  ws.on('message',d=>{const m=JSON.parse(d);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result||m.error);pend.delete(m.id);}
    if(m.method==='Runtime.exceptionThrown')consoleErrs.push(JSON.stringify(m.params.exceptionDetails.exception&&m.params.exceptionDetails.exception.description||m.params.exceptionDetails.text).slice(0,200));
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')consoleErrs.push((m.params.args[0]||{}).value);
  });
  await new Promise(r=>ws.on('open',r));
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  const ev=async(expr)=>{const r=await send('Runtime.evaluate',{expression:`(()=>{try{return JSON.stringify(${expr})}catch(e){return JSON.stringify('THREW: '+e.message)}})()`,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)return 'EXCEPTION '+JSON.stringify(r.exceptionDetails).slice(0,200);
    try{return JSON.parse(r.result.value)}catch(e){return r.result.value}};
  const go=async(u)=>{await send('Page.navigate',{url:u});await new Promise(r=>setTimeout(r,2200));};

  let pass=0,fail=0;
  const t=(name,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
    if(ok){pass++;console.log('  ok   '+name);}else{fail++;console.log('  FAIL '+name+'\n         got  '+JSON.stringify(got)+'\n         want '+JSON.stringify(want));}};
  const tt=(name,cond)=>t(name,!!cond,true);

  // Start from a genuinely clean slate so the suite is re-runnable against the
  // same Chrome profile — otherwise run 2 inherits run 1's tournaments.
  await go(URL_+'?t='+Date.now());
  await ev(`(localStorage.clear(),1)`);
  await go(URL_+'?t='+Date.now());

  console.log('\n[1] FIRST RUN');
  tt('name sheet opens', await ev(`document.querySelector('#modal').classList.contains('on')`));
  t('prompt copy', await ev(`document.querySelector('#sheet h3').textContent`), 'Who are we tracking?');
  await ev(`(document.querySelector('#pnName').value='Robin', document.querySelector('#pnGo').click(), 1)`);
  await new Promise(r=>setTimeout(r,300));
  t('name saved', await ev(`window.CHESS._db().player`), 'Robin');
  t('header personalised', await ev(`document.querySelector('#hTitle').textContent`), "Robin's Chess Growth Tracker");
  tt('sheet closed', await ev(`!document.querySelector('#modal').classList.contains('on')`));

  console.log('\n[2] CREATE TOURNAMENT (real clicks)');
  await ev(`(document.querySelector('#newT').click(),1)`);
  await new Promise(r=>setTimeout(r,250));
  tt('create sheet open', await ev(`!!document.querySelector('#ntGo')`));
  await ev(`(document.querySelector('#ntName').value='NY State Championship',document.querySelector('#ntDate').value='2026-09-05',document.querySelector('#ntRounds').value='6',document.querySelector('#ntGo').click(),1)`);
  await new Promise(r=>setTimeout(r,350));
  t('1 tournament', await ev(`window.CHESS._db().tournaments.length`), 1);
  t('6 rounds', await ev(`window.CHESS._db().tournaments[0].rounds.length`), 6);
  t('on tour view', await ev(`window.CHESS._ui().view`), 'tour');
  t('header shows name', await ev(`document.querySelector('#hTitle').textContent`), 'NY State Championship');
  t('6 round rows', await ev(`document.querySelectorAll('[data-r]').length`), 6);

  console.log('\n[3] ROUND 1 ENTRY (clicks + typing)');
  await ev(`(document.querySelectorAll('[data-r]')[0].click(),1)`);
  await new Promise(r=>setTimeout(r,300));
  t('round view', await ev(`window.CHESS._ui().view`), 'round');
  await ev(`(document.querySelector('[data-res="W"]').click(),1)`); await new Promise(r=>setTimeout(r,200));
  t('result W', await ev(`window.CHESS._db().tournaments[0].rounds[0].result`), 'W');
  await ev(`(document.querySelector('[data-col="W"]').click(),1)`); await new Promise(r=>setTimeout(r,200));
  t('colour W', await ev(`window.CHESS._db().tournaments[0].rounds[0].color`), 'W');
  await ev(`(function(){var i=document.querySelector('#fOpp');i.value='Maya R.';i.oninput();var r=document.querySelector('#fRat');r.value='1180';r.oninput();var a=document.querySelector('#eAcc');a.value='88';a.oninput();var n=document.querySelector('#fNotes');n.value='Calm game.';n.oninput();return 1})()`);
  await new Promise(r=>setTimeout(r,350));
  t('opponent saved', await ev(`window.CHESS._db().tournaments[0].rounds[0].opponent`), 'Maya R.');
  t('rating saved', await ev(`window.CHESS._db().tournaments[0].rounds[0].oppRating`), '1180');
  t('engine acc saved', await ev(`window.CHESS._db().tournaments[0].rounds[0].engine.acc`), '88');
  t('notes saved', await ev(`window.CHESS._db().tournaments[0].rounds[0].notes`), 'Calm game.');

  console.log('\n[4] PROCESS MARKS + HELP TOGGLE');
  await ev(`(document.querySelector('[data-help="A"]').click(),1)`); await new Promise(r=>setTimeout(r,150));
  tt('help opens', await ev(`document.querySelector('#help-A').classList.contains('on')`));
  await ev(`(document.querySelector('[data-help="A"]').click(),1)`); await new Promise(r=>setTimeout(r,150));
  tt('help closes', await ev(`!document.querySelector('#help-A').classList.contains('on')`));
  await ev(`(function(){['A','B','C','D','E'].forEach(function(k){document.querySelector('[data-cat="'+k+'"][data-mark="met"]').click()});return 1})()`);
  await new Promise(r=>setTimeout(r,400));
  t('5 marks set', await ev(`Object.keys(window.CHESS._db().tournaments[0].rounds[0].proc).length`), 5);
  await ev(`(document.querySelector('[data-cat="D"][data-mark="star"]').click(),1)`); await new Promise(r=>setTimeout(r,300));
  t('star overrides met', await ev(`window.CHESS._db().tournaments[0].rounds[0].proc.D`), 'star');
  await ev(`(document.querySelector('[data-cat="D"][data-mark="star"]').click(),1)`); await new Promise(r=>setTimeout(r,300));
  t('tap again clears', await ev(`window.CHESS._db().tournaments[0].rounds[0].proc.D`), undefined);
  await ev(`(document.querySelector('[data-cat="D"][data-mark="star"]').click(),1)`); await new Promise(r=>setTimeout(r,300));

  console.log('\n[5] BYE');
  await ev(`(window.CHESS._go('round',{rIdx:1}),1)`); await new Promise(r=>setTimeout(r,300));
  await ev(`(document.querySelector('[data-res="B"]').click(),1)`); await new Promise(r=>setTimeout(r,300));
  t('bye recorded', await ev(`window.CHESS._db().tournaments[0].rounds[1].result`), 'B');
  tt('bye hint shown', await ev(`document.body.innerText.indexOf('Half-point bye')>-1`));

  console.log('\n[6] FILL REMAINING + SUMMARY');
  await ev(`(function(){var t=window.CHESS._db().tournaments[0];
    ['','','W','D','L','L'].forEach(function(r,i){if(r)t.rounds[i].result=r});
    [2,3,4,5].forEach(function(i){t.rounds[i].proc={A:'met',B:'met',C:'partial',D:'met',E:'met'}});
    window.CHESS._go('tour',{tab:'summary'});return 1})()`);
  await new Promise(r=>setTimeout(r,500));
  const sum = await ev(`({score:document.querySelector('.hero .big').textContent,
    rec:document.querySelector('.hero .rec').textContent,
    reward:document.querySelector('.reward .val').textContent,
    total:(document.body.innerText.match(/(\\d+(\\.\\d+)?) \\/ 20/)||[])[0]})`);
  console.log('    summary =', JSON.stringify(sum));
  t('score 3.0 (2W 1D 2L + half-point bye)', sum.score, '3');
  t('reward = $5 base + $25 effort bonus = $30', sum.reward, '$30');
  tt('record pluralised correctly', /1 draw\b/.test(sum.rec) && /1 bye\b/.test(sum.rec));
  tt('reward is a dollar figure', /^\$/.test(sum.reward));
  tt('no provisional banner (all rounds filled)', await ev(`document.body.innerText.indexOf('Provisional')===-1`));

  console.log('\n[7] PROCESS TAB + OVERRIDE');
  await ev(`(document.querySelectorAll('.tabs button').forEach(function(b){if(b.dataset.tab==='process')b.click()}),1)`);
  await new Promise(r=>setTimeout(r,400));
  const sugg = await ev(`window.CHESS.processScore(window.CHESS._db().tournaments[0]).cats.C.suggested`);
  await ev(`(document.querySelector('[data-cat="C"][data-score="1"]').click(),1)`);
  await new Promise(r=>setTimeout(r,400));
  t('override applied', await ev(`window.CHESS._db().tournaments[0].overrides.C.score`), 1);
  tt('suggestion still visible', await ev(`document.body.innerText.indexOf('suggested '+${sugg})>-1`));
  tt('override note sheet opened', await ev(`!!document.querySelector('#ovNote')`));
  await ev(`(document.querySelector('#ovNote').value='rushed rounds 3-5',document.querySelector('#ovSave').click(),1)`);
  await new Promise(r=>setTimeout(r,400));
  t('note saved', await ev(`window.CHESS._db().tournaments[0].overrides.C.note`), 'rushed rounds 3-5');
  tt('parent badge shown', await ev(`document.body.innerText.indexOf('set by parent')>-1`));
  await ev(`(document.querySelector('#clearOv').click(),1)`); await new Promise(r=>setTimeout(r,400));
  t('reset clears overrides', await ev(`Object.keys(window.CHESS._db().tournaments[0].overrides).length`), 0);

  console.log('\n[8] PERSISTENCE ACROSS RELOAD');
  await go(URL_);
  t('tournament survived', await ev(`window.CHESS._db().tournaments.length`), 1);
  t('name survived', await ev(`window.CHESS._db().player`), 'Robin');
  t('round data survived', await ev(`window.CHESS._db().tournaments[0].rounds[0].opponent`), 'Maya R.');
  tt('no name prompt on return', await ev(`!document.querySelector('#modal').classList.contains('on')`));

  console.log('\n[9] NAV + TRENDS + MORE');
  await ev(`(document.querySelector('[data-nav="trends"]').click(),1)`); await new Promise(r=>setTimeout(r,400));
  t('trends view', await ev(`window.CHESS._ui().view`), 'trends');
  tt('trends rendered', await ev(`document.querySelector('#trendsBody').innerHTML.length>200`));
  tt('sparkline bars', await ev(`document.querySelectorAll('.spark i').length>0`));
  await ev(`(document.querySelector('[data-nav="more"]').click(),1)`); await new Promise(r=>setTimeout(r,400));
  t('more view', await ev(`window.CHESS._ui().view`), 'more');
  t('two reward tables (6-round + 4-round)', await ev(`document.querySelectorAll('table.rt').length`), 2);
  t('6-round table rows', await ev(`document.querySelectorAll('table.rt')[0].querySelectorAll('tr').length`), 13);
  t('4-round table rows', await ev(`document.querySelectorAll('table.rt')[1].querySelectorAll('tr').length`), 9);
  t('4-round table tops out at $100', await ev(`document.querySelectorAll('table.rt')[1].querySelector('tr td:last-child').textContent`), '$100');
  tt('shows tracked name', await ev(`document.body.innerText.indexOf('Robin')>-1`));
  tt('super row highlighted', await ev(`!!document.querySelector('table.rt tr.hi')`));

  console.log('\n[10] THEME TOGGLE');
  await ev(`(document.querySelector('#themeBtn').click(),1)`); await new Promise(r=>setTimeout(r,300));
  t('dark applied', await ev(`document.documentElement.getAttribute('data-theme')`), 'dark');
  const darkBg = await ev(`getComputedStyle(document.body).backgroundColor`);
  await ev(`(document.querySelector('#themeBtn').click(),1)`); await new Promise(r=>setTimeout(r,300));
  const lightBg = await ev(`getComputedStyle(document.body).backgroundColor`);
  tt('bg actually changes', darkBg !== lightBg);
  console.log('    dark='+darkBg+'  light='+lightBg);

  console.log('\n[11] IMPORT / EXPORT ROUNDTRIP');
  const snap = await ev(`JSON.stringify(window.CHESS._db())`);
  await ev(`(document.querySelector('#wipeBtn').click(),1)`); await new Promise(r=>setTimeout(r,250));
  await ev(`(document.querySelector('#wYes').click(),1)`); await new Promise(r=>setTimeout(r,400));
  t('erased', await ev(`window.CHESS._db().tournaments.length`), 0);
  await ev(`(function(){var db=window.CHESS._db();var p=JSON.parse(${JSON.stringify(snap)});
    p.tournaments.forEach(function(t){db.tournaments.push(window.CHESS.migrate(t))});return 1})()`);
  await new Promise(r=>setTimeout(r,300));
  t('restored from snapshot', await ev(`window.CHESS._db().tournaments.length`), 1);
  t('restored round intact', await ev(`window.CHESS._db().tournaments[0].rounds[0].opponent`), 'Maya R.');

  console.log('\n[12] OPPONENT STRENGTH BONUS (real clicks)');
  await ev(`(window.CHESS._db().tournaments.length=0,window.CHESS._go('home'),1)`);
  await new Promise(r=>setTimeout(r,250));
  await ev(`(document.querySelector('#newT').click(),1)`);
  await new Promise(r=>setTimeout(r,250));
  tt('rating field on the create sheet', await ev(`!!document.querySelector('#ntRating')`));
  await ev(`(document.querySelector('#ntName').value='Strength Open',document.querySelector('#ntDate').value='2026-09-05',document.querySelector('#ntRounds').value='6',document.querySelector('#ntRating').value='1560',document.querySelector('#ntGo').click(),1)`);
  await new Promise(r=>setTimeout(r,350));
  t('player rating stored', await ev(`window.CHESS._db().tournaments[0].myRating`), '1560');
  tt('rating chip on the rounds screen', await ev(`!!document.querySelector('#myRatBtn')`));

  // R1: beat an 1800 -> +0.5
  await ev(`(document.querySelectorAll('[data-r]')[0].click(),1)`); await new Promise(r=>setTimeout(r,300));
  await ev(`(document.querySelector('[data-res="W"]').click(),1)`); await new Promise(r=>setTimeout(r,250));
  await ev(`(function(){var r=document.querySelector('#fRat');r.value='1800';r.oninput();return 1})()`);
  await new Promise(r=>setTimeout(r,250));
  tt('round shows the bonus live', /bonus \+0\.5/.test(await ev(`document.querySelector('#fStr').textContent`)));

  // R2: lose to a 1300 -> explicitly no penalty
  await ev(`(window.CHESS._go('round',{rIdx:1}),1)`); await new Promise(r=>setTimeout(r,300));
  await ev(`(document.querySelector('[data-res="L"]').click(),1)`); await new Promise(r=>setTimeout(r,250));
  await ev(`(function(){var r=document.querySelector('#fRat');r.value='1300';r.oninput();return 1})()`);
  await new Promise(r=>setTimeout(r,250));
  const downTxt = await ev(`document.querySelector('#fStr').textContent`);
  tt('loss to a 1300 says no penalty', /no penalty for playing down/.test(downTxt));
  tt('and never shows a minus', !/-0\./.test(downTxt.replace(/\(-\d+\)/,'')));

  // remaining rounds
  for (const [i,res,rat] of [[2,'L','1600'],[3,'D','1620'],[4,'W','1550'],[5,'L','1700']]){
    await ev(`(window.CHESS._go('round',{rIdx:${i}}),1)`); await new Promise(r=>setTimeout(r,260));
    await ev(`(document.querySelector('[data-res="${res}"]').click(),1)`); await new Promise(r=>setTimeout(r,220));
    await ev(`(function(){var r=document.querySelector('#fRat');r.value='${rat}';r.oninput();return 1})()`);
    await new Promise(r=>setTimeout(r,180));
  }
  const evalT = await ev(`(function(){var t=window.CHESS._db().tournaments[0],e=window.CHESS.evaluate(t);
    return {raw:e.ts.pts,bonus:e.str.total,adj:e.adjPts,money:e.fin.money}})()`);
  t('raw 2.5, bonus +0.5, counts as 3.0', [evalT.raw,evalT.bonus,evalT.adj], [2.5,0.5,3]);
  t('bonus lifts a neutral 2.5 to a $5 reward', evalT.money, 5);

  await ev(`(window.CHESS._go('tour',{tab:'summary'}),1)`); await new Promise(r=>setTimeout(r,400));
  const sumTxt = await ev(`document.querySelector('#tourBody').textContent`);
  tt('summary headline is still the raw score', /TOURNAMENT SCORE/.test(sumTxt));
  tt('summary shows the bonus', /Strength bonus \+0\.5/.test(sumTxt));
  tt('summary shows what it counts as', /counts as 3/.test(sumTxt));
  tt('summary reassures about playing down', /never penalised/.test(sumTxt));
  tt('no minus sign anywhere in the summary', !/−0\.|\s-0\./.test(sumTxt));

  await ev(`(window.CHESS._go('more'),1)`); await new Promise(r=>setTimeout(r,350));
  const moreTxt = await ev(`document.querySelector('#moreBody').textContent`);
  tt('More documents the bonus table', /Opponent strength bonus/.test(moreTxt));
  tt('More says playing down is free', /never costs anything/.test(moreTxt));

  console.log('\n[13] FOUR-ROUND EVENT (real clicks)');
  await ev(`(window.CHESS._db().tournaments.length=0,window.CHESS._go('home'),1)`);
  await new Promise(r=>setTimeout(r,250));
  await ev(`(document.querySelector('#newT').click(),1)`);
  await new Promise(r=>setTimeout(r,250));
  await ev(`(document.querySelector('#ntName').value='Saturday Quad',document.querySelector('#ntDate').value='2026-09-10',document.querySelector('#ntRounds').value='4',document.querySelector('#ntRating').value='1560',document.querySelector('#ntGo').click(),1)`);
  await new Promise(r=>setTimeout(r,350));
  t('4 rounds created', await ev(`window.CHESS._db().tournaments[0].rounds.length`), 4);
  t('4 round rows on screen', await ev(`document.querySelectorAll('[data-r]').length`), 4);
  tt('header says 4 rounds', /4 rounds/.test(await ev(`document.querySelector('#hSub').textContent`)));

  // sweep all four
  for (let i=0;i<4;i++){
    await ev(`(window.CHESS._go('round',{rIdx:${i}}),1)`); await new Promise(r=>setTimeout(r,260));
    await ev(`(document.querySelector('[data-res="W"]').click(),1)`); await new Promise(r=>setTimeout(r,220));
  }
  const four = await ev(`(function(){var t=window.CHESS._db().tournaments[0],e=window.CHESS.evaluate(t);
    return {raw:e.ts.pts,eq:e.base.equivalent,money:e.fin.money,sup:e.fin.isSuper,blocked:e.base.topTierBlocked}})()`);
  t('4/4 raw', four.raw, 4);
  t('4/4 read from the 4-round table', four.eq, 4);
  t('4/4 pays $100, NOT $2,000', four.money, 100);
  t('4/4 is not the perfect-score tier', four.sup, false);
  t('4/4 flagged as top-tier blocked', four.blocked, true);

  await ev(`(window.CHESS._go('tour',{tab:'summary'}),1)`); await new Promise(r=>setTimeout(r,400));
  const fourTxt = await ev(`document.querySelector('#tourBody').textContent`);
  tt('summary says which table was read', /Read from the 4-round table/.test(fourTxt));
  tt('summary explains the reserved prize', /reserved for winning six games/.test(fourTxt));
  // the $2,000 is named only to explain why this sweep does not get it
  t('the reward actually paid is $100', await ev(`document.querySelector('#tourBody .reward .val').textContent`), '$100');
  tt('the reward block is not the super tier', await ev(`!document.querySelector('#tourBody .reward').classList.contains('super')`));

  // walk the 4-round table back down by changing results
  for (const [res, want] of [['D', 20], ['L', 10]]){
    await ev(`(window.CHESS._go('round',{rIdx:3}),1)`); await new Promise(r=>setTimeout(r,260));
    await ev(`(document.querySelector('[data-res="${res}"]').click(),1)`); await new Promise(r=>setTimeout(r,240));
    const m = await ev(`window.CHESS.evaluate(window.CHESS._db().tournaments[0]).fin.money`);
    t('3 wins + 1 ' + res + ' -> $' + want, m, want);
  }

  await ev(`(window.CHESS._go('more'),1)`); await new Promise(r=>setTimeout(r,350));
  const moreTxt4 = await ev(`document.querySelector('#moreBody').textContent`);
  tt('More shows a 4-round reward table', /Reward table \(4 rounds\)/.test(moreTxt4));
  tt('More explains it is not a conversion', /its own table, not a converted one/.test(moreTxt4));

  // a real 6-round sweep still wins the big one
  await ev(`(function(){var t=window.CHESS.newTournament('Six','2026-09-10',6);
    t.rounds.forEach(function(r){r.result='W'});window.CHESS._db().tournaments.push(t);
    window.CHESS._go('tour',{tId:t.id,tab:'summary'});return 1})()`);
  await new Promise(r=>setTimeout(r,400));
  tt('a genuine 6/6 still pays $2,000', /\$2,000/.test(await ev(`document.querySelector('#tourBody').textContent`)));

  console.log('\n[14] EFFORT BONUS ON A LOSING TOURNAMENT');
  // 2.0/6 with excellent process: used to pay $0, only "not punished". Now pays.
  await ev(`(function(){var C=window.CHESS,t=C.newTournament('Hard Weekend','2026-09-10',6);
    ['L','L','D','L','D','L'].forEach(function(r,i){t.rounds[i].result=r;
      t.rounds[i].proc={A:'met',B:'met',C:'met',D:'star',E:'met'}});
    C._db().tournaments.push(t); C._go('tour',{tId:t.id,tab:'summary'}); return 1})()`);
  await new Promise(r=>setTimeout(r,450));
  const hard = await ev(`(function(){var t=window.CHESS._db().tournaments.slice(-1)[0],e=window.CHESS.evaluate(t);
    return {raw:e.ts.pts,proc:e.proc.total,money:e.fin.money,days:e.fin.days,kind:e.fin.kind,bonus:e.fin.processBonus}})()`);
  t('raw 1.0/6 with a 20/20 process', [hard.raw,hard.proc], [1,20]);
  t('break waived', [hard.days,hard.kind], [0,'waived']);
  t('and $25 actually paid (used to be $0)', [hard.money,hard.bonus], [25,25]);
  const hardTxt = await ev(`document.querySelector('#tourBody').textContent`);
  tt('summary shows the money', /\$25/.test(hardTxt));
  tt('summary still shows the waiver', /waived/.test(hardTxt));
  tt('summary strikes through the old break', await ev(`!!document.querySelector('#tourBody .strike')`));

  // a break that only gets halved must NOT also pay money
  await ev(`(function(){var C=window.CHESS,t=C.newTournament('Halved','2026-09-10',6);
    ['L','L','D','L','D','L'].forEach(function(r,i){t.rounds[i].result=r;
      t.rounds[i].proc={A:'met',B:'met',C:'met',D:'partial',E:'partial'}});
    C._db().tournaments.push(t); C._go('tour',{tId:t.id,tab:'summary'}); return 1})()`);
  await new Promise(r=>setTimeout(r,450));
  const halved = await ev(`(function(){var t=window.CHESS._db().tournaments.slice(-1)[0],e=window.CHESS.evaluate(t);
    return {proc:e.proc.total,money:e.fin.money,days:e.fin.days,kind:e.fin.kind}})()`);
  tt('process lands in the 15-17 band', halved.proc >= 15 && halved.proc <= 17);
  t('break is halved, not waived', halved.kind, 'hold');
  t('no money while a break remains', halved.money, 0);
  tt('summary says the credit went into the break', /went into shortening the break/.test(
    await ev(`document.querySelector('#tourBody').textContent`)));

  console.log('\n[15] LAYOUT + ERRORS');
  for (const w of [320,390,430]){
    await send('Emulation.setDeviceMetricsOverride',{width:w,height:844,deviceScaleFactor:2,mobile:true});
    await ev(`(window.CHESS._go('round',{rIdx:0}),1)`); await new Promise(r=>setTimeout(r,350));
    const ov = await ev(`(function(){var d=document.documentElement,o=[];
      document.querySelectorAll('*').forEach(function(el){var r=el.getBoundingClientRect();
        if(r.width>0&&r.right>d.clientWidth+1)o.push(el.className||el.tagName)});
      return {w:d.clientWidth,h:d.scrollWidth>d.clientWidth+1,over:o.slice(0,5)}})()`);
    t('no overflow @'+w, [ov.h,ov.over.length], [false,0]);
  }
  t('zero JS errors', consoleErrs.filter(Boolean), []);

  console.log('\n=== '+pass+' passed, '+fail+' failed ===');
  ws.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
