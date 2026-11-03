export interface Segment<T extends string>{value:T;label:string;count?:number}
/** Filter or view switch; counts make the choice informative before it is clicked. */
export function Segmented<T extends string>({value,options,onChange,label}:{value:T;options:Segment<T>[];onChange:(v:T)=>void;label:string}){
  return <div className="segmented" role="tablist" aria-label={label}>{options.map(o=><button key={o.value} type="button" role="tab" aria-selected={value===o.value} className={value===o.value?'is-active':''} onClick={()=>onChange(o.value)}>
    {o.label}{o.count!=null&&<span className="count">{o.count}</span>}
  </button>)}</div>;
}
