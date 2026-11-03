import {useEffect,useRef,useState} from 'react';
import {AlertCircle,ArrowDownRight,ArrowRight,CheckCircle2,ChevronDown,Database,Info,Lightbulb,Play,RotateCcw,Settings2,ShieldCheck,SlidersHorizontal,UserRoundCheck,Workflow} from 'lucide-react';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {explain} from '../../services/ApiBase';
import {ScenarioService} from '../../services/ScenarioService';
import type{ScenarioDecision,ScenarioPreset,ScenarioState} from '../../types/scenarios';
import './scenario-lab.css';

const FORMAT=(n:number|null|undefined)=>n==null?'Unknown':n<60?`${Math.round(n)} min`:`${Math.floor(n/60)}h ${Math.round(n%60)}m`;
const ROUND=(v:number)=>Math.round(v);
const STATE_LABEL:Record<ScenarioDecision['status'],string>={
  blocked:'Blocked',at_risk:'Needs replanning',eligible:'Eligible',approval_required:'Approval required',
  exit_blocked:'Exit blocked',cleared_to_depart:'Ready to exit'
};

export function ScenarioLabPage(){
  const [catalog,setCatalog]=useState<ScenarioPreset[]>([]);
  const [selected,setSelected]=useState<string>('');
  const [scenario,setScenario]=useState<ScenarioState|null>(null);
  const [decision,setDecision]=useState<ScenarioDecision|null>(null);
  const [baseline,setBaseline]=useState<number|null>(null);
  const [category,setCategory]=useState('All cases');
  const [loading,setLoading]=useState(true);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState('');
  const [applied,setApplied]=useState<string[]>([]);
  const [expanded,setExpanded]=useState(false);
  const turn=useRef(0);
  const selectedCase=catalog.find(x=>x.id===selected);

  useEffect(()=>{
    let active=true;
    ScenarioService.catalogue().then(data=>{
      if(!active)return;
      setCatalog(data.scenarios);
      const first=data.scenarios.find(x=>x.id==='late_reallocated')||data.scenarios[0];
      if(first){setSelected(first.id);setScenario(first.state)}
    }).catch(e=>{if(active)setError(explain(e))}).finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[]);

  useEffect(()=>{
    if(!selected||!scenario)return;
    const n=++turn.current;
    setRunning(true);setError('');
    const job=window.setTimeout(()=>{
      ScenarioService.evaluate(selected,scenario).then(data=>{if(n===turn.current){setDecision(data)}})
      .catch(e=>{if(n===turn.current){setError(explain(e));setDecision(null)}})
      .finally(()=>{if(n===turn.current)setRunning(false)});
    },100);
    return ()=>window.clearTimeout(job);
  },[selected,scenario]);

  function pick(item:ScenarioPreset){
    setSelected(item.id);setScenario(item.state);setDecision(null);setBaseline(null);setApplied([]);setError('');setExpanded(false);
  }
  function update(changes:Partial<ScenarioState>){
    setScenario(s=>s?{...s,...changes}:s);
  }
  function applyAction(label:string,changes:Partial<ScenarioState>){
    if(!scenario||!decision)return;
    if(baseline===null)setBaseline(decision.earliest_start_min);
    setApplied(a=>[...a,label]);update(changes);
  }
  const categories=['All cases',...new Set(catalog.map(x=>x.category))];
  const filtered=catalog.filter(x=>category==='All cases'||x.category===category);
  return <div className="page scenario-page">
    <PageHeader title="Scenario lab" subtitle="16 factory disruptions. Change the conditions and see the rules recalculate a defensible next action.">
      <span className="sl-safe"><ShieldCheck size={15}/> Simulation only · no live writes</span>
    </PageHeader>
    <div className="sl-story">
      <div><span className="sl-eyebrow">WHY THIS EXISTS</span><h2>Factory plans change. The system should respond.</h2>
        <p>A late truck, a busy dock, or an urgent load can break the original schedule. Select a real-world problem, inspect the decision, then try a different action to see its operational consequence.</p></div>
      <div className="sl-story-metric"><strong>{catalog.length||16}</strong><span>tested disruption cases</span><small>One shared decision engine</small></div>
    </div>
    <div className="sl-layout">
      <aside className="sl-library">
        <div className="sl-library-head"><div><h3>Problem library</h3><p>Choose an exception to investigate</p></div><span>{filtered.length}</span></div>
        <label className="sl-field"><span>Scenario group</span><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <div className="sl-case-list" role="listbox" aria-label="Factory problem scenarios">{filtered.map(item=><button type="button" key={item.id} role="option" aria-selected={selected===item.id} className={`sl-case ${selected===item.id?'selected':''}`} onClick={()=>pick(item)}>
          <span className="sl-case-num">{String(catalog.indexOf(item)+1).padStart(2,'0')}</span><span><b>{item.title}</b><small>{item.category}</small></span><ArrowRight size={14}/>
        </button>)}</div>
      </aside>
      <div className="sl-main">
        {loading?<Card><div className="sl-loading">Loading scenarios…</div></Card>:error&&!scenario?<Card><div className="sl-error"><AlertCircle size={17}/>{error}</div></Card>:selectedCase&&scenario?<>
          <Card className="sl-case-card" title={<div className="sl-case-heading"><span className="sl-eyebrow">SCENARIO {selectedCase.code} · {selectedCase.category.toUpperCase()}</span><h2>{selectedCase.title}</h2><p>{selectedCase.question}</p></div>}
            actions={<button className="btn btn-sm" onClick={()=>pick(selectedCase)}><RotateCcw size={14}/> Reset case</button>}>
            <div className="sl-kpi-grid">
              <Metric label="Possible dock start" value={decision?FORMAT(decision.earliest_start_min):'Calculating…'} detail="From actual arrival · illustrative"/>
              <Metric label="Queue position" value={decision?`#${decision.queue_position}`:'—'} detail={scenario.urgent&&scenario.priority_approved?'Approved urgent priority':'Original first-eligible order'}/>
              <Metric label="Current condition" value={decision?STATE_LABEL[decision.status]:'Calculating…'} detail={decision?.recommended_owner??'Reviewing inputs'}/>
            </div>
            {baseline!==null&&decision&&decision.earliest_start_min!==null&&<div className="sl-compare"><ArrowDownRight size={16}/><span>What-if comparison: {FORMAT(baseline)} before → {FORMAT(decision.earliest_start_min)} now. <b>{decision.earliest_start_min<baseline?`Modelled improvement ${FORMAT(baseline-decision.earliest_start_min)}`:decision.earliest_start_min>baseline?`Modelled delay ${FORMAT(decision.earliest_start_min-baseline)}`:'No estimated change'}</b></span></div>}
            {applied.length>0&&<div className="sl-changes"><CheckCircle2 size={15}/> Simulated actions: {applied.join(' · ')}</div>}
          </Card>
          <div className="sl-two">
            <Card title={<span className="sl-section-heading"><Settings2 size={17}/> Change operational conditions</span>} footer="Edits trigger a real backend evaluation. They do not alter any truck, appointment or dock in Neon.">
              <div className="sl-slider-group">
                <Range label="Arrival delay" suffix="late" value={scenario.late_by_min} max={240} step={15} onChange={v=>update({late_by_min:v})}/>
                <Range label="Current dock occupied for" suffix="more" value={scenario.dock_busy_for_min} max={720} step={15} onChange={v=>update({dock_busy_for_min:v})}/>
                <Range label="Trucks waiting ahead" suffix="trucks" value={scenario.queue_ahead} max={8} step={1} onChange={v=>update({queue_ahead:v})}/>
                <Range label="Expected loading duration" suffix="service" value={scenario.service_min} min={15} max={240} step={15} onChange={v=>update({service_min:v})}/>
              </div>
              <button className="sl-expand" type="button" aria-expanded={expanded} onClick={()=>setExpanded(s=>!s)}><SlidersHorizontal size={15}/> Readiness, safety, shifts and priority <ChevronDown size={16} className={expanded?'expanded':''}/></button>
              {expanded&&<div className="sl-extra">
                <div className="sl-switchgrid">
                  <Switch label="Goods staged" checked={scenario.goods_ready} onChange={v=>update({goods_ready:v})}/>
                  <Switch label="Documents ready" checked={scenario.documents_ready} onChange={v=>update({documents_ready:v})}/>
                  <Switch label="Handling crew ready" checked={scenario.crew_ready} onChange={v=>update({crew_ready:v})}/>
                  <Switch label="Equipment available" checked={scenario.equipment_ready} onChange={v=>update({equipment_ready:v})}/>
                  <Switch label="Dock operational" checked={scenario.dock_operational} onChange={v=>update({dock_operational:v})}/>
                  <Switch label="Compatible dock" checked={scenario.compatible_dock} onChange={v=>update({compatible_dock:v})}/>
                  <Switch label="Alternate usable dock" checked={scenario.alternate_dock_available} onChange={v=>update({alternate_dock_available:v})}/>
                  <Switch label="Gate verified" checked={scenario.gate_cleared} onChange={v=>update({gate_cleared:v})}/>
                  <Switch label="Safe yard space" checked={scenario.yard_space} onChange={v=>update({yard_space:v})}/>
                  <Switch label="Urgent shipment" checked={scenario.urgent} onChange={v=>update({urgent:v})}/>
                  <Switch label="Priority approved" checked={scenario.priority_approved} onChange={v=>update({priority_approved:v})}/>
                  <Switch label="Overtime approved" checked={scenario.overtime_approved} onChange={v=>update({overtime_approved:v})}/>
                </div>
                <Range label="Minutes left in shift" value={scenario.shift_left_min} suffix="left" min={0} max={600} step={15} onChange={v=>update({shift_left_min:v})}/>
                <Range label="Next staffed shift starts" value={scenario.next_shift_in_min} suffix="from now" min={0} max={1200} step={30} onChange={v=>update({next_shift_in_min:v})}/>
              </div>}
            </Card>
            <Card title={<span className="sl-section-heading"><Lightbulb size={17}/> What the system recommends</span>} actions={running?<span className="sl-running">Recomputing…</span>:<span className="sl-evaluated"><CheckCircle2 size={14}/> Rule evaluated</span>}>
              {error&&<div className="sl-error"><AlertCircle size={16}/>{error}</div>}
              {decision?<>
                <div className={`sl-result ${decision.status}`}><span className="sl-result-status">{STATE_LABEL[decision.status]}</span><h3>{decision.headline}</h3><p>{decision.recommended_action}</p><div><UserRoundCheck size={14}/> Responsible: {decision.recommended_owner}</div></div>
                <div className="sl-flags"><h4>What happens next?</h4>{decision.flags.length===0?<p className="sl-empty"><CheckCircle2 size={16}/> No blocker remains in the current simulation. A supervisor can verify and approve the safe next movement.</p>:decision.flags.map((flag,i)=><div className="sl-flag" key={flag.code}><span className="sl-flag-index">{String(i+1).padStart(2,'0')}</span><div><b>{flag.title}</b><p>{flag.reason}</p><small>{flag.owner}{flag.delay_min>0?` · reported ETA ${FORMAT(flag.delay_min)}`:''}</small>{flag.action&&<button className="sl-try" type="button" onClick={()=>applyAction(flag.action!.label,flag.action!.changes)}><Play size={12}/> Try: {flag.action.label}</button>}</div></div>)}</div>
              </>:<div className="sl-loading">Evaluating the latest factory conditions…</div>}
            </Card>
          </div>
          <Card title={<span className="sl-section-heading"><Workflow size={17}/> Engineering decision trace</span>} footer="Safety and compatibility gates are checked before priority; occupancy is never silently preempted. The scenario engine is a policy demonstration, not an optimizer.">
            <div className="sl-trace-grid">
              <div><span className="sl-eyebrow">THE REASONING</span>{decision?<ol className="sl-trace">{decision.decision_trace.map((line,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><p>{line}</p></li>)}</ol>:<p>Evaluating…</p>}</div>
              <div className="sl-outcome"><span className="sl-eyebrow">THE OPERATIONAL DECISION</span><p>{decision?.outcome??'Evaluate this scenario to see its decision.'}</p><div><Info size={15}/><span>Modeled waiting is an illustration based on declared inputs. Site safety, shifts and carrier policies must be verified with the factory.</span></div></div>
            </div>
          </Card>
          <div className="sl-footer"><Database size={15}/><span>None of the experiments above update a real appointment, live bay or database record. Show the normal Gate / Readiness / Dock screens for real persisted workflows.</span></div>
        </>:<Card><div className="sl-loading">Choose a scenario on the left.</div></Card>}
      </div>
    </div>
  </div>;
}

function Metric({label,value,detail}:{label:string;value:string;detail:string}){return <div className="sl-metric"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div>}
function Range({label,value,onChange,min=0,max,step,suffix}:{label:string;value:number;onChange:(v:number)=>void;min?:number;max:number;step:number;suffix:string}){
  return <label className="sl-range"><span><b>{label}</b><output>{value} {suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(ROUND(Number(e.target.value)))}/></label>;
}
function Switch({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}){
  return <label className="sl-switch"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>;
}
