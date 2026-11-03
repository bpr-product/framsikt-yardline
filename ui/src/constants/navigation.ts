import type{LucideIcon} from 'lucide-react';
import {Activity,CalendarDays,ClipboardCheck,ClipboardList,LayoutDashboard,ShieldAlert,Truck,Warehouse} from 'lucide-react';
export interface NavItem{path:string;label:string;icon:LucideIcon;hint:string}
export const NAV:{group:string;items:NavItem[]}[]=[
  {group:'Operate',items:[
    {path:'/command',label:'Command center',icon:LayoutDashboard,hint:'Prioritized actions across the site'},
    {path:'/gate',label:'Gate',icon:Truck,hint:'Expected arrivals, trucks on site and departures'},
    {path:'/docks',label:'Docks',icon:Warehouse,hint:'Bay occupancy and the ready-for-dock queue'},
    {path:'/readiness',label:'Readiness',icon:ClipboardCheck,hint:'Prerequisites before a truck is sent to a dock'},
    {path:'/problems',label:'Problem desk',icon:ShieldAlert,hint:'Open blockers with owners and resolutions'},
  ]},
  {group:'Plan & review',items:[
    {path:'/appointments',label:'Appointments',icon:ClipboardList,hint:'Every booking and visit, searchable'},
    {path:'/capacity',label:'Capacity planner',icon:CalendarDays,hint:'Book against available dock hours'},
    {path:'/analysis',label:'Analysis',icon:Activity,hint:'Turnaround, long tail and blocker categories'},
  ]},
];
export const NAV_ITEMS=NAV.flatMap(g=>g.items);
