import type{ReactNode} from 'react';
/** Section container: every block on a screen gets a title, an optional one-line purpose, and its controls on the right. */
export function Card({title,subtitle,actions,children,footer,flush,className}:{title?:ReactNode;subtitle?:string;actions?:ReactNode;children:ReactNode;footer?:ReactNode;flush?:boolean;className?:string}){
  return <section className={`card${flush?' is-flush':''}${className?' '+className:''}`}>
    {(title||actions)&&<header className="card-head">
      {/* A string is a heading; a node (tabs, filters) is a toolbar that takes the title slot. */}
      {title&&(typeof title==='string'?<div className="card-title"><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>:<div className="card-title is-toolbar">{title}</div>)}
      {actions&&<div className="card-actions">{actions}</div>}
    </header>}
    <div className="card-body">{children}</div>
    {footer&&<footer className="card-foot">{footer}</footer>}
  </section>;
}
