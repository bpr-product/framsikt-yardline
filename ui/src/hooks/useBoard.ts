import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {OperationsService} from '../services/OperationsService';
import {explain} from '../services/ApiBase';
import type{Board,Dock,Visit} from '../types/domain';

const POLL_MS=30000;
const EMPTY:Board={visits:[],docks:[],metrics:{scheduled:0,on_site:0,on_hold:0,ready:0,occupied_docks:0,completed:0,avg_turnaround_min:null,longest_turnaround_min:null}};

/** Dock occupancy follows the trucks we hold locally, so an assignment or release shows instantly. */
function syncDocks(docks:Dock[],visits:Visit[]){
  const occupant=new Map(visits.filter(v=>v.dock).map(v=>[v.dock!,v.id]));
  const known=new Set(visits.map(v=>v.id));
  return docks.map(d=>{
    const id=occupant.get(d.code)??(d.visit_id&&known.has(d.visit_id)?null:d.visit_id);
    return id===d.visit_id?d:{...d,visit_id:id};
  });
}

/** Server data wins unless this client already holds a newer version or a save is still pending. */
function mergeVisits(server:Visit[],local:Visit[],pending:Set<string>,keepLocalOnly:boolean){
  const mine=new Map(local.map(v=>[v.id,v]));
  const merged=server.map(s=>{const l=mine.get(s.id);return l&&(pending.has(s.id)||l.version>s.version)?l:s});
  if(!keepLocalOnly)return merged;
  const ids=new Set(server.map(v=>v.id));
  return [...local.filter(v=>!ids.has(v.id)),...merged];
}

/**
 * Shared operational state for every screen: one /board request, background revalidation,
 * visible-tab polling, and local merging of mutation responses (no refetch waterfall).
 */
export function useBoard(enabled:boolean){
  const [board,setBoard]=useState<Board>(EMPTY);
  const [loaded,setLoaded]=useState(false),[refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState(''),[updatedAt,setUpdatedAt]=useState<Date|null>(null);
  const pending=useRef(new Set<string>());
  const inFlight=useRef<Promise<void>|null>(null),again=useRef(false),mutations=useRef(0),timer=useRef<number|undefined>(undefined);

  const refresh=useCallback(():Promise<void>=>{
    // Coalesce: overlapping callers share one request; a call during flight queues exactly one more.
    if(inFlight.current){again.current=true;return inFlight.current}
    const run=async()=>{
      setRefreshing(true);
      const before=mutations.current;
      try{
        const next=await OperationsService.board();
        setBoard(current=>{
          const visits=mergeVisits(next.visits,current.visits,pending.current,mutations.current!==before);
          return {visits,docks:syncDocks(next.docks,visits),metrics:next.metrics};
        });
        setLoaded(true);setError('');setUpdatedAt(new Date());
      }catch(e){setError(explain(e))}
      finally{
        inFlight.current=null;setRefreshing(false);
        if(again.current){again.current=false;void refresh()}
      }
    };
    inFlight.current=run();
    return inFlight.current;
  },[]);

  /** Debounced reconcile after a save, so counts and metrics catch up without blocking the operator. */
  const scheduleRefresh=useCallback(()=>{window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>void refresh(),350)},[refresh]);

  const applyVisit=useCallback((visit:Visit)=>{
    mutations.current++;
    setBoard(current=>{
      const exists=current.visits.some(v=>v.id===visit.id);
      const visits=exists?current.visits.map(v=>v.id===visit.id&&v.version<=visit.version?visit:v):[visit,...current.visits];
      return {...current,visits,docks:syncDocks(current.docks,visits)};
    });
  },[]);

  /** Optimistic local change; returns a rollback that restores the previous record. */
  const patchVisit=useCallback((id:string,patch:Partial<Visit>)=>{
    let previous:Visit|undefined;
    pending.current.add(id);
    setBoard(current=>({...current,visits:current.visits.map(v=>{if(v.id!==id)return v;previous=v;return {...v,...patch}})}));
    return ()=>{
      pending.current.delete(id);
      if(previous){const p=previous;setBoard(current=>({...current,visits:current.visits.map(v=>v.id===id?p:v)}))}
    };
  },[]);
  const settle=useCallback((id:string)=>pending.current.delete(id),[]);

  useEffect(()=>{
    if(!enabled){setBoard(EMPTY);setLoaded(false);return}
    void refresh();
    const tick=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh()},POLL_MS);
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh()};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.clearInterval(tick);window.clearTimeout(timer.current);document.removeEventListener('visibilitychange',onVisible)};
  },[enabled,refresh]);

  // Changes only when a truck's server version changes; screens use it to revalidate their own data.
  const revision=useMemo(()=>board.visits.map(v=>v.id+':'+v.version).join('|'),[board.visits]);
  const byId=useMemo(()=>new Map(board.visits.map(v=>[v.id,v])),[board.visits]);
  // Stable identity so context consumers re-render only when board state actually changes.
  return useMemo(()=>({board,byId,loaded,refreshing,error,updatedAt,revision,refresh,scheduleRefresh,applyVisit,patchVisit,settle}),
    [board,byId,loaded,refreshing,error,updatedAt,revision,refresh,scheduleRefresh,applyVisit,patchVisit,settle]);
}
export type BoardStore=ReturnType<typeof useBoard>;
