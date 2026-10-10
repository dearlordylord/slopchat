/** Explicit lifecycle readiness, independent of elapsed time. */
export function signal(){
 let complete:()=>void=()=>{}
 const promise=new Promise<void>(resolve=>{complete=resolve})
 return {promise,complete}
}
