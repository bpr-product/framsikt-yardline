import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';
import {Plus,Search} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useShell} from '../../layouts/AppShell';
import {can} from '../../constants/permissions';
import {STATUS_NAMES} from '../../constants/labels';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {VisitTable} from '../../components/visits/VisitTable';
import type{Status} from '../../types/domain';

/** The complete register: every booking and visit, searchable and filterable, with its next step. */
export function AppointmentsPage(){
  const {board,loaded,refreshing,user}=useWorkspace();
  const {openForm}=useShell();
  const [params,setParams]=useSearchParams();
  const q=params.get('q')??'',status=params.get('status')??'all',direction=params.get('direction')??'all';
  const set=(key:string,value:string)=>setParams(p=>{const n=new URLSearchParams(p);if(value&&value!=='all')n.set(key,value);else n.delete(key);return n},{replace:true});
  const counts=useMemo(()=>{const c:Record<string,number>={};for(const v of board.visits)c[v.status]=(c[v.status]??0)+1;return c},[board.visits]);
  const rows=useMemo(()=>{
    const term=q.trim().toLowerCase();
    return board.visits.filter(v=>(status==='all'||v.status===status)&&(direction==='all'||v.direction===direction)
      &&(!term||`${v.truck_plate} ${v.company} ${v.driver} ${v.cargo}`.toLowerCase().includes(term)));
  },[board.visits,q,status,direction]);
  return <div className="page">
    <PageHeader title="Appointments" subtitle="All bookings and truck visits, newest first." busy={refreshing}>
      {can(user.role,'create')&&<button className="btn btn-primary" onClick={()=>openForm({walkIn:false})}><Plus size={15}/>New appointment</button>}
    </PageHeader>
    <Card flush title={<div className="toolbar">
        <div className="search wide"><Search size={14}/><input value={q} onChange={e=>set('q',e.target.value)} placeholder="Plate, carrier, driver or cargo" aria-label="Search appointments"/></div>
        <select className="sm" value={status} onChange={e=>set('status',e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses ({board.visits.length})</option>
          {(Object.keys(STATUS_NAMES) as Status[]).map(s=><option key={s} value={s}>{STATUS_NAMES[s]} ({counts[s]??0})</option>)}
        </select>
        <select className="sm" value={direction} onChange={e=>set('direction',e.target.value)} aria-label="Filter by direction">
          <option value="all">Both directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option>
        </select>
      </div>} actions={<span className="hint">{rows.length} of {board.visits.length}</span>}>
      <VisitTable rows={rows} loading={!loaded} columns={['truck','direction','when','dock','status','action']}
        empty={{title:'No visits match these filters',detail:q||status!=='all'||direction!=='all'?'Clear a filter to see more.':'Book an appointment to get started.'}}/>
    </Card>
  </div>;
}
