import {useState} from 'react';
import {DecisionService} from '../../services/DecisionService';
import {explain} from '../../services/ApiBase';
import {useQuery} from '../../hooks/useQuery';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useToast} from '../../context/ToastContext';
import {can} from '../../constants/permissions';
import {humanize} from '../../constants/labels';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {Segmented} from '../../components/common/Segmented';
import {EmptyState,ErrorState,SkeletonRows,Spinner} from '../../components/common/Feedback';
import {IssueRow} from '../../components/visits/VisitIssues';
import type{Issue} from '../../types/decisions';

/** Every blocker with an owner, open across shift changes until a resolution is recorded. */
export function ProblemDeskPage(){
  const {user,revision,scheduleRefresh,openVisit,board}=useWorkspace();
  const toast=useToast();
  const [status,setStatus]=useState<'open'|'resolved'>('open');
  const issues=useQuery<Issue[]>(`issues:${status}`,()=>DecisionService.issues(status),revision);
  const [busy,setBusy]=useState<string|null>(null);
  const legacyHolds=board.visits.filter(v=>v.status==='on_hold');
  const resolve=async(issue:Issue,note:string)=>{
    setBusy(issue.id);
    try{
      await DecisionService.resolveIssue(issue.id,note);
      issues.mutate(list=>list.filter(i=>i.id!==issue.id));scheduleRefresh();
      toast.success(`${issue.truck_plate}: ${humanize(issue.code)} resolved`);return true;
    }catch(e){toast.error(explain(e));return false}finally{setBusy(null)}
  };
  const escalate=async(issue:Issue)=>{
    setBusy(issue.id+':esc');
    try{
      const saved=await DecisionService.escalateIssue(issue.id);
      issues.mutate(list=>list.map(i=>i.id===issue.id?{...i,...saved}:i));scheduleRefresh();
      toast.success(`${issue.truck_plate}: escalated to manager review`);
    }catch(e){toast.error(explain(e))}finally{setBusy(null)}
  };
  return <div className="page">
    <PageHeader title="Problem desk" subtitle="Give every operational delay an owner and a recorded resolution." busy={issues.refreshing}/>
    <Card title={<Segmented label="Problem status" value={status} onChange={setStatus} options={[{value:'open',label:'Open & escalated',count:status==='open'?issues.data?.length:undefined},{value:'resolved',label:'Resolved'}]}/>}
      actions={legacyHolds.length>0&&<span className="hint">{legacyHolds.length} truck(s) on hold without a structured problem</span>}>
      {issues.loading?<SkeletonRows rows={5} cols={3}/>:issues.error&&!issues.data?<ErrorState message={issues.error} onRetry={()=>void issues.reload()}/>:
      !issues.data?.length?<EmptyState title={status==='open'?'No open problems':'No resolved problems yet'} detail={status==='open'?'Report a blocker from a truck’s Problems tab.':undefined}/>:
      <ul className="issue-list desk">{issues.data.map(i=>
        <IssueRow key={i.id} lead={<button className="link-btn plate" onClick={()=>openVisit(i.visit_id,'problems')}>{i.truck_plate}</button>} issue={i} editable={can(user.role,'issue')} saving={busy===i.id} disabled={!!busy} onResolve={resolve}>
          {can(user.role,'escalate')&&i.status==='open'&&<button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={()=>void escalate(i)}>{busy===i.id+':esc'&&<Spinner size={12}/>}Escalate</button>}
        </IssueRow>)}</ul>}
    </Card>
  </div>;
}
