import {ArrowRight,Check} from 'lucide-react';
import {useReadiness} from '../../hooks/useReadiness';
import {useWorkspace} from '../../context/WorkspaceContext';
import {can} from '../../constants/permissions';
import {CLOSED_STATUSES} from '../../constants/labels';
import {ErrorState,SkeletonRows,Spinner} from '../common/Feedback';
import {dateTime} from '../../utils/format';
import type{Visit} from '../../types/domain';

/** Shared by the truck drawer and the Readiness screen so both behave identically. */
export function ReadinessChecklist({visit}:{visit:Visit}){
  const {user,pending,runAction}=useWorkspace();
  const {data,loading,error,reload,saving,toggle}=useReadiness(visit.id);
  if(loading)return <SkeletonRows rows={3} cols={2}/>;
  if(error&&!data)return <ErrorState message={error} onRetry={()=>void reload()}/>;
  if(!data)return null;
  const closed=CLOSED_STATUSES.includes(visit.status);
  const editable=can(user.role,'readiness')&&!closed;
  const done=data.checks.filter(c=>c.done).length;
  return <div className="checklist-wrap">
    <div className="checklist-summary">
      <span className={`pill tone-${data.ready?'green':'amber'}`}>{data.ready?'All prerequisites confirmed':'Preparation outstanding'}</span>
      <span className="progress" aria-label={`${done} of ${data.checks.length} complete`}><span style={{width:`${100*done/Math.max(1,data.checks.length)}%`}}/></span>
      <small>{done}/{data.checks.length}</small>
    </div>
    <ul className="checklist">{data.checks.map(c=>{
      const busy=saving.has(c.code);
      return <li key={c.code}><label className={`check${c.done?' is-done':''}${busy?' is-saving':''}`}>
        <input type="checkbox" checked={c.done} disabled={!editable||busy} onChange={e=>void toggle(c.code,e.target.checked)}/>
        <span className="check-box" aria-hidden="true">{busy?<Spinner size={11}/>:c.done&&<Check size={12} strokeWidth={3}/>}</span>
        <span className="check-text"><b>{c.label}</b><small>{busy?'Saving…':c.confirmed_by?`${c.confirmed_by} · ${dateTime(c.confirmed_at)}`:'Not confirmed'}</small></span>
      </label></li>;
    })}</ul>
    {data.ready&&(visit.status==='checked_in'||visit.status==='on_hold')&&can(user.role,'ready')&&<div className="action-row">
      <button className="btn btn-primary" disabled={!!pending[visit.id]||saving.size>0} onClick={()=>void runAction(visit,'ready')}>{pending[visit.id]==='ready'?<Spinner/>:<ArrowRight size={14}/>}Mark truck ready for dock</button>
    </div>}
    {!editable&&!closed&&<p className="muted-note">Your role can view readiness but not confirm it.</p>}
  </div>;
}
