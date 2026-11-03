import {useMemo} from 'react';
import {AlertTriangle,Clock3,Gauge,Timer} from 'lucide-react';
import {DecisionService} from '../../services/DecisionService';
import {useQuery} from '../../hooks/useQuery';
import {useWorkspace} from '../../context/WorkspaceContext';
import {STATUS_NAMES,STATUS_TONE,humanize} from '../../constants/labels';
import {PageHeader} from '../../components/common/PageHeader';
import {StatCards} from '../../components/common/StatCards';
import {Card} from '../../components/common/Card';
import {EmptyState,ErrorState,SkeletonBlock} from '../../components/common/Feedback';
import {VisitTable} from '../../components/visits/VisitTable';
import {duration} from '../../utils/format';
import type{Analytics} from '../../types/decisions';
import type{Status} from '../../types/domain';

/** Thin single-series bars: label, value in text ink, and the bar itself; hover shows the exact figure. */
function Bars({rows,max}:{rows:{key:string;label:string;n:number;tone?:string}[];max:number}){
  return <ul className="bars">{rows.map(r=><li key={r.key} title={`${r.label}: ${r.n}`}>
    <span className="bar-label">{r.label}</span><b className="num">{r.n}</b>
    <span className={`bar tone-${r.tone??'blue'}`}><span style={{width:`${100*r.n/Math.max(1,max)}%`}}/></span>
  </li>)}</ul>;
}

/** Measured turnaround (completed visits only), the long tail, and where blockers are reported. */
export function AnalysisPage(){
  const {board,loaded,revision}=useWorkspace();
  const {data:a,loading,error,reload,refreshing}=useQuery<Analytics>('analytics',DecisionService.analytics,revision);
  const lifecycle=useMemo(()=>{
    const c:Partial<Record<Status,number>>={};for(const v of board.visits)c[v.status]=(c[v.status]??0)+1;
    return (Object.keys(STATUS_NAMES) as Status[]).filter(s=>s!=='departed'&&s!=='cancelled').map(s=>({key:s,label:STATUS_NAMES[s],n:c[s]??0,tone:STATUS_TONE[s]}));
  },[board.visits]);
  const departed=useMemo(()=>board.visits.filter(v=>v.status==='departed').sort((x,y)=>(y.departed_at??'').localeCompare(x.departed_at??'')).slice(0,25),[board.visits]);
  return <div className="page">
    <PageHeader title="Analysis" subtitle="Completed visits are measured separately from trucks still on site." busy={refreshing}/>
    {loading?<div className="stats">{Array.from({length:4},(_,i)=><SkeletonBlock key={i} height={118}/>)}</div>:error&&!a?<ErrorState message={error} onRetry={()=>void reload()}/>:a&&<StatCards items={[
      {label:'Median turnaround',value:duration(a.p50_min),hint:`p50 across ${a.sample_size} completed visits`,icon:Timer,tone:'blue'},
      {label:'Long tail',value:duration(a.p90_min),hint:`p90 · p95 is ${duration(a.p95_min)}`,icon:Gauge,tone:'amber'},
      {label:'Longest visit',value:board.metrics.longest_turnaround_min!=null?`${board.metrics.longest_turnaround_min} min`:'—',hint:'Arrival to departure',icon:Clock3,tone:'violet'},
      {label:'Open problems',value:a.issue_open,hint:`${a.issue_resolved} resolved · avg. ${duration(a.mean_issue_resolution_min)} to resolve`,icon:AlertTriangle,tone:a.issue_open?'red':'neutral'},
    ]}/>}
    <div className="layout-thirds">
      <Card title="Blockers by category" subtitle="All recorded problems">
        {!a?<SkeletonBlock height={140}/>:!a.top_reasons.length?<EmptyState title="No problems recorded yet"/>:
        <Bars rows={a.top_reasons.map(r=>({key:r.code,label:humanize(r.code),n:r.count,tone:'red'}))} max={a.top_reasons[0].count}/>}
      </Card>
      <Card title="Inbound vs outbound" subtitle="Turnaround by direction">
        {!a?<SkeletonBlock height={140}/>:<div className="cohorts">{Object.entries(a.cohorts).map(([k,c])=><div key={k} className="cohort">
          <span className="cohort-name">{k==='inbound'?'Inbound deliveries':'Outbound collections'}<small>{c.n} completed</small></span>
          <span className="cohort-figs"><span><small>p50</small><b>{duration(c.p50_min)}</b></span><span><small>p90</small><b>{duration(c.p90_min)}</b></span></span>
        </div>)}</div>}
      </Card>
      <Card title="Where trucks are now" subtitle="Current stage of active visits">
        {!loaded?<SkeletonBlock height={140}/>:<Bars rows={lifecycle} max={Math.max(...lifecycle.map(l=>l.n))}/>}
      </Card>
    </div>
    <Card title="Recent completed journeys" subtitle="Open a journey to see its time breakdown" flush>
      <VisitTable rows={departed} loading={!loaded} columns={['truck','direction','arrival','dock','status']} empty={{title:'No completed journeys yet'}}/>
    </Card>
    {a&&<p className="footnote">{a.evidence} {a.cost}</p>}
  </div>;
}
