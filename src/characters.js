const backgrounds=[
 {id:'worker',name:'普通上班族',desc:'白天改表格，晚上看行情。母亲偶尔发来一张晚饭的照片。',bank:20000,debt:0,wage:420,expense:180,limit:50000,assets:[['car','代步汽车',60000,.8,2],['computer','电脑',6000,.65,1]]},
 {id:'debtor',name:'背债者',desc:'工资到账的提醒，总比还款提醒晚一些。朋友阿岚还在等你一起吃饭。',bank:3000,debt:80000,wage:360,expense:150,limit:120000,assets:[['computer','电脑',4000,.6,1]]},
 {id:'owner',name:'有房有积蓄',desc:'房子已经付清，抽屉里还有几张没用完的装修收据。你原本不急着改变生活。',bank:180000,debt:0,wage:600,expense:220,limit:200000,assets:[['home','自住房',1200000,.85,7],['car','汽车',120000,.8,2],['computer','电脑',10000,.65,1]]},
 {id:'gambler',name:'赌狗',desc:'相册里存着几张大赚的截图，银行里却只剩一小笔钱。你总觉得，下一次就能把日子赢回来。',bank:2500,debt:15000,wage:280,expense:140,limit:30000,assets:[['computer','电脑',3000,.6,1]]}
];

// Custom setup values use integer cents, just like all saved money fields.
const setupFields=['bank','debt','wage','expense','limit','home','car','computer','other'];
function checkedSetup(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('自定义开局数据无效');
  const result={};
  for(const key of setupFields){
    if(!Number.isSafeInteger(raw[key])||raw[key]<0||raw[key]>100000000000)throw Error('开局金额须为 0～1,000,000,000 U，最多两位小数');
    result[key]=raw[key];
  }
  return result;
}
function classifyProfile(raw){
  const v=checkedSetup(raw);
  if(v.bank<500000)return 'gambler';
  if(v.debt>0)return 'debtor';
  if(v.home>0||v.bank>=10000000||v.home+v.car+v.computer+v.other>=50000000)return 'owner';
  return 'worker';
}
function customAssets(raw){
  const v=checkedSetup(raw);
  return [['home','自住房',.85,7],['car','汽车',.8,2],['computer','电脑',.65,1],['other','其他资产',.7,2]]
    .filter(a=>v[a[0]]>0).map(a=>({id:a[0],name:a[1],value:v[a[0]],discount:a[2],days:a[3],sold:false}));
}
function profileIntro(raw){
  const v=checkedSetup(raw),id=classifyProfile(v),b=backgrounds.find(b=>b.id===id);
  if(id==='gambler'&&v.bank===0)return '相册里还存着大赚的截图，银行余额却已经见底。你总觉得，下一次就能把日子赢回来。';
  if(id==='owner'&&v.home===0)return '你还没有房产，但存款或手里的资产给生活留出了余地。阿岚说，周末找个地方坐坐，你原本并不急着改变什么。';
  if(v.wage===0&&id==='debtor')return '还款提醒照常亮起，固定收入却暂时停了。阿岚问你最近怎么样，你想了很久，只回了一句“还行”。';
  if(v.wage===0&&id==='worker')return '你曾经每天按时打卡，最近却暂时没有固定收入。母亲发来一张晚饭的照片，你想先把眼前的日子安排好。';
  return b.desc;
}
function initialStory(s){
  const b=backgrounds.find(x=>x.id===s.background);
  const origin=s.origin?.mode==='custom'?'这些数字是你亲手填下的。':'你选择从这段日常开始。';
  const income=s.wage===0?'目前没有固定收入，工资一栏暂时是零。':`每天的收入是 ${(s.wage/100).toFixed(2)} U，日常开支是 ${(s.expense/100).toFixed(2)} U。`;
  const debt=s.debt>0?`还有 ${(s.debt/100).toFixed(2)} U 生活债务，要在以后的日子里慢慢偿还。`:'暂时没有生活债务。';
  const intro=s.origin?.mode==='custom'?profileIntro(s.origin.initial):b.desc;
  return `${intro} ${origin}${income}${debt} 你给交易账户放进了 10,000 U，生活里的存款仍留在另一个口袋。`;
}
function newCustomGame(raw,seed){const setup=checkedSetup(raw);return newGame(classifyProfile(setup),seed,setup);}
