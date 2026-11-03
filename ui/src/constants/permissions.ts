import type{Role,Status} from '../types/domain';
/** Mirrors the API's require() rules so the UI only offers permitted actions; the server re-validates every call. */
export const ACTION_ROLES:Record<string,Role[]>={
  'outside-arrival':['gate','manager'],'check-in':['gate','manager'],ready:['supervisor','coordinator','manager'],
  hold:['supervisor','coordinator','manager'],assign:['supervisor','manager'],start:['supervisor','manager'],
  pause:['supervisor','manager'],resume:['supervisor','manager'],finish:['supervisor','manager'],
  'release-dock':['supervisor','manager'],clearance:['coordinator','gate','manager'],depart:['gate','manager'],
  cancel:['coordinator','manager'],reschedule:['coordinator','manager'],create:['coordinator','manager'],walkin:['gate','manager'],
  readiness:['coordinator','supervisor','manager'],issue:['coordinator','supervisor','manager'],escalate:['manager'],
};
export const can=(role:Role,action:string)=>!!ACTION_ROLES[action]?.includes(role);
/** Toast wording for each completed transition, e.g. "TN 09 AB 1234 checked in". */
export const ACTION_DONE:Record<string,string>={
  'outside-arrival':'outside-gate arrival recorded','check-in':'checked in',ready:'marked ready for dock',hold:'placed on hold',
  assign:'assigned to dock',start:'service started',pause:'service paused',resume:'service resumed',finish:'service completed',
  'release-dock':'dock released',clearance:'exit clearance confirmed',depart:'departed the site',cancel:'appointment cancelled',
};
/** Transitions whose only precondition is the current status are shown optimistically. */
export const OPTIMISTIC:Record<string,Status>={'check-in':'checked_in',finish:'completed',pause:'paused',hold:'on_hold'};
/** One-click next steps that need no extra input; anything needing a reason or a dock opens the truck drawer. */
const QUICK:Partial<Record<Status,{action:string;label:string}>>={
  scheduled:{action:'check-in',label:'Check in'},at_dock:{action:'start',label:'Start service'},
  loading:{action:'finish',label:'Complete'},paused:{action:'resume',label:'Resume'},
};
export function quickAction(status:Status,role:Role){
  const q=QUICK[status];
  return q&&can(role,q.action)?q:null;
}
