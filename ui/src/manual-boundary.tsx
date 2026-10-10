import {Component,useLayoutEffect,useState,useRef,type ReactNode} from 'react'
import {flushSync} from '@opentui/react'
import {App} from './app'
import type {makeClient} from './client'
import type {ViewSession} from './view-session'
import type * as Atoms from './state'
export type View=typeof App
class Guard extends Component<{children:ReactNode;failed:(error:Error)=>void},{broken:boolean}>{state={broken:false};static getDerivedStateFromError(){return {broken:true}};componentDidCatch(error:Error){this.props.failed(error)};render(){return this.state.broken?null:this.props.children}}
function Commit({done}:{done:()=>void}){useLayoutEffect(done,[]);return null}
export function ManualBoundary({host,register}:{host:{client:ReturnType<typeof makeClient>;session:ViewSession;atoms:typeof Atoms};register:(apply:(view:View)=>Promise<void>)=>void}){
 const operation=useRef<{success:()=>void;failure:(error:Error)=>void}|undefined>(undefined);
 const [current,setCurrent]=useState<{View:View;key:number}>({View:App,key:0});
 useLayoutEffect(()=>{let busy=false;let generation=0;let committed=current;register(view=>new Promise<void>((resolve,reject)=>{if(busy){reject(new Error('Reload already in progress'));return}busy=true;const s=host.session,e=s.editor,h=s.history;if(e&&!e.isDestroyed){s.draft=e.plainText;s.cursor=e.cursorOffset;s.selection=e.getSelection()}if(h&&!h.isDestroyed){s.scrollTop=h.scrollTop;s.scrollLeft=h.scrollLeft}
 const next={View:view,key:++generation};operation.current={success:()=>{committed=next;busy=false;operation.current=undefined;resolve()},failure:error=>{operation.current=undefined;flushSync(()=>setCurrent({...committed,key:++generation}));busy=false;reject(error)}};flushSync(()=>setCurrent(next));}));return()=>{operation.current?.failure(new Error('Host closed'))}},[]);
 const Active=current.View;return <Guard key={current.key} failed={error=>operation.current?.failure(error)}><Active {...host}/><Commit done={()=>operation.current?.success()}/></Guard>
}
