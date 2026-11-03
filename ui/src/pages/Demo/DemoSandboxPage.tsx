import {useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {
  AlertCircle,ArrowRight,Check,CheckCircle2,ChevronRight,Clock3,ClipboardCheck,
  Gauge,Info,PackageX,Play,RotateCcw,ShieldCheck,ShieldAlert,Siren,Truck,UsersRound,
  Warehouse,Wrench
} from 'lucide-react';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {StatusBadge} from '../../components/common/StatusBadge';
import {
  DEMO_CASES,advanceDemo,canAssignDemo,demoImpact,formatDemoClock,getDemoCase,
  nextDemoStep,seedDemo,tryAssignDemo
} from './demoEngine';
import type {DemoCaseId,DemoDock,DemoState,DemoTruck} from './demoEngine';
import './demo-sandbox.css';

const CASE_ICONS={late:Clock3,urgent:Siren,goods:PackageX,breakdown:Wrench,peak:UsersRound};
const stageName:Record<DemoTruck['status'],string>={
  scheduled:'Scheduled',checked_in:'Checked in',ready:'Ready for dock',on_hold:'On hold',
  at_dock:'At dock',loading:'Loading / unloading',completed:'Service completed',departed:'Departed'
};
const dockLabel=(dock:DemoDock)=>dock.state==='offline'?'Out of service':dock.state==='occupied'?'Occupied':'Available';

export function DemoSandboxPage(){
  const [params,setParams]=useSearchParams();
  const param=params.get('case');
  const valid=DEMO_CASES.some(c=>c.id===param);
  const initial=(valid?param:'late') as DemoCaseId;
  const [sandbox,setSandbox]=useState<DemoState>(()=>seedDemo(initial));
  const [error,setError]=useState('');
  const [selectedTruck,setSelectedTruck]=useState<string>(()=>getDemoCase(initial).heroTruckId);
  const [showDetails,setShowDetails]=useState(false);

  // Supports bookmarkable links to each interview case, including browser back/forward.
  useEffect(()=>{
    if(sandbox.id!==initial){setSandbox(seedDemo(initial));setSelectedTruck(getDemoCase(initial).heroTruckId);setError('');setShowDetails(false)}
  },[initial,sandbox.id]);

  const preset=getDemoCase(sandbox.id);
  const focus=sandbox.trucks.find(t=>t.id===preset.heroTruckId)!;
  const step=nextDemoStep(sandbox);
  const done=!step;
  const impact=demoImpact(sandbox);
  const selected=sandbox.trucks.find(t=>t.id===selectedTruck)??focus;
  const clock=formatDemoClock(sandbox.clockMin);
  const progress=100*sandbox.step/preset.steps.length;
  const queueTrucks=sandbox.queue.map(id=>sandbox.trucks.find(t=>t.id===id)).filter((t):t is DemoTruck=>!!t);
  const activeTrucks=sandbox.trucks.filter(t=>!sandbox.queue.includes(t.id)&&t.status!=='scheduled'&&t.status!=='departed');
  const scheduledTrucks=sandbox.trucks.filter(t=>t.status==='scheduled');
  const occupied=sandbox.docks.filter(d=>d.state==='occupied').length;
  const blocked=sandbox.trucks.filter(t=>t.issue&&!t.issue.resolved).length;
  const wrongDock=sandbox.id==='late'?'DOCK-01':sandbox.id==='breakdown'?'DOCK-01':sandbox.id==='urgent'?'DOCK-01':null;

  const events=useMemo(()=>[...sandbox.events].reverse(),[sandbox.events]);
  function switchCase(id:DemoCaseId){
    setParams({case:id},{replace:false});setSandbox(seedDemo(id));setSelectedTruck(getDemoCase(id).heroTruckId);
    setError('');setShowDetails(false);
  }
  function reset(){setSandbox(seedDemo(sandbox.id));setSelectedTruck(preset.heroTruckId);setError('');setShowDetails(false)}
  function advance(){
    const result=advanceDemo(sandbox);
    if(result.ok){setSandbox(result.state);setError('')}
    else setError(result.message);
  }
  function challengeDock(id:string){
    const result=tryAssignDemo(sandbox,preset.heroTruckId,id);
    setError(result.message);
  }

  return <div className="page sandbox-page">
    <PageHeader title="Demo sandbox" subtitle="Five factory problems. Operate the trucks, see the decision, reset instantly.">
      <span className="sb-safe"><ShieldCheck size={15}/> Safe demo - no live database changes</span>
      <button className="btn" type="button" onClick={reset}><RotateCcw size={15}/> Reset scenario</button>
    </PageHeader>

    <div className="sb-case-rail" role="tablist" aria-label="Choose factory disruption">
      {DEMO_CASES.map((c,index)=>{
        const Icon=CASE_ICONS[c.id];
        return <button className={`sb-case${sandbox.id===c.id?' is-selected':''}`} role="tab" aria-selected={sandbox.id===c.id}
          key={c.id} type="button" onClick={()=>switchCase(c.id)}>
          <span className="sb-case-icon"><Icon size={18}/></span>
          <span className="sb-case-copy"><span className="sb-case-title">{index+1}. {c.label}</span><span className="sb-case-sub">{c.short}</span></span>
          {sandbox.id===c.id&&<Check size={16} className="sb-case-check"/>}
        </button>;
      })}
    </div>

    <div className="sb-hero">
      <div className="sb-hero-text">
        <div className="sb-eyebrow"><span className="sb-sim-dot"/> SANDBOX CASE {String(DEMO_CASES.indexOf(preset)+1).padStart(2,'0')} OF 05 <span className="sb-eyebrow-divider"/> {preset.category}</div>
        <h2>{preset.headline}</h2>
        <p>{preset.story}</p>
        <div className="sb-hero-person"><Truck size={15}/><span>Focus truck</span><b>{focus.plate}</b><StatusBadge status={focus.status}/></div>
      </div>
      <div className="sb-outcome-summary" aria-live="polite">
        <span className="sb-outcome-label">{impact.label}</span>
        <div className="sb-outcome-values"><span>{impact.before}</span><ArrowRight size={19}/><strong className={impact.changed?'is-improved':''}>{impact.after}</strong></div>
        <div className="sb-outcome-caption">{impact.changed?'Changed by your decision':'Original situation'} <span aria-hidden="true">-</span> {impact.note}</div>
      </div>
    </div>

    <div className="sb-metrics" aria-label="Simulated factory conditions">
      <div><Truck size={15}/><span>Trucks on site</span><strong>{sandbox.trucks.filter(t=>t.status!=='scheduled'&&t.status!=='departed').length}</strong></div>
      <div><Warehouse size={15}/><span>Docks occupied</span><strong>{occupied} / {sandbox.docks.length}</strong></div>
      <div><ShieldAlert size={15}/><span>Open blockers</span><strong>{blocked}</strong></div>
      <div><Clock3 size={15}/><span>Scenario time</span><strong>{clock}</strong></div>
    </div>

    <div className="sb-columns">
      <div className="sb-operations">
        <Card className="sb-board" title={<div className="sb-board-heading"><span className="sb-section-icon"><Warehouse size={17}/></span><span>Factory floor <small>Realistic truck and dock occupancy</small></span></div>}
          actions={<span className="sb-live-indicator"><span/> Simulation</span>}>
          <div className="sb-subheading"><span>LOADING DOCKS</span><small>Never reassign an occupied or unsafe dock</small></div>
          <div className="sb-docks">
            {sandbox.docks.map(d=>{
              const current=d.truckId?sandbox.trucks.find(t=>t.id===d.truckId):null;
              return <div key={d.id} className={`sb-dock sb-dock-${d.state}`}>
                <div className="sb-dock-top"><div className="sb-dock-symbol"><Warehouse size={19}/></div><span className={`sb-dock-tag tag-${d.state}`}><span/>{dockLabel(d)}</span></div>
                <div className="sb-dock-title">{d.label}</div>
                <div className="sb-dock-type">{d.direction==='both'?'Inbound + outbound':d.direction==='inbound'?'Inbound only':'Outbound only'}</div>
                <div className="sb-dock-foot">{current?<><Truck size={14}/><b>{current.plate}</b></>:<><Info size={13}/><span>{d.note}</span></>}</div>
                {d.state==='occupied'&&<div className="sb-dock-occupancy" aria-hidden="true"/>}
              </div>;
            })}
          </div>
          <div className="sb-queue-heading"><span>TRUCK QUEUE & OPERATIONS</span><small>{queueTrucks.length} waiting for a dock</small></div>
          <div className="sb-truck-list">
            {queueTrucks.map((t,index)=><TruckRow key={t.id} truck={t} selected={selectedTruck===t.id}
              onSelect={()=>{setSelectedTruck(t.id);setShowDetails(true)}} position={index+1} focus={t.id===focus.id}/>)}
            {activeTrucks.map(t=><TruckRow key={t.id} truck={t} selected={selectedTruck===t.id}
              onSelect={()=>{setSelectedTruck(t.id);setShowDetails(true)}} focus={t.id===focus.id}/>)}
            {scheduledTrucks.map(t=><TruckRow key={t.id} truck={t} selected={selectedTruck===t.id}
              onSelect={()=>{setSelectedTruck(t.id);setShowDetails(true)}} focus={t.id===focus.id}/>)}
            {sandbox.trucks.filter(t=>t.status==='departed').map(t=><TruckRow key={t.id} truck={t}
              selected={selectedTruck===t.id} onSelect={()=>{setSelectedTruck(t.id);setShowDetails(true)}} focus={t.id===focus.id}/>)}
          </div>
          {showDetails&&<div className="sb-truck-detail">
            <button className="sb-detail-close" type="button" onClick={()=>setShowDetails(false)}>Close</button>
            <div className="sb-detail-head"><b>{selected.plate}</b><StatusBadge status={selected.status}/></div>
            <div className="sb-detail-grid">
              <span>Appointment <b>{selected.appointment}</b></span><span>Arrival <b>{selected.arrived}</b></span>
              <span>Goods staged <b>{selected.goodsReady?'Yes':'No'}</b></span><span>Documents <b>{selected.documentsReady?'Ready':'Missing'}</b></span>
              <span>Dock <b>{selected.dockId?.replace('DOCK-','Dock ')??'Not allocated'}</b></span>
              <span>Problem <b>{selected.issue?(selected.issue.resolved?'Resolved':selected.issue.reason):'None open'}</b></span>
            </div>
          </div>}
        </Card>
      </div>
      <aside className="sb-guidance">
        <div className={`sb-action-card${done?' is-done':''}`}>
          <div className="sb-step-top"><span><Play size={13}/> NEXT OPERATIONAL ACTION</span><span>{sandbox.step} / {preset.steps.length} completed</span></div>
          <div className="sb-progress" role="progressbar" aria-valuemin={0} aria-valuemax={preset.steps.length} aria-valuenow={sandbox.step} aria-label="Scenario progress"><span style={{width:`${progress}%`}}/></div>
          {step?<>
            <div className="sb-action-context">Decision {sandbox.step+1} of {preset.steps.length}</div>
            <h3>{step.label}</h3>
            <p>{step.why}</p>
            <div className="sb-actor"><span>Responsible</span><b>{step.actor}</b></div>
            <button type="button" className="sb-primary-action" onClick={advance}>{step.label}<ArrowRight size={17}/></button>
            {wrongDock&&sandbox.step===0&&<button className="sb-unsafe-action" type="button" onClick={()=>challengeDock(wrongDock)}>
              Test assigning occupied / unsafe Dock 01
            </button>}
          </>:<>
            <div className="sb-complete-mark"><CheckCircle2 size={34}/></div>
            <h3>Scenario completed</h3>
            <p>You've handled this factory disruption while keeping the truck, dock and event records consistent.</p>
            <button className="sb-primary-action" type="button" onClick={reset}><RotateCcw size={16}/> Run it again</button>
            <button className="sb-unsafe-action" type="button" onClick={()=>switchCase(DEMO_CASES[(DEMO_CASES.indexOf(preset)+1)%DEMO_CASES.length].id)}>
              Try the next scenario <ChevronRight size={15}/>
            </button>
          </>}
          {error&&<div role="alert" className="sb-error"><AlertCircle size={16}/><span>{error}</span></div>}
        </div>
        <Card className="sb-why" title={<div className="sb-section-title"><ShieldCheck size={16}/> Rules enforced</div>}>
          <ul>{preset.rules.map(r=><li key={r}><CheckCircle2 size={14}/><span>{r}</span></li>)}</ul>
        </Card>
        <Card className="sb-audit" title={<div className="sb-section-title"><ClipboardCheck size={16}/> Activity history</div>}>
          <ol aria-live="polite">{events.slice(0,6).map((e,i)=><li key={`${e.time}-${i}`}>
            <div className="sb-event-time">{e.time}</div>
            <div className="sb-event-detail"><b>{e.actor}</b><p>{e.message}</p></div>
          </li>)}</ol>
        </Card>
      </aside>
    </div>
    <div className="sb-footer-note"><Gauge size={16}/>
      <span>This is an isolated, preloaded demo of Yardline's operational concepts. All buttons update local sandbox data only. Your live appointments, docks and Neon database are never changed. Refreshing or resetting restarts the example.</span>
    </div>
  </div>;
}

function TruckRow({truck,position,focus,selected,onSelect}:{truck:DemoTruck;position?:number;focus:boolean;selected:boolean;onSelect:()=>void}){
  return <button type="button" className={`sb-truck-row${focus?' is-focus':''}${selected?' is-selected':''}`} onClick={onSelect}>
    <span className="sb-truck-position">{position?`#${position}`:<Truck size={16}/>}</span>
    <span className="sb-truck-core"><span className="sb-truck-name"><b>{truck.plate}</b>{truck.urgent&&<span className="sb-urgent"><Siren size={11}/> URGENT</span>}{focus&&<span className="sb-focus">Focus truck</span>}</span>
      <small>{truck.cargo} <span className="sb-mid-dot">-</span> {truck.carrier}</small>
    </span>
    <span className="sb-truck-right"><StatusBadge status={truck.status}/><small>{truck.dockId?truck.dockId.replace('DOCK-','Dock '):truck.status==='scheduled'?`Rebooked ${truck.appointment}`:truck.issue&&!truck.issue.resolved?'Problem open':position?`Queue #${position}`:stageName[truck.status]}</small></span>
    <ChevronRight className="sb-truck-arrow" size={15}/>
  </button>;
}
