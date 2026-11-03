import {useMemo,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {AlertTriangle,CalendarClock,CheckCircle2,ChevronRight,Clock3,Eye,PauseCircle,Plus,Search,Timer,Truck,UserRound,Warehouse} from 'lucide-react';
import {useWorkspace,type DrawerTab} from '../../context/WorkspaceContext';
import {useShell} from '../../layouts/AppShell';
import {DecisionService} from '../../services/DecisionService';
import {useQuery} from '../../hooks/useQuery';
import {can} from '../../constants/permissions';
import {PageHeader} from '../../components/common/PageHeader';
import {StatCards} from '../../components/common/StatCards';
import {Card} from '../../components/common/Card';
import {Segmented} from '../../components/common/Segmented';
import {EmptyState,ErrorState,SkeletonRows,Spinner} from '../../components/common/Feedback';
import {StatusBadge} from '../../components/common/StatusBadge';
import {DockBoard} from '../../components/docks/DockBoard';
import {TruckIdentity} from '../../components/visits/VisitTable';
import {time} from '../../utils/format';
import type{Decision} from '../../types/decisions';

const PRIORITY=[{label:'Immediate',tone:'red',icon:AlertTriangle},{label:'Action needed',tone:'amber',icon:Clock3},{label:'Monitor',tone:'neutral',icon:Eye}];
const TAB_FOR:Record<string,DrawerTab>={resolve_issue:'problems',open_issue:'problems',readiness:'readiness'};

export function CommandCenterPage(){
  const ws=useWorkspace();
  const {board,user,revision,openVisit}=ws;
  const {openForm}=useShell();
  const navigate=useNavigate();
  const decisions=useQuery('decisions',DecisionService.recommendations,revision);
  const [scope,setScope]=useState<'attention'|'all'>('attention'),[q,setQ]=useState('');
  const items=decisions.data?.recommendations??[];
  const attention=items.filter(x=>x.priority<=1).length;
  const visible=useMemo(()=>{
    const term=q.trim().toLowerCase();
    return items.filter(x=>(scope==='all'||x.priority<=1)&&(!term||`${x.truck_plate} ${x.title} ${x.owner} ${x.reason}`.toLowerCase().includes(term)));
  },[items,scope,q]);
  const m=board.metrics,docksInUse=board.docks.filter(d=>d.visit_id).length;
  const arriving=useMemo(()=>board.visits.filter(v=>v.status==='scheduled'&&v.scheduled_at).sort((a,b)=>a.scheduled_at!.localeCompare(b.scheduled_at!)).slice(0,5),[board.visits]);
  const n=(v:number|string)=>ws.loaded?v:'–';

  return <div className="page">
    <PageHeader title="Command center" subtitle="What needs a decision right now, most urgent first." busy={decisions.refreshing}>
      {can(user.role,'create')&&<button className="btn btn-primary" onClick={()=>openForm({walkIn:false})}><Plus size={15}/>New appointment</button>}
    </PageHeader>
    <StatCards items={[
      {label:'On site',value:n(m.on_site),hint:'Trucks inside the gate',icon:Truck,tone:'blue',onClick:()=>navigate('/gate?view=onsite')},
      {label:'Ready for dock',value:n(m.ready),hint:'Cleared, waiting for a bay',icon:CheckCircle2,tone:'green',onClick:()=>navigate('/docks')},
      {label:'On hold',value:n(m.on_hold),hint:m.on_hold?'Blocked, needs an owner':'Nothing blocked',icon:PauseCircle,tone:m.on_hold?'red':'neutral',onClick:()=>navigate('/problems')},
      {label:'Docks in use',value:n(`${docksInUse} / ${board.docks.length}`),hint:`${board.docks.length-docksInUse} bay(s) free`,icon:Warehouse,tone:'violet',onClick:()=>navigate('/docks')},
      {label:'Avg. turnaround',value:m.avg_turnaround_min!=null?`${m.avg_turnaround_min} min`:'–',hint:`${m.completed} completed visits`,icon:Timer,tone:'amber',onClick:()=>navigate('/analysis')},
    ]}/>
    <div className="layout-main">
      <Card title="Action queue" subtitle="Rule-based suggestions from recorded events"
        actions={<>
          <Segmented label="Queue scope" value={scope} onChange={setScope} options={[{value:'attention',label:'Needs attention',count:attention},{value:'all',label:'All',count:items.length}]}/>
          <div className="search"><Search size={14}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter" aria-label="Filter action queue"/></div>
        </>}>
        {decisions.loading?<SkeletonRows rows={5} cols={3}/>:decisions.error&&!decisions.data?<ErrorState message={decisions.error} onRetry={()=>void decisions.reload()}/>:
          !visible.length?<EmptyState icon={CheckCircle2} title={scope==='attention'?'All clear — nothing urgent':'No matching items'} detail={scope==='attention'&&items.length?'Lower-priority items are listed under All.':'New items appear as soon as a truck needs a decision.'}/>:
          <ul className="queue">{visible.map(x=><QueueRow key={x.id} item={x} onOpen={()=>openVisit(x.visit_id,TAB_FOR[x.action??'']??'actions')}/>)}</ul>}
      </Card>
      <div className="stack">
        <Card title="Dock status" subtitle={`${board.docks.length-docksInUse} of ${board.docks.length} bays free`} actions={<button className="btn btn-sm btn-ghost" onClick={()=>navigate('/docks')}>View all<ChevronRight size={14}/></button>}>
          <DockBoard compact/>
        </Card>
        <Card title="Arriving next" subtitle="Upcoming appointments" actions={<button className="btn btn-sm btn-ghost" onClick={()=>navigate('/gate?view=expected')}>Gate<ChevronRight size={14}/></button>}>
          {!ws.loaded?<SkeletonRows rows={3} cols={2}/>:!arriving.length?<EmptyState icon={CalendarClock} title="No upcoming appointments"/>:
          <ul className="list">{arriving.map(v=><li key={v.id}><button className="list-row" onClick={()=>openVisit(v.id)}>
            <span className="time-tag">{time(v.scheduled_at)}</span><span className="grow"><TruckIdentity visit={v}/></span><StatusBadge status={v.status}/>
          </button></li>)}</ul>}
        </Card>
      </div>
    </div>
  </div>;
}

/** One decision; the next step runs inline when it needs no input, otherwise "Review" opens the right tab. */
function QueueRow({item,onOpen}:{item:Decision;onOpen:()=>void}){
  const {byId,user,pending,runAction}=useWorkspace();
  const visit=byId.get(item.visit_id);
  const p=PRIORITY[Math.min(item.priority,2)];
  const dockIds=(item.evidence.dock_ids as string[]|undefined)??[],dockCodes=(item.evidence.dock_codes as string[]|undefined)??[];
  const busy=visit&&pending[visit.id];
  let inline=null;
  if(visit&&item.action==='assign_dock'&&dockIds.length&&can(user.role,'assign'))
    inline=<button className="btn btn-sm btn-primary" disabled={!!busy} onClick={()=>void runAction(visit,'assign',{dock_id:dockIds[0]})}>{busy==='assign'&&<Spinner size={12}/>}Assign {dockCodes[0]}</button>;
  if(visit&&item.action==='depart'&&can(user.role,'depart'))
    inline=<button className="btn btn-sm btn-primary" disabled={!!busy} onClick={()=>void runAction(visit,'depart')}>{busy==='depart'&&<Spinner size={12}/>}Record departure</button>;
  return <li className="queue-row">
    <span className={`icon-chip tone-${p.tone}`} title={p.label}><p.icon size={16}/></span>
    <button className="queue-main" onClick={onOpen}>
      <span className="queue-title"><span className="plate">{item.truck_plate}</span><b>{item.title}</b></span>
      <span className="queue-reason">{item.reason}</span>
      <span className="queue-meta"><span className={`prio-label tone-text-${p.tone}`}>{p.label}</span><span className="owner"><UserRound size={12}/>{item.owner}</span></span>
    </button>
    <div className="queue-actions">{inline}<button className="btn btn-sm" onClick={onOpen}>Review</button></div>
  </li>;
}
