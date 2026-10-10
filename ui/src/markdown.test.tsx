import {test,expect} from 'bun:test'
import {TextAttributes} from '@opentui/core'
import {createTestRenderer} from '@opentui/core/testing'
import {createRoot,flushSync} from '@opentui/react'
import {RegistryContext} from '@effect/atom-react'
import * as Registry from 'effect/reactivity/AtomRegistry'
import {App} from './app'
import {makeClient} from './client'
import {pinHostAtoms} from './host-atoms'
import {messagesAtom} from './state'
test('assistant Markdown emits bold and italic terminal attributes',async()=>{
 const t=await createTestRenderer({width:100,height:30});const registry=Registry.make();const release=pinHostAtoms(registry);const client=makeClient('/tmp/unused-markdown',registry);const root=createRoot(t.renderer);
 try{registry.set(messagesAtom,[{i:0,kind:'slopchat',text:'**BOLD_SAMPLE** and *ITALIC_SAMPLE* and `CODE_SAMPLE`',size:60,date:'now'}]);flushSync(()=>root.render(<RegistryContext.Provider value={registry}><App client={client}/></RegistryContext.Provider>));await t.waitForFrame(f=>f.includes('BOLD_SAMPLE')&&f.includes('ITALIC_SAMPLE'));const spans=t.captureSpans().lines.flatMap(l=>l.spans);expect(spans.some(s=>s.text.includes('BOLD_SAMPLE')&&(s.attributes&TextAttributes.BOLD)!==0)).toBe(true);expect(spans.some(s=>s.text.includes('ITALIC_SAMPLE')&&(s.attributes&TextAttributes.ITALIC)!==0)).toBe(true);expect(t.captureCharFrame()).toContain('CODE_SAMPLE');}finally{flushSync(()=>root.unmount());await client.close();release();registry.dispose();t.renderer.destroy()}
})
