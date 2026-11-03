import {useCallback,useEffect,useRef,useState} from 'react';
import {explain} from '../services/ApiBase';

// Session-scoped cache: revisiting a screen renders the last result instantly while it revalidates.
const cache=new Map<string,unknown>();
export const clearQueryCache=()=>cache.clear();

/**
 * Stale-while-revalidate loader. `loading` is true only when there is nothing to show yet;
 * later reloads set `refreshing` so screens never blank out during a background update.
 * Pass `revision` to revalidate when shared data (e.g. truck versions) changes.
 */
export function useQuery<T>(key:string|null,fetcher:()=>Promise<T>,revision?:unknown){
  const [data,setData]=useState<T|undefined>(()=>key?cache.get(key) as T|undefined:undefined);
  const [error,setError]=useState('');
  const [fetching,setFetching]=useState(false);
  const fetcherRef=useRef(fetcher);fetcherRef.current=fetcher;
  const seq=useRef(0),lastKey=useRef(key);
  const reload=useCallback(async()=>{
    if(!key)return;
    const id=++seq.current;
    setFetching(true);
    try{
      const result=await fetcherRef.current();
      if(id===seq.current){cache.set(key,result);setData(result);setError('')}
    }catch(e){if(id===seq.current)setError(explain(e))}
    finally{if(id===seq.current)setFetching(false)}
  },[key]);
  useEffect(()=>{
    if(lastKey.current!==key){lastKey.current=key;setData(key?cache.get(key) as T|undefined:undefined);setError('')}
    void reload();
  },[key,reload,revision]);
  /** Apply a confirmed server result locally; an older in-flight read must not overwrite it. */
  const mutate=useCallback((update:(current:T)=>T)=>{
    seq.current++;setFetching(false);
    setData(current=>{
      if(current===undefined)return current;
      const next=update(current);
      if(key)cache.set(key,next);
      return next;
    });
  },[key]);
  return {data,error,loading:fetching&&data===undefined,refreshing:fetching&&data!==undefined,reload,mutate};
}
