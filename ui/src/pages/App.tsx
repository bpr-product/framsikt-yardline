import {useCallback,useEffect,useState} from 'react';
import {Navigate,Route,Routes} from 'react-router-dom';
import {UNAUTHORIZED_EVENT} from '../services/ApiBase';
import {clearQueryCache} from '../hooks/useQuery';
import {ToastProvider} from '../context/ToastContext';
import {WorkspaceProvider} from '../context/WorkspaceContext';
import {AppShell} from '../layouts/AppShell';
import {LoginPage} from './Login/LoginPage';
import {CommandCenterPage} from './CommandCenter/CommandCenterPage';
import {GatePage} from './Gate/GatePage';
import {DocksPage} from './Docks/DocksPage';
import {ReadinessPage} from './Readiness/ReadinessPage';
import {ProblemDeskPage} from './Problems/ProblemDeskPage';
import {AppointmentsPage} from './Appointments/AppointmentsPage';
import {CapacityPage} from './Capacity/CapacityPage';
import {AnalysisPage} from './Analysis/AnalysisPage';
import {DemoSandboxPage} from './Demo/DemoSandboxPage';
import type{User} from '../types/domain';

const storedUser=():User|null=>{try{return JSON.parse(sessionStorage.getItem('yardline_user')||'null')}catch{return null}};

export default function App(){
  const [user,setUser]=useState<User|null>(storedUser);
  const [notice,setNotice]=useState('');
  const signOut=useCallback((message='')=>{sessionStorage.clear();clearQueryCache();setNotice(message);setUser(null)},[]);
  useEffect(()=>{
    const expired=()=>signOut('Your session expired. Sign in again to continue.');
    window.addEventListener(UNAUTHORIZED_EVENT,expired);
    return ()=>window.removeEventListener(UNAUTHORIZED_EVENT,expired);
  },[signOut]);
  return <ToastProvider>
    {!user?<LoginPage notice={notice} onLogin={u=>{setNotice('');setUser(u)}}/>:
    <WorkspaceProvider user={user} signOut={()=>signOut()}>
      <Routes>
        <Route element={<AppShell/>}>
          <Route path="/command" element={<CommandCenterPage/>}/>
          <Route path="/gate" element={<GatePage/>}/>
          <Route path="/docks" element={<DocksPage/>}/>
          <Route path="/readiness" element={<ReadinessPage/>}/>
          <Route path="/problems" element={<ProblemDeskPage/>}/>
          <Route path="/appointments" element={<AppointmentsPage/>}/>
          <Route path="/capacity" element={<CapacityPage/>}/>
          <Route path="/analysis" element={<AnalysisPage/>}/>
          <Route path="/demo" element={<DemoSandboxPage/>}/>
          <Route path="/scenario-lab" element={<Navigate to="/demo" replace/>}/>
          <Route path="*" element={<Navigate to="/command" replace/>}/>
        </Route>
      </Routes>
    </WorkspaceProvider>}
  </ToastProvider>;
}
