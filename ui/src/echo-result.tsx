import {useState} from 'react'
import type {Message} from './protocol'
import {Expression} from './expression'
import {theme} from './theme'
// Decode only the known process envelope; unknown results remain literal.
export function processResult(text:string){
 const match=/^\(:session-id "([^"]+)" :status "([^"]+)" :output ("(?:\\.|[^"\\])*") :dropped-chars (\d+) :exit-code (nil|-?\d+)\)$/.exec(text);
 if(!match)return null;
 try{return {session:match[1],status:match[2],output:JSON.parse(match[3]!),dropped:Number(match[4]),exit:match[5]}}catch{return null}
}
export function EchoResult({message}:{message:Message}){
 const [expanded,setExpanded]=useState(false);const process=processResult(message.text);const [outputExpanded,setOutputExpanded]=useState(false);const output:string=process?process.output:message.text;const lines=output.split('\n');const long=lines.length>3||output.length>240;const preview=lines.slice(0,3).join('\n').slice(0,240);
 return <box flexDirection='column'><text fg={theme.muted}>{message.i+' Tool result'+(message.tool?' · '+message.tool.callId:'')+(process?' · '+process.status+' · exit '+process.exit+(process.dropped?' · dropped '+process.dropped:''):'')}</text><text wrapMode='word' fg={theme.muted}>{long&&!outputExpanded?preview+'…':output}</text>{long?<text id={'echo-output-'+message.i} fg={theme.muted} onMouseUp={()=>setOutputExpanded(v=>!v)}>{outputExpanded?'▼ Output':'▶ Output'}</text>:null}{process?<><text id={'echo-details-'+message.i} fg={theme.muted} onMouseUp={()=>setExpanded(v=>!v)}>{expanded?'▼':'▶'}</text>{expanded?<Expression source={message.text}/>:null}</>:null}</box>
}
