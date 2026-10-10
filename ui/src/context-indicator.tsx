import type {Status} from './protocol'
import {uiCommands} from './ui-commands'
import {theme} from './theme'

/** Pure projection of the latest call, without fallback to older usage. */
export function contextIndicator(status:Status|undefined){
 const metrics=status?.contextCall?.observation?.metrics
 return uiCommands.context+' · Reported input '+(metrics?.last?.input??'unavailable')+' tokens · cached '+(metrics?.last?.['cached-input']??'unavailable')+' · limit '+(metrics?.['context-limit']??'unavailable')
}
export function ContextIndicator({status}:{status:Status|undefined}){
 return <text height={1} flexShrink={0} fg={theme.muted}>{contextIndicator(status)}</text>
}
