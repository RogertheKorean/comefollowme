const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../src/calendar-model.js');
test('Korean dates and month boundaries are independent of device time zone',()=>{
 assert.equal(M.dayKey('2026-09-12T15:30:00Z'),'2026-09-13');
 assert.equal(M.timeKey('2026-09-12T15:30:00Z'),'00:30');
 assert.deepEqual(M.monthRange(2026,8),{start:'2026-08-31T15:00:00.000Z',end:'2026-09-30T15:00:00.000Z'});
 assert.equal(M.toISO('2026-09-12','14:00'),'2026-09-12T05:00:00.000Z');
 assert.throws(()=>M.toISO('2026-02-30','14:00'));
});
test('events spanning midnight occur on both days except an exclusive midnight end',()=>{
 const e={starts_at:M.toISO('2026-09-12','23:00'),ends_at:M.toISO('2026-09-13','01:00')};
 assert.equal(M.onDay(e,'2026-09-12'),true);assert.equal(M.onDay(e,'2026-09-13'),true);assert.equal(M.onDay(e,'2026-09-14'),false);
 e.ends_at=M.toISO('2026-09-13','00:00');assert.equal(M.onDay(e,'2026-09-13'),false);
});
test('organization filters can include all-member events without exposing unrelated organizations',()=>{
 const events=[{id:1,title:'Sports',location:'Hall',organizations:['primary']},{id:2,title:'Ward meal',location:'Hall',organizations:['all']},{id:3,title:'Meeting',location:'Room',organizations:['relief']}];
 assert.deepEqual(M.filterEvents(events,{organizations:['primary'],includeAll:true}).map(e=>e.id),[1,2]);
 assert.deepEqual(M.filterEvents(events,{organizations:['primary'],includeAll:false}).map(e=>e.id),[1]);
 assert.deepEqual(M.filterEvents(events,{organizations:['primary','relief'],includeAll:false,query:'room'}).map(e=>e.id),[3]);
 assert.equal(M.canView({status:'draft'},false),false);assert.equal(M.canView({status:'cancelled'},false),true);
});
test('event validation refuses reversed periods, missing locations and forged organization IDs',()=>{
 const good={title:'Activity',location:'Hall',date:'2026-09-12',endDate:'2026-09-12',start:'14:00',end:'16:00',organizations:['primary'],description:''};
 assert.equal(M.validateDraft(good).timezone,'Asia/Seoul');
 for(const change of [{end:'13:00'},{location:' '},{organizations:['self-appointed-admin']},{date:'2026-02-30'}])assert.throws(()=>M.validateDraft({...good,...change}));
});
