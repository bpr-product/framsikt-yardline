import {AlertCircle,Inbox,Loader2,RotateCw} from 'lucide-react';
import type{ReactNode} from 'react';
import type{LucideIcon} from 'lucide-react';
export function Spinner({size=14,label}:{size?:number;label?:string}){
  return <Loader2 size={size} className="spin" aria-label={label} role={label?'status':undefined}/>;
}
/** Placeholder rows shaped like the content they replace, so layout does not jump when data arrives. */
export function SkeletonRows({rows=5,cols=5}:{rows?:number;cols?:number}){
  return <div className="skeleton-table" aria-busy="true" aria-label="Loading">
    {Array.from({length:rows},(_,r)=><div className="skeleton-row" key={r}>
      <span className="skeleton circle"/>
      {Array.from({length:Math.max(1,cols-1)},(_,c)=><span key={c} className="skeleton" style={{maxWidth:`${c===0?180:60+((r*7+c*13)%60)}px`}}/>)}
    </div>)}
  </div>;
}
export function SkeletonBlock({height=72}:{height?:number}){return <div className="skeleton block" style={{height}} aria-hidden="true"/>}
export function EmptyState({title,detail,action,icon:Icon=Inbox}:{title:string;detail?:string;action?:ReactNode;icon?:LucideIcon}){
  return <div className="empty"><span className="empty-icon"><Icon size={18}/></span><b>{title}</b>{detail&&<p>{detail}</p>}{action}</div>;
}
export function ErrorState({message,onRetry}:{message:string;onRetry?:()=>void}){
  return <div className="inline-error" role="alert"><AlertCircle size={16}/><span>{message}</span>{onRetry&&<button className="btn btn-sm" onClick={onRetry}><RotateCw size={13}/>Retry</button>}</div>;
}
