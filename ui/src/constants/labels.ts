import type{Role,Status} from '../types/domain';
export const ROLE_NAMES:Record<Role,string>={coordinator:'Logistics Coordinator',gate:'Gate Operator',supervisor:'Dock Supervisor',manager:'Factory Manager'};
// Demo identities issued by the pilot authentication service (synthetic people).
export const DEMO_USERS:Record<Role,string>={coordinator:'Maya Chen',gate:'Alex Rivera',supervisor:'Sam Okafor',manager:'Priya Shah'};
export const STATUS_NAMES:Record<Status,string>={scheduled:'Scheduled',checked_in:'Checked in',ready:'Ready for dock',on_hold:'On hold',at_dock:'At dock',loading:'In service',paused:'Service paused',completed:'Service complete',departed:'Departed',cancelled:'Cancelled'};
export const STATUS_TONE:Record<Status,string>={scheduled:'neutral',checked_in:'blue',ready:'green',on_hold:'red',at_dock:'violet',loading:'amber',paused:'orange',completed:'teal',departed:'neutral',cancelled:'muted'};
export const ACTIVE_STATUSES:Status[]=['checked_in','ready','on_hold','at_dock','loading','paused','completed'];
export const CLOSED_STATUSES:Status[]=['departed','cancelled'];
export const SEVERITY_TONE:Record<string,string>={critical:'red',high:'orange',medium:'amber',low:'neutral'};
export const initials=(name:string)=>name.split(' ').map(p=>p[0]).join('');
/** goods_not_ready -> "Goods not ready" */
export const humanize=(code:string)=>{const t=code.replaceAll('_',' ');return t.charAt(0).toUpperCase()+t.slice(1)};
