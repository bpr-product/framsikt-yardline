export type IssueCode='goods_not_ready'|'documents_missing'|'dock_unavailable'|'crew_unavailable'|'equipment_breakdown'|'quality_discrepancy'|'gate_verification'|'driver_unavailable'|'clearance_pending'|'other';
export interface Issue {id:string;visit_id:string;truck_plate?:string;visit_status?:string;code:IssueCode;category:string;description:string;owner:string;severity:'low'|'medium'|'high'|'critical';blocking:boolean;status:'open'|'escalated'|'resolved';opened_at:string;resolved_at:string|null;escalated_at:string|null;resolution_note:string|null}
export interface Check {id:string;visit_id:string;code:string;label:string;required:boolean;done:boolean;confirmed_at:string|null;confirmed_by:string|null}
export interface Readiness {visit_id:string;direction:'inbound'|'outbound';ready:boolean;checks:Check[]}
export interface Decision {id:string;visit_id:string;truck_plate:string;direction:'inbound'|'outbound';kind:string;priority:number;title:string;reason:string;owner:string;action:string|null;status:string;evidence:Record<string,unknown>}
export interface Segment {label:string;minutes:number;kind:'waiting'|'service';from:string;to:string}
export interface Diagnosis {visit_id:string;truck_plate:string;status:string;source:string;total_dwell_min:number|null;measured_segments_min:number;waiting_min:number;service_min:number;segments:Segment[];issues:(Issue&{duration_min:number})[];complete:boolean;explanation:string}
export interface PlannerSlot {start_at:string;booked:number;capacity:number;available:boolean;reason:string}
export interface Planning {day:string;direction:string;timezone:string;policy:string;slots:PlannerSlot[]}
export interface Analytics {sample_size:number;active_trucks:number;p50_min:number|null;p90_min:number|null;p95_min:number|null;mean_min:number|null;issue_open:number;issue_resolved:number;mean_issue_resolution_min:number|null;top_reasons:{code:string;count:number}[];cohorts:Record<string,{n:number;p50_min:number|null;p90_min:number|null}>;evidence:string;cost:string}
export interface IssueType {code:IssueCode;label:string;category:string;default_owner:string}
