import {OperationsService} from '../../services/OperationsService';
import {useQuery} from '../../hooks/useQuery';
import {ErrorState,SkeletonRows} from '../common/Feedback';
import {humanize} from '../../constants/labels';
import {dateTime} from '../../utils/format';
import type{Visit,VisitDetail} from '../../types/domain';

/** Audit trail, newest first; refetched only when the truck's version changes (a new event exists). */
export function ActivityLog({visit}:{visit:Visit}){
  const {data,loading,error,reload}=useQuery<VisitDetail>(`detail:${visit.id}`,()=>OperationsService.visit(visit.id),visit.version);
  if(loading)return <SkeletonRows rows={4} cols={2}/>;
  if(error&&!data)return <ErrorState message={error} onRetry={()=>void reload()}/>;
  const events=[...(data?.events??[])].reverse();
  return <ol className="activity">{events.map(e=><li key={e.id}>
    <span className="activity-dot"/>
    <div><b>{humanize(e.action)}</b>{e.note&&<p>{e.note}</p>}<small>{e.actor} · {dateTime(e.at)}</small></div>
  </li>)}</ol>;
}
