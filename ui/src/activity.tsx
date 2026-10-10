import {theme} from './theme'

/** Pure work indicator: lifecycle comes from authoritative stream state. */
export function Activity({label}:{label:string}){
 return <text fg={theme.agent}>{label+' ...'}</text>
}
