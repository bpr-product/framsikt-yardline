import {useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,AlertCircle,ArrowRight,CheckCircle2,CalendarDays,ChevronRight,Clock3,Filter,Info,Loader2,PackageCheck,RefreshCw,Search,ShieldAlert,Truck,Warehouse,AlertTriangle} from 'lucide-react';
import {DecisionService} from '../services/DecisionService';
import {explain} from '../services/ApiBase';
import type{Visit,Dock,Role} from '../types/domain';
import type{Analytics,Decision,Issue,Planning,Readiness} from '../types/decisions';

type Props={page:string;visits:Visit[];docks:Dock[];role:Role;onSelect:(id:string)=>void;onCreateAt:(time?:string,direction?:'inbound'|'outbound')=>void;onRefresh:()=>Promise<void>};
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
const duration=(mins:number|null|undefined)=>mins==null?'Not recorded':mins<60?`${Math.round(mins)} min`:`${Math.floor(mins/60)}h ${Math.round(mins%60)}m`;
const dt=(value:string|null)=>value?new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'Not recorded';
const can=(role:Role,...roles:Role[])=>roles.includes(role);
const prio=(p:number)=>p===0?'Immediate':p===1?'Action needed':'Monitor';

export function DecisionWorkspace({page,visits,docks,role,onSelect,onCreateAt,onRefresh}:Props){
  const [items,setItems]=useState<Decision[]>([]),[issues,setIssues]=useState<Issue[]>([]),[analysis,setAnalysis]=useState<Analytics|null>(null),[plan,setPlan]=useState<Planning|null>(null);
  const [day,setDay]=useState(today),[direction,setDirection]=useState<'inbound'|'outbound'>('outbound'),[status,setStatus]=useState<'open'|'resolved'>('open');
  const [selectedVisit,setSelectedVisit]=useState<string|null>(null),[prep,setPrep]=useState<Readiness|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [resolution,setResolution]=useState<Record<string,string>>({}),[search,setSearch]=useState('');
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      if(page==='Command center')setItems((await DecisionService.recommendations()).recommendations);
      if(page==='Problem desk')setIssues(await DecisionService.issues(status));
      if(page==='Readiness'&&selectedVisit)setPrep(await DecisionService.readiness(selectedVisit));
      if(page==='Capacity planner')setPlan(await DecisionService.slots(day,direction));
      if(page==='Analysis')setAnalysis(await DecisionService.analytics());
    }catch(e){setError(explain(e))}finally{setLoading(false)}
  },[page,status,selectedVisit,day,direction]);
  useEffect(()=>{void load()},[load]);
  const run=async(action:()=>Promise<unknown>,success:string)=>{
    setBusy(true);setError('');setMessage('');
    try{await action();setMessage(success);await onRefresh();await load()}
    catch(e){setError(explain(e))}finally{setBusy(false)}
  };
  const visible=useMemo(()=>items.filter(x=>(x.truck_plate+' '+x.title+' '+x.owner+' '+x.reason).toLowerCase().includes(search.toLowerCase())),[items,search]);
  const active=visits.filter(v=>v.status!=='departed'&&v.status!=='cancelled');
  return <div className="dec-page">
    {error&&<div className="dec-error" role="alert"><AlertCircle size={17}/>{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
    {message&&<div className="dec-message" role="status"><CheckCircle2 size={17}/>{message}</div>}
    {page==='Command center'&&<>
      <div className="dec-intro"><div><span className="dec-kicker">LIVE DECISIONS</span><h2>What needs attention right now?</h2><p>Yardline turns current truck and dock state into explainable next actions, with an owner for each problem.</p></div><button className="dec-outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>Refresh decisions</button></div>
      <div className="dec-kpis"><Metric label="Action needed" number={items.filter(x=>x.priority<=1).length.toString()} note="Current recommendations" icon={ShieldAlert}/><Metric label="Trucks at the plant" number={active.filter(v=>v.arrival_at).length.toString()} note="Not yet departed" icon={Truck}/><Metric label="Occupied bays" number={`${docks.filter(d=>d.visit_id).length}/${docks.length}`} note="Physical occupancy" icon={Warehouse}/><Metric label="Active recommendations" number={items.length.toString()} note="Rule-based, not AI-generated" icon={Activity}/></div>
      <div className="dec-toolbar"><div className="dec-search"><Search size={16}/><input aria-label="Search recommendations" placeholder="Search trucks, reasons or owners" value={search} onChange={e=>setSearch(e.target.value)}/></div><span className="dec-help"><Info size={14}/> Human approval required for physical actions</span></div>
      <div className="dec-queue">{loading&&items.length===0?<Loading/>:visible.length===0?<Empty title="No matching actions" detail="New recommendations appear as appointments, readiness, issues and dock occupancy change."/>:visible.map(x=><article className="dec-action" key={x.id}>
        <div className={`dec-severity ${x.priority===0?'hot':x.priority===1?'warm':'normal'}`}>{prio(x.priority)}</div>
        <div className="dec-action-body"><div className="dec-action-top"><span className="dec-plate">{x.truck_plate}</span><span className="dec-tag">{x.direction}</span><span className="dec-stage">{x.status.replaceAll('_',' ')}</span></div><h3>{x.title}</h3><p>{x.reason}</p><div className="dec-owner"><span>Next owner</span><b>{x.owner}</b></div></div>
        <button className="dec-cta" onClick={()=>onSelect(x.visit_id)} aria-label={`Review ${x.truck_plate}`}>Review and act <ChevronRight size={16}/></button>
      </article>)}</div>
      <p className="dec-evidence">These are pilot rules based on recorded information. Staffing, equipment and contractual priority are not yet connected; any recommendation is subject to a supervisor's safety check.</p>
    </>}
    {page==='Problem desk'&&<>
      <div className="dec-intro"><div><span className="dec-kicker">ACCOUNTABLE RESOLUTION</span><h2>Every blocker needs an owner.</h2><p>Problems stay open across shift changes until someone records the resolution. Issue time is never double-counted as additional truck waiting.</p></div><button className="dec-outline" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button></div>
      <div className="dec-tabs"><button className={status==='open'?'selected':''} onClick={()=>setStatus('open')}>Open and escalated</button><button className={status==='resolved'?'selected':''} onClick={()=>setStatus('resolved')}>Resolved history</button></div>
      <div className="dec-issue-list">{loading&&!issues.length?<Loading/>:issues.length===0?<Empty title="No problems in this view" detail="Open a truck to report missing goods, documents or other operational blockers."/>:issues.map(issue=><article className="dec-issue" key={issue.id}>
        <div className="dec-issue-main"><span className={`dec-dot ${issue.severity}`}/><div><div className="dec-action-top"><button className="dec-link" onClick={()=>onSelect(issue.visit_id)}>{issue.truck_plate}</button><span className="dec-tag">{issue.code.replaceAll('_',' ')}</span>{issue.status==='escalated'&&<span className="dec-escalated">Escalated</span>}</div><h3>{issue.description}</h3><div className="dec-issue-meta">Owner: {issue.owner} · Opened {dt(issue.opened_at)} · {issue.severity} priority</div>{issue.status==='resolved'&&<p className="dec-resolved">Resolved: {issue.resolution_note}</p>}</div></div>
        {issue.status!=='resolved'&&<div className="dec-resolution"><input value={resolution[issue.id]||''} placeholder="How was this resolved?" aria-label={`Resolution for ${issue.truck_plate}`} onChange={e=>setResolution({...resolution,[issue.id]:e.target.value})}/><button disabled={busy||(resolution[issue.id]||'').trim().length<5||!can(role,'coordinator','supervisor','manager')} onClick={()=>void run(()=>DecisionService.resolveIssue(issue.id,resolution[issue.id]),'Problem resolved and recorded')}>Resolve</button>{can(role,'manager')&&issue.status==='open'&&<button className="dec-outline smaller" disabled={busy} onClick={()=>void run(()=>DecisionService.escalateIssue(issue.id),'Issue escalated to manager review')}>Escalate</button>}</div>}
      </article>)}</div>
    </>}
    {page==='Readiness'&&<>
      <div className="dec-intro"><div><span className="dec-kicker">PREVENT THE WAIT</span><h2>Don't send a truck to unprepared work.</h2><p>Different prerequisites for deliveries and collections. Every confirmation is attributed to a person and can be revoked if conditions change.</p></div></div>
      <div className="dec-split"><div className="dec-select-pane"><span className="dec-pane-title">Planned and on-site trucks</span><div className="dec-choice-list">{active.filter(v=>['scheduled','checked_in','on_hold','ready','at_dock','loading','paused','completed'].includes(v.status)).map(v=><button key={v.id} className={selectedVisit===v.id?'selected':''} onClick={()=>setSelectedVisit(v.id)}><span><b>{v.truck_plate}</b><small>{v.direction} · {v.status.replaceAll('_',' ')}</small></span><ChevronRight size={16}/></button>)}</div></div>
      <div className="dec-edit-pane">{!selectedVisit?<Empty title="Select a truck" detail="See what must be ready before work can start."/>:loading&&!prep?<Loading/>:prep?<><div className="dec-pane-head"><span className="dec-kicker">{prep.direction.toUpperCase()} / PREPARATION</span><h3>{visits.find(v=>v.id===selectedVisit)?.truck_plate}</h3><p>{prep.ready?'All prerequisites confirmed.':'Complete all required checks before marking this truck ready.'}</p></div><div className="dec-checklist">{prep.checks.map(c=><label className={`dec-check ${c.done?'done':''}`} key={c.id}><input type="checkbox" checked={c.done} disabled={busy||!can(role,'coordinator','supervisor','manager')} onChange={e=>void run(()=>DecisionService.setReadiness(selectedVisit,c.code,e.target.checked),'Readiness updated and audited')}/><span><b>{c.label}</b><small>{c.confirmed_by?`Confirmed by ${c.confirmed_by} · ${dt(c.confirmed_at)}`:'Not confirmed'}</small></span></label>)}</div><div className="dec-pane-footer"><span>{prep.checks.filter(c=>c.done).length}/{prep.checks.length} verified</span>{prep.ready&&['checked_in','on_hold'].includes(visits.find(v=>v.id===selectedVisit)?.status||'')&&<button className="dec-primary" disabled={busy||!can(role,'coordinator','supervisor','manager')} onClick={()=>void run(()=>import('../services/OperationsService').then(x=>x.OperationsService.action(selectedVisit,'ready')),'Truck is ready for a suitable dock')}>Mark truck ready <ArrowRight size={16}/></button>}</div></>:<Empty title="Readiness unavailable" detail="Try selecting the truck again."/>}</div></div>
    </>}
    {page==='Capacity planner'&&<>
      <div className="dec-intro"><div><span className="dec-kicker">CAPACITY BEFORE ARRIVAL</span><h2>Spread the work. Prevent a peak-hour queue.</h2><p>Conservative pilot rule: one planned service start per eligible dock each hour. Actual plant shifts, crews and handling durations must be configured before real use.</p></div>{can(role,'coordinator','manager')&&<button className="dec-primary" onClick={()=>onCreateAt()}>New appointment <ArrowRight size={16}/></button>}</div>
      <div className="dec-toolbar"><label className="dec-control"><CalendarDays size={16}/> <input type="date" aria-label="Date" value={day} onChange={e=>setDay(e.target.value)}/></label><label className="dec-control"><Filter size={16}/><select aria-label="Direction" value={direction} onChange={e=>setDirection(e.target.value as 'inbound'|'outbound')}><option value="inbound">Inbound deliveries</option><option value="outbound">Outbound collections</option></select></label><span className="dec-help">Asia/Kolkata · 08:00–18:00 · Mon–Sat</span></div>
      <div className="dec-plan">{!plan||loading?<Loading/>:plan.slots.map(s=><div className={`dec-slot ${s.available?'':'full'}`} key={s.start_at}><div><b>{new Date(s.start_at).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})}</b><small>{s.reason}</small></div><div className="dec-slot-meter"><div style={{width:`${s.capacity?Math.min(100,s.booked/s.capacity*100):100}%`}}/></div><div className="dec-slot-count">{s.booked}/{s.capacity} booked</div><button disabled={!s.available||!can(role,'coordinator','manager')} onClick={()=>onCreateAt(s.start_at,direction)}>Choose <ArrowRight size={14}/></button></div>)}</div>
      <div className="dec-planner-note"><Info size={17}/> These are planning estimates, not a guarantee that staff, forklifts or goods will be ready. The system rejects overbooking at the API.</div>
    </>}
    {page==='Analysis'&&<>
      <div className="dec-intro"><div><span className="dec-kicker">MEASURE, THEN IMPROVE</span><h2>Understand the tail, not just the average.</h2><p>Completed visits are measured separately from trucks still on site. Costs remain unknown until carrier terms are provided.</p></div><button className="dec-outline" onClick={()=>void load()}><RefreshCw size={16}/> Refresh metrics</button></div>
      {!analysis?<Loading/>:<><div className="dec-kpis"><Metric label="Median turnaround / p50" number={duration(analysis.p50_min)} note={`Based on ${analysis.sample_size} completed visits`} icon={Clock3}/><Metric label="Long tail / p90" number={duration(analysis.p90_min)} note="Nine of ten at or below this threshold" icon={Activity}/><Metric label="Open issues" number={String(analysis.issue_open)} note="Action still required" icon={AlertTriangle}/><Metric label="Active trucks" number={String(analysis.active_trucks)} note="Not included as completed" icon={Truck}/></div><div className="dec-insight-columns"><section className="dec-white-panel"><span className="dec-kicker">WHERE PROBLEMS ARE REPORTED</span><h3>Operational blockers by category</h3>{analysis.top_reasons.length?analysis.top_reasons.map(row=><div className="dec-cause" key={row.code}><span>{row.code.replaceAll('_',' ')}</span><div><div style={{width:`${Math.max(5,row.count/Math.max(1,analysis.top_reasons[0].count)*100)}%`}}/></div><b>{row.count}</b></div>):<Empty title="No issues recorded" detail="Issue history appears as the team records and resolves blockers."/>}</section><section className="dec-white-panel"><span className="dec-kicker">COMPARE DIRECTIONS</span><h3>Inbound vs outbound</h3>{Object.entries(analysis.cohorts).map(([k,v])=><div key={k} className="dec-cohort"><div><b>{k==='inbound'?'Inbound deliveries':'Outbound collections'}</b><span>{v.n} completed</span></div><div><b>{duration(v.p50_min)}</b><small>p50</small><b>{duration(v.p90_min)}</b><small>p90</small></div></div>)}</section></div><div className="dec-evidence strong"><Info size={18}/><span>{analysis.evidence}<br/>{analysis.cost}</span></div><section className="dec-white-panel"><div className="dec-section-title"><h3>Inspect the evidence for a specific truck</h3><p>Each timeline separates recorded waiting and processing intervals; missing events remain unknown.</p></div><div className="dec-analysis-visits">{visits.filter(v=>v.arrival_at).slice(0,12).map(v=><button onClick={()=>onSelect(v.id)} key={v.id}><span><b>{v.truck_plate}</b><small>{v.company}</small></span><span>{v.status.replaceAll('_',' ')} <ChevronRight size={15}/></span></button>)}</div></section></>}
    </>}
  </div>
}
function Metric({label,number,note,icon:Icon}:{label:string;number:string;note:string;icon:typeof Truck}){return <div className="dec-metric"><div className="dec-metric-label"><span>{label}</span><Icon size={18}/></div><strong>{number}</strong><small>{note}</small></div>}
function Empty({title,detail}:{title:string;detail:string}){return <div className="dec-empty"><PackageCheck size={27}/><b>{title}</b><p>{detail}</p></div>}
function Loading(){return <div className="dec-loading"><Loader2 size={17} className="spin"/>Loading operational data…</div>}
