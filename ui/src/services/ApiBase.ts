import axios from 'axios';
export const api=axios.create({baseURL:(import.meta.env.VITE_API_BASE_URL || '')+'/api/v1',timeout:15000});
api.interceptors.request.use(cfg=>{const token=sessionStorage.getItem('yardline_token');if(token)cfg.headers.Authorization=`Bearer ${token}`;return cfg});
export function explain(error:unknown):string {
 if(axios.isAxiosError(error)){const d=error.response?.data?.detail;if(typeof d==='string')return d;if(Array.isArray(d))return d.map(v=>v.msg).join('; ');return error.response?.status===401?'Session expired. Please sign in again.':error.message}
 return 'Something went wrong. Please try again.';
}
