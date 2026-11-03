/**
 * Yardline interview sandbox. A deliberately isolated copy of operational state.
 * No API calls and no storage access: a scenario is reset on selection/refresh.
 * The same basic safety invariants as Yardline's VisitsService are enforced here.
 * A demo is NOT a production optimizer, live ETA or database transaction.
 */
export type DemoCaseId='late'|'urgent'|'goods'|'breakdown'|'peak';
export type DemoStatus='scheduled'|'checked_in'|'ready'|'on_hold'|'at_dock'|'loading'|'completed'|'departed';
export type DemoDirection='inbound'|'outbound';
export type DemoDockState='free'|'occupied'|'offline';
export type DemoOp='approve'|'prepare'|'resolve'|'ready'|'assign'|'start'|'finish'|'release'|'depart'|'complete_active'|'release_active'|'restore_backup'|'stagger';
export type DemoRole='Factory manager'|'Gate operator'|'Dock supervisor'|'Warehouse lead'|'Logistics coordinator'|'Maintenance lead';

export interface DemoTruck {
  id:string; plate:string; carrier:string; cargo:string; direction:DemoDirection;
  appointment:string; arrived:string; status:DemoStatus; dockId:string|null;
  goodsReady:boolean; documentsReady:boolean; urgent:boolean; priorityApproved:boolean;
  issue:{reason:string;owner:string;resolved:boolean}|null;
}
export interface DemoDock {
  id:string;label:string;direction:DemoDirection|'both';state:DemoDockState;
  truckId:string|null;note:string;
}
export interface DemoEvent {time:string;actor:string;message:string}
export interface DemoStep {
  op:DemoOp;label:string;actor:DemoRole;why:string;truckId:string;dockId?:string;
  event:string;advanceMin?:number;
}
export interface DemoCase {
  id:DemoCaseId;label:string;short:string;category:string;headline:string;
  story:string;heroTruckId:string;clockMin:number;trucks:DemoTruck[];docks:DemoDock[];
  queue:string[];initialEvents:DemoEvent[];steps:DemoStep[];
  insight:string;rules:string[];
}
export interface DemoState {
  id:DemoCaseId;clockMin:number;trucks:DemoTruck[];docks:DemoDock[];
  queue:string[];events:DemoEvent[];step:number;priorityApproved:boolean;staggered:boolean;
}
export interface DemoResult {ok:boolean;state:DemoState;message:string}

const truck=(id:string,plate:string,carrier:string,cargo:string,direction:DemoDirection,
  status:DemoStatus,appointment:string,arrived:string,dockId:string|null=null):DemoTruck=>({
    id,plate,carrier,cargo,direction,status,appointment,arrived,dockId,goodsReady:true,
    documentsReady:true,urgent:false,priorityApproved:false,issue:null
  });
const dock=(id:string,direction:DemoDirection|'both',state:DemoDockState,truckId:string|null, note:string):DemoDock=>({
  id,label:id.replace('DOCK-','Dock '),direction,state,truckId,note
});
const task=(op:DemoOp,label:string,actor:DemoRole,why:string,truckId:string,event:string,dockId?:string,advanceMin=5):DemoStep=>({
  op,label,actor,why,truckId,event,dockId,advanceMin
});

const lateA=truck('a','KA 01 AB 4920','Apex Logistics','Steel components - delivery','inbound','ready','10:00 AM','12:00 PM');
const lateB=truck('b','KA 03 MN 7712','Southern Freight','Packing materials - delivery','inbound','loading','10:00 AM','10:00 AM','DOCK-01');
const urgentC={...truck('c','TN 22 AX 6641','Rapid Industrial','Critical production component','inbound','ready','11:40 AM','11:40 AM'),urgent:true};
const goodsA={...truck('g','KA 05 BS 3307','Nexus Transport','Finished motor assemblies','outbound','on_hold','09:00 AM','09:15 AM'),goodsReady:false,issue:{reason:'Goods not yet staged for collection',owner:'Warehouse lead',resolved:false}};
const breakdownA=truck('d','KA 04 TG 1188','Northline Carriers','Inbound tooling pallets','inbound','ready','02:00 PM','02:10 PM');
const peakA=truck('p1','KA 02 MG 4602','Kaveri Cargo','Finished goods - collection','outbound','ready','08:00 AM','08:00 AM');

export const DEMO_CASES:DemoCase[]=[
  {
    id:'late',label:'Late arrival',short:'Booked dock is taken',category:'Arrival',
    headline:'A truck arrives 2 hours late. Its dock is busy.',
    story:'Truck A was booked at 10:00. It arrived at 12:00. Truck B is still loading at Dock 01 until 1:00. What should happen to A?',
    heroTruckId:'a',clockMin:12*60,
    trucks:[lateA,lateB],docks:[
      dock('DOCK-01','inbound','occupied','b','Truck B loading - 60 min remaining'),
      dock('DOCK-02','both','free',null,'Compatible alternative available'),
      dock('DOCK-03','outbound','free',null,'Outbound only')],
    queue:['a'],initialEvents:[
      {time:'10:00',actor:'Dock supervisor',message:'Truck B started loading at Dock 01.'},
      {time:'12:00',actor:'Gate operator',message:'Truck A checked in 120 minutes late. Dock 01 is occupied.'}],
    steps:[
      task('assign','Assign Truck A to Dock 02','Dock supervisor','Dock 01 is physically occupied. Dock 02 is free and compatible.','a','Truck A assigned to alternate Dock 02. Dock 01 was not interrupted.','DOCK-02'),
      task('start','Start unloading Truck A','Dock supervisor','The truck is at a safe, compatible dock.','a','Unloading started for Truck A.'),
      task('finish','Complete unloading','Dock supervisor','Record work completion without assuming the bay is clear.','a','Unloading finished. Dock 02 remains occupied.',undefined,25),
      task('release','Release Dock 02','Dock supervisor','Confirm the truck has physically moved clear of the dock.','a','Dock 02 physically cleared and released.'),
      task('depart','Record gate departure','Gate operator','Departure is valid after dock release and document clearance.','a','Truck A departed the factory with its event history intact.')],
    insight:'The original appointment does not let a late truck interrupt a truck already being loaded.',
    rules:['Occupied docks cannot be reassigned','A dock must support the truck direction','Departure follows physical dock release']
  },
  {
    id:'urgent',label:'Urgent delivery',short:'Priority vs waiting queue',category:'Priority',
    headline:'Production needs an urgent delivery. Two trucks are ahead.',
    story:'A critical component arrives while two trucks are queued. Dock 01 is occupied for another 35 minutes. Can the urgent truck go first?',
    heroTruckId:'c',clockMin:11*60+40,
    trucks:[
      truck('u0','KA 14 LM 9284','Swift Carrier','Existing inbound shipment','inbound','loading','11:00 AM','11:00 AM','DOCK-01'),
      truck('u1','KA 02 MX 3211','Metro Freight','Scheduled inbound parts','inbound','ready','11:15 AM','11:15 AM'),
      truck('u2','TN 07 BL 8821','Delta Transport','Standard delivery pallets','inbound','ready','11:20 AM','11:20 AM'),
      urgentC],
    docks:[dock('DOCK-01','inbound','occupied','u0','Active unloading - 35 min remaining'),
      dock('DOCK-02','outbound','free',null,'Outbound only - incompatible')],
    queue:['u1','u2','c'],initialEvents:[
      {time:'11:20',actor:'Logistics coordinator',message:'Two scheduled deliveries wait for Dock 01.'},
      {time:'11:40',actor:'Gate operator',message:'Urgent production component checked in. Manager approval required.'}],
    steps:[
      task('approve','Approve urgent priority','Factory manager','An authorized manager may move the truck ahead of waiting trucks, never active unloading.','c','Priority approved. Critical delivery moved to first waiting position.'),
      task('complete_active','Finish current truck unloading','Dock supervisor','Complete the work already in progress; do not interrupt it.','u0','Current truck finished unloading. Physical dock release still required.',undefined,35),
      task('release_active','Release Dock 01 safely','Dock supervisor','The bay becomes reusable only after physical clearance.','u0','Current truck left Dock 01. The bay is now available.'),
      task('assign','Assign urgent delivery to Dock 01','Dock supervisor','The manager approved priority and Dock 01 is now free.','c','Urgent truck allocated to Dock 01. Other trucks remain waiting.','DOCK-01'),
      task('start','Begin urgent unloading','Dock supervisor','The critical truck has a valid bay assignment.','c','Urgent material unloading started, without preempting other active work.')],
    insight:'Urgent priority changes the waiting order, but it never interrupts work already underway.',
    rules:['Only a manager approves urgent priority','Active loading is never preempted','Previously waiting trucks remain in the queue']
  },
  {
    id:'goods',label:'Goods not ready',short:'Blocked warehouse handoff',category:'Readiness',
    headline:'The truck arrived. The finished goods are not ready.',
    story:'An outbound collection is at the gate. Loading cannot begin because the warehouse has not staged the shipment.',
    heroTruckId:'g',clockMin:9*60+20,
    trucks:[goodsA,truck('g2','KA 21 HJ 4460','Mitra Carrier','Packaging rolls','inbound','loading','09:00 AM','08:50 AM','DOCK-01')],
    docks:[dock('DOCK-01','inbound','occupied','g2','Inbound delivery being unloaded'),dock('DOCK-02','both','free',null,'Available after goods are ready')],
    queue:[],initialEvents:[
      {time:'09:15',actor:'Gate operator',message:'Collection truck checked in.'},
      {time:'09:20',actor:'Logistics coordinator',message:'Blocking issue logged: goods not staged. Owner: Warehouse lead.'}],
    steps:[
      task('prepare','Confirm goods are staged','Warehouse lead','The warehouse must physically prepare goods before a truck can be marked ready.','g','Goods staged and verified by warehouse lead.',undefined,20),
      task('resolve','Resolve the recorded blocker','Logistics coordinator','Close the problem with a resolution record, not just an informal message.','g','Goods readiness issue resolved with recorded ownership.'),
      task('ready','Mark truck ready for dock','Logistics coordinator','Readiness requires goods, documents and no open blocking issue.','g','All requirements confirmed. Truck entered the ready queue.'),
      task('assign','Assign Dock 02','Dock supervisor','The shipment is ready and Dock 02 supports outbound collections.','g','Collection truck assigned to Dock 02.','DOCK-02'),
      task('start','Start loading finished goods','Dock supervisor','Begin the loading operation only after readiness and assignment.','g','Loading started for the outbound collection.')],
    insight:'A free dock is not enough. Goods and documents must be ready, with blockers resolved.',
    rules:['Incomplete readiness prevents allocation','Issues need named owners and resolution','Only ready trucks enter the dock queue']
  },
  {
    id:'breakdown',label:'Dock breakdown',short:'Unsafe dock, backup available',category:'Capacity',
    headline:'The planned dock breaks down during the shift.',
    story:'Dock 01 has a mechanical fault. The arriving truck is ready, but the backup Dock 03 needs a safety check before it can be used.',
    heroTruckId:'d',clockMin:14*60+10,
    trucks:[breakdownA,truck('d2','KA 05 MR 9931','Industrial Express','Outbound pallets','outbound','loading','01:30 PM','01:20 PM','DOCK-02')],
    docks:[dock('DOCK-01','inbound','offline',null,'Fault detected - do not use'),
      dock('DOCK-02','outbound','occupied','d2','Active outbound service'),
      dock('DOCK-03','both','offline',null,'Backup bay - awaiting safety verification')],
    queue:['d'],initialEvents:[
      {time:'14:05',actor:'Maintenance lead',message:'Mechanical fault reported. Dock 01 taken out of service.'},
      {time:'14:10',actor:'Dock supervisor',message:'Truck waiting. Backup bay requires safety confirmation.'}],
    steps:[
      task('restore_backup','Verify backup Dock 03 is safe','Maintenance lead','A broken dock cannot be assigned. Verify an alternate before reallocating.','d','Backup Dock 03 passed safety check and was marked operational.','DOCK-03',15),
      task('assign','Assign ready truck to Dock 03','Dock supervisor','Backup bay is operational, free and compatible.','d','Truck reassigned to verified Dock 03.','DOCK-03'),
      task('start','Begin unloading at backup dock','Dock supervisor','The truck is docked and required equipment is available.','d','Unloading began at Dock 03.'),
      task('finish','Finish unloading','Dock supervisor','Record actual service completion.','d','Unloading completed; truck still occupies Dock 03.',undefined,35),
      task('release','Confirm truck moved off Dock 03','Dock supervisor','Only physical clearance makes the backup dock available again.','d','Dock 03 physically released.')],
    insight:'A free-looking dock is not usable if it is unsafe or has not been verified.',
    rules:['Faulty docks are excluded from capacity','Backup docks require safety verification','Physical occupancy is tracked separately from completion']
  },
  {
    id:'peak',label:'Morning rush',short:'Too many arrivals at once',category:'Scheduling',
    headline:'Four trucks are booked into the same morning hour.',
    story:'Two trucks are waiting at the gate. Two more are due at 8:00, but only one dock is free. Stagger the trucks that have not arrived yet.',
    heroTruckId:'p1',clockMin:8*60,
    trucks:[peakA,
      truck('p2','KA 11 DE 2386','Sundar Logistics','Manufactured fittings','outbound','ready','08:00 AM','08:00 AM'),
      truck('p3','KA 19 UV 7703','Ace Haulage','Boxed spare parts','outbound','scheduled','08:00 AM','Not arrived'),
      truck('p4','TN 02 RD 4207','Skyline Freight','Finished panel stock','outbound','scheduled','08:00 AM','Not arrived'),
      truck('p0','KA 06 QQ 1229','Westport Cargo','Previous delivery','outbound','loading','07:30 AM','07:20 AM','DOCK-01')],
    docks:[dock('DOCK-01','outbound','occupied','p0','Previous truck still loading'),dock('DOCK-02','both','free',null,'Compatible free bay')],
    queue:['p1','p2'],initialEvents:[
      {time:'07:30',actor:'Dock supervisor',message:'Previous shipment began loading at Dock 01.'},
      {time:'08:00',actor:'Gate operator',message:'Four trucks booked for 8 AM. Two have arrived; two are still approaching.'}],
    steps:[
      task('stagger','Reschedule two approaching trucks','Logistics coordinator','Keep the two trucks already onsite. Move the two not yet arrived to realistic slots.','p1','Two unarrived appointments moved to 10:00 and 11:00; the 8 AM booking load fell from 4 to 2.'),
      task('assign','Assign first waiting truck to Dock 02','Dock supervisor','The other dock is occupied; Dock 02 is free and compatible.','p1','First waiting truck assigned to Dock 02.','DOCK-02'),
      task('start','Start loading at Dock 02','Dock supervisor','The bay is ready and the first queued truck is assigned.','p1','Loading began without interrupting Dock 01.'),
      task('finish','Complete loading','Dock supervisor','Track service time instead of assuming every truck takes one fixed hour.','p1','Loading completed at Dock 02.',undefined,35),
      task('release','Release Dock 02','Dock supervisor','The next queued truck can use the dock only after it is physically clear.','p1','Dock 02 released; next eligible truck can be assigned.')],
    insight:'Arrival bunching creates avoidable queues. Reschedule incoming trucks before they enter the site.',
    rules:['Avoid booking more service than docks can handle','Keep early-arrival order visible','Free docks only after physical release']
  }
];

const copyTruck=(t:DemoTruck):DemoTruck=>({...t,issue:t.issue?{...t.issue}:null});
const copyDock=(d:DemoDock):DemoDock=>({...d});
const clock=(minutes:number)=>`${String(Math.floor((minutes%(24*60))/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;

export function seedDemo(id:DemoCaseId):DemoState {
  const preset=DEMO_CASES.find(x=>x.id===id);
  if(!preset)throw new Error('Unknown factory scenario');
  return {id,clockMin:preset.clockMin,trucks:preset.trucks.map(copyTruck),docks:preset.docks.map(copyDock),
    queue:[...preset.queue],events:preset.initialEvents.map(x=>({...x})),step:0,priorityApproved:false,staggered:false};
}
export const getDemoCase=(id:DemoCaseId)=>DEMO_CASES.find(x=>x.id===id)!;
export const nextDemoStep=(state:DemoState)=>getDemoCase(state.id).steps[state.step]??null;
export const formatDemoClock=clock;

/** Validates the physical assignment guards. Also powers the deliberately failed try button. */
export function canAssignDemo(state:DemoState,truckId:string,dockId:string):string|null {
  const t=state.trucks.find(x=>x.id===truckId);
  const d=state.docks.find(x=>x.id===dockId);
  if(!t||!d)return 'Unknown truck or dock.';
  if(t.status!=='ready')return `${t.plate} is not ready for a dock.`;
  if(!t.goodsReady||!t.documentsReady||t.issue&&!t.issue.resolved)return 'Readiness incomplete. Resolve the blocking issue first.';
  if(d.state==='offline')return `${d.label} is out of service. Verify a safe backup first.`;
  if(d.state==='occupied'||d.truckId)return `${d.label} is occupied. Do not interrupt active service.`;
  if(d.direction!=='both'&&d.direction!==t.direction)return `${d.label} is incompatible with this ${t.direction} truck.`;
  if(t.urgent&&!t.priorityApproved)return 'Emergency priority needs manager approval.';
  if(state.queue.length>0&&state.queue[0]!==t.id)return 'This truck is not first in the approved waiting queue.';
  return null;
}
export function tryAssignDemo(state:DemoState,truckId:string,dockId:string):DemoResult {
  const error=canAssignDemo(state,truckId,dockId);
  return {ok:false,state,message:error??'Use the guided action to record this assignment and its audit event.'};
}

/** One real, validated state transition per click. No Neon writes or backend mutations. */
export function advanceDemo(current:DemoState):DemoResult {
  const step=nextDemoStep(current);
  if(!step)return {ok:false,state:current,message:'Scenario complete. Reset to run it again.'};
  const state:DemoState={...current,trucks:current.trucks.map(copyTruck),docks:current.docks.map(copyDock),
    queue:[...current.queue],events:[...current.events]};
  const t=state.trucks.find(x=>x.id===step.truckId);
  if(!t)return {ok:false,state:current,message:'The truck is missing from this sandbox case.'};
  const bad=(message:string):DemoResult=>({ok:false,state:current,message});
  const d=t.dockId?state.docks.find(x=>x.id===t.dockId):undefined;
  switch(step.op){
    case 'approve':
      if(!t.urgent)return bad('Only a declared urgent shipment can be prioritized.');
      t.priorityApproved=true;state.priorityApproved=true;state.queue=[t.id,...state.queue.filter(id=>id!==t.id)];break;
    case 'prepare':
      if(t.goodsReady)return bad('The goods have already been confirmed ready.');
      t.goodsReady=true;break;
    case 'resolve':
      if(!t.issue||t.issue.resolved)return bad('No unresolved blocker exists.');
      if(!t.goodsReady||!t.documentsReady)return bad('Complete physical readiness before closing this issue.');
      t.issue.resolved=true;break;
    case 'ready':
      if(t.status!=='on_hold'&&t.status!=='checked_in')return bad('The truck cannot enter the ready queue from its current state.');
      if(!t.goodsReady||!t.documentsReady||t.issue&&!t.issue.resolved)return bad('Cannot mark ready until every blocking requirement is complete.');
      t.status='ready';state.queue.push(t.id);break;
    case 'restore_backup': {
      const backup=state.docks.find(x=>x.id===step.dockId);
      if(!backup||backup.state!=='offline'||backup.truckId)return bad('Backup dock is not available for safety verification.');
      backup.state='free';backup.note='Verified safe by maintenance';break;
    }
    case 'stagger':
      if(state.staggered)return bad('These appointments were already moved.');
      for(const [i,id] of ['p3','p4'].entries()){
        const x=state.trucks.find(v=>v.id===id);
        if(!x||x.status!=='scheduled')return bad('The approaching truck has already arrived or been moved.');
        x.status='scheduled';x.appointment=i===0?'10:00 AM':'11:00 AM';x.arrived='Expected later';
      }
      state.queue=state.queue.filter(id=>!['p3','p4'].includes(id));state.staggered=true;break;
    case 'complete_active':
      if(t.status!=='loading'||!d||d.truckId!==t.id)return bad('The active truck is not loading at an occupied dock.');
      t.status='completed';d.note='Loading complete - truck still occupies the bay';break;
    case 'release_active':
    case 'release':
      if(t.status!=='completed'||!d||d.truckId!==t.id)return bad('Complete loading and confirm physical dock occupancy before release.');
      d.state='free';d.truckId=null;d.note='Free and available';t.dockId=null;break;
    case 'assign': {
      if(!step.dockId)return bad('No target dock specified.');
      const reason=canAssignDemo(state,t.id,step.dockId);
      if(reason)return bad(reason);
      const target=state.docks.find(x=>x.id===step.dockId)!;
      target.state='occupied';target.truckId=t.id;target.note=`${t.plate} - awaiting service`;
      t.dockId=target.id;t.status='at_dock';state.queue=state.queue.filter(id=>id!==t.id);break;
    }
    case 'start':
      if(t.status!=='at_dock'||!d||d.truckId!==t.id)return bad('Truck must be assigned to an occupied compatible dock first.');
      if(!t.goodsReady||!t.documentsReady||t.issue&&!t.issue.resolved)return bad('Goods, documents and blockers must be cleared before loading.');
      t.status='loading';d.note=`${t.plate} - loading / unloading`;break;
    case 'finish':
      if(t.status!=='loading'||!d||d.truckId!==t.id)return bad('The truck has not started loading / unloading.');
      t.status='completed';d.note='Service complete - physically occupied';break;
    case 'depart':
      if(t.status!=='completed'||t.dockId)return bad('Dock must be physically released before gate departure.');
      if(!t.documentsReady||t.issue&&!t.issue.resolved)return bad('Exit clearance and documents are required before departure.');
      t.status='departed';break;
    default:return bad('Unknown sandbox action.');
  }
  state.clockMin+=(step.advanceMin??5);state.step+=1;
  state.events.push({time:clock(state.clockMin),actor:step.actor,message:step.event});
  return {ok:true,state,message:step.event};
}

export function demoImpact(state:DemoState):{label:string,before:string,after:string,changed:boolean,note:string}{
  const focus=state.trucks.find(x=>x.id===getDemoCase(state.id).heroTruckId)!;
  if(state.id==='late'){
    const changed=!!focus.dockId||state.step>0;
    return {label:'Estimated dock wait',before:'60 min',after:changed?'0 min':'60 min',changed,note:'Assumes Dock 02 stays compatible, staffed and free.'};
  }
  if(state.id==='urgent'){
    const index=state.queue.indexOf('c');
    const position=index>=0?`#${index+1}`:focus.dockId?'At dock':'#1';
    return {label:'Emergency queue place',before:'#3',after:position,changed:state.priorityApproved,note:'Existing active unloading is not interrupted.'};
  }
  if(state.id==='goods')return {label:'Warehouse readiness',before:'Blocked',after:focus.status==='ready'||['at_dock','loading','completed','departed'].includes(focus.status)?'Ready':'Blocked',changed:focus.status==='ready'||['at_dock','loading','completed','departed'].includes(focus.status),note:'Goods must be staged and issue closed.'};
  if(state.id==='breakdown'){
    const verified=state.docks.find(x=>x.id==='DOCK-03')?.state!=='offline';
    return {label:'Safe dock available',before:'None',after:verified?'Dock 03':'None',changed:verified,note:'Maintenance verifies the backup before assignment.'};
  }
  return {label:'Bookings at 8:00 AM',before:'4',after:state.staggered?'2':'4',changed:state.staggered,note:'Only unarrived trucks are rescheduled; arrived trucks keep their place.'};
}
