import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {NavLink,Outlet,useLocation,useNavigate,useOutletContext} from 'react-router-dom';
import {AlertTriangle,Bell,LogOut,Menu,RotateCw,Search,Warehouse,X} from 'lucide-react';
import {useWorkspace} from '../context/WorkspaceContext';
import {NAV,NAV_ITEMS} from '../constants/navigation';
import {ROLE_NAMES,initials} from '../constants/labels';
import {VisitDrawer} from '../components/visits/VisitDrawer';
import {VisitFormModal,type VisitFormIntent} from '../components/visits/VisitFormModal';
import {StatusBadge} from '../components/common/StatusBadge';
import {Spinner} from '../components/common/Feedback';
import {time} from '../utils/format';

interface ShellContext{openForm:(intent:VisitFormIntent)=>void}
export const useShell=()=>useOutletContext<ShellContext>();

export function AppShell(){
  const {user,signOut,board,refreshing,error,updatedAt,refresh}=useWorkspace();
  const location=useLocation();
  const [menu,setMenu]=useState(false),[form,setForm]=useState<VisitFormIntent|null>(null);
  const current=NAV_ITEMS.find(n=>location.pathname.startsWith(n.path));
  const counts:Record<string,number>={'/docks':board.metrics.ready,'/problems':board.metrics.on_hold};
  const openForm=useCallback((intent:VisitFormIntent)=>setForm(intent),[]);
  const outlet=useMemo<ShellContext>(()=>({openForm}),[openForm]);
  useEffect(()=>setMenu(false),[location.pathname]);

  return <div className="shell">
    <aside className={`sidebar${menu?' is-open':''}`}>
      <div className="brand"><span className="brand-mark"><Warehouse size={16}/></span><span className="brand-name"><b>Yardline</b><small>Plant 01 · Operations</small></span>
        <button className="icon-btn ghost mobile-only" aria-label="Close menu" onClick={()=>setMenu(false)}><X size={16}/></button></div>
      <nav className="nav">{NAV.map(g=><div className="nav-group" key={g.group}>
        <div className="nav-label">{g.group}</div>
        {g.items.map(item=><NavLink key={item.path} to={item.path} title={item.hint} className={({isActive})=>`nav-item${isActive?' is-active':''}`}>
          <item.icon size={17}/><span>{item.label}</span>{!!counts[item.path]&&<span className="nav-count">{counts[item.path]}</span>}
        </NavLink>)}
      </div>)}</nav>
      <div className="sidebar-foot">
        <div className="user-chip"><span className="avatar">{initials(user.name)}</span><span><b>{user.name}</b><small>{ROLE_NAMES[user.role]}</small></span>
          <button className="icon-btn ghost" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={15}/></button></div>
        <p className="pilot-note"><span className="live-dot"/>Pilot workspace · synthetic data</p>
      </div>
    </aside>
    {menu&&<div className="sidebar-scrim" onClick={()=>setMenu(false)}/>}
    <div className="main">
      <header className="topbar">
        <button className="icon-btn mobile-only" aria-label="Open menu" onClick={()=>setMenu(true)}><Menu size={18}/></button>
        <div className="crumb">Plant 01 <span>/</span> <b>{current?.label??'Workspace'}</b></div>
        <QuickFind/>
        <div className="topbar-right">
          <SyncStatus refreshing={refreshing} error={error} updatedAt={updatedAt} onRefresh={()=>void refresh()}/>
          <NavLink to="/problems" className="icon-btn" title={`${board.metrics.on_hold} truck(s) on hold`} aria-label="Trucks on hold"><Bell size={17}/>{board.metrics.on_hold>0&&<span className="dot-badge">{board.metrics.on_hold}</span>}</NavLink>
        </div>
      </header>
      <main className="content"><Outlet context={outlet}/></main>
    </div>
    <VisitDrawer/>
    {form&&<VisitFormModal intent={form} onClose={()=>setForm(null)}/>}
  </div>;
}

/** Always tells the operator whether what they see is current, updating, or stale. */
function SyncStatus({refreshing,error,updatedAt,onRefresh}:{refreshing:boolean;error:string;updatedAt:Date|null;onRefresh:()=>void}){
  return <button className={`sync${error?' is-error':''}`} onClick={onRefresh} disabled={refreshing} title={error||'Refresh now'}>
    {refreshing?<Spinner size={13}/>:error?<AlertTriangle size={13}/>:<RotateCw size={13}/>}
    <span>{refreshing?'Syncing…':error?'Offline — retry':updatedAt?`Updated ${time(updatedAt.toISOString())}`:'Loading…'}</span>
  </button>;
}

/** Find any truck by plate, carrier or driver and open it directly. Press "/" to focus. */
function QuickFind(){
  const {board,openVisit}=useWorkspace();
  const navigate=useNavigate();
  const [q,setQ]=useState(''),[open,setOpen]=useState(false),[active,setActive]=useState(0);
  const input=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const typing=(e.target as HTMLElement)?.closest('input,textarea,select');
      if(e.key==='/'&&!typing){e.preventDefault();input.current?.focus()}
    };
    window.addEventListener('keydown',onKey);return ()=>window.removeEventListener('keydown',onKey);
  },[]);
  const results=useMemo(()=>{
    const term=q.trim().toLowerCase();
    if(!term)return [];
    return board.visits.filter(v=>`${v.truck_plate} ${v.company} ${v.driver}`.toLowerCase().includes(term)).slice(0,8);
  },[q,board.visits]);
  const choose=(id:string)=>{setQ('');setOpen(false);input.current?.blur();openVisit(id)};
  return <div className="quickfind">
    <Search size={14}/>
    <input ref={input} value={q} placeholder="Find truck, carrier or driver" aria-label="Find a truck"
      onChange={e=>{setQ(e.target.value);setOpen(true);setActive(0)}} onFocus={()=>setOpen(true)} onBlur={()=>window.setTimeout(()=>setOpen(false),120)}
      onKeyDown={e=>{
        if(e.key==='ArrowDown'){e.preventDefault();setActive(a=>Math.min(a+1,results.length-1))}
        if(e.key==='ArrowUp'){e.preventDefault();setActive(a=>Math.max(a-1,0))}
        if(e.key==='Enter'&&results[active])choose(results[active].id);
        if(e.key==='Enter'&&!results.length&&q.trim())navigate('/appointments?q='+encodeURIComponent(q.trim()));
        if(e.key==='Escape'){setQ('');input.current?.blur()}
      }}/>
    <kbd>/</kbd>
    {open&&q.trim()&&<div className="quickfind-menu" role="listbox">
      {results.length?results.map((v,i)=><button key={v.id} role="option" aria-selected={i===active} className={i===active?'is-active':''} onMouseDown={e=>{e.preventDefault();choose(v.id)}}>
        <b>{v.truck_plate}</b><span>{v.company}</span><StatusBadge status={v.status}/>
      </button>):<div className="quickfind-empty">No truck matches “{q.trim()}”</div>}
    </div>}
  </div>;
}
