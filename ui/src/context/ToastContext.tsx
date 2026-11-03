import {createContext,useCallback,useContext,useMemo,useRef,useState,type ReactNode} from 'react';
import {AlertCircle,CheckCircle2,Info,X} from 'lucide-react';

type Tone='success'|'error'|'info';
interface Toast{id:number;tone:Tone;message:string}
interface ToastApi{success:(message:string)=>void;error:(message:string)=>void;info:(message:string)=>void}

const ToastContext=createContext<ToastApi|null>(null);
const LIFETIME:Record<Tone,number>={success:3500,info:4000,error:7000};
const ICON={success:CheckCircle2,error:AlertCircle,info:Info};

export function ToastProvider({children}:{children:ReactNode}){
  const [toasts,setToasts]=useState<Toast[]>([]);
  const next=useRef(0);
  const dismiss=useCallback((id:number)=>setToasts(list=>list.filter(t=>t.id!==id)),[]);
  const push=useCallback((tone:Tone,message:string)=>{
    const id=++next.current;
    // Keep the stack short; the newest result is what the operator needs.
    setToasts(list=>[...list.filter(t=>t.message!==message).slice(-3),{id,tone,message}]);
    window.setTimeout(()=>dismiss(id),LIFETIME[tone]);
  },[dismiss]);
  const api=useMemo<ToastApi>(()=>({success:m=>push('success',m),error:m=>push('error',m),info:m=>push('info',m)}),[push]);
  return <ToastContext.Provider value={api}>
    {children}
    <div className="toast-stack" aria-live="polite">
      {toasts.map(t=>{const Icon=ICON[t.tone];return <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone==='error'?'alert':'status'}>
        <Icon size={16}/><span>{t.message}</span>
        <button className="icon-btn ghost" aria-label="Dismiss notification" onClick={()=>dismiss(t.id)}><X size={14}/></button>
      </div>})}
    </div>
  </ToastContext.Provider>;
}

export function useToast(){
  const api=useContext(ToastContext);
  if(!api)throw new Error('useToast must be used inside ToastProvider');
  return api;
}
