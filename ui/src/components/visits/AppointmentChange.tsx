import {useState} from 'react';
import {DecisionService} from '../../services/DecisionService';
import {explain} from '../../services/ApiBase';
import {useWorkspace} from '../../context/WorkspaceContext';
import {useToast} from '../../context/ToastContext';
import {can} from '../../constants/permissions';
import {Spinner} from '../common/Feedback';
import type{Visit} from '../../types/domain';

/** Reschedule or cancel an upcoming appointment; both require a reason that enters the audit trail. */
export function AppointmentChange({visit}:{visit:Visit}){
  const {user,pending,runAction,applyVisit,scheduleRefresh}=useWorkspace();
  const toast=useToast();
  const [when,setWhen]=useState(''),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[confirming,setConfirming]=useState(false);
  if(visit.status!=='scheduled'||!can(user.role,'reschedule'))return null;
  const valid=reason.trim().length>=5,busy=saving||!!pending[visit.id];
  const reschedule=async()=>{
    setSaving(true);
    try{
      const saved=await DecisionService.reschedule(visit.id,new Date(when).toISOString(),reason.trim());
      applyVisit(saved);scheduleRefresh();setWhen('');setReason('');
      toast.success(`${visit.truck_plate} rescheduled`);
    }catch(e){toast.error(explain(e))}finally{setSaving(false)}
  };
  const cancel=async()=>{
    if(await runAction(visit,'cancel',{reason:reason.trim(),expected_version:visit.version})){setReason('');setConfirming(false)}
  };
  return <section className="sub-section">
    <h4>Change appointment</h4>
    <div className="form-row">
      <label>New arrival time<input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)} disabled={busy}/></label>
      <label>Reason<input value={reason} maxLength={300} placeholder="e.g. Goods staging needs more time" onChange={e=>setReason(e.target.value)} disabled={busy}/></label>
    </div>
    <div className="action-row">
      <button className="btn" disabled={busy||!when||!valid} onClick={()=>void reschedule()}>{saving&&<Spinner/>}Reschedule</button>
      {confirming?<>
        <span className="hint">Cancel this appointment? It stays in the audit trail.</span>
        <button className="btn btn-danger" disabled={busy} onClick={()=>void cancel()}>{pending[visit.id]==='cancel'&&<Spinner/>}Confirm cancel</button>
        <button className="btn btn-ghost" disabled={busy} onClick={()=>setConfirming(false)}>Keep</button>
      </>:<button className="btn btn-ghost danger-text" disabled={busy||!valid} title={valid?undefined:'Enter a reason first'} onClick={()=>setConfirming(true)}>Cancel appointment…</button>}
    </div>
  </section>;
}
