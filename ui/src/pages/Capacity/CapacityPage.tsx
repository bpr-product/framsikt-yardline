import {ChevronLeft,ChevronRight,Plus} from 'lucide-react';
import {useSearchParams} from 'react-router-dom';
import {DecisionService} from '../../services/DecisionService';
import {useQuery} from '../../hooks/useQuery';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useShell} from '../../layouts/AppShell';
import {can} from '../../constants/permissions';
import {PageHeader} from '../../components/common/PageHeader';
import {Card} from '../../components/common/Card';
import {Segmented} from '../../components/common/Segmented';
import {ErrorState,SkeletonBlock} from '../../components/common/Feedback';
import {shiftDay,siteToday} from '../../utils/format';
import type{Planning} from '../../types/decisions';
import type{Direction} from '../../types/domain';

const hourLabel=(iso:string)=>new Date(iso).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'});
/** datetime-local value in site time, so the booking form opens on exactly the chosen slot. */
const slotInput=(iso:string)=>new Date(iso).toLocaleString('sv-SE',{timeZone:'Asia/Kolkata'}).replace(' ','T').slice(0,16);
const dayLabel=(day:string)=>new Date(day+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});

export function CapacityPage(){
  const {user,revision}=useWorkspace();
  const {openForm}=useShell();
  const [params,setParams]=useSearchParams();
  const day=params.get('day')??siteToday(),direction=(params.get('direction') as Direction)||'outbound';
  const set=(key:string,value:string)=>setParams(p=>{const n=new URLSearchParams(p);n.set(key,value);return n},{replace:true});
  const plan=useQuery<Planning>(`slots:${day}:${direction}`,()=>DecisionService.slots(day,direction),revision);
  const mayBook=can(user.role,'create');
  const free=plan.data?.slots.filter(s=>s.available).length;
  return <div className="page">
    <PageHeader title="Capacity planner" subtitle="Book against available dock hours. Overbooking is rejected when you save." busy={plan.refreshing}>
      {mayBook&&<button className="btn btn-primary" onClick={()=>openForm({walkIn:false,direction})}><Plus size={15}/>New appointment</button>}
    </PageHeader>
    <Card title={<div className="toolbar">
        <div className="day-nav">
          <button className="icon-btn" aria-label="Previous day" onClick={()=>set('day',shiftDay(day,-1))}><ChevronLeft size={16}/></button>
          <input type="date" value={day} onChange={e=>e.target.value&&set('day',e.target.value)} aria-label="Planning date"/>
          <button className="icon-btn" aria-label="Next day" onClick={()=>set('day',shiftDay(day,1))}><ChevronRight size={16}/></button>
          {day!==siteToday()&&<button className="btn btn-sm btn-ghost" onClick={()=>set('day',siteToday())}>Today</button>}
        </div>
        <Segmented label="Direction" value={direction} onChange={v=>set('direction',v)} options={[{value:'inbound',label:'Inbound'},{value:'outbound',label:'Outbound'}]}/>
      </div>}
      actions={<span className="hint">{dayLabel(day)}{free!=null&&` · ${free} of ${plan.data!.slots.length} hours open`}</span>}
      footer="Pilot rule: one planned service start per compatible dock per hour, Mon–Sat 08:00–18:00 IST. Staffing and equipment are not yet connected.">
      {plan.loading?<div className="slot-grid">{Array.from({length:10},(_,i)=><SkeletonBlock key={i} height={128}/>)}</div>:
      plan.error&&!plan.data?<ErrorState message={plan.error} onRetry={()=>void plan.reload()}/>:
      <div className="slot-grid">{plan.data?.slots.map(s=>{
        const pct=s.capacity?Math.min(100,100*s.booked/s.capacity):100;
        const level=!s.available?'full':pct>=50?'busy':'open';
        return <div key={s.start_at} className={`slot is-${level}`}>
          <div className="slot-head"><b>{hourLabel(s.start_at)}</b><span className={`slot-state is-${level}`}>{s.available?`${s.capacity-s.booked} free`:s.reason}</span></div>
          <span className={`meter is-${level}`} title={`${s.booked} of ${s.capacity} booked`}><span style={{width:`${pct}%`}}/></span>
          <small>{s.booked} of {s.capacity} booked</small>
          {mayBook&&<button className="btn btn-sm" disabled={!s.available} onClick={()=>openForm({walkIn:false,direction,scheduled_at:slotInput(s.start_at)})}>{s.available?'Book this hour':'Unavailable'}</button>}
        </div>;
      })}</div>}
    </Card>
  </div>;
}
