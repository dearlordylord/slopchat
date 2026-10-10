import {StyledText,RGBA} from '@opentui/core'
import {theme} from './theme'
// Lexical colors preserve incomplete expressions without requiring a parser download.
export function highlightExpression(source:string){
 const tokens=source.match(/;[^\n]*|"(?:\\.|[^"\\])*"?|[()]|[^\s()";]+|\s+|./gs)??[];
 return new StyledText(tokens.map(text=>({__isChunk:true as const,text,fg:RGBA.fromHex(text.startsWith(';')?theme.muted:text.startsWith('"')?theme.success:/^[+-]?\d+(?:\.\d+)?$/.test(text)?theme.user:text==='('||text===')'?theme.border:theme.agent)})));
}
export function Expression({source}:{source:string}){return <text wrapMode='word' content={highlightExpression(source)}/>}
