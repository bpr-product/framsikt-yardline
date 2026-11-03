import {DecisionService} from '../../services/DecisionService';
import {useQuery} from '../../hooks/useQuery';
import {ErrorState,SkeletonRows} from '../common/Feedback';
import {dateTime,duration} from '../../utils/format';
import type{Diagnosis} from '../../types/decisions';
import type{Visit} from '../../types/domain';

/** Where this truck's time went: waiting versus productive segments, from recorded events only. */
export function TimeBreakdown({visit}:{visit:Visit}){
  const {data,loading,error,reload}=useQuery<Diagnosis>(`diagnosis:${visit.id}`,()=>DecisionService.diagnosis(visit.id),visit.version);
  if(loading)return <SkeletonRows rows={3} cols={3}/>;
  if(error&&!data)return <ErrorState message={error} onRetry={()=>void reload()}/>;
  if(!data)return null;
  const total=Math.max(1,data.segments.reduce((n,s)=>n+s.minutes,0));
  return <div className="breakdown">
    <div className="mini-stats">
      <div><small>Total dwell</small><b>{duration(data.total_dwell_min)}</b></div>
      <div><small>Waiting</small><b className="tone-text-amber">{duration(data.waiting_min)}</b></div>
      <div><small>Service</small><b className="tone-text-green">{duration(data.service_min)}</b></div>
    </div>
    {data.segments.length>0&&<div className="timeline-bar">{data.segments.map((s,i)=><span key={i} className={`seg seg-${s.kind}`} style={{flexGrow:s.minutes/total}} title={`${s.label}: ${duration(s.minutes)}`}/>)}</div>}
    {data.segments.length===0?<p className="muted-note">Not enough recorded timestamps to calculate segments yet.</p>:
    <ul className="segments">{data.segments.map((s,i)=><li key={i}><span className={`dot seg-${s.kind}`}/><span><b>{s.label}</b><small>{dateTime(s.from)} → {dateTime(s.to)}</small></span><b className="num">{duration(s.minutes)}</b></li>)}</ul>}
    <p className="muted-note">{data.source}. {data.complete?'Segments reconcile to total dwell.':'Incomplete until the truck departs and all stages are recorded.'} {data.explanation}</p>
  </div>;
}
