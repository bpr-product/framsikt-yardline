import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Search,Truck} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useShell} from '../../layouts/AppShell';
import {can} from '../../constants/permissions';
import {ACTIVE_STATUSES} from '../../constants/labels';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {Segmented} from '../../components/common/Segmented';
import {VisitTable,type Column} from '../../components/visits/VisitTable';
import {isSiteToday} from '../../utils/format';
import type{Visit} from '../../types/domain';

type View='expected'|'onsite'|'departed';
const VIEWS:Record<View,{filter:(v:Visit)=>boolean;columns:Column[];empty:string;sort:(a:Visit,b:Visit)=>number}>={
  expected:{filter:v=>v.status==='scheduled',columns:['scheduled','truck','direction','cargo','status','action'],empty:'No expected arrivals',
    sort:(a,b)=>(a.scheduled_at??'9').localeCompare(b.scheduled_at??'9')},
  onsite:{filter:v=>ACTIVE_STATUSES.includes(v.status),columns:['truck','direction','arrival','onsite','dock','status','action'],empty:'No trucks on site',
    sort:(a,b)=>(a.arrival_at??'').localeCompare(b.arrival_at??'')},
  departed:{filter:v=>v.status==='departed'&&isSiteToday(v.departed_at),columns:['truck','direction','arrival','dock','status'],empty:'No departures today',
    sort:(a,b)=>(b.departed_at??'').localeCompare(a.departed_at??'')},
};

export function GatePage(){
  const {board,loaded,refreshing,user}=useWorkspace();
  const {openForm}=useShell();
  const [params,setParams]=useSearchParams();
  const view=(params.get('view') as View)||'expected',q=params.get('q')??'';
  const set=(key:string,value:string)=>setParams(p=>{const n=new URLSearchParams(p);if(value)n.set(key,value);else n.delete(key);return n},{replace:true});
  const counts=useMemo(()=>Object.fromEntries((Object.keys(VIEWS) as View[]).map(k=>[k,board.visits.filter(VIEWS[k].filter).length])) as Record<View,number>,[board.visits]);
  const rows=useMemo(()=>{
    const term=q.trim().toLowerCase(),cfg=VIEWS[view];
    return board.visits.filter(cfg.filter).filter(v=>!term||`${v.truck_plate} ${v.company} ${v.driver} ${v.cargo}`.toLowerCase().includes(term)).sort(cfg.sort);
  },[board.visits,view,q]);
  return <div className="page">
    <PageHeader title="Gate" subtitle="Check trucks in on arrival and record departures after clearance." busy={refreshing}>
      {can(user.role,'walkin')&&<button className="btn btn-primary" onClick={()=>openForm({walkIn:true})}><Truck size={15}/>Register walk-in</button>}
    </PageHeader>
    <Card flush title={<Segmented label="Gate view" value={view} onChange={v=>set('view',v)} options={[
          {value:'expected',label:'Expected',count:counts.expected},{value:'onsite',label:'On site',count:counts.onsite},{value:'departed',label:'Departed today',count:counts.departed}]}/>}
      actions={<div className="search"><Search size={14}/><input value={q} onChange={e=>set('q',e.target.value)} placeholder="Search plate, carrier, driver" aria-label="Search gate register"/></div>}>
      <VisitTable rows={rows} loading={!loaded} columns={VIEWS[view].columns} empty={{title:q?'No trucks match this search':VIEWS[view].empty}}/>
    </Card>
  </div>;
}
