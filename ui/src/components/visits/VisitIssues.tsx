import {useState,type FormEvent,type ReactNode} from 'react';
import {DecisionService} from '../../services/DecisionService';
import {explain} from '../../services/ApiBase';
import {useQuery} from '../../hooks/useQuery';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useToast} from '../../context/ToastContext';
import {can} from '../../constants/permissions';
import {CLOSED_STATUSES,SEVERITY_TONE,humanize} from '../../constants/labels';
import {EmptyState,ErrorState,SkeletonRows,Spinner} from '../common/Feedback';
import {Pill} from '../common/StatusBadge';
import {dateTime} from '../../utils/format';
import type{Issue,IssueCode,IssueType} from '../../types/decisions';
import type{Visit} from '../../types/domain';

type NewIssue={code:IssueCode;description:string;owner:string;severity:string};

/** Structured blockers for one truck: report with an owner, resolve with a recorded note. */
export function VisitIssues({visit}:{visit:Visit}){
  const {user,scheduleRefresh}=useWorkspace();
  const toast=useToast();
  const issues=useQuery<Issue[]>(`visit-issues:${visit.id}`,()=>DecisionService.issuesForVisit(visit.id));
  const types=useQuery<IssueType[]>('issue-types',DecisionService.issueTypes);
  const [busy,setBusy]=useState<string|null>(null);
  const editable=can(user.role,'issue');
  const resolve=async(issue:Issue,note:string)=>{
    setBusy(issue.id);
    try{
      const saved=await DecisionService.resolveIssue(issue.id,note);
      issues.mutate(list=>list.map(i=>i.id===saved.id?saved:i));scheduleRefresh();
      toast.success(`${humanize(issue.code)} resolved`);return true;
    }catch(e){toast.error(explain(e));return false}finally{setBusy(null)}
  };
  const create=async(payload:NewIssue)=>{
    setBusy('new');
    try{
      const saved=await DecisionService.createIssue(visit.id,{...payload,blocking:true});
      issues.mutate(list=>[saved,...list]);scheduleRefresh();
      toast.success(`Problem assigned to ${saved.owner}`);return true;
    }catch(e){toast.error(explain(e));return false}finally{setBusy(null)}
  };
  return <div className="issues">
    {issues.loading?<SkeletonRows rows={2} cols={2}/>:issues.error&&!issues.data?<ErrorState message={issues.error} onRetry={()=>void issues.reload()}/>:
      !issues.data?.length?<EmptyState title="No problems recorded" detail="Report a blocker so it gets an owner and stays visible across shifts."/>:
      <ul className="issue-list">{issues.data.map(i=><IssueRow key={i.id} issue={i} editable={editable} saving={busy===i.id} disabled={!!busy} onResolve={resolve}/>)}</ul>}
    {editable&&!CLOSED_STATUSES.includes(visit.status)&&<IssueForm types={types.data??[]} saving={busy==='new'} disabled={!!busy} onCreate={create}/>}
  </div>;
}

export function IssueRow({issue,editable,saving,disabled,onResolve,lead,children}:{issue:Issue;lead?:ReactNode;editable:boolean;saving:boolean;disabled:boolean;onResolve:(i:Issue,note:string)=>Promise<boolean>;children?:ReactNode}){
  const [note,setNote]=useState('');
  const open=issue.status!=='resolved';
  return <li className={`issue${open?'':' is-resolved'}`}>
    <div className="issue-head">{lead}<b>{humanize(issue.code)}</b><Pill caps tone={SEVERITY_TONE[issue.severity]}>{issue.severity}</Pill><Pill caps tone={open?(issue.status==='escalated'?'red':'amber'):'green'}>{issue.status}</Pill></div>
    <p>{issue.description}</p>
    <small>Owner {issue.owner} · opened {dateTime(issue.opened_at)}</small>
    {!open&&issue.resolution_note&&<small className="resolution">Resolved: {issue.resolution_note}</small>}
    {open&&editable&&<form className="inline-form" onSubmit={e=>{e.preventDefault();void onResolve(issue,note.trim()).then(ok=>{if(ok)setNote('')})}}>
      <input value={note} onChange={e=>setNote(e.target.value)} placeholder="How was it resolved?" aria-label="Resolution note" maxLength={800} disabled={disabled}/>
      <button className="btn btn-sm" disabled={disabled||note.trim().length<5}>{saving&&<Spinner size={12}/>}Resolve</button>
      {children}
    </form>}
  </li>;
}

function IssueForm({types,saving,disabled,onCreate}:{types:IssueType[];saving:boolean;disabled:boolean;onCreate:(p:NewIssue)=>Promise<boolean>}){
  const [code,setCode]=useState<IssueCode>('goods_not_ready'),[owner,setOwner]=useState(''),[severity,setSeverity]=useState('medium'),[description,setDescription]=useState('');
  const defaultOwner=types.find(t=>t.code===code)?.default_owner??'';
  const effectiveOwner=(owner||defaultOwner).trim();
  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    if(await onCreate({code,description:description.trim(),owner:effectiveOwner,severity})){setDescription('');setOwner('')}
  };
  return <form className="issue-form" onSubmit={submit}>
    <h4>Report a problem</h4>
    <div className="form-row">
      <label>Type<select value={code} onChange={e=>{setCode(e.target.value as IssueCode);setOwner('')}} disabled={disabled}>{types.map(t=><option key={t.code} value={t.code}>{t.label}</option>)}</select></label>
      <label className="narrow">Severity<select value={severity} onChange={e=>setSeverity(e.target.value)} disabled={disabled}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label>
    </div>
    <label>Owner<input value={owner} placeholder={defaultOwner||'Responsible team or person'} maxLength={80} onChange={e=>setOwner(e.target.value)} disabled={disabled}/></label>
    <label>What happened?<textarea rows={2} value={description} maxLength={800} placeholder="Operational impact and next step" onChange={e=>setDescription(e.target.value)} disabled={disabled}/></label>
    <button className="btn btn-primary" disabled={disabled||description.trim().length<5||effectiveOwner.length<2}>{saving&&<Spinner/>}Assign problem</button>
  </form>;
}
