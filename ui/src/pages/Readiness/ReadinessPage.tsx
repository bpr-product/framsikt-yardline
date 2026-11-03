import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ChevronRight,ClipboardCheck} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {PageHeader} from '../../components/common/PageHeader';
import {Segmented} from '../../components/common/Segmented';
import {EmptyState,SkeletonRows} from '../../components/common/Feedback';
import {StatusBadge} from '../../components/common/StatusBadge';
import {TruckIdentity} from '../../components/visits/VisitTable';
import {ReadinessChecklist} from '../../components/visits/ReadinessChecklist';
import {time} from '../../utils/format';

type Scope='before'|'onsite';
// Before dock: preparation still matters. On site: later stages, where a revoked check is a risk.
const SCOPES:Record<Scope,string[]>={before:['scheduled','checked_in','on_hold','ready'],onsite:['at_dock','loading','paused','completed']};

export function ReadinessPage(){
  const {board,byId,loaded,refreshing,openVisit}=useWorkspace();
  const [params,setParams]=useSearchParams();
  const scope=(params.get('scope') as Scope)||'before',selected=params.get('truck');
  const set=(key:string,value:string)=>setParams(p=>{const n=new URLSearchParams(p);n.set(key,value);return n},{replace:true});
  const list=useMemo(()=>board.visits.filter(v=>SCOPES[scope].includes(v.status))
    .sort((a,b)=>(a.scheduled_at??a.arrival_at??'').localeCompare(b.scheduled_at??b.arrival_at??'')),[board.visits,scope]);
  const visit=selected?byId.get(selected):undefined;
  return <div className="page">
    <PageHeader title="Readiness" subtitle="Confirm goods, documents and equipment before a truck is sent to a dock." busy={refreshing}/>
    <div className="master-detail card">
      <div className="master">
        <div className="card-head"><Segmented label="Readiness scope" value={scope} onChange={v=>set('scope',v)} options={[
          {value:'before',label:'Before dock',count:board.visits.filter(v=>SCOPES.before.includes(v.status)).length},
          {value:'onsite',label:'At dock',count:board.visits.filter(v=>SCOPES.onsite.includes(v.status)).length}]}/></div>
        {!loaded?<SkeletonRows rows={6} cols={2}/>:!list.length?<EmptyState title="No trucks in this stage"/>:
        <ul className="list">{list.map(v=><li key={v.id}><button className={`list-row${selected===v.id?' is-active':''}`} aria-current={selected===v.id} onClick={()=>set('truck',v.id)}>
          <span className="grow"><TruckIdentity visit={v} sub={v.status==='scheduled'?`Due ${time(v.scheduled_at)}`:`Arrived ${time(v.arrival_at)}`}/></span>
          <StatusBadge status={v.status}/>
        </button></li>)}</ul>}
      </div>
      <div className="detail">
        {!visit?<EmptyState icon={ClipboardCheck} title="Select a truck" detail="Its checklist appears here. Each check saves as you tick it."/>:<>
          <div className="detail-head">
            <TruckIdentity visit={visit} sub={`${visit.direction==='inbound'?'Inbound delivery':'Outbound collection'} · ${visit.cargo}`}/>
            <button className="btn btn-sm" onClick={()=>openVisit(visit.id)}>Open truck<ChevronRight size={14}/></button>
          </div>
          <ReadinessChecklist key={visit.id} visit={visit}/>
        </>}
      </div>
    </div>
  </div>;
}
