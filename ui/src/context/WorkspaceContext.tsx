import {createContext,useCallback,useContext,useMemo,useState,type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {OperationsService} from '../services/OperationsService';
import {DecisionService} from '../services/DecisionService';
import {explain} from '../services/ApiBase';
import {useBoard,type BoardStore} from '../hooks/useBoard';
import {useToast} from './ToastContext';
import {ACTION_DONE,OPTIMISTIC} from '../constants/permissions';
import type{User,Visit,VisitCreate} from '../types/domain';

export type DrawerTab='actions'|'readiness'|'problems'|'time'|'activity';
interface Workspace extends BoardStore{
  user:User;
  signOut:()=>void;
  /** visitId -> action currently saving, shared by every place that shows the truck. */
  pending:Record<string,string>;
  runAction:(visit:Visit,action:string,payload?:object)=>Promise<Visit|null>;
  createVisit:(payload:VisitCreate,walkIn:boolean)=>Promise<Visit|null>;
  openVisit:(id:string,tab?:DrawerTab)=>void;
  closeVisit:()=>void;
}
const WorkspaceContext=createContext<Workspace|null>(null);

export function WorkspaceProvider({user,signOut,children}:{user:User;signOut:()=>void;children:ReactNode}){
  const store=useBoard(true);
  const toast=useToast();
  const [pending,setPending]=useState<Record<string,string>>({});
  // The drawer target lives in the URL so a truck can be linked, refreshed or closed with Back.
  const [,setParams]=useSearchParams();
  const {applyVisit,patchVisit,settle,scheduleRefresh}=store;

  const runAction=useCallback(async(visit:Visit,action:string,payload?:object)=>{
    setPending(p=>({...p,[visit.id]:action}));
    const target=OPTIMISTIC[action];
    const rollback=target?patchVisit(visit.id,{status:target,...(action==='hold'?{hold_reason:(payload as {reason?:string})?.reason??null}:{})}):null;
    try{
      const saved=await OperationsService.action(visit.id,action,payload);
      settle(visit.id);applyVisit(saved);scheduleRefresh();
      toast.success(`${visit.truck_plate} ${ACTION_DONE[action]??'updated'}`);
      return saved;
    }catch(e){
      rollback?.();
      toast.error(`${visit.truck_plate}: ${explain(e)}`);
      return null;
    }finally{setPending(({[visit.id]:_,...rest})=>rest)}
  },[applyVisit,patchVisit,settle,scheduleRefresh,toast]);

  const openVisit=useCallback((id:string,tab?:DrawerTab)=>{
    setParams(p=>{const n=new URLSearchParams(p);n.set('visit',id);if(tab)n.set('tab',tab);else n.delete('tab');return n});
  },[setParams]);
  const closeVisit=useCallback(()=>{
    setParams(p=>{const n=new URLSearchParams(p);n.delete('visit');n.delete('tab');return n});
  },[setParams]);

  const createVisit=useCallback(async(payload:VisitCreate,walkIn:boolean)=>{
    try{
      const visit=walkIn?await DecisionService.walkin(payload):await OperationsService.create(payload);
      applyVisit(visit);scheduleRefresh();
      toast.success(walkIn?`${visit.truck_plate} registered and checked in`:`Appointment booked for ${visit.truck_plate}`);
      openVisit(visit.id,walkIn?'readiness':undefined);
      return visit;
    }catch(e){toast.error(explain(e));return null}
  },[applyVisit,scheduleRefresh,toast,openVisit]);

  const value=useMemo<Workspace>(()=>({...store,user,signOut,pending,runAction,createVisit,openVisit,closeVisit}),
    [store,user,signOut,pending,runAction,createVisit,openVisit,closeVisit]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(){
  const ws=useContext(WorkspaceContext);
  if(!ws)throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ws;
}
