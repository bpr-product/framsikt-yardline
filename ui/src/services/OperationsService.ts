import {api} from './ApiBase';
import type{Board,Visit,VisitCreate,VisitDetail} from '../types/domain';
export const OperationsService={
 board:async()=> (await api.get<Board>('/board')).data,
 visit:async(id:string)=> (await api.get<VisitDetail>(`/visits/${id}`)).data,
 create:async(data:VisitCreate)=> (await api.post<Visit>('/visits',data)).data,
 action:async(id:string,action:string,payload?:object)=> (await api.post<Visit>(`/visits/${id}/${action}`,payload??{})).data,
 login:async(name:string,pin:string)=> (await api.post<{token:string;user:{name:string;role:string}}>('/auth/login',{name,pin})).data,
};
