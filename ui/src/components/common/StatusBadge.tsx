import type{ReactNode} from 'react';
import {STATUS_NAMES,STATUS_TONE} from '../../constants/labels';
import type{Status} from '../../types/domain';
export function StatusBadge({status,pending}:{status:Status;pending?:boolean}){
  return <span className={`badge tone-${STATUS_TONE[status]}${pending?' is-pending':''}`}><span className="badge-dot"/>{STATUS_NAMES[status]}</span>;
}
export function Pill({tone='neutral',caps,children}:{tone?:string;caps?:boolean;children:ReactNode}){
  return <span className={`pill tone-${tone}${caps?' caps':''}`}>{children}</span>;
}
