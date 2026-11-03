import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,act,bookingPressure,canAssign,operationalImpact,plan,seed,sortedQueue} from '../src/pages/LiveDemo/opsEngine.ts';

const run=(state,op,fields={})=>{
 const r=act(state,{op,...fields});
 assert.equal(r.ok,true,`${state.id}/${op}: ${r.message}`);
 return r.world;
};

test('five seed cases return working incident states',()=>{
 assert.equal(SCENARIOS.length,5);
 for(const c of SCENARIOS){const state=seed(c.id);assert.ok(state.vehicles.length);assert.ok(state.docks.length);assert.ok(operationalImpact(state).title)}
});
test('late two-hour arrival is checked in, revalidated and reassigned to free compatible dock',()=>{
 let w=seed('late');
 assert.equal(w.now,720);
 assert.equal(w.docks[0].releaseEstimateMin,780);
 w=run(w,'check_in',{truckId:'a'});
 assert.match(canAssign(w,'a','DOCK-01'),/Ready/i);
 w=run(w,'ready',{truckId:'a'});
 assert.equal(plan(w).byTruck.a.dockId,'DOCK-02');
 assert.equal(plan(w).byTruck.a.waitMin,0);
 assert.match(canAssign(w,'a','DOCK-01'),/occupied/i);
 assert.match(canAssign(w,'a','DOCK-03'),/cannot handle/i);
 assert.equal(act(w,{op:'assign',truckId:'a',dockId:'DOCK-01'}).ok,false);
 w=run(w,'assign',{truckId:'a',dockId:'DOCK-02'});
 assert.equal(w.docks[1].truckId,'a');assert.equal(w.docks[0].truckId,'b');
 assert.equal(operationalImpact(w).primary,'0 min');
 w=run(w,'start',{truckId:'a'});
 w=run(w,'finish',{truckId:'a'});
 assert.equal(w.docks[1].truckId,'a');
 assert.equal(act(w,{op:'depart',truckId:'a'}).ok,false);
 w=run(w,'release',{truckId:'a'});w=run(w,'clearance',{truckId:'a'});w=run(w,'depart',{truckId:'a'});
 assert.equal(w.vehicles[0].stage,'departed');assert.equal(w.docks[1].truckId,null);
});
test('urgent approval reprioritizes queue and makes existing trucks wait longer',()=>{
 let w=seed('urgent');const before=plan(w);
 assert.deepEqual(sortedQueue(w).map(t=>t.id),['u1','u2','c']);
 assert.equal(before.byTruck.c.position,3);
 assert.equal(act(w,{op:'assign',truckId:'c',dockId:'DOCK-01'}).ok,false);
 w=run(w,'approve_priority',{truckId:'c'});
 assert.deepEqual(sortedQueue(w).map(t=>t.id),['c','u1','u2']);
 assert.ok(plan(w).byTruck.c.waitMin < before.byTruck.c.waitMin);
 assert.ok(plan(w).byTruck.u1.waitMin>before.byTruck.u1.waitMin);
 assert.equal(w.docks[0].truckId,'u0');
 assert.equal(act(w,{op:'assign',truckId:'c',dockId:'DOCK-01'}).ok,false);
 w=run(w,'finish',{truckId:'u0'});assert.equal(w.docks[0].truckId,'u0');
 w=run(w,'release',{truckId:'u0'});
 w=run(w,'assign',{truckId:'c',dockId:'DOCK-01'});
 assert.equal(w.docks[0].truckId,'c');
});
test('goods readiness open blocker prohibits allocation until confirmed and closed',()=>{
 let w=seed('goods');
 assert.equal(act(w,{op:'ready',truckId:'g'}).ok,false);
 assert.equal(act(w,{op:'assign',truckId:'g',dockId:'DOCK-02'}).ok,false);
 w=run(w,'stage_goods',{truckId:'g'});
 assert.equal(act(w,{op:'ready',truckId:'g'}).ok,false);
 w=run(w,'resolve',{truckId:'g'});
 w=run(w,'ready',{truckId:'g'});
 w=run(w,'assign',{truckId:'g',dockId:'DOCK-02'});
 assert.equal(w.vehicles[0].stage,'at_dock');
});
test('broken dock is excluded and verified backup becomes eligible',()=>{
 let w=seed('breakdown');
 assert.equal(plan(w).byTruck.d.startMin,null);
 assert.equal(act(w,{op:'assign',truckId:'d',dockId:'DOCK-01'}).ok,false);
 assert.equal(act(w,{op:'assign',truckId:'d',dockId:'DOCK-03'}).ok,false);
 w=run(w,'verify_dock',{dockId:'DOCK-03'});
 assert.equal(plan(w).byTruck.d.waitMin,0);
 w=run(w,'assign',{truckId:'d',dockId:'DOCK-03'});
 assert.equal(w.docks[2].truckId,'d');assert.equal(w.docks[0].operational,false);
});
test('peak hour rescheduling only works for unarrived trucks, with capacity guard',()=>{
 let w=seed('peak');assert.equal(bookingPressure(w),4);
 assert.equal(act(w,{op:'reschedule',truckId:'p1',bookedMin:600}).ok,false);
 w=run(w,'reschedule',{truckId:'p3',bookedMin:600});
 w=run(w,'reschedule',{truckId:'p4',bookedMin:660});
 assert.equal(bookingPressure(w),2);
 assert.equal(w.vehicles.find(t=>t.id==='p1').bookedMin,480);
 assert.equal(w.vehicles.find(t=>t.id==='p2').bookedMin,480);
 w=run(w,'assign',{truckId:'p1',dockId:'DOCK-02'});
 assert.equal(w.docks[1].truckId,'p1');
});
test('advanced clock does not free occupied bays automatically',()=>{
 let w=seed('urgent');
 w=run(w,'advance',{minutes:60});
 assert.equal(w.docks[0].truckId,'u0');
 assert.equal(plan(w).byTruck.u1.startMin,null);
});
