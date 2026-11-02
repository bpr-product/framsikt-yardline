export type Role='coordinator'|'gate'|'supervisor'|'manager';
export type Status='scheduled'|'checked_in'|'ready'|'on_hold'|'at_dock'|'loading'|'completed'|'departed';
export interface Visit {id:string;truck_plate:string;driver:string;company:string;direction:'inbound'|'outbound';cargo:string;scheduled_at:string|null;arrival_at:string|null;ready_at:string|null;service_started_at:string|null;service_finished_at:string|null;departed_at:string|null;created_at:string;status:Status;hold_reason:string|null;dock:string|null;version:number}
export interface Dock{id:string;code:string;direction:string;enabled:boolean;visit_id:string|null}
export interface Metrics{scheduled:number;on_site:number;on_hold:number;ready:number;occupied_docks:number;completed:number;avg_turnaround_min:number|null;longest_turnaround_min:number|null}
export interface Event{id:string;actor:string;action:string;note:string|null;at:string}
export interface VisitDetail{visit:Visit;events:Event[]}
export interface VisitCreate{truck_plate:string;driver:string;company:string;direction:'inbound'|'outbound';cargo:string;scheduled_at:string|null}
