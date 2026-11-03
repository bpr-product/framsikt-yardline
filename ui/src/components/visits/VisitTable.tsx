import {ArrowDownLeft,ArrowUpRight,Truck} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {StatusBadge} from '../common/StatusBadge';
import {EmptyState,SkeletonRows} from '../common/Feedback';
import {QuickAction} from './QuickAction';
import {dateTime,duration,minutesSince} from '../../utils/format';
import type{Visit} from '../../types/domain';

export type Column='truck'|'direction'|'cargo'|'scheduled'|'arrival'|'when'|'dock'|'status'|'onsite'|'action';
const HEAD:Record<Column,string>={truck:'Truck',direction:'Direction',cargo:'Cargo',scheduled:'Scheduled',arrival:'Arrived',when:'Arrival',dock:'Dock',status:'Status',onsite:'On site',action:''};

export function Direction({value}:{value:Visit['direction']}){
  return <span className={`direction is-${value}`} title={value==='inbound'?'Inbound delivery':'Outbound collection'}>{value==='inbound'?<ArrowDownLeft size={13}/>:<ArrowUpRight size={13}/>}{value==='inbound'?'Inbound':'Outbound'}</span>;
}
/** Plate + carrier with a direction-tinted truck chip; the recurring identity of a truck across screens. */
export function TruckIdentity({visit,sub}:{visit:Visit;sub?:string}){
  return <span className="truck-id">
    <span className={`icon-chip sm tone-${visit.direction==='inbound'?'blue':'violet'}`}><Truck size={14}/></span>
    <span className="truck-id-text"><b>{visit.truck_plate}</b><small>{sub??visit.company}</small></span>
  </span>;
}
function Cell({column,visit}:{column:Column;visit:Visit}){
  switch(column){
    case 'truck':return <td><TruckIdentity visit={visit}/></td>;
    case 'direction':return <td><Direction value={visit.direction}/></td>;
    case 'cargo':return <td className="cell-muted cell-clip" title={visit.cargo}>{visit.cargo}</td>;
    case 'scheduled':return <td className="cell-time">{dateTime(visit.scheduled_at)}</td>;
    case 'arrival':return <td className="cell-time">{dateTime(visit.arrival_at)}</td>;
    // Actual arrival once it happened, otherwise the planned slot.
    case 'when':return <td className="cell-time">{visit.arrival_at?dateTime(visit.arrival_at):visit.scheduled_at?<span className="cell-muted">Due {dateTime(visit.scheduled_at)}</span>:'—'}</td>;
    case 'dock':return <td>{visit.dock?<span className="dock-tag">{visit.dock}</span>:<span className="cell-muted">—</span>}</td>;
    case 'onsite':return <td className="cell-time">{visit.arrival_at&&!visit.departed_at?duration(minutesSince(visit.arrival_at)):'—'}</td>;
    case 'status':return <td><StatusBadge status={visit.status}/>{visit.status==='on_hold'&&visit.hold_reason&&<small className="cell-sub" title={visit.hold_reason}>{visit.hold_reason}</small>}</td>;
    case 'action':return <td className="cell-action"><QuickAction visit={visit}/></td>;
  }
}

export function VisitTable({rows,columns,loading,empty}:{rows:Visit[];columns:Column[];loading?:boolean;empty:{title:string;detail?:string}}){
  const {openVisit,pending}=useWorkspace();
  if(loading)return <SkeletonRows cols={Math.min(columns.length,5)}/>;
  if(!rows.length)return <EmptyState title={empty.title} detail={empty.detail}/>;
  return <div className="table-wrap"><table className="table">
    <thead><tr>{columns.map(c=><th key={c} className={c==='action'?'cell-action':undefined}>{HEAD[c]}</th>)}</tr></thead>
    <tbody>{rows.map(v=><tr key={v.id} className={pending[v.id]?'is-saving':undefined} tabIndex={0} onClick={()=>openVisit(v.id)} onKeyDown={e=>{if(e.key==='Enter'&&e.target===e.currentTarget)openVisit(v.id)}}>
      {columns.map(c=><Cell key={c} column={c} visit={v}/>)}
    </tr>)}</tbody>
  </table></div>;
}
