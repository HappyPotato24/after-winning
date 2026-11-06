function lifeAllowed(s){if(s.ended||s.guide<=2)throw Error('请先完成两局引导');}
function transfer(s,amount,direction){lifeAllowed(s);if(!Number.isSafeInteger(amount)||amount<=0)throw Error('请输入正数金额');if(direction==='out'){if(amount>s.cash)throw Error('可用余额不足，不能提现持仓');s.cash-=amount;s.bank+=amount;s.stats.withdraw+=amount;entry(s,'提现到银行',-amount,amount);once(s,'withdraw','钱回到了生活里','银行余额更新了。你终于想起，那张一直没换的旧床垫。');}else{if(amount>s.bank)throw Error('银行存款不足');s.bank-=amount;s.cash+=amount;s.stats.deposit+=amount;entry(s,'转入交易',amount,-amount);if(s.flags.withdraw)once(s,'return','又打开了那个页面','提现的记录还在，新的转账已经完成。阿岚的聊天窗口被挤到了后面。');}event(s,direction==='out'?'落袋的一笔':'返回交易',`${(amount/100).toFixed(2)} U 已转移。转账不计入交易盈利。`,'transfer');}
function borrow(s,amount){lifeAllowed(s);if(!Number.isSafeInteger(amount)||amount<=0||amount>Math.max(0,s.limit-s.debt))throw Error('超过剩余借款额度');s.bank+=amount;s.debt+=amount;entry(s,'生活借款',0,amount,amount);event(s,'借来的现金',`借入 ${(amount/100).toFixed(2)} U。银行里多了一笔钱，负债栏也是。每日利率 0.03%，复利计息。`,'debt');s.flags.borrow=true;}
function repay(s,amount){lifeAllowed(s);if(!Number.isSafeInteger(amount)||amount<=0||amount>s.bank||amount>s.debt)throw Error('还款金额超过存款或债务');s.bank-=amount;s.debt-=amount;entry(s,'主动还款',0,-amount,-amount);event(s,'少了一点重量',`还掉 ${(amount/100).toFixed(2)} U。你把还款提醒向后划走，这一次是真的。`,'debt');}
function day(s,work){lifeAllowed(s);advance(s,DAY);if(work){s.bank+=s.wage;entry(s,'工作一天',0,s.wage);event(s,'回到日常',`一整天的工作结束，工资 ${(s.wage/100).toFixed(2)} U 进入银行。楼下那家面店还开着。`,'work');}else event(s,'没有盯盘的一天','你洗了衣服，给家里回了电话。生活费和债务利息仍照常计算。','rest');s.paused=true;milestones(s);}
function skipDays(s,days,work){
  lifeAllowed(s);
  if(!Number.isSafeInteger(days)||days<1||days>3650||typeof work!=='boolean')throw Error('请选择 1～3650 的整数天数和有效的生活方式');
  if(s.time+days*DAY>1e8)throw Error('快进后的日期超出可保存范围，请减少天数');
  // Simulate on a candidate so a failed range/save check never changes the real story.
  const draft=JSON.parse(JSON.stringify(s));
  let income=0;
  for(let i=0;i<days;i++){
    advance(draft,DAY);
    if(work){draft.bank+=draft.wage;income+=draft.wage;entry(draft,'工作一天',0,draft.wage,0,0,`多天快进 · 第 ${i+1}/${days} 天`);}
    if(![draft.cash,draft.bank,draft.debt].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1e15))throw Error('快进后的金额超出可保存范围，当前故事未改变，请减少天数');
    milestones(draft);
  }
  draft.paused=true;
  event(draft,work?`按时出门的 ${days} 天`:`日历翻过了 ${days} 天`,`${work?'这段时间，你每天去工作，晚上再回到自己的生活。':'你暂时离开了行情，把这些天留给了生活。'} 共推进 ${days} 天，工资累计 ${(income/100).toFixed(2)} U；银行存款变化 ${((draft.bank-s.bank)/100).toFixed(2)} U，生活债务变化 ${((draft.debt-s.debt)/100).toFixed(2)} U。每日开支和利息都已经记在账上。`,'timeskip');
  let checked;
  try{checked=validate(draft);}catch{throw Error('本次快进超出存档可保存范围，当前故事未改变，请减少天数');}
  Object.assign(s,checked);
}
function updateLiving(s,changes){
  lifeAllowed(s);
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Object.keys(changes).length||Object.keys(changes).some(k=>!['wage','expense'].includes(k)))throw Error('请填写需要修改的收入或生活费');
  for(const n of Object.values(changes))if(!Number.isSafeInteger(n)||n<0||n>100000000000)throw Error('收入和生活费须为 0～1,000,000,000 U，最多两位小数');
  const before={wage:s.wage,expense:s.expense},draft=JSON.parse(JSON.stringify(s));
  if(Object.hasOwn(changes,'wage'))draft.wage=changes.wage;
  if(Object.hasOwn(changes,'expense'))draft.expense=changes.expense;
  const note=`每日工作收入 ${(before.wage/100).toFixed(2)} → ${(draft.wage/100).toFixed(2)} U；每日生活费 ${(before.expense/100).toFixed(2)} → ${(draft.expense/100).toFixed(2)} U`;
  entry(draft,'调整生活收支',0,0,0,0,note);
  event(draft,'重新安排日常',`${note}。你把接下来的日子重新算了一遍，过去已经发生的工资与账单仍留在原处。`,'budget');
  let checked;
  try{checked=validate(draft);}catch{throw Error('本次修改超出存档可保存范围，当前故事未改变');}
  Object.assign(s,checked);
}

function sellAsset(s,id){lifeAllowed(s);const a=s.assets.find(x=>x.id===id);if(!a||a.sold)throw Error('资产已出售或不存在');a.sold=true;advance(s,a.days*DAY);const proceeds=Math.round(a.value*a.discount);s.bank+=proceeds;if(a.id==='car'){s.wage=Math.round(s.wage*.85);s.expense+=2000;}if(a.id==='home')s.expense+=12000;entry(s,'变卖'+a.name,0,proceeds,0,0,`耗时 ${a.days} 天；账面价值 ${a.value/100} U`);event(s,'空出来的位置',`${a.name}卖了 ${(proceeds/100).toFixed(2)} U。${a.id==='home'?'钥匙交出去以后，每天增加 120 U 租金。':a.id==='car'?'以后工资减少 15%，每天多花 20 U 通勤。':'桌上空了一块，钱进入了银行。'}`,'asset');s.paused=true;milestones(s);}
function finish(s,kind){if(s.ended)throw Error('故事已终止');if(kind==='leave'&&s.round){for(const o of [...s.positions])close(s,o.id,1,'exit');s.round=null;}s.ended=kind;s.paused=true;event(s,kind==='leave'?'合上屏幕':'故事在这里停下',kind==='leave'?`你选择离场。净资产 ${(total(s)/100).toFixed(2)} U，生活债务 ${(s.debt/100).toFixed(2)} U。${s.debt>0?'未还完的债，仍属于以后的生活。':'窗外还有一整天。'} ${s.flags.withdraw?'曾经落袋的钱，也曾带来真实的片刻安稳。':''}`:'人物的故事到此终止。不描写过程。当前资产、持仓与债务作为记录保留，没有奖励，也没有债务豁免。','ending');}
