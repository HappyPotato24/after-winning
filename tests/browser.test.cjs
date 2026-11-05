const fs=require('node:fs'),http=require('node:http'),cp=require('node:child_process'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const html=cp.execFileSync('wsl',['-d','Ubuntu2404','--','cat','/home/ubuntu/Potato/dist/赢过以后.html']);const writeWSL=(name,data)=>cp.execFileSync('wsl',['-d','Ubuntu2404','--','python3','-c','import sys,pathlib; pathlib.Path(sys.argv[1]).write_bytes(sys.stdin.buffer.read())','/home/ubuntu/Potato/'+name],{input:data});const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(8765,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'winning-browser-'));const chrome=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9223','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,errors=[],results=[];try{let targets;for(let i=0;i<50;i++){try{targets=await (await fetch('http://127.0.0.1:9223/json')).json();if(targets.length)break;}catch{}await new Promise(r=>setTimeout(r,200));}if(!targets?.length)throw Error('Chrome debug endpoint unavailable');ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0,pending=new Map();ws.addEventListener('message',e=>{const msg=JSON.parse(e.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}});const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});const evalJS=async expression=>{let v=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(v.exceptionDetails)throw Error(JSON.stringify(v.exceptionDetails));return v.result.value;};const click=sel=>evalJS(`document.querySelector(${JSON.stringify(sel)}).click()`);const sleep=ms=>new Promise(r=>setTimeout(r,ms));const check=(label,condition)=>{assert.ok(condition,label);results.push(label);console.log('PASS '+label);};await cmd('Runtime.enable');await cmd('Page.enable');await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await cmd('Page.navigate',{url:'http://127.0.0.1:8765'});await sleep(700);check('中文人物创建页面',await evalJS('document.body.innerText.includes("如果赢了很多")'));check('默认角色保留三种原角色并新增赌狗',await evalJS(`document.querySelectorAll('[data-action="create"]').length===4&&!!document.querySelector('[data-action="create"][data-id="gambler"]')`));
await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>writeWSL('tests/creation-desktop.png',Buffer.from(r.data,'base64')));
const setSetup=async(key,value)=>evalJS(`(()=>{const input=document.getElementById('setup-'+${JSON.stringify(key)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await setSetup('bank','4999.99');await setSetup('debt','80000');await setSetup('home','1000000');
check('自定义低存款优先判定赌狗，即使有房和债务',await evalJS(`document.getElementById('custom-role-name').textContent==='赌狗'`));
await setSetup('bank','5000');check('5000 U 边界有债务判为背债者',await evalJS(`document.getElementById('custom-role-name').textContent==='背债者'`));
await setSetup('debt','0');check('存款达标且有房分配有房有积蓄',await evalJS(`document.getElementById('custom-role-name').textContent==='有房有积蓄'`));
await setSetup('home','0');check('其余配置分配普通上班族',await evalJS(`document.getElementById('custom-role-name').textContent==='普通上班族'`));
await setSetup('wage','');check('缺失或无效自定义数据禁止开局',await evalJS(`document.querySelector('[data-action="create-custom"]').disabled`));
await setSetup('wage','0');check('自定义支持零收入并显示对应故事提示',await evalJS(`!document.querySelector('[data-action="create-custom"]').disabled&&document.getElementById('custom-preview').innerText.includes('没有固定收入')`));
await setSetup('bank','4999.99');await setSetup('debt','80000');await setSetup('home','1000000');await setSetup('wage','123.45');
await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(200);
check('390px 手机开局表单与角色卡片无横向溢出',await evalJS('document.documentElement.scrollWidth<=window.innerWidth'));
await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>writeWSL('tests/creation-mobile.png',Buffer.from(r.data,'base64')));
await click('[data-action="create-custom"]');let customSaved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');
check('界面自定义开局精确采用金额并写入角色故事',customSaved.background==='gambler'&&customSaved.cash===1000000&&customSaved.bank===499999&&customSaved.debt===8000000&&customSaved.wage===12345&&customSaved.origin.mode==='custom'&&customSaved.events[0].text.includes('123.45'));
await cmd('Page.reload');await sleep(400);customSaved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');
check('自定义角色刷新后完整恢复',customSaved.bank===499999&&customSaved.debt===8000000&&customSaved.assets.some(a=>a.id==='home'&&a.value===100000000)&&await evalJS('document.body.innerText.includes("自定义开局")'));
await click('[data-action="leave"]');await click('[data-action="confirm"]');await click('[data-action="new"]');await click('[data-action="confirm"]');
await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await sleep(200);
await click('[data-action="create"]');await click('[data-action="start"]');await click('[data-action="help"]');await click('[data-action="confirm"]');check('引导下单前打开弹窗后可手动恢复',await evalJS(`!document.querySelector('[data-action="pause"]').disabled`));await click('[data-action="pause"]');await click('[data-action="buy"]');await sleep(1700);check('引导行情实际绘制有转折的 SVG 折线',await evalJS(`(()=>{const line=document.querySelector('polyline[data-chart="guide-line"]');if(!line)return false;const p=line.getAttribute('points').trim().split(/\\s+/).map(v=>v.split(',').map(Number));return p.length>=5&&p.slice(2).some((v,i)=>(v[1]-p[i+1][1])*(p[i+1][1]-p[i][1])<0);})()`));await sleep(4000);let saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');check('浏览器第一局实际等待并结算 980392.16',saved.cash===98039216&&saved.guide===2);check('剧情弹窗冻结时钟',saved.paused===true);await click('[data-action="confirm"]');await click('[data-action="start"]');await click('[data-action="buy"]');await sleep(5700);saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');check('浏览器第二局 490196.08 且自由操作解锁',saved.cash===49019608&&saved.guide===3);await click('[data-action="confirm"]');await click('[data-action="start"]');await click('[data-action="side"][data-id="down"]');await click('[data-action="leverage"][data-n="5"]');await evalJS(`document.querySelector('[data-action="buy"]').click();document.querySelector('[data-action="pause"]').click();`);saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');check('自由下单：跌方向 5 倍仓位',saved.positions[0]?.leverage===5&&saved.positions[0]?.side==='down');await cmd('Page.captureScreenshot',{format:'png'}).then(r=>writeWSL('tests/desktop.png',Buffer.from(r.data,'base64')));const before=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1")).time');await sleep(1000);check('暂停后时钟保持不变',await evalJS('JSON.parse(localStorage.getItem("after-winning.v1")).time')===before);await cmd('Page.reload');await sleep(600);check('刷新恢复存档并保持暂停',await evalJS('document.body.innerText.includes("恢复行情")'));await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await sleep(300);check('390px 手机视口无横向溢出',await evalJS('document.documentElement.scrollWidth<=window.innerWidth'));await cmd('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}).then(r=>writeWSL('tests/mobile.png',Buffer.from(r.data,'base64')));await evalJS(`window.__exported=null;const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.__exportPromise=blob.text().then(t=>window.__exported=t);return original.call(URL,blob);};HTMLAnchorElement.prototype.click=function(){};`);await click('[data-action="save"]');await click('#exportDirect');await evalJS('window.__exportPromise');const exported=await evalJS('window.__exported');check('界面导出为可验证的完整 JSON',JSON.parse(exported).positions.length===1);await evalJS(`const file=new File([window.__exported],'test.json',{type:'application/json'});const dt=new DataTransfer();dt.items.add(file);document.getElementById('file').files=dt.files;document.getElementById('file').dispatchEvent(new Event('change'));`);await sleep(300);check('导入前出现备份与恢复确认',await evalJS('document.getElementById("modal").innerText.includes("备份并恢复")'));await click('[data-action="confirm"]');saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');check('界面导入恢复持仓资金与暂停状态',saved.cash===JSON.parse(exported).cash&&saved.positions.length===1&&saved.paused);await click('[data-action="tab"][data-id="life"]');await click('[data-action="work"]');await click('[data-action="confirm"]');saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');check('工作操作推进一天并处理旧持仓',saved.time>=1450&&saved.round===null);await click('[data-action="tab"][data-id="story"]');check('故事轨迹包含工作节点',await evalJS('document.body.innerText.includes("回到日常")'));await click('[data-action="leave"]');await click('[data-action="confirm"]');check('主动离场界面生成',await evalJS('document.body.innerText.includes("导出这段故事")'));// Restart choices must not force a download or discard a cancelled story.
async function captureRestartExports(){
  await evalJS(`(()=>{window.__restartExports=0;const capture=URL.createObjectURL;URL.createObjectURL=function(blob){window.__restartExports++;window.__exportPromise=blob.text().then(text=>window.__exported=text);return capture.call(URL,blob);};HTMLAnchorElement.prototype.click=function(){};})()`);
}
await captureRestartExports();
const endedBeforeRestart=await evalJS('localStorage.getItem("after-winning.v1")');
await click('[data-action="new"]');
check('结束页重开提供不导出、导出后重开和取消',await evalJS(`document.querySelector('[data-action="confirm"]').textContent==='不导出，重新开始'&&document.querySelector('[data-action="restart-export"]').textContent==='导出后重新开始'&&!!document.querySelector('[data-action="cancel"]')`));
await click('[data-action="cancel"]');
check('取消重开保留完整结束存档且不导出',await evalJS('localStorage.getItem("after-winning.v1")')===endedBeforeRestart&&await evalJS('window.__restartExports')===0);
await click('[data-action="new"]');
await click('[data-action="confirm"]');
check('不导出重开不生成文件并回到人物选择',await evalJS(`window.__restartExports===0&&localStorage.getItem('after-winning.v1')===null&&document.body.innerText.includes('如果赢了很多')`));
await cmd('Page.reload');await sleep(400);
check('不导出重开刷新后不会恢复旧故事',await evalJS(`localStorage.getItem('after-winning.v1')===null&&document.body.innerText.includes('如果赢了很多')`));
await click('[data-action="create"][data-id="debtor"]');
const fresh=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');
check('重开的新人物资金、债务和轨迹独立初始化',fresh.cash===1000000&&fresh.bank===300000&&fresh.debt===8000000&&fresh.guide===1&&fresh.roundNo===0&&fresh.events[0].kind==='start'&&fresh.events.every(e=>e.time===0&&['start','milestone'].includes(e.kind))&&fresh.ledger.length===0&&fresh.ended===null);
await click('[data-action="leave"]');await click('[data-action="confirm"]');
await captureRestartExports();
await click('[data-action="new"]');
await evalJS(`window.__restartExportButton=document.querySelector('[data-action="restart-export"]');window.__restartExportButton.click();window.__restartExportButton.click();`);
await evalJS('window.__exportPromise');
const restartExport=await evalJS('JSON.parse(window.__exported)');
check('导出后重开仅导出一次且保留结束状态与债务',await evalJS('window.__restartExports')===1&&restartExport.background==='debtor'&&restartExport.debt===8000000&&restartExport.ended==='leave');
check('导出后重开清除当前存档并回到人物选择',await evalJS(`localStorage.getItem('after-winning.v1')===null&&document.body.innerText.includes('如果赢了很多')`));
await cmd('Network.enable');await cmd('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});await cmd('Page.navigate',{url:'file://wsl.localhost/Ubuntu2404/home/ubuntu/Potato/dist/'+encodeURIComponent('赢过以后.html')});await sleep(700);check('直接离线打开单文件中文页面',await evalJS('document.body.innerText.includes("如果赢了很多")'));await click('[data-action="create"]');await click('[data-action="start"]');check('离线引导预览按 0.01 价格计算费用与份额',await evalJS('document.getElementById("preview").innerText.includes("196.08")&&document.getElementById("preview").innerText.includes("980392.1569")'));// Regression: exact countdown formats and pointer targets across live market ticks.
async function loadRound(period){
  const fixtureJSON=await evalJS(`const fixture=Game.newGame('worker',123456);fixture.guide=3;fixture.nextPeriod=${period};Game.startRound(fixture);fixture.paused=true;JSON.stringify(fixture);`);
  const injected=await cmd('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('after-winning.v1',${JSON.stringify(fixtureJSON)});`});
  await cmd('Page.reload');
  await sleep(400);
  await cmd('Page.removeScriptToEvaluateOnNewDocument',{identifier:injected.identifier});
}
for(const [period,expected] of [[5,'00:05'],[15,'00:15'],[60,'01:00'],[1440,'24:00']]){
  await loadRound(period);
  check(`周期 ${period}：游戏时:分 / 现实分:秒`,await evalJS(`document.getElementById('game-countdown').textContent==='${expected}'&&document.getElementById('real-countdown').textContent==='${expected}'&&document.getElementById('game-countdown').parentElement.innerText.includes('时:分')&&document.getElementById('real-countdown').parentElement.innerText.includes('分:秒')`));
}
await loadRound(60);
await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await sleep(200);
await click('[data-action="pause"]');
const pointerAt=async selector=>{
  const point=await evalJS(`(()=>{const button=document.querySelector(${JSON.stringify(selector)});button.scrollIntoView({block:'center'});const rect=button.getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};})()`);
  await cmd('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
  return point;
};
await evalJS(`window.__buyButton=document.querySelector('[data-action="buy"]');window.__amountInput=document.getElementById('amount');`);
const buyPoint=await pointerAt('[data-action="buy"]');
await sleep(800);
check('行情刷新期间悬停买入按钮不被替换',await evalJS(`window.__buyButton===document.querySelector('[data-action="buy"]')&&window.__buyButton.matches(':hover')`));
await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...buyPoint});
await sleep(650);
await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...buyPoint});
saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');
check('买入按下后跨多个刷新再释放仍仅成交一笔',saved.positions.length===1&&saved.ledger.filter(e=>e.type==='买入').length===1);
await evalJS(`document.getElementById('amount').focus();document.getElementById('amount').select();`);
await cmd('Input.insertText',{text:'750.25'});
await sleep(700);
check('行情刷新保留金额输入节点、焦点与输入值',await evalJS(`document.getElementById('amount')===window.__amountInput&&document.activeElement===window.__amountInput&&window.__amountInput.value==='750.25'`));
await evalJS(`window.__sellButton=document.querySelector('[data-action="sell"][data-fraction=".25"]');`);
const sellPoint=await pointerAt('[data-action="sell"][data-fraction=".25"]');
await sleep(700);
check('行情刷新期间悬停卖出按钮不被替换',await evalJS(`window.__sellButton===document.querySelector('[data-action="sell"][data-fraction=".25"]')&&window.__sellButton.matches(':hover')`));
const qBefore=saved.positions[0].q;
await cmd('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...sellPoint});
await sleep(650);
await cmd('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...sellPoint});
saved=await evalJS('JSON.parse(localStorage.getItem("after-winning.v1"))');
check('卖出按下后跨多个刷新再释放仍仅卖出一次',saved.positions.length===1&&saved.positions[0].q<qBefore&&saved.ledger.filter(e=>e.type==='提前卖出').length===1);
check('分钟倒计时在未满一分钟时不提前显示零',await evalJS(`/^\\d{2}:\\d{2}$/.test(document.getElementById('game-countdown').textContent)&&!document.getElementById('game-countdown').parentElement.innerText.includes('秒')`));
await click('[data-action="pause"]');
check('浏览器无 JavaScript 异常',errors.length===0);writeWSL('tests/browser-results.json',JSON.stringify({results,errors},null,2));console.log('Browser checks complete');
}catch(e){console.error(e);process.exitCode=1;}finally{if(ws)ws.close();chrome.kill();server.close();}
})();
