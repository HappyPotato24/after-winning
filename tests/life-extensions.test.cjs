const assert = require('node:assert/strict');
const G = require('../src/engine.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function fresh(seed = 123, background = 'worker') {
  const s = G.newGame(background, seed);
  s.guide = 3;
  return s;
}
function finances(s) {
  return Object.fromEntries(['time','cash','bank','debt','wage','expense','seed','positions','round','roundNo','stats'].map(key => [key, s[key]]));
}
function unchangedOnError(s, fn) {
  const before = JSON.stringify(s);
  assert.throws(fn);
  assert.equal(JSON.stringify(s), before, 'rejected action must leave every state field unchanged');
}
function assertRepeatedDaysEquivalent(s, days, work) {
  const reference = structuredClone(s);
  G.skipDays(s, days, work);
  for (let i = 0; i < days; i++) G.day(reference, work);
  assert.deepEqual(finances(s), finances(reference));
  assert.equal(G.total(s), G.total(reference));
  assert.equal(s.paused, true);
  assert.deepEqual(G.validate(s), s);
}

test('休息快进与逐次休息 7 天的财务和时间相同', () => {
  assertRepeatedDaysEquivalent(fresh(), 7, false);
});
test('工作快进与逐次工作 90 天的财务和时间相同', () => {
  assertRepeatedDaysEquivalent(fresh(), 90, true);
});
test('跨日界线先记日账，再在完整工作日结束后发工资', () => {
  const s = fresh();
  s.time = 1439.75;
  s.bank = 0; s.debt = 0; s.wage = 30000; s.expense = 20000;
  G.skipDays(s, 2, true);
  assert.equal(s.time, 4319.75);
  assert.equal(s.bank, 40000);
  assert.equal(s.debt, 20006);
  assert.equal(s.ledger.filter(e => e.type === '每日生活费与利息').length, 2);
});
test('银行不足时按日累积生活欠款并复利计息，不动交易现金', () => {
  const s = fresh(); s.bank = 0; s.debt = 123456; s.expense = 18000;
  let expectedDebt = s.debt;
  for (let i = 0; i < 365; i++) expectedDebt += Math.round(expectedDebt * .0003) + s.expense;
  const cash = s.cash;
  G.skipDays(s, 365, false);
  assert.equal(s.debt, expectedDebt);
  assert.equal(s.bank, 0);
  assert.equal(s.cash, cash);
});
test('多天快进仍逐步触发当前逐仓强平，随机路径与逐天操作相同', () => {
  const s = fresh(); G.startRound(s); G.buy(s, 'up', 10000, 10);
  s.round.x = -.2; s.round.spot = 100 * Math.exp(-.2); s.round.p = .01;
  assertRepeatedDaysEquivalent(s, 7, true);
  assert.equal(s.stats.liquidations, 1);
  assert.equal(s.positions.length, 0);
  assert.equal(s.roundNo, 1, 'time skip must not open any new trading round');
});
test('24 小时持仓在多天快进中正常结算，且不会开启后续轮次', () => {
  const s = fresh(44); s.nextPeriod = 1440; G.startRound(s); G.buy(s, 'down', 10000, 1);
  assertRepeatedDaysEquivalent(s, 30, false);
  assert.equal(s.round, null);
  assert.equal(s.roundNo, 1);
  assert.equal(s.ledger.filter(e => e.type === '结算兑付').length, 1);
});
test('3650 天支持逐日流水，仅新增一个最终快进剧情总结', () => {
  const s = fresh(), events = s.events.length, cash = s.cash, bank = s.bank;
  G.skipDays(s, 3650, true);
  assert.equal(s.time, 3650 * 1440);
  assert.equal(s.cash, cash);
  assert.equal(s.bank, bank + 3650 * (s.wage - s.expense));
  assert.equal(s.ledger.filter(e => e.type === '工作一天').length, 3650);
  assert.equal(s.ledger.filter(e => e.type === '每日生活费与利息').length, 3650);
  assert.equal(s.events.length, events + 1);
  assert.equal(s.events.at(-1).kind, 'timeskip');
  assert.deepEqual(G.validate(s), s);
});
test('无效天数或生活方式在任何修改前被拒绝', () => {
  for (const days of [0,-1,.5,3651,NaN,Infinity,'7',null,undefined]) {
    const s = fresh(); unchangedOnError(s, () => G.skipDays(s, days, false));
  }
  for (const work of [0,1,'work',null,undefined]) {
    const s = fresh(); unchangedOnError(s, () => G.skipDays(s, 1, work));
  }
});
test('现金、债务或日期越界快进原子失败，原存档仍能读取', () => {
  for (const setup of [s => s.bank = 1e15, s => s.debt = 1e15, s => s.time = 1e8]) {
    const s = fresh(); setup(s); G.validate(s);
    unchangedOnError(s, () => G.skipDays(s, 1, true));
    G.validate(s);
  }
});
test('修改生活收支不即时增减资金、日期或初始配置，不改旧流水', () => {
  const s = G.newCustomGame({bank:2000000,debt:0,wage:42000,expense:18000,limit:5000000,home:0,car:0,computer:0,other:0}, 8);
  s.guide = 3;
  G.day(s, true);
  const before = {cash:s.cash,bank:s.bank,debt:s.debt,time:s.time,net:G.total(s),origin:structuredClone(s.origin),ledger:structuredClone(s.ledger),opening:s.events[0].text};
  G.updateLiving(s, {wage:12345, expense:5432});
  assert.deepEqual({cash:s.cash,bank:s.bank,debt:s.debt,time:s.time,net:G.total(s)}, {cash:before.cash,bank:before.bank,debt:before.debt,time:before.time,net:before.net});
  assert.deepEqual(s.origin, before.origin);
  assert.deepEqual(s.ledger.slice(0, before.ledger.length), before.ledger);
  assert.equal(s.events[0].text, before.opening);
  assert.equal(s.wage, 12345); assert.equal(s.expense, 5432);
  assert.equal(s.ledger.at(-1).bank, 0);
  assert.equal(s.ledger.at(-1).cash, 0);
  assert.equal(s.events.at(-1).kind, 'budget');
});
test('显式零值有效，未传字段保持原值，未来工作采用新金额', () => {
  const s = fresh();
  G.updateLiving(s, {wage:0}); assert.equal(s.wage, 0); assert.equal(s.expense, 18000);
  G.updateLiving(s, {expense:0}); assert.equal(s.expense, 0);
  G.updateLiving(s, {wage:12345, expense:5432});
  const bank = s.bank;
  G.day(s, true);
  assert.equal(s.bank, bank + 12345 - 5432);
  assert.equal(s.debt, 0);
});
test('修改拒绝空对象、未知字段和不合法金额且不会部分写入', () => {
  for (const patch of [{},null,[],{bank:42},{wage:-1},{expense:.5},{wage:NaN},{expense:Infinity},{wage:100000000001},{wage:12345,expense:-1}]) {
    const s = fresh(); unchangedOnError(s, () => G.updateLiving(s, patch));
  }
});
test('更新总生活费后，未来出售房车继续影响当时的收入和费用', () => {
  const s = fresh(123, 'owner');
  G.updateLiving(s, {wage:100000, expense:10000});
  G.sellAsset(s, 'car');
  assert.equal(s.wage, 85000); assert.equal(s.expense, 12000);
  G.updateLiving(s, {expense:7000});
  assert.equal(s.expense, 7000, 'editing replaces the current total, including existing commute/rent');
  G.sellAsset(s, 'home');
  assert.equal(s.expense, 19000);
  assert.equal(s.wage, 85000);
  assert.deepEqual(G.validate(s), s);
});
test('引导未完成或故事封存时不能快进或修改生活参数', () => {
  for (const s of [G.newGame('worker',3), (() => {const x=fresh();G.finish(x,'leave');return x;})()]) {
    unchangedOnError(s, () => G.skipDays(s, 7, true));
    unchangedOnError(s, () => G.updateLiving(s, {wage:10000}));
  }
});
test('达到剧情记录上限时修改生活参数也原子失败', () => {
  const s = fresh(), e = s.events[0];
  s.events = Array.from({length:100000}, () => ({...e}));
  G.validate(s);
  unchangedOnError(s, () => G.updateLiving(s, {wage:12345}));
  G.validate(s);
});
test('修改收入费用并快进后的 JSON 往返恢复全部实际状态', () => {
  const s = fresh();
  G.updateLiving(s, {wage:90000,expense:15000});
  G.borrow(s, 123456);
  G.skipDays(s, 90, true);
  assert.deepEqual(G.validate(JSON.parse(JSON.stringify(s))), s);
});
console.log(`${passed} life-extension checks passed; ${failed} failed`);
if (failed) process.exitCode = 1;
