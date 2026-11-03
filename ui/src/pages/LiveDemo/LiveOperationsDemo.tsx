import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  AlertCircle,ArrowRight,CheckCircle2,Clock3,ClipboardCheck,PackageCheck,RotateCcw,
  ShieldCheck,Siren,Truck,Warehouse,Wrench,UsersRound,CalendarClock,Play,Info,LockKeyhole
} from 'lucide-react';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {StatusBadge} from '../../components/common/StatusBadge';
import {
  SCENARIOS,act,bookingPressure,canUse,formatTime,operationalImpact,plan,recommendation,
  scenario,seed,sortedQueue
} from './opsEngine';
import type{CaseId,Dock,Operation,Vehicle,World} from './opsEngine';
import './live-operations.css';

const ICONS={late:Clock3,urgent:Siren,goods:PackageCheck,breakdown:Wrench,peak:UsersRound};
const stage:Record<Vehicle['stage'],string>={scheduled:'Scheduled',checked_in:'Checked in',on_hold:'On hold',ready:'Ready',at_dock:'At dock',loading:'In service',completed:'Completed',departed:'Departed'};
const where=(dock:Dock)=>dock.truckId?'Occupied':dock.operational?'Free':'Offline';
const buttonLabel=(op:Operation)=>({check_in:'Check in truck',stage_goods:'Confirm goods staged',prepare_docs:'Verify documents',resolve:'Resolve issue',ready:'Mark ready for dock',approve_priority:'Approve urgent priority',assign:'Assign to dock',start:'Start loading / unloading',finish:'Finish service',release:'Release physical dock',clearance:'Confirm exit clearance',depart:'Record departure',verify_dock:'Verify dock safe',reschedule:'Reschedule appointment',advance:'Move demo clock'} as Record<Operation,string>)[op];

export function LiveOperationsDemo(){
 const [params,setParams]=useSearchParams();
 const p=params.get('case');
 const valid=SCENARIOS.some(x=>x.id===p);
 const requested=(valid?p:'late') as CaseId;
 const [world,setWorld]=useState<World>(()=>seed(requested));
 const [selectedTruck,setSelectedTruck]=useState(scenario(requested).targetId);
 const [selectedDock,setSelectedDock]=useState('');
 const [newAppointment,setNewAppointment]=useState('600');
 const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);
 useEffect(()=>{
  if(world.id!==requested){setWorld(seed(requested));setSelectedTruck(scenario(requested).targetId);setSelectedDock('');setNotice(null)}
 },[requested,world.id]);
 const info=scenario(world.id);
 const selected=world.vehicles.find(x=>x.id===selectedTruck)??world.vehicles[0];
 const queued=useMemo(()=>sortedQueue(world),[world]);
 const now=world.now;
 const planning=useMemo(()=>plan(world),[world]);
 const rec=recommendation(world,selected.id);
 const impact=operationalImpact(world);
 const target=world.vehicles.find(v=>v.id===info.targetId)!;
 const queuePosition=planning.byTruck[selected.id]?.position;
 const recommendedDock=planning.byTruck[selected.id]?.dockId;
 const dockOption=selectedDock||recommendedDock||'';
 const totalOnsite=world.vehicles.filter(t=>t.arrivalMin!=null&&t.stage!=='departed').length;
 const occupied=world.docks.filter(d=>!!d.truckId).length;
 const offline=world.docks.filter(d=>!d.operational).length;
 const blocked=world.vehicles.filter(t=>t.problem&&!t.problem.resolved).length;
 const busy=world.docks.filter(d=>d.truckId&&d.releaseEstimateMin!=null).length;
 const originalBooking=world.id==='late'?formatTime(target.bookedMin):null;
 function changeScenario(id:CaseId){setParams({case:id});setWorld(seed(id));setSelectedTruck(scenario(id).targetId);setSelectedDock('');setNotice(null)}
 function reset(){setWorld(seed(world.id));setSelectedTruck(info.targetId);setSelectedDock('');setNotice(null)}
 function perform(op:Operation,props:{dockId?:string;minutes?:number;bookedMin?:number}={}){
  const result=act(world,{op,truckId:selected.id,...props});setNotice({ok:result.ok,text:result.message});
  if(result.ok){setWorld(result.world);if(op==='assign')setSelectedDock('')}
 }
 function selectTruck(id:string){setSelectedTruck(id);setSelectedDock('');setNotice(null)}
 const primaryOp=rec.action as Operation;
 const blockedByGate=selected.stage==='scheduled'&&(selected.observedMin==null||world.now<selected.observedMin);
 return <div className="page op-demo-page">
  <PageHeader title="Factory operations demo" subtitle="Choose a real operating decision. The trucks, docks, queue and wait estimates update together.">
    <span className="op-sandbox-tag"><ShieldCheck size={14}/> Isolated demo data</span>
    <button className="btn" type="button" onClick={reset}><RotateCcw size={15}/> Reset</button>
  </PageHeader>

  <div className="op-cases" role="tablist" aria-label="Factory disruption examples">
   {SCENARIOS.map((s,i)=>{const Icon=ICONS[s.id];return <button key={s.id} role="tab" aria-selected={s.id===world.id} className={`op-case${s.id===world.id?' selected':''}`} type="button" onClick={()=>changeScenario(s.id)}>
    <span className="op-case-icon"><Icon size={16}/></span><span><b>{i+1}. {s.label}</b><small>{s.sub}</small></span>
   </button>})}
  </div>

  <section className="op-problem">
   <div className="op-problem-main"><span className="op-overline"><span className="op-dot"/> LIVE FACTORY SITUATION <span className="op-word-dot">·</span> {formatTime(now)}</span>
    <h2>{info.issue}</h2>
    {world.id==='late'&&<p>Booked {originalBooking} · Arrived {formatTime(target.observedMin)} · Dock 01 busy until 13:00 · Dock 02 available</p>}
    {world.id!=='late'&&<p>Select a truck, apply an action and watch the operational plan recalculate.</p>}
   </div>
   <div className="op-impact"><span>OPERATING IMPACT</span><strong>{impact.primary}</strong><small>{impact.title}</small><p>{impact.secondary}</p></div>
  </section>

  <div className="op-summary" aria-label="Simulated current plant state">
    <div><Truck size={15}/><span>On-site trucks</span><b>{totalOnsite}</b></div>
    <div><Warehouse size={15}/><span>Docks occupied</span><b>{occupied} / {world.docks.length}</b></div>
    <div><AlertCircle size={15}/><span>Needs attention</span><b>{blocked+offline}</b></div>
    <div><Clock3 size={15}/><span>Time</span><b>{formatTime(now)}</b></div>
  </div>

  <div className="op-layout">
   <div className="op-left">
    <Card title={<div className="op-card-title"><Warehouse size={16}/> Dock occupancy <span className="op-sub">Select a bay to allocate the selected truck</span></div>} actions={<span className="op-muted">{world.docks.filter(d=>d.operational&&!d.truckId).length} free · {busy} active</span>}>
     <div className="op-docks">{world.docks.map(d=>{const occupant=world.vehicles.find(x=>x.id===d.truckId);
       return <button type="button" key={d.id} className={`op-dock ${d.truckId?'busy':d.operational?'free':'offline'} ${dockOption===d.id?'choice':''}`} onClick={()=>setSelectedDock(d.id)} title="Select this dock for the current truck">
        <div className="op-dock-line"><b>{d.id.replace('DOCK-','Dock ')}</b><span className="op-dock-state">{where(d)}</span></div>
        <small>{d.direction==='both'?'Inbound / outbound':d.direction==='inbound'?'Inbound only':'Outbound only'}</small>
        <div className="op-dock-who">{occupant?<><Truck size={13}/><b>{occupant.plate}</b></>:d.operational?<><CheckCircle2 size={13}/><span>Available for allocation</span></>:<><Wrench size={13}/><span>Unavailable for service</span></>}</div>
        <div className="op-dock-note">{occupant?d.releaseEstimateMin!=null?`Est. release ${formatTime(d.releaseEstimateMin)}`:'Requires physical release':d.note||'Ready'}</div>
       </button>})}</div>
     <div className="op-legend"><span><i className="dot-free"/>Available</span><span><i className="dot-busy"/>Occupied</span><span><i className="dot-offline"/>Offline</span><span>Selected bay has a highlighted border</span></div>
    </Card>

    <Card title={<div className="op-card-title"><Truck size={16}/> Truck register <span className="op-sub">Click any truck to take action</span></div>} actions={<span className="op-muted">{queued.length} in ready queue</span>} flush>
     <div className="op-table-scroll"><table className="op-table"><thead><tr><th>Truck</th><th>Appointment</th><th>Status</th><th>Next service</th><th>Dock</th></tr></thead>
      <tbody>{[...world.vehicles].sort((a,b)=>Number(a.stage==='departed')-Number(b.stage==='departed')||Number(!a.urgent&&a.priorityApproved)-Number(!b.urgent&&b.priorityApproved)||a.id.localeCompare(b.id)).map(t=>{
       const pp=planning.byTruck[t.id];const focus=t.id===info.targetId;
       return <tr key={t.id} className={`${selected.id===t.id?'row-selected':''}${focus?' row-focus':''}`} onClick={()=>selectTruck(t.id)}>
        <td><button className="op-plate" type="button" onClick={e=>{e.stopPropagation();selectTruck(t.id)}}>{t.plate}</button>{t.urgent&&<span className="op-urg">URGENT</span>}<small>{t.cargo}</small></td>
        <td>{formatTime(t.bookedMin)}{t.modifiedBooking&&<small>Rescheduled</small>}</td>
        <td><StatusBadge status={t.stage}/></td>
        <td>{pp?pp.startMin==null?'Unknown':pp.waitMin===0?'Now':formatTime(pp.startMin):t.stage==='scheduled'?t.observedMin!=null&&t.observedMin<=now?'At gate':'Not arrived':'—'}{pp&&<small>Queue #{pp.position}</small>}</td>
        <td>{t.dockId?t.dockId.replace('DOCK-','Dock '):pp?.dockId?`→ ${pp.dockId.replace('DOCK-','Dock ')}`:'—'}</td>
       </tr>})}</tbody></table></div>
    </Card>
   </div>

   <div className="op-right">
    <div className="op-dispatch">
     <div className="op-action-overline"><span>DISPATCH CONSOLE</span><span>Version {world.version+1}</span></div>
     <div className="op-selected"><h3>{selected.plate}</h3><StatusBadge status={selected.stage}/></div>
     <div className="op-selected-context">{selected.cargo} · {selected.direction==='inbound'?'Inbound delivery':'Outbound collection'} {selected.urgent?'· Urgent shipment':''}</div>
     <div className="op-recommendation"><span><Info size={13}/> SYSTEM RECOMMENDATION</span><p>{rec.text}</p><small>Owner: {rec.owner}</small></div>

     {selected.stage==='ready'&&<div className="op-dock-picker"><label htmlFor="op-dock-select">Assign dock</label><select id="op-dock-select" value={dockOption} onChange={e=>setSelectedDock(e.target.value)}>
      <option value="">Choose a dock</option>{world.docks.map(d=><option key={d.id} value={d.id}>{d.id.replace('DOCK-','Dock ')} — {d.truckId?'OCCUPIED':!d.operational?'OFFLINE':canUse(d,selected)?'AVAILABLE':'WRONG DIRECTION'}</option>)}</select>
      {queuePosition&&<small>Current approved queue position #{queuePosition}</small>}
     </div>}
     {selected.stage==='scheduled'&&<div className="op-slot-picker"><label htmlFor="op-slot-select">Move unarrived booking to</label><select id="op-slot-select" value={newAppointment} onChange={e=>setNewAppointment(e.target.value)}>
       {[540,600,660,720,780,840,900].map(v=><option key={v} value={v}>{formatTime(v)}</option>)}
     </select></div>}

     <div className="op-actions">
      {selected.stage==='scheduled'&&<>
       <button className="op-main-button" type="button" disabled={blockedByGate} onClick={()=>perform('check_in')}>Check in truck <ArrowRight size={16}/></button>
       <button className="op-alt-button" type="button" onClick={()=>perform('reschedule',{bookedMin:Number(newAppointment)})}><CalendarClock size={15}/> Reschedule appointment</button>
       {blockedByGate&&<span className="op-help">This vehicle has not reached the gate. Advance the demo clock if needed.</span>}
      </>}
      {(selected.stage==='checked_in'||selected.stage==='on_hold')&&<>
       {!selected.goodsReady&&<button className="op-main-button" type="button" onClick={()=>perform('stage_goods')}>Warehouse: confirm goods staged <ArrowRight size={16}/></button>}
       {!selected.docsReady&&<button className="op-alt-button" type="button" onClick={()=>perform('prepare_docs')}>Verify required documents</button>}
       {selected.problem&&!selected.problem.resolved&&<button className="op-alt-button" type="button" onClick={()=>perform('resolve')}>Resolve blocking issue</button>}
       <button className="op-main-button" type="button" onClick={()=>perform('ready')}>Mark ready for dock <ArrowRight size={16}/></button>
      </>}
      {selected.stage==='ready'&&<>
       {selected.urgent&&!selected.priorityApproved&&<button className="op-main-button" type="button" onClick={()=>perform('approve_priority')}>Manager: approve urgent priority <ArrowRight size={16}/></button>}
       <button className={selected.urgent&&!selected.priorityApproved?'op-alt-button':'op-main-button'} type="button" onClick={()=>perform('assign',{dockId:dockOption})}>Assign {dockOption?dockOption.replace('DOCK-','Dock '):'selected dock'} <ArrowRight size={16}/></button>
      </>}
      {selected.stage==='at_dock'&&<button className="op-main-button" type="button" onClick={()=>perform('start')}>Start loading / unloading <ArrowRight size={16}/></button>}
      {selected.stage==='loading'&&<button className="op-main-button" type="button" onClick={()=>perform('finish')}>Record service completed <ArrowRight size={16}/></button>}
      {selected.stage==='completed'&&<>
       {selected.dockId?<button className="op-main-button" type="button" onClick={()=>perform('release')}>Confirm truck physically left dock <ArrowRight size={16}/></button>:
        !selected.clearance?<button className="op-main-button" type="button" onClick={()=>perform('clearance')}>Confirm exit documents and clearance <ArrowRight size={16}/></button>:<button className="op-main-button" type="button" onClick={()=>perform('depart')}>Record gate departure <ArrowRight size={16}/></button>}
      </>}
      {selected.stage==='departed'&&<div className="op-complete"><CheckCircle2 size={17}/> This truck's factory visit is complete.</div>}
      {world.docks.filter(d=>!d.operational).map(d=><button className="op-alt-button" key={d.id} type="button" onClick={()=>perform('verify_dock',{dockId:d.id})}><Wrench size={14}/> Maintenance: verify {d.id.replace('DOCK-','Dock ')}</button>)}
     </div>
     {notice&&<div className={`op-notice ${notice.ok?'success':'error'}`} role="status">{notice.ok?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>}<span>{notice.text}</span></div>}
     {selected.problem&&!selected.problem.resolved&&<div className="op-open-issue"><LockKeyhole size={15}/><span>Open blocker · {selected.problem.owner}<small>{selected.problem.reason}</small></span></div>}
    </div>
    <Card title={<div className="op-card-title"><Clock3 size={15}/> Simulate time</div>}>
     <div className="op-clock-row"><div><b>{formatTime(now)}</b><small>Factory local clock</small></div><div className="op-clock-buttons"><button className="btn btn-sm" onClick={()=>perform('advance',{minutes:15})}>+15m</button><button className="btn btn-sm" onClick={()=>perform('advance',{minutes:60})}>+1h</button></div></div>
    </Card>
   </div>
  </div>
  <Card className="op-log-card" title={<div className="op-card-title"><ClipboardCheck size={15}/> Operational audit history</div>} actions={<span className="op-muted">{world.history.length} recorded events</span>}>
   <div className="op-event-strip">{[...world.history].reverse().slice(0,6).map((e,i)=><div key={`${e.timeMin}-${i}-${e.event}`} className="op-event"><time>{formatTime(e.timeMin)}</time><div><b>{e.role}</b><p>{e.event}</p></div></div>)}</div>
  </Card>
  <div className="op-footer"><ShieldCheck size={15}/><span>Operational sandbox: every button applies a validated state change, recalculates the queue and updates the dock board. All trucks and timings are synthetic. No real yard records or Neon data are modified; the normal Yardline screens handle persistent operations.</span></div>
 </div>;
}
