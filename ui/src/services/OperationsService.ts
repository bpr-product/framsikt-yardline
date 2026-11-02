import {api} from './ApiBase';
import type{Visit,VisitCreate,Dock,Metrics,VisitDetail} from '../types/domain';
export const OperationsService={
 visits:async()=> (await api.get<Visit[]>('/visits')).data,
 docks:async()=> (await api.get<Dock[]>('/docks')).data,
 metrics:async()=> (await api.get<Metrics>('/metrics')).data,
 visit:async(id:string)=> (await api.get<VisitDetail>(`/visits/${id}`)).data,
 create:async(data:VisitCreate)=> (await api.post<Visit>('/visits',data)).data,
 action:async(id:string,action:string,payload?:object)=> (await api.post<Visit>(`/visits/${id}/${action}`,payload??{})).data,
 login:async(name:string,pin:string)=> (await api.post<{token:string;user:{name:string;role:string}}>('/auth/login',{name,pin})).data,
};
