export interface ScenarioState {
  late_by_min:number; booked_slot_reused:boolean; dock_busy_for_min:number;
  queue_ahead:number;service_min:number;shift_left_min:number;next_shift_in_min:number;
  urgent:boolean;priority_approved:boolean;overtime_approved:boolean;
  goods_ready:boolean;goods_ready_in_min:number;documents_ready:boolean;documents_ready_in_min:number;
  crew_ready:boolean;crew_ready_in_min:number;equipment_ready:boolean;equipment_ready_in_min:number;
  dock_operational:boolean;dock_repair_in_min:number;compatible_dock:boolean;alternate_dock_available:boolean;
  gate_cleared:boolean;gate_clear_in_min:number;yard_space:boolean;yard_space_in_min:number;
  walk_in:boolean;loading_complete:boolean;physically_left_dock:boolean;exit_cleared:boolean;
}
export interface ScenarioPreset {
  id:string;title:string;category:string;code:string;question:string;hypothesis:string;state:ScenarioState;
}
export interface ScenarioAction {id:string;label:string;changes:Partial<ScenarioState>}
export interface ScenarioFlag {code:string;title:string;reason:string;owner:string;delay_min:number;action:ScenarioAction|null}
export interface ScenarioDecision {
  scenario_id:string;status:'blocked'|'at_risk'|'eligible'|'approval_required'|'exit_blocked'|'cleared_to_depart';
  headline:string;earliest_start_min:number|null;estimated_delay_min:number|null;
  estimated_finish_min:number|null;queue_position:number;flags:ScenarioFlag[];
  decision_trace:string[];recommended_owner:string;recommended_action:string;
  outcome:string;messages:string[];assumptions:string[];
}
