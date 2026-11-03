import {useMemo,useState} from 'react';
import {CheckCircle2} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {can} from '../../constants/permissions';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {DockBoard} from '../../components/docks/DockBoard';
import {EmptyState,SkeletonRows,Spinner} from '../../components/common/Feedback';
import {Direction,TruckIdentity,VisitTable} from '../../components/visits/VisitTable';
import {duration,minutesSince} from '../../utils/format';
import type{Visit} from '../../types/domain';

export function DocksPage(){
  const {board,loaded,refreshing}=useWorkspace();
  const queue=useMemo(()=>board.visits.filter(v=>v.status==='ready').sort((a,b)=>(a.ready_at??'').localeCompare(b.ready_at??'')),[board.visits]);
  const working=useMemo(()=>board.visits.filter(v=>['at_dock','loading','paused'].includes(v.status)||(v.status==='completed'&&v.dock)),[board.visits]);
  const free=board.docks.filter(d=>d.enabled&&!d.visit_id).length;
  return <div className="page">
    <PageHeader title="Docks" subtitle="Assign ready trucks to compatible bays and keep service moving." busy={refreshing}/>
    <Card title="Bays" subtitle={`${free} of ${board.docks.length} available`} flush>
      <DockBoard/>
    </Card>
    <div className="layout-half">
      <Card title="Ready for dock" subtitle="Longest waiting first. Pick a bay and assign in one step." actions={<span className="count-chip">{queue.length}</span>}>
        {!loaded?<SkeletonRows rows={3} cols={3}/>:!queue.length?<EmptyState icon={CheckCircle2} title="No trucks waiting" detail="Trucks appear here once readiness is confirmed and they are marked ready."/>:
        <ul className="list">{queue.map(v=><ReadyRow key={v.id} visit={v}/>)}</ul>}
      </Card>
      <Card title="At dock" subtitle="Trucks occupying a bay" actions={<span className="count-chip">{working.length}</span>}>
        <VisitTable rows={working} loading={!loaded} columns={['truck','dock','status','action']} empty={{title:'No trucks at a dock'}}/>
      </Card>
    </div>
  </div>;
}

/** Assign straight from the queue: pick a compatible free bay and confirm in one step. */
function ReadyRow({visit}:{visit:Visit}){
  const {board,user,pending,runAction,openVisit}=useWorkspace();
  const free=board.docks.filter(d=>d.enabled&&!d.visit_id&&(d.direction==='both'||d.direction===visit.direction));
  const [dock,setDock]=useState('');
  const chosen=dock||free[0]?.id||'';
  const busy=pending[visit.id];
  return <li className="list-row static">
    <button className="link-btn grow" onClick={()=>openVisit(visit.id)}><TruckIdentity visit={visit} sub={`Waiting ${duration(minutesSince(visit.ready_at))}`}/></button>
    <Direction value={visit.direction}/>
    {can(user.role,'assign')?(free.length?<div className="assign">
      <select className="sm" value={chosen} onChange={e=>setDock(e.target.value)} aria-label={`Dock for ${visit.truck_plate}`} disabled={!!busy}>{free.map(d=><option key={d.id} value={d.id}>{d.code}</option>)}</select>
      <button className="btn btn-sm btn-primary" disabled={!!busy||!chosen} onClick={()=>void runAction(visit,'assign',{dock_id:chosen})}>{busy==='assign'&&<Spinner size={12}/>}Assign</button>
    </div>:<span className="hint">No compatible bay free</span>):<span className="hint">Supervisor assigns</span>}
  </li>;
}
