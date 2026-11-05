const VERSION=1, DAY=1440, PERIODS=[5,15,60,1440];
const cents=n=>Math.round(n*100), quant=n=>Math.round(n*1e8)/1e8;
const rate=p=>p<=.5?.02:.02*(1-p)/p;
function cdf(x){const a=Math.abs(x),t=1/(1+.2316419*a),d=.3989422804014327*Math.exp(-a*a/2);const v=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?v:1-v;}
function random(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return (s.seed+.5)/4294967296;}
function normal(s){return Math.sqrt(-2*Math.log(random(s)))*Math.cos(2*Math.PI*random(s));}
function price(r,side){return side==='up'?r.p:1-r.p;}
function quote(budget,p,leverage){if(!Number.isSafeInteger(budget)||budget<=0||!Number.isFinite(p)||p<.009999||p>.990001||![1,2,5,10].includes(leverage))throw Error('请输入有效的投入金额。');const exactCost=budget/(1/leverage+rate(p));const cost=Math.round(exactCost);const fee=Math.round(exactCost*rate(p));const margin=budget-fee;return {budget,cost,fee,margin,grossCarry:0,finance:cost-margin,q:quant(exactCost/100/p),p,leverage};}
function newGame(id,seed,custom=null){
  const b=backgrounds.find(x=>x.id===id);if(!b)throw Error('人物背景无效');
  const setup=custom===null?null:checkedSetup(custom);
  if(setup&&classifyProfile(setup)!==id)throw Error('自定义开局与角色判定不一致');
  const initial=setup||Object.fromEntries(['bank','debt','wage','expense','limit'].map(k=>[k,cents(b[k])]));
  const s={version:VERSION,background:id,origin:setup?{mode:'custom',initial:{...setup}}:{mode:'preset'},seed:(seed>>>0)||123456789,time:0,cash:cents(10000),bank:initial.bank,debt:initial.debt,wage:initial.wage,expense:initial.expense,limit:initial.limit,assets:setup?customAssets(setup):b.assets.map(a=>({id:a[0],name:a[1],value:cents(a[2]),discount:a[3],days:a[4],sold:false})),positions:[],round:null,roundNo:0,nextPeriod:15,guide:1,paused:true,ended:null,events:[],ledger:[],flags:{},stats:{fees:0,pnl:0,peak:cents(10000),wins:0,losses:0,streak:0,withdraw:0,deposit:0,liquidations:0},serial:0};
  event(s,'起点',initialStory(s),'start');return s;
}
function total(s){return s.cash+s.bank+equity(s)+s.assets.filter(a=>!a.sold).reduce((n,a)=>n+a.value,0)-s.debt;}
function equity(s){return s.positions.reduce((n,o)=>n+Math.max(0,Math.round(o.q*price(s.round,o.side)*100+(o.grossCarry||0))-o.finance),0);}
