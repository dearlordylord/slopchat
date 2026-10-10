import {test,expect} from 'bun:test'
import {Schema} from 'effect'
import {Status} from './protocol'
import {contextIndicator} from './context-indicator'
test('indicator preserves zero and never invents missing usage',()=>{
 const base={count:0,cursor:0,working:false,summaryActive:0,summaryFailed:0,contextBytes:0,viewTotal:0,offset:0,nodes:[]}
 const status=Schema.decodeUnknownSync(Status)({...base,contextCall:{id:'call',observation:{source:'fixture',receivedAt:123,metrics:{last:{input:10,'cached-input':0}}}}})
 expect(contextIndicator(status)).toContain('cached 0')
 expect(contextIndicator(status)).toContain('limit unavailable')
 expect(contextIndicator(undefined)).toContain('input unavailable')
 expect(contextIndicator(Schema.decodeUnknownSync(Status)({...base,contextCall:{id:'new',observation:null}}))).not.toContain('input 10')
})

import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {ContextIndicator} from './context-indicator'
test('indicator renders unavailable usage without hiding the command at narrow width',async()=>{
 const t=await createTestRenderer({width:60,height:4});const root=createRoot(t.renderer);
 try{flushSync(()=>root.render(<ContextIndicator status={undefined}/>));await t.flush();expect(t.captureCharFrame()).toContain('/context')}finally{flushSync(()=>root.unmount());t.renderer.destroy()}
})
