import {useState,type FormEvent,type ReactNode} from 'react';
import {CheckCircle2,Clock3,LogOut,Package,Pause,Play,Truck,Warehouse} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {can} from '../../constants/permissions';
import {Spinner} from '../common/Feedback';
import type{Visit} from '../../types/domain';

const MIN_REASON=5;

/** Every transition available to this role at this stage; the server re-validates each one. */
export function VisitActions({visit}:{visit:Visit}){
  const {user,board,pending,runAction}=useWorkspace();
  const role=user.role,busy=pending[visit.id];
  const [dock,setDock]=useState('');
  const act=(action:string,payload?:object)=>runAction(visit,action,payload);
  const s=visit.status;
  const freeDocks=board.docks.filter(d=>d.enabled&&!d.visit_id&&(d.direction==='both'||d.direction===visit.direction));
  const blocks:ReactNode[]=[];

  if(s==='scheduled'&&can(role,'check-in'))blocks.push(<div className="action-row" key="arrive">
    <ActionButton busy={busy} onRun={act} action="check-in" primary icon={<Truck size={14}/>}>Check in truck</ActionButton>
    <ActionButton busy={busy} onRun={act} action="outside-arrival" icon={<Clock3 size={14}/>}>Record outside-gate arrival</ActionButton>
  </div>);
  if((s==='checked_in'||s==='on_hold')&&can(role,'ready'))blocks.push(<div className="action-row" key="ready">
    <ActionButton busy={busy} onRun={act} action="ready" primary icon={<CheckCircle2 size={14}/>}>Mark ready for dock</ActionButton>
    <span className="hint">Requires all readiness checks and no open blocking problem.</span>
  </div>);
  if(s==='ready'&&can(role,'assign'))blocks.push(<form className="action-form" key="assign" onSubmit={e=>{e.preventDefault();if(dock)void act('assign',{dock_id:dock}).then(r=>{if(r)setDock('')})}}>
    <label>Assign to dock<select value={dock} onChange={e=>setDock(e.target.value)} disabled={!!busy}>
      <option value="">{freeDocks.length?'Select a free compatible dock':'No compatible dock is free'}</option>
      {freeDocks.map(d=><option key={d.id} value={d.id}>{d.code} · {d.direction==='both'?'all directions':d.direction}</option>)}
    </select></label>
    <button className="btn btn-primary" disabled={!!busy||!dock}>{busy==='assign'?<Spinner/>:<Warehouse size={14}/>}Assign dock</button>
  </form>);
  if(s==='at_dock'&&can(role,'start'))blocks.push(<div className="action-row" key="start"><ActionButton busy={busy} onRun={act} action="start" primary icon={<Play size={14}/>}>Start loading / unloading</ActionButton></div>);
  if(s==='loading'&&can(role,'finish'))blocks.push(<div className="action-row" key="finish"><ActionButton busy={busy} onRun={act} action="finish" primary icon={<Package size={14}/>}>Complete loading / unloading</ActionButton></div>);
  if(s==='paused'&&can(role,'resume'))blocks.push(<div className="action-row" key="resume"><ActionButton busy={busy} onRun={act} action="resume" primary icon={<Play size={14}/>}>Resume safe operation</ActionButton></div>);
  if(s==='completed'&&visit.dock&&can(role,'release-dock'))blocks.push(<ReasonForm key="release" label="Confirm the truck has physically left the dock" placeholder="e.g. Bay clear, truck moved to exit lane" submit="Release dock" primary busy={busy} action="release-dock" onSubmit={reason=>act('release-dock',{reason})}/>);
  if(s==='completed'&&!visit.dock&&can(role,'clearance'))blocks.push(<ReasonForm key="clear" label="Exit clearance" placeholder="e.g. Delivery note and gate pass verified" submit="Confirm clearance" primary busy={busy} action="clearance" onSubmit={reason=>act('clearance',{reason})}/>);
  if(s==='completed'&&can(role,'depart'))blocks.push(<div className="action-row" key="depart">
    <ActionButton busy={busy} onRun={act} action="depart" primary={!visit.dock} icon={<LogOut size={14}/>} disabled={!!visit.dock}>Record gate departure</ActionButton>
    <span className="hint">{visit.dock?'Release the dock first.':'Requires confirmed exit clearance.'}</span>
  </div>);
  if((s==='checked_in'||s==='ready'||s==='on_hold')&&can(role,'hold'))blocks.push(<ReasonForm key="hold" label={s==='on_hold'?'Update hold reason':'Place on hold'} placeholder="Why is this truck blocked?" submit="Place on hold" busy={busy} action="hold" onSubmit={reason=>act('hold',{reason})}/>);
  if(s==='loading'&&can(role,'pause'))blocks.push(<ReasonForm key="pause" label="Pause service" placeholder="Reason for the pause" submit="Pause" icon={<Pause size={14}/>} busy={busy} action="pause" onSubmit={reason=>act('pause',{reason})}/>);

  if(s==='departed')return <p className="muted-note">Visit complete. All events are retained in the activity log.</p>;
  if(s==='cancelled')return <p className="muted-note">This appointment was cancelled and remains in the audit history.</p>;
  if(!blocks.length)return <p className="muted-note">No action for your role at this stage. The next step belongs to another team.</p>;
  return <div className="action-stack">{blocks}</div>;
}

interface ActionButtonProps{action:string;primary?:boolean;icon?:ReactNode;children:ReactNode;disabled?:boolean;busy?:string;onRun:(action:string)=>unknown}
function ActionButton({action,primary,icon,children,disabled,busy,onRun}:ActionButtonProps){
  return <button type="button" className={`btn${primary?' btn-primary':''}`} disabled={!!busy||disabled} onClick={()=>void onRun(action)}>
    {busy===action?<Spinner/>:icon}{children}
  </button>;
}

/** Inline form for transitions that need a recorded reason (min. 5 characters, as the API requires). */
function ReasonForm({label,placeholder,submit,primary,icon,busy,action,onSubmit}:{label:string;placeholder:string;submit:string;primary?:boolean;icon?:ReactNode;busy?:string;action:string;onSubmit:(reason:string)=>Promise<Visit|null>}){
  const [reason,setReason]=useState('');
  const valid=reason.trim().length>=MIN_REASON;
  const send=async(e:FormEvent)=>{e.preventDefault();if(!valid)return;if(await onSubmit(reason.trim()))setReason('')};
  return <form className="action-form" onSubmit={send}>
    <label>{label}<input value={reason} placeholder={placeholder} maxLength={500} onChange={e=>setReason(e.target.value)} disabled={!!busy}/></label>
    <button className={`btn${primary?' btn-primary':''}`} disabled={!!busy||!valid} title={valid?undefined:`Enter at least ${MIN_REASON} characters`}>{busy===action?<Spinner/>:icon}{submit}</button>
  </form>;
}
