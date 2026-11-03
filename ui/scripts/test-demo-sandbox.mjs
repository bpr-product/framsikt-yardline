import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_CASES,advanceDemo,canAssignDemo,demoImpact,getDemoCase,nextDemoStep,seedDemo
} from '../src/pages/Demo/demoEngine.ts';

test('all five scenario presets run to completion with guarded transitions',()=>{
  assert.equal(DEMO_CASES.length,5);
  for(const entry of DEMO_CASES){
    let state=seedDemo(entry.id);
    while(nextDemoStep(state)){
      const result=advanceDemo(state);
      assert.equal(result.ok,true,`${entry.id}: ${result.message}`);
      state=result.state;
    }
    assert.equal(state.step,getDemoCase(entry.id).steps.length);
    assert.ok(state.events.length>2);
    assert.equal(advanceDemo(state).ok,false);
  }
});

test('reset gives clean isolated scenario state',()=>{
  const state=seedDemo('late');
  assert.equal(advanceDemo(state).ok,true);
  assert.equal(state.step,0,'original seed was not mutated');
  assert.equal(seedDemo('late').step,0);
  assert.equal(seedDemo('late').events.length,2);
});

test('late truck may not take occupied dock or incompatible bay',()=>{
  const state=seedDemo('late');
  assert.match(canAssignDemo(state,'a','DOCK-01'),/occupied/i);
  assert.match(canAssignDemo(state,'a','DOCK-03'),/incompatible/i);
  assert.equal(canAssignDemo(state,'a','DOCK-02'),null);
  const result=advanceDemo(state);
  assert.equal(result.ok,true);
  assert.equal(result.state.docks.find(d=>d.id==='DOCK-01').truckId,'b');
  assert.equal(result.state.docks.find(d=>d.id==='DOCK-02').truckId,'a');
  assert.equal(demoImpact(result.state).after,'0 min');
});

test('urgent truck cannot preempt active work and must obtain approval',()=>{
  const initial=seedDemo('urgent');
  assert.match(canAssignDemo(initial,'c','DOCK-01'),/occupied|approval/i);
  const approved=advanceDemo(initial);
  assert.equal(approved.ok,true);
  assert.deepEqual(approved.state.queue,['c','u1','u2']);
  assert.equal(approved.state.trucks.find(t=>t.id==='u0').status,'loading');
  assert.equal(approved.state.docks[0].state,'occupied');
  assert.equal(demoImpact(approved.state).after,'#1');
});

test('readiness and blocker rules must clear before dock assignment',()=>{
  let state=seedDemo('goods');
  assert.match(canAssignDemo(state,'g','DOCK-02'),/not ready/i);
  state=advanceDemo(state).state;
  assert.equal(state.trucks.find(t=>t.id==='g').goodsReady,true);
  assert.equal(state.trucks.find(t=>t.id==='g').issue.resolved,false);
  state=advanceDemo(state).state;
  assert.equal(state.trucks.find(t=>t.id==='g').issue.resolved,true);
  state=advanceDemo(state).state;
  assert.equal(canAssignDemo(state,'g','DOCK-02'),null);
});

test('unsafe dock remains offline even when backup becomes free',()=>{
  const initial=seedDemo('breakdown');
  assert.match(canAssignDemo(initial,'d','DOCK-01'),/out of service/i);
  assert.match(canAssignDemo(initial,'d','DOCK-03'),/out of service/i);
  const verified=advanceDemo(initial).state;
  assert.equal(verified.docks[0].state,'offline');
  assert.equal(verified.docks.find(d=>d.id==='DOCK-03').state,'free');
  assert.equal(canAssignDemo(verified,'d','DOCK-03'),null);
});

test('morning rush only rebooks trucks that have not checked in',()=>{
  const initial=seedDemo('peak');
  assert.deepEqual(initial.queue,['p1','p2']);
  assert.equal(initial.trucks.find(t=>t.id==='p3').status,'scheduled');
  const result=advanceDemo(initial);
  assert.equal(result.ok,true);
  assert.deepEqual(result.state.queue,['p1','p2']);
  assert.equal(result.state.trucks.find(t=>t.id==='p3').appointment,'10:00 AM');
  assert.equal(result.state.trucks.find(t=>t.id==='p4').appointment,'11:00 AM');
  assert.equal(demoImpact(result.state).after,'2');
});
