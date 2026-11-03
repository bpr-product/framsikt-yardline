// Site operates in Asia/Kolkata; formats follow the existing en-IN operator conventions.
const LOCALE='en-IN';
export const dateTime=(value:string|null)=>value?new Date(value).toLocaleString(LOCALE,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
export const time=(value:string|null)=>value?new Date(value).toLocaleTimeString(LOCALE,{hour:'2-digit',minute:'2-digit'}):'—';
export const duration=(mins:number|null|undefined)=>mins==null?'—':mins<60?`${Math.round(mins)} min`:`${Math.floor(mins/60)}h ${Math.round(mins%60)}m`;
export const minutesSince=(value:string|null,now=Date.now())=>value?Math.max(0,(now-new Date(value).getTime())/60000):null;
export const siteToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
export const isSiteToday=(value:string|null)=>!!value&&new Date(value).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})===siteToday();
export function shiftDay(day:string,by:number){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+by);return d.toISOString().slice(0,10)}
