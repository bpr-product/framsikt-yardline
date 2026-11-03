import {useState,type FormEvent} from 'react';
import {ArrowRight,Check,ClipboardCheck,ShieldCheck,Truck,Warehouse} from 'lucide-react';
import {OperationsService} from '../../services/OperationsService';
import {explain} from '../../services/ApiBase';
import {DEMO_USERS,ROLE_NAMES,initials} from '../../constants/labels';
import {Spinner} from '../../components/common/Feedback';
import type{Role,User} from '../../types/domain';

const POINTS=[
  {icon:Truck,title:'Gate to departure',text:'Check-in, docks and exit clearance in one flow.'},
  {icon:ClipboardCheck,title:'Ready before arrival',text:'Goods, documents and crew confirmed up front.'},
  {icon:ShieldCheck,title:'Every action recorded',text:'Owners, reasons and timestamps for each decision.'},
];

export function LoginPage({onLogin,notice}:{onLogin:(user:User)=>void;notice?:string}){
  const [role,setRole]=useState<Role>('manager'),[pin,setPin]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await OperationsService.login(DEMO_USERS[role],pin);
      sessionStorage.setItem('yardline_token',r.token);sessionStorage.setItem('yardline_user',JSON.stringify(r.user));
      onLogin({name:r.user.name,role:r.user.role as Role});
    }catch(err){setError(explain(err))}finally{setBusy(false)}
  };
  return <div className="login">
    <aside className="login-aside">
      <div className="brand"><span className="brand-mark"><Warehouse size={16}/></span><span className="brand-name"><b>Yardline</b><small>Factory operations</small></span></div>
      <div className="login-pitch">
        <h1>Every truck, every dock, one calm workspace.</h1>
        <ul>{POINTS.map(p=><li key={p.title}><span className="icon-chip"><p.icon size={16}/></span><span><b>{p.title}</b><small>{p.text}</small></span></li>)}</ul>
      </div>
      <p className="login-foot">Pilot environment · synthetic data · not a live factory deployment</p>
    </aside>
    <main className="login-main">
      <form className="login-form" onSubmit={submit}>
        <div><h2>Sign in</h2><p className="muted">Choose your team role to open its workspace.</p></div>
        {notice&&!error&&<div className="notice notice-amber">{notice}</div>}
        <fieldset className="roles"><legend>Team member</legend>
          {(Object.keys(ROLE_NAMES) as Role[]).map(r=><label key={r} className={`role${role===r?' is-active':''}`}>
            <input type="radio" name="role" value={r} checked={role===r} onChange={()=>setRole(r)}/>
            <span className="avatar">{initials(DEMO_USERS[r])}</span>
            <span className="grow"><b>{DEMO_USERS[r]}</b><small>{ROLE_NAMES[r]}</small></span>
            <span className="role-check">{role===r&&<Check size={13} strokeWidth={3}/>}</span>
          </label>)}
        </fieldset>
        <label>Access PIN<input type="password" autoComplete="off" value={pin} onChange={e=>setPin(e.target.value)} required placeholder="Enter the pilot PIN"/></label>
        {error&&<div className="notice notice-red" role="alert">{error}</div>}
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy?<Spinner/>:null}{busy?'Signing in…':'Continue'}{!busy&&<ArrowRight size={16}/>}</button>
      </form>
    </main>
  </div>;
}
