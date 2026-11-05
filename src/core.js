const VERSION=1, DAY=1440, PERIODS=[5,15,60,1440];
const backgrounds=[
 {id:'worker',name:'普通上班族',desc:'白天改表格，晚上看行情。母亲偶尔发来一张晚饭的照片。',bank:20000,debt:0,wage:420,expense:180,limit:50000,assets:[['car','代步汽车',60000,.8,2],['computer','电脑',6000,.65,1]]},
 {id:'debtor',name:'背债者',desc:'工资到账的提醒，总比还款提醒晚一些。朋友阿岚还在等你一起吃饭。',bank:3000,debt:80000,wage:360,expense:150,limit:120000,assets:[['computer','电脑',4000,.6,1]]},
 {id:'owner',name:'有房有积蓄',desc:'房子已经付清，抽屉里还有几张没用完的装修收据。你原本不急着改变生活。',bank:180000,debt:0,wage:600,expense:220,limit:200000,assets:[['home','自住房',1200000,.85,7],['car','汽车',120000,.8,2],['computer','电脑',10000,.65,1]]}
];
const cents=n=>Math.round(n*100), quant=n=>Math.round(n*1e8)/1e8;
const rate=p=>p<=.5?.02:.02*(1-p)/p;
function cdf(x){const a=Math.abs(x),t=1/(1+.2316419*a),d=.3989422804014327*Math.exp(-a*a/2);const v=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?v:1-v;}
function random(s){let x=s.seed|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.seed=x>>>0;return (s.seed+.5)/4294967296;}
function normal(s){return Math.sqrt(-2*Math.log(random(s)))*Math.cos(2*Math.PI*random(s));}
function price(r,side){return side==='up'?r.p:1-r.p;}
function quote(budget,p,leverage){if(!Number.isSafeInteger(budget)||budget<=0||!Number.isFinite(p)||p<.009999||p>.990001||![1,2,5,10].includes(leverage))throw Error('请输入有效的投入金额。');const exactCost=budget/(1/leverage+rate(p));const cost=Math.round(exactCost);const fee=Math.round(exactCost*rate(p));const margin=budget-fee;return {budget,cost,fee,margin,grossCarry:0,finance:cost-margin,q:quant(exactCost/100/p),p,leverage};}
function newGame(id,seed){const b=backgrounds.find(x=>x.id===id);if(!b)throw Error('人物背景无效');const s={version:VERSION,background:id,seed:(seed>>>0)||123456789,time:0,cash:cents(10000),bank:cents(b.bank),debt:cents(b.debt),wage:cents(b.wage),expense:cents(b.expense),limit:cents(b.limit),assets:b.assets.map(a=>({id:a[0],name:a[1],value:cents(a[2]),discount:a[3],days:a[4],sold:false})),positions:[],round:null,roundNo:0,nextPeriod:15,guide:1,paused:true,ended:null,events:[],ledger:[],flags:{},stats:{fees:0,pnl:0,peak:cents(10000),wins:0,losses:0,streak:0,withdraw:0,deposit:0,liquidations:0},serial:0};event(s,'起点','你给交易账户放进了 10,000 U。生活里的钱还在另一个口袋。','start');return s;}
function total(s){return s.cash+s.bank+equity(s)+s.assets.filter(a=>!a.sold).reduce((n,a)=>n+a.value,0)-s.debt;}
function equity(s){return s.positions.reduce((n,o)=>n+Math.max(0,Math.round(o.q*price(s.round,o.side)*100+(o.grossCarry||0))-o.finance),0);}
