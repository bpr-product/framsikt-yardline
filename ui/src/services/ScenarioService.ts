import {api} from './ApiBase';
import type {ScenarioPreset,ScenarioState,ScenarioDecision} from '../types/scenarios';

/** Read-only planning simulation. Calls never update actual trucks or Neon records. */
export const ScenarioService={
  catalogue:async()=>(await api.get<{scenarios:ScenarioPreset[];data_type:string;writes_to_database:boolean}>('/scenarios')).data,
  evaluate:async(scenario_id:string,state:ScenarioState)=>(await api.post<ScenarioDecision>('/scenarios/evaluate',{scenario_id,state})).data,
};
