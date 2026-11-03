import {Warehouse} from 'lucide-react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {STATUS_NAMES} from '../../constants/labels';
import {StatusBadge} from '../common/StatusBadge';
import {SkeletonRows} from '../common/Feedback';
import {QuickAction} from '../visits/QuickAction';
import {duration,minutesSince} from '../../utils/format';

const DIRECTION_LABEL:Record<string,string>={both:'All directions',inbound:'Inbound only',outbound:'Outbound only'};

/** Live bay occupancy. A bay stays occupied until a supervisor confirms the truck physically left. */
export function DockBoard({compact}:{compact?:boolean}){
  const {board,byId,loaded,openVisit}=useWorkspace();
  if(!loaded)return <SkeletonRows rows={compact?4:2} cols={3}/>;
  if(compact)return <ul className="dock-list">{board.docks.map(d=>{
    const v=d.visit_id?byId.get(d.visit_id):undefined;
    const state=!d.enabled?'off':d.visit_id?'busy':'free';
    return <li key={d.id}><button className="dock-line" onClick={()=>d.visit_id&&openVisit(d.visit_id)} disabled={!d.visit_id}>
      <span className={`bay-dot is-${state}`}/>
      <span className="dock-line-code">{d.code}</span>
      <span className="grow dock-line-truck">{v?<><b>{v.truck_plate}</b><small>{STATUS_NAMES[v.status]}</small></>:state==='free'?'Available':state==='off'?'Disabled':'Occupied'}</span>
    </button></li>;
  })}</ul>;
  return <div className="bay-grid">{board.docks.map(d=>{
    const v=d.visit_id?byId.get(d.visit_id):undefined;
    const state=!d.enabled?'off':d.visit_id?'busy':'free';
    const since=v?.service_started_at??v?.ready_at;
    return <article key={d.id} className={`bay is-${state}`}>
      <header className="bay-head">
        <span className="icon-chip sm tone-neutral"><Warehouse size={14}/></span>
        <span className="grow"><b>{d.code}</b><small>{DIRECTION_LABEL[d.direction]??d.direction}</small></span>
        <span className={`bay-state is-${state}`}>{state==='off'?'Disabled':state==='busy'?'Occupied':'Available'}</span>
      </header>
      {v?<div className="bay-truck">
        <button className="link-btn" onClick={()=>openVisit(v.id)}><b>{v.truck_plate}</b><small>{v.company}</small></button>
        <div className="bay-truck-row"><StatusBadge status={v.status}/>{since&&<small>{duration(minutesSince(since))} at this stage</small>}</div>
        <QuickAction visit={v}/>
      </div>:d.visit_id?<button className="link-btn" onClick={()=>openVisit(d.visit_id!)}>View assigned truck</button>
      :<div className="bay-empty">Ready for the next truck</div>}
    </article>;
  })}</div>;
}
