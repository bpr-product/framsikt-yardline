import {useCallback,useEffect,useRef,useState} from 'react';
import {DecisionService} from '../services/DecisionService';
import {useQuery} from './useQuery';
import {useWorkspace} from '../context/WorkspaceContext';
import {useToast} from '../context/ToastContext';
import {explain} from '../services/ApiBase';
import type{Readiness} from '../types/decisions';

/**
 * Readiness checklist with optimistic toggles. Only the check being saved is locked, so an
 * operator can tick several items in a row; each server reply updates just its own item and
 * carries the new visit version, which keeps optimistic-concurrency tokens current without a refetch.
 */
export function useReadiness(visitId:string|null){
  const {byId,patchVisit,settle,scheduleRefresh}=useWorkspace();
  const toast=useToast();
  const visit=visitId?byId.get(visitId):undefined;
  const known=useRef<number|null>(null);
  const [saving,setSaving]=useState<Set<string>>(new Set());
  // Revalidate only when someone else changed the truck (a version this hook did not produce).
  const [external,setExternal]=useState(0);
  const query=useQuery<Readiness>(visitId?`readiness:${visitId}`:null,()=>DecisionService.readiness(visitId!),external);
  const {data,mutate}=query;

  useEffect(()=>{if(data)known.current=Math.max(known.current??0,data.version)},[data]);
  useEffect(()=>{known.current=null},[visitId]);
  useEffect(()=>{
    if(visit&&known.current!=null&&visit.version>known.current&&saving.size===0){known.current=visit.version;setExternal(n=>n+1)}
  },[visit,saving]);

  const toggle=useCallback(async(code:string,done:boolean)=>{
    if(!visitId||!data||saving.has(code))return;
    const label=data.checks.find(c=>c.code===code)?.label??'Check';
    setSaving(s=>new Set(s).add(code));
    mutate(r=>{const checks=r.checks.map(c=>c.code===code?{...c,done}:c);return {...r,checks,ready:checks.every(c=>!c.required||c.done)}});
    try{
      const saved=await DecisionService.setReadiness(visitId,code,done);
      const item=saved.checks.find(c=>c.code===code);
      known.current=Math.max(known.current??0,saved.version);
      mutate(r=>{const checks=r.checks.map(c=>c.code===code&&item?item:c);return {...r,version:Math.max(r.version,saved.version),checks,ready:checks.every(c=>!c.required||c.done)}});
      // Keep the board's version token current without a refetch.
      patchVisit(visitId,{version:saved.version});settle(visitId);
      scheduleRefresh();
    }catch(e){
      mutate(r=>{const checks=r.checks.map(c=>c.code===code?{...c,done:!done}:c);return {...r,checks,ready:checks.every(c=>!c.required||c.done)}});
      toast.error(`${label} was not saved. ${explain(e)}`);
    }finally{setSaving(s=>{const n=new Set(s);n.delete(code);return n})}
  },[visitId,data,saving,mutate,patchVisit,settle,scheduleRefresh,toast]);

  return {...query,saving,toggle};
}
