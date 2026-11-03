import {useEffect,useRef} from 'react';
import {useSearchParams} from 'react-router-dom';
import {AlertTriangle,Truck,X} from 'lucide-react';
import {useWorkspace,type DrawerTab} from '../../context/WorkspaceContext';
import {OperationsService} from '../../services/OperationsService';
import {useQuery} from '../../hooks/useQuery';
import {StatusBadge} from '../common/StatusBadge';
import {ErrorState,SkeletonBlock,Spinner} from '../common/Feedback';
import {Direction} from './VisitTable';
import {VisitActions} from './VisitActions';
import {ReadinessChecklist} from './ReadinessChecklist';
import {VisitIssues} from './VisitIssues';
import {TimeBreakdown} from './TimeBreakdown';
import {ActivityLog} from './ActivityLog';
import {AppointmentChange} from './AppointmentChange';
import {dateTime,duration,minutesSince} from '../../utils/format';
import type{VisitDetail} from '../../types/domain';

const TABS:{value:DrawerTab;label:string}[]=[
  {value:'actions',label:'Next step'},{value:'readiness',label:'Readiness'},{value:'problems',label:'Problems'},
  {value:'time',label:'Time'},{value:'activity',label:'Activity'},
];

/**
 * Side panel for one truck. It opens instantly from board data (no blocking fetch) and keeps the
 * list behind it visible, so operators can work down a queue without losing their place.
 */
export function VisitDrawer(){
  const [params,setParams]=useSearchParams();
  const {byId,closeVisit,pending}=useWorkspace();
  const id=params.get('visit');
  const tab=(params.get('tab') as DrawerTab)||'actions';
  const fromBoard=id?byId.get(id):undefined;
  // Trucks outside the board window (older than the latest 300) are fetched directly.
  const fallback=useQuery<VisitDetail>(id&&!fromBoard?`detail:${id}`:null,()=>OperationsService.visit(id!));
  const visit=fromBoard??fallback.data?.visit;
  const panel=useRef<HTMLElement>(null);

  useEffect(()=>{
    if(!id)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('.modal'))closeVisit()};
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[id,closeVisit]);
  useEffect(()=>{if(id)panel.current?.focus()},[id]);

  if(!id)return null;
  const setTab=(value:DrawerTab)=>setParams(p=>{const n=new URLSearchParams(p);n.set('tab',value);return n},{replace:true});
  const onSite=visit?.arrival_at&&!visit.departed_at?duration(minutesSince(visit.arrival_at)):null;

  return <>
    <div className="drawer-scrim" onClick={closeVisit}/>
    <aside className="drawer" role="dialog" aria-label={visit?`Truck ${visit.truck_plate}`:'Truck details'} tabIndex={-1} ref={panel}>
      {!visit?<div className="drawer-body">
        {fallback.error?<ErrorState message={fallback.error} onRetry={()=>void fallback.reload()}/>:<><SkeletonBlock height={56}/><SkeletonBlock height={180}/></>}
      </div>:<>
        <header className="drawer-head">
          <span className={`icon-chip lg tone-${visit.direction==='inbound'?'blue':'violet'}`}><Truck size={20}/></span>
          <div className="drawer-title">
            <div className="drawer-title-row"><h2>{visit.truck_plate}</h2><StatusBadge status={visit.status}/>{pending[visit.id]&&<span className="saving-label"><Spinner size={12}/>Saving…</span>}</div>
            <p>{visit.company} · {visit.driver}</p>
          </div>
          <button className="icon-btn" aria-label="Close truck panel" onClick={closeVisit}><X size={16}/></button>
        </header>
        <dl className="facts">
          <div><dt>Direction</dt><dd><Direction value={visit.direction}/></dd></div>
          <div><dt>Cargo</dt><dd title={visit.cargo}>{visit.cargo}</dd></div>
          <div><dt>Dock</dt><dd>{visit.dock??'—'}</dd></div>
          <div><dt>Scheduled</dt><dd>{dateTime(visit.scheduled_at)}</dd></div>
          <div><dt>Arrived</dt><dd>{dateTime(visit.arrival_at)}</dd></div>
          <div><dt>On site</dt><dd>{onSite??'—'}</dd></div>
        </dl>
        {visit.status==='on_hold'&&visit.hold_reason&&<div className="notice notice-red"><AlertTriangle size={14}/><span><b>On hold:</b> {visit.hold_reason}</span></div>}
        <nav className="tabs" role="tablist">{TABS.map(t=><button key={t.value} role="tab" aria-selected={tab===t.value} className={tab===t.value?'is-active':''} onClick={()=>setTab(t.value)}>{t.label}</button>)}</nav>
        <div className="drawer-body">
          {tab==='actions'&&<><VisitActions visit={visit}/><AppointmentChange visit={visit}/></>}
          {tab==='readiness'&&<ReadinessChecklist visit={visit}/>}
          {tab==='problems'&&<VisitIssues visit={visit}/>}
          {tab==='time'&&<TimeBreakdown visit={visit}/>}
          {tab==='activity'&&<ActivityLog visit={visit}/>}
        </div>
      </>}
    </aside>
  </>;
}
