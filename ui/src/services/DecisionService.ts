import {api} from './ApiBase';
import type{Visit,VisitCreate} from '../types/domain';
import type{Analytics,Decision,Diagnosis,Issue,IssueType,Planning,Readiness,IssueCode} from '../types/decisions';
export const DecisionService={
  recommendations:async()=> (await api.get<{recommendations:Decision[];data_status:string}>('/decisions')).data,
  issues:async(status:'open'|'resolved'|'all'='open')=>(await api.get<Issue[]>('/issues',{params:{status}})).data,
  issueTypes:async()=>(await api.get<IssueType[]>('/issue-types')).data,
  createIssue:async(visitId:string,payload:{code:IssueCode;description:string;owner:string;severity:string;blocking:boolean})=>(await api.post<Issue>(`/visits/${visitId}/issues`,payload)).data,
  resolveIssue:async(id:string,resolution:string)=>(await api.post<Issue>(`/issues/${id}/resolve`,{resolution})).data,
  escalateIssue:async(id:string)=>(await api.post<Issue>(`/issues/${id}/escalate`,{})).data,
  readiness:async(id:string)=>(await api.get<Readiness>(`/visits/${id}/readiness`)).data,
  setReadiness:async(id:string,code:string,done:boolean)=>(await api.post<Readiness>(`/visits/${id}/readiness/${code}`,{done})).data,
  diagnosis:async(id:string)=>(await api.get<Diagnosis>(`/visits/${id}/diagnosis`)).data,
  analytics:async()=>(await api.get<Analytics>('/analytics/overview')).data,
  slots:async(day:string,direction:string)=>(await api.get<Planning>('/planning/slots',{params:{day,direction}})).data,
  reschedule:async(id:string,scheduled_at:string,reason:string)=>(await api.post<Visit>(`/visits/${id}/reschedule`,{scheduled_at,reason})).data,
  walkin:async(p:VisitCreate)=>(await api.post<Visit>('/visits/walk-in',{...p,scheduled_at:null})).data,
  externalArrival:async(id:string)=>(await api.post<Visit>(`/visits/${id}/outside-arrival`,{})).data,
};
