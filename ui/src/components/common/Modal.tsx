import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
/** Accessible dialog: Escape and backdrop close it, focus moves inside on open and returns on close. */
export function Modal({title,subtitle,onClose,children,footer,width=520}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;footer?:ReactNode;width?:number}){
  const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
  // Runs once per open: re-running on each parent render would steal focus from the field being typed in.
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close.current()};
    window.addEventListener('keydown',onKey);
    return ()=>{window.removeEventListener('keydown',onKey);previous?.focus()};
  },[]);
  return <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={{maxWidth:width}} ref={ref}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={16}/></button></div>
      <div className="modal-body">{children}</div>
      {footer&&<div className="modal-foot">{footer}</div>}
    </div>
  </div>;
}
