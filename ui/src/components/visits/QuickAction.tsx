import {ChevronRight} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {quickAction} from '../../constants/permissions';
import {Spinner} from '../common/Feedback';
import type{Visit} from '../../types/domain';
/** The truck's next zero-input step as one click; otherwise a link into the drawer where inputs are collected. */
export function QuickAction({visit}:{visit:Visit}){
  const {user,pending,runAction,openVisit}=useWorkspace();
  const q=quickAction(visit.status,user.role);
  const saving=pending[visit.id];
  if(saving)return <span className="saving-label"><Spinner size={13}/>Saving…</span>;
  if(!q)return <button type="button" className="btn btn-sm btn-ghost" onClick={e=>{e.stopPropagation();openVisit(visit.id)}}>Open<ChevronRight size={13}/></button>;
  return <button type="button" className="btn btn-sm" onClick={e=>{e.stopPropagation();void runAction(visit,q.action)}}>{q.label}</button>;
}
