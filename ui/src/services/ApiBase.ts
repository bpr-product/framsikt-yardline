import axios from 'axios';
export const api=axios.create({baseURL:(import.meta.env.VITE_API_BASE_URL || '')+'/api/v1',timeout:15000});
export const UNAUTHORIZED_EVENT='yardline:unauthorized';
api.interceptors.request.use(cfg=>{const token=sessionStorage.getItem('yardline_token');if(token)cfg.headers.Authorization=`Bearer ${token}`;return cfg});
// An expired session ends the workspace once, centrally, instead of every screen showing its own 401.
api.interceptors.response.use(r=>r,error=>{
  if(axios.isAxiosError(error)&&error.response?.status===401&&!error.config?.url?.includes('/auth/login'))window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  return Promise.reject(error);
});
export function explain(error:unknown):string {
 if(axios.isAxiosError(error)){
  const d=error.response?.data?.detail;if(typeof d==='string')return d;if(Array.isArray(d))return d.map(v=>v.msg).join('; ');
  if(error.response?.status===401)return 'Session expired. Please sign in again.';
  if(error.code==='ECONNABORTED')return 'The server took too long to respond. Check the connection and try again.';
  if(!error.response)return 'Cannot reach the server. Check the connection and try again.';
  return error.message;
 }
 return 'Something went wrong. Please try again.';
}
