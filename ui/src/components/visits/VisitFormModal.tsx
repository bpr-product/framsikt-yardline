import {useState,type FormEvent} from 'react';
import {useWorkspace} from '../../context/WorkspaceContext';
import {Modal} from '../common/Modal';
import {Spinner} from '../common/Feedback';
import type{VisitCreate} from '../../types/domain';

export interface VisitFormIntent{walkIn:boolean;scheduled_at?:string|null;direction?:VisitCreate['direction']}

/** Book an appointment, or register an unplanned walk-in at the gate (checked in immediately). */
export function VisitFormModal({intent,onClose}:{intent:VisitFormIntent;onClose:()=>void}){
  const {createVisit}=useWorkspace();
  const [form,setForm]=useState<VisitCreate>({truck_plate:'',driver:'',company:'',direction:intent.direction??'inbound',cargo:'',scheduled_at:intent.scheduled_at??null});
  const [saving,setSaving]=useState(false);
  const set=<K extends keyof VisitCreate>(key:K,value:VisitCreate[K])=>setForm(f=>({...f,[key]:value}));
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setSaving(true);
    const payload={...form,scheduled_at:intent.walkIn||!form.scheduled_at?null:new Date(form.scheduled_at).toISOString()};
    const created=await createVisit(payload,intent.walkIn);
    setSaving(false);
    if(created)onClose();
  };
  return <Modal title={intent.walkIn?'Register walk-in truck':'New appointment'}
    subtitle={intent.walkIn?'Unplanned arrival. The truck is checked in now; readiness and dock rules still apply.':'Book a truck before it reaches the gate. Capacity is validated on save.'}
    onClose={onClose} footer={<>
      <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
      <button type="submit" form="visit-form" className="btn btn-primary" disabled={saving}>{saving&&<Spinner/>}{saving?'Saving…':intent.walkIn?'Register and check in':'Book appointment'}</button>
    </>}>
    <form id="visit-form" className="form-grid" onSubmit={submit}>
      <label>Truck registration<input required minLength={4} maxLength={30} value={form.truck_plate} onChange={e=>set('truck_plate',e.target.value.toUpperCase())} placeholder="SYN 01 AB 1234"/></label>
      <label>Direction<select value={form.direction} onChange={e=>set('direction',e.target.value as VisitCreate['direction'])}><option value="inbound">Inbound · delivery</option><option value="outbound">Outbound · collection</option></select></label>
      <label>Driver<input required minLength={2} maxLength={80} value={form.driver} onChange={e=>set('driver',e.target.value)} placeholder="Full name"/></label>
      <label>Carrier<input required minLength={2} maxLength={100} value={form.company} onChange={e=>set('company',e.target.value)} placeholder="Transport company"/></label>
      <label className="span-2">Cargo<input required minLength={2} maxLength={120} value={form.cargo} onChange={e=>set('cargo',e.target.value)} placeholder="e.g. Steel coils, 12 tonnes"/></label>
      {!intent.walkIn&&<label className="span-2">Expected arrival<input type="datetime-local" value={form.scheduled_at??''} onChange={e=>set('scheduled_at',e.target.value||null)}/><small>Pilot hours Mon–Sat, 08:00–18:00 IST. Leave empty for an unscheduled booking.</small></label>}
    </form>
  </Modal>;
}
