import type{ReactNode} from 'react';
import type{LucideIcon} from 'lucide-react';
import {ArrowUpRight} from 'lucide-react';

/** A headline number. Tone colors the icon chip only; the value stays in text ink so color never carries meaning alone. */
export interface Stat{label:string;value:ReactNode;hint?:string;icon:LucideIcon;tone?:string;onClick?:()=>void}

export function StatCards({items}:{items:Stat[]}){
  return <div className="stats">{items.map(s=>{
    const body=<>
      <span className="stat-top"><span className={`icon-chip tone-${s.tone??'neutral'}`}><s.icon size={16}/></span><span className="stat-label">{s.label}</span>{s.onClick&&<ArrowUpRight size={15} className="stat-go"/>}</span>
      <span className="stat-value">{s.value}</span>
      {s.hint&&<span className="stat-hint">{s.hint}</span>}
    </>;
    return s.onClick?<button key={s.label} type="button" className="stat is-link" onClick={s.onClick}>{body}</button>:<div key={s.label} className="stat">{body}</div>;
  })}</div>;
}
