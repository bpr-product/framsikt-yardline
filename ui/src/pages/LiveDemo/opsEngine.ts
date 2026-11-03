/**
 * Yardline decision-driven demonstration engine.
 * Five seed cases, but no scripted next steps: the operator chooses any allowed action.
 * Safety/state/occupancy constraints and queue estimates are computed from current state.
 * Isolated to the browser. It does not write to Neon or modify real appointments.
 */
export type CaseId='late'|'urgent'|'goods'|'breakdown'|'peak';
export type Direction='inbound'|'outbound';
export type Stage='scheduled'|'checked_in'|'on_hold'|'ready'|'at_dock'|'loading'|'completed'|'departed';
export type Operation='check_in'|'stage_goods'|'prepare_docs'|'resolve'|'ready'|'approve_priority'|'assign'|'start'|'finish'|'release'|'clearance'|'depart'|'verify_dock'|'reschedule'|'advance';
export interface Problem {reason:string;owner:string;resolved:boolean}
export interface Vehicle {
  id:string; plate:string;carrier:string;cargo:string;direction:Direction;stage:Stage;
  bookedMin:number;observedMin:number|null;arrivalMin:number|null; serviceMin:number;
  urgent:boolean;priorityApproved:boolean;goodsReady:boolean;docsReady:boolean;
  problem:Problem|null;dockId:string|null;startedMin:number|null;finishedMin:number|null;
  clearance:boolean;departedMin:number|null;modifiedBooking:boolean;
}
export interface Dock {
  id:string;direction:Direction|'both';operational:boolean;truckId:string|null;
  releaseEstimateMin:number|null; note:string;
}
export interface History {timeMin:number;role:string;event:string;truckId?:string}
export interface ScenarioInfo {id:CaseId;label:string;sub:string;issue:string;targetId:string;}
export interface World {id:CaseId; now:number;vehicles:Vehicle[];docks:Dock[];history:History[];version:number;}
export interface OperationRequest {op:Operation;truckId?:string;dockId?:string;minutes?:number;bookedMin?:number}
export interface Transition {ok:boolean;world:World;message:string}
export interface QueueEntry {truckId:string;position:number;dockId:string|null;startMin:number|null;waitMin:number|null;reason:string}
export interface Plan {queue:QueueEntry[];byTruck:Record<string,QueueEntry>;}
export const SCENARIOS:ScenarioInfo[]=[
 {id:'late',label:'Late arrival',sub:'2h late / booked dock busy',issue:'Truck A reached the gate at 12:00 for a 10:00 booking. Dock 01 is busy until 13:00. Where should it go?',targetId:'a'},
 {id:'urgent',label:'Urgent delivery',sub:'Expedite without unsafe preemption',issue:'Production needs a critical part. Two trucks are waiting ahead; another truck is using the only inbound dock.',targetId:'c'},
 {id:'goods',label:'Goods not ready',sub:'Fix the warehouse handoff',issue:'A collection truck is on site, but finished goods have not been staged. A dock is free.',targetId:'g'},
 {id:'breakdown',label:'Dock breakdown',sub:'Recover safe loading capacity',issue:'Dock 01 failed. A waiting delivery needs a compatible bay; Dock 03 is available only after maintenance verification.',targetId:'d'},
 {id:'peak',label:'Morning rush',sub:'Avoid arrival bunching',issue:'Four trucks are booked for 08:00, but only two have arrived. Reschedule unarrived trucks before the queue grows.',targetId:'p1'}
];
const v=(id:string,plate:string,stage:Stage,direction:Direction,bookedMin:number,observedMin:number|null,serviceMin=75,cargo='Materials'):Vehicle=>({
 id,plate,stage,direction,bookedMin,observedMin,arrivalMin:stage==='scheduled'?null:observedMin,serviceMin,
 carrier:'Demo Logistics',cargo,urgent:false,priorityApproved:false,goodsReady:true,docsReady:true,problem:null,dockId:null,startedMin:null,finishedMin:null,clearance:false,departedMin:null,modifiedBooking:false
});
const d=(id:string,direction:Direction|'both',operational=true,truckId:string|null=null,releaseEstimateMin:number|null=null,note=''):Dock=>({id,direction,operational,truckId,releaseEstimateMin,note});
const h=(timeMin:number,role:string,event:string,truckId?:string):History=>({timeMin,role,event,truckId});

export function seed(id:CaseId):World {
 if(id==='late'){
   const a=v('a','KA 01 AB 4920','scheduled','inbound',600,720,80,'Steel components');
   const b={...v('b','KA 03 MN 7712','loading','inbound',600,600,180,'Packaging material'),dockId:'DOCK-01',startedMin:600};
   return {id,now:720,vehicles:[a,b],docks:[d('DOCK-01','inbound',true,'b',780,'Truck B still unloading'),d('DOCK-02','both',true,null,null,'Compatible and staffed'),d('DOCK-03','outbound',true)],history:[h(600,'Dock supervisor','Truck B began unloading at Dock 01.','b'),h(720,'Gate operator','Truck A reached the gate, two hours late.','a')],version:0};
 }
 if(id==='urgent'){
   const active={...v('u0','KA 14 LM 9284','loading','inbound',660,660,70,'Existing inbound shipment'),dockId:'DOCK-01',startedMin:665};
   const a=v('u1','KA 02 MX 3211','ready','inbound',675,675,70,'Scheduled delivery');
   const b=v('u2','TN 07 BL 8821','ready','inbound',680,680,70,'Standard pallets');
   const c={...v('c','TN 22 AX 6641','ready','inbound',700,700,70,'Critical production component'),urgent:true};
   return {id,now:700,vehicles:[active,a,b,c],docks:[d('DOCK-01','inbound',true,'u0',735,'Active operation in progress'),d('DOCK-02','outbound',true)],history:[h(680,'Logistics coordinator','Two standard deliveries are waiting for Dock 01.'),h(700,'Gate operator','Critical delivery checked in; priority needs approval.','c')],version:0};
 }
 if(id==='goods'){
   const a={...v('g','KA 05 BS 3307','on_hold','outbound',540,555,75,'Finished motor assemblies'),goodsReady:false,problem:{reason:'Finished goods not staged',owner:'Warehouse lead',resolved:false}};
   const b={...v('g2','KA 21 HJ 4460','loading','inbound',540,530,60,'Packaging rolls'),dockId:'DOCK-01',startedMin:535};
   return {id,now:560,vehicles:[a,b],docks:[d('DOCK-01','inbound',true,'g2',600,'Inbound unloading'),d('DOCK-02','both')],history:[h(555,'Gate operator','Outbound truck checked in.','g'),h(560,'Coordinator','Blocking issue: goods not staged; owner is Warehouse lead.','g')],version:0};
 }
 if(id==='breakdown'){
   const a=v('d','KA 04 TG 1188','ready','inbound',840,850,90,'Machine tooling');
   const b={...v('d2','KA 05 MR 9931','loading','outbound',810,800,100,'Outbound pallets'),dockId:'DOCK-02',startedMin:810};
   return {id,now:850,vehicles:[a,b],docks:[d('DOCK-01','inbound',false,null,null,'Mechanical fault'),d('DOCK-02','outbound',true,'d2',910,'Active outbound loading'),d('DOCK-03','both',false,null,null,'Awaiting safety verification')],history:[h(845,'Maintenance','Dock 01 reported unsafe and was isolated.'),h(850,'Gate operator','Truck D ready, but its intended dock is unavailable.','d')],version:0};
 }
 const p1=v('p1','KA 02 MG 4602','ready','outbound',480,480,65,'Finished goods');
 const p2=v('p2','KA 11 DE 2386','ready','outbound',480,480,65,'Manufactured fittings');
 const p3=v('p3','KA 19 UV 7703','scheduled','outbound',480,600,65,'Spare parts');
 const p4=v('p4','TN 02 RD 4207','scheduled','outbound',480,660,65,'Packed panels');
 const p0={...v('p0','KA 06 QQ 1229','loading','outbound',450,440,60,'Previous consignment'),dockId:'DOCK-01',startedMin:450};
 return {id:'peak',now:480,vehicles:[p0,p1,p2,p3,p4],docks:[d('DOCK-01','outbound',true,'p0',510,'Previous truck finishing'),d('DOCK-02','both')],history:[h(480,'Gate operator','Two trucks arrived; two more are expected later.'),h(480,'Coordinator','Four 08:00 bookings exceed realistic immediate service capacity.')],version:0};
}
export const scenario=(id:CaseId)=>SCENARIOS.find(s=>s.id===id)!;
export function formatTime(timeMin:number|null):string{
 if(timeMin==null)return 'Unknown';
 const hours=(Math.floor(timeMin/60)%24+24)%24;
 return `${String(hours).padStart(2,'0')}:${String(((timeMin%60)+60)%60).padStart(2,'0')}`;
}
export function canUse(dock:Dock,truck:Vehicle){return dock.operational&&(dock.direction==='both'||dock.direction===truck.direction)}
export function ready(truck:Vehicle){return truck.goodsReady&&truck.docsReady&&(!truck.problem||truck.problem.resolved)}
export function sortedQueue(world:World):Vehicle[]{
 return world.vehicles.filter(t=>t.stage==='ready').sort((a,b)=>Number(b.urgent&&b.priorityApproved)-Number(a.urgent&&a.priorityApproved)||(a.arrivalMin??a.observedMin??99999)-(b.arrivalMin??b.observedMin??99999)||a.id.localeCompare(b.id));
}
/** Multi-bay earliest-compatible-availability heuristic. This estimates rather than guarantees start times. */
export function plan(world:World):Plan{
 const available=new Map(world.docks.map(dock=>{
  if(!dock.operational)return [dock.id,Infinity] as const;
  if(!dock.truckId)return [dock.id,world.now] as const;
  const truck=world.vehicles.find(t=>t.id===dock.truckId);
  // A physically occupied dock has no guaranteed ETA if the visit finished without release.
  if(!truck||truck.stage==='completed'||dock.releaseEstimateMin==null||dock.releaseEstimateMin<world.now)return [dock.id,Infinity] as const;
  return [dock.id,Math.max(world.now,dock.releaseEstimateMin)] as const;
 }));
 const queue:QueueEntry[]=[];
 for(const [position,truck] of sortedQueue(world).entries()){
  let best:Dock|null=null;let at=Infinity;
  for(const dock of world.docks){if(!canUse(dock,truck))continue;const free=available.get(dock.id)??Infinity;if(free<at){at=free;best=dock}}
  if(best&&Number.isFinite(at))available.set(best.id,at+truck.serviceMin+5);
  queue.push({truckId:truck.id,position:position+1,dockId:best?.id??null,startMin:Number.isFinite(at)?at:null,waitMin:Number.isFinite(at)?Math.max(0,at-world.now):null,
   reason:!best?'No compatible operational dock':Number.isFinite(at)?at<=world.now?'Dock available now':'Wait for current work and earlier trucks':'Occupied dock has no confirmed release time'});
 }
 return {queue,byTruck:Object.fromEntries(queue.map(x=>[x.truckId,x]))};
}
export function recommendation(world:World,truckId:string):{text:string;owner:string;action:string;dockId?:string;delayMin?:number|null} {
 const truck=world.vehicles.find(t=>t.id===truckId);
 if(!truck)return {text:'Select a truck.',owner:'Dispatcher',action:'select'};
 const p=plan(world).byTruck[truckId];
 if(truck.stage==='scheduled')return {text:`Truck is due for ${formatTime(truck.bookedMin)}. Record physical arrival at the gate before allocation.`,owner:'Gate operator',action:'check_in'};
 if(!truck.goodsReady)return {text:'Goods are not staged. Keep this truck off the dock until the warehouse confirms readiness.',owner:'Warehouse lead',action:'stage_goods'};
 if(!truck.docsReady)return {text:'Documents are incomplete. Ask dispatch to prepare them.',owner:'Dispatch',action:'prepare_docs'};
 if(truck.problem&&!truck.problem.resolved)return {text:'An unresolved issue blocks this truck. Record resolution before assigning a dock.',owner:truck.problem.owner,action:'resolve'};
 if(truck.stage==='on_hold'||truck.stage==='checked_in')return {text:'Preparation is complete. Mark the truck ready to enter the dock queue.',owner:'Coordinator',action:'ready'};
 if(truck.stage==='ready'){
   if(truck.urgent&&!truck.priorityApproved)return {text:'Emergency priority requires manager approval before bypassing other waiting trucks.',owner:'Factory manager',action:'approve_priority'};
   return p?.dockId?{text:p.waitMin===0?`Assign ${p.dockId} now. It is free, compatible, and staffed in this demo.`:`Plan ${p.dockId} for ${formatTime(p.startMin)}; wait until it is physically free.`,owner:'Dock supervisor',action:'assign',dockId:p.dockId,delayMin:p.waitMin}: {text:'No compatible confirmed dock is available. Check maintenance and existing occupants.',owner:'Dock supervisor',action:'verify_dock'};
 }
 if(truck.stage==='at_dock')return {text:'Truck is docked; begin loading or unloading and record the start time.',owner:'Dock supervisor',action:'start'};
 if(truck.stage==='loading')return {text:'Loading is active. Confirm actual completion before freeing the physical dock.',owner:'Dock supervisor',action:'finish'};
 if(truck.stage==='completed'&&truck.dockId)return {text:'Service is finished. The dock remains occupied until physical clearance is confirmed.',owner:'Dock supervisor',action:'release'};
 if(truck.stage==='completed'&&!truck.clearance)return {text:'Dock is free; verify exit documents and approve gate clearance.',owner:'Gate operator',action:'clearance'};
 if(truck.stage==='completed'&&truck.clearance)return {text:'Clearance confirmed. Record the truck leaving the site.',owner:'Gate operator',action:'depart'};
 return {text:'Truck has departed. Event history is complete.',owner:'Gate operator',action:'done'};
}
export function canAssign(world:World,truckId:string,dockId:string):string|null{
 const t=world.vehicles.find(x=>x.id===truckId),d=world.docks.find(x=>x.id===dockId);
 if(!t||!d)return 'Truck or dock not found.';
 if(t.stage!=='ready')return 'Truck must be marked Ready before dock allocation.';
 if(!ready(t))return 'Goods, documents and blocking issues must be resolved first.';
 if(t.urgent&&!t.priorityApproved)return 'Urgent queue priority must be approved by the manager.';
 if(!d.operational)return `${d.id} is unsafe or out of service.`;
 if(!canUse(d,t))return `${d.id} cannot handle this ${t.direction} truck.`;
 if(d.truckId)return `${d.id} is physically occupied. Complete and release the current truck first.`;
 const q=sortedQueue(world);
 if(q[0]?.id!==t.id)return `${q[0]?.plate} is first in the approved queue. Select that truck or approve an urgent exception.`;
 return null;
}
const clone=(w:World):World=>({id:w.id,now:w.now,version:w.version,vehicles:w.vehicles.map(t=>({...t,problem:t.problem?{...t.problem}:null})),docks:w.docks.map(d=>({...d})),history:w.history.map(e=>({...e}))});
export function act(before:World,request:OperationRequest):Transition{
 const s=clone(before),op=request.op,t=s.vehicles.find(x=>x.id===request.truckId),d=s.docks.find(x=>x.id===request.dockId);
 const failure=(m:string):Transition=>({ok:false,world:before,message:m});
 const requireTruck=()=>t??null;
 let log='',role='Operator';
 if(op==='advance'){
  const m=request.minutes??15;if(m<5||m>240)return failure('Choose 5–240 minutes.');
  s.now+=m;role='Demo clock';log=`Simulated clock advanced ${m} minutes. Physical dock occupancy remains unchanged.`;
 } else if(op==='verify_dock'){
  if(!d||d.operational||d.truckId)return failure('Only an offline, unoccupied dock can be restored.');
  d.operational=true;d.note='Maintenance verified safe';role='Maintenance lead';log=`${d.id} certified operational and available.`;
 } else if(!requireTruck())return failure('Select a truck.');
 else if(op==='check_in'){
  if(t!.stage!=='scheduled')return failure('Only scheduled trucks can be checked in.');
  if(t!.observedMin==null||s.now<t!.observedMin)return failure('Truck has not physically arrived at the gate.');
  t!.stage='checked_in';t!.arrivalMin=s.now;role='Gate operator';log=`${t!.plate} checked in. Planned ${formatTime(t!.bookedMin)}, actual ${formatTime(s.now)}.`;
 } else if(op==='stage_goods'){
  if(t!.goodsReady)return failure('Goods are already staged.');t!.goodsReady=true;role='Warehouse lead';log=`Goods staged for ${t!.plate}.`;
 } else if(op==='prepare_docs'){
  if(t!.docsReady)return failure('Documents already ready.');t!.docsReady=true;role='Dispatch';log=`Documents verified for ${t!.plate}.`;
 } else if(op==='resolve'){
  if(!t!.problem||t!.problem.resolved)return failure('No open problem on this truck.');
  if(!t!.goodsReady||!t!.docsReady)return failure('Resolve goods/documents before closing the problem.');
  t!.problem.resolved=true;role='Logistics coordinator';log=`Blocking issue resolved: ${t!.problem.reason}.`;
 } else if(op==='ready'){
  if(!['checked_in','on_hold'].includes(t!.stage))return failure('Truck must be checked in or on hold first.');
  if(!ready(t!))return failure('Incomplete readiness or unresolved blocking issue.');
  t!.stage='ready';role='Coordinator';log=`${t!.plate} marked ready for dock allocation.`;
 } else if(op==='approve_priority'){
  if(!t!.urgent||t!.priorityApproved||t!.stage!=='ready')return failure('Only a waiting urgent truck can receive priority approval.');
  t!.priorityApproved=true;role='Factory manager';log=`Manager approved urgent priority for ${t!.plate}; active loading cannot be interrupted.`;
 } else if(op==='assign'){
  if(!request.dockId)return failure('Choose a dock.');const why=canAssign(s,t!.id,request.dockId);if(why)return failure(why);
  d!.truckId=t!.id;d!.note=`${t!.plate} occupying bay`;d!.releaseEstimateMin=s.now+t!.serviceMin+5;
  t!.dockId=d!.id;t!.stage='at_dock';role='Dock supervisor';log=`${t!.plate} assigned to ${d!.id}; protected against double allocation.`;
 } else if(op==='start'){
  if(t!.stage!=='at_dock'||!t!.dockId)return failure('Assign a compatible free dock first.');
  t!.stage='loading';t!.startedMin=s.now;const dock=s.docks.find(x=>x.id===t!.dockId)!;
  dock.releaseEstimateMin=s.now+t!.serviceMin+5;role='Dock supervisor';log=`Loading/unloading started for ${t!.plate} at ${dock.id}.`;
 } else if(op==='finish'){
  if(t!.stage!=='loading'||!t!.dockId)return failure('Truck is not currently loading.');
  t!.stage='completed';t!.finishedMin=s.now;role='Dock supervisor';log=`Service complete for ${t!.plate}; bay still physically occupied.`;
  const dock=s.docks.find(x=>x.id===t!.dockId)!;dock.releaseEstimateMin=null;
 } else if(op==='release'){
  if(t!.stage!=='completed'||!t!.dockId)return failure('Complete loading before releasing the physical dock.');
  const dock=s.docks.find(x=>x.id===t!.dockId);if(!dock||dock.truckId!==t!.id)return failure('Dock occupancy mismatch.');
  dock.truckId=null;dock.releaseEstimateMin=null;dock.note='Physically cleared';t!.dockId=null;
  role='Dock supervisor';log=`${t!.plate} physically moved clear; ${dock.id} released for the next truck.`;
 } else if(op==='clearance'){
  if(t!.stage!=='completed'||t!.dockId||!t!.docsReady)return failure('Truck must release dock and have complete documents.');
  t!.clearance=true;role='Gate operator';log=`Exit paperwork and clearance confirmed for ${t!.plate}.`;
 } else if(op==='depart'){
  if(t!.stage!=='completed'||t!.dockId||!t!.clearance)return failure('Release dock and confirm exit clearance before departure.');
  t!.stage='departed';t!.departedMin=s.now;role='Gate operator';log=`${t!.plate} departed the factory.`;
 } else if(op==='reschedule'){
  if(t!.stage!=='scheduled')return failure('Only unarrived trucks may be rescheduled.');
  const proposed=request.bookedMin;
  if(proposed==null||proposed<=s.now)return failure('Choose a future appointment time.');
  const sameHour=s.vehicles.filter(x=>x.id!==t!.id&&x.stage!=='departed'&&Math.floor(x.bookedMin/60)===Math.floor(proposed/60)&&x.direction===t!.direction);
  const cap=s.docks.filter(x=>canUse(x,t!)).length;
  if(cap<=0||sameHour.length>=cap)return failure('That appointment hour is fully booked for compatible capacity.');
  const old=t!.bookedMin;t!.bookedMin=proposed;t!.modifiedBooking=true;role='Logistics coordinator';log=`${t!.plate} appointment moved ${formatTime(old)} → ${formatTime(proposed)}; truck had not arrived.`;
 } else return failure('Unknown operation.');
 s.version++;s.history.push(h(s.now,role,log,t?.id));
 return {ok:true,world:s,message:log};
}
export function bookingPressure(world:World,hour=8){return world.vehicles.filter(t=>t.stage!=='departed'&&Math.floor(t.bookedMin/60)===hour).length}
/** Illustrative opportunity, not verified financial savings. */
export function operationalImpact(world:World):{title:string;primary:string;detail:string;secondary:string}{
 const target=world.vehicles.find(t=>t.id===scenario(world.id).targetId)!;
 if(world.id==='late'){
  const bookedDock=world.docks.find(d=>d.id==='DOCK-01');
  const oldDelay=Math.max(0,(bookedDock?.releaseEstimateMin??world.now)-world.now);
  const assigned=target.dockId;
  const p=plan(world).byTruck[target.id];
  const possibleSaved=p?.waitMin!=null?Math.max(0,oldDelay-p.waitMin):0;
  return {title:assigned?'Confirmed alternate dock wait':'Wait if original dock is used',primary:assigned?'0 min':`${oldDelay} min`,detail:assigned?`${assigned} allocated; Dock 01 stays occupied`:`System recommends ${p?.dockId??'a compatible alternative'} ${p?.waitMin===0?'now':''}`,secondary:assigned?`${oldDelay} min of modelled dock wait avoided`:`${possibleSaved} min can be avoided if a supervisor assigns the alternative`};
 }
 if(world.id==='urgent'){
  const p=plan(world).byTruck[target.id];
  const baseline=clone(world);baseline.vehicles.find(t=>t.id==='c')!.priorityApproved=false;
  const old=plan(baseline).byTruck[target.id];
  const beforeLead=plan(baseline).byTruck.u1; const afterLead=p?plan(world).byTruck.u1:null;
  const displacement=afterLead?.waitMin!=null&&beforeLead?.waitMin!=null?Math.max(0,afterLead.waitMin-beforeLead.waitMin):0;
  return {title:'Urgent truck estimated wait',primary:target.dockId?'Allocated':p?.waitMin==null?'Unknown':`${p.waitMin} min`,detail:`Queue position ${p?.position??'—'} (approval ${target.priorityApproved?'granted':'required'})`,secondary:target.priorityApproved&&old?.waitMin!=null&&p?.waitMin!=null?`Urgent gains ${Math.max(0,old.waitMin-p.waitMin)} min; first standard truck waits ${displacement} min longer`:'Manager approval is required; existing unloading remains protected'};
 }
 if(world.id==='goods')return {title:'Outbound readiness',primary:ready(target)?'Cleared':'Blocked',detail:target.problem&&!target.problem.resolved?'Warehouse lead owns the open issue':target.goodsReady?'Goods staged and verified':'Goods are still not staged',secondary:target.dockId?`${target.dockId} assigned safely`:'A free dock is unusable until goods are ready'};
 if(world.id==='breakdown')return {title:'Recovered usable capacity',primary:world.docks.filter(x=>x.operational&&canUse(x,target)&&!x.truckId).length.toString()+' bay(s)',detail:world.docks.find(x=>x.id==='DOCK-01')?.operational?'Planned dock has been repaired':'Failed Dock 01 remains safely offline',secondary:target.dockId?`Truck allocated to ${target.dockId}`:'Verify backup then assign'};
 return {title:'08:00 appointment congestion',primary:`${bookingPressure(world)} trucks`,detail:`${world.vehicles.filter(t=>t.stage==='scheduled'&&Math.floor(t.bookedMin/60)===8).length} still approaching this booking hour`,secondary:'Move only unarrived trucks; do not reset on-site queue'};
}
