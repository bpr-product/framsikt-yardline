import type{ReactNode} from 'react';
import {Spinner} from './Feedback';
/** Screen title, a one-line purpose, and the screen's primary actions. */
export function PageHeader({title,subtitle,busy,children}:{title:string;subtitle?:string;busy?:boolean;children?:ReactNode}){
  return <header className="page-header">
    <div className="page-title"><h1>{title}{busy&&<span className="updating"><Spinner size={12}/>Updating</span>}</h1>{subtitle&&<p>{subtitle}</p>}</div>
    {children&&<div className="page-actions">{children}</div>}
  </header>;
}
