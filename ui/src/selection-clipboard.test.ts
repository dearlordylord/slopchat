import {test,expect} from 'bun:test'
import {createTestRenderer} from '@opentui/core/testing'
import {TextRenderable} from '@opentui/core'
import {installSelectionClipboard,copySelection} from './selection-clipboard'
test('mouse selection copies text and cleanup removes listener',async()=>{
 const t=await createTestRenderer({width:40,height:10});const copies:string[]=[];
 t.renderer.copyToClipboardOSC52=text=>{copies.push(text);return true};
 const text=new TextRenderable(t.renderer,{content:'Clipboard example',width:30,height:1});t.renderer.root.add(text);
 const dispose=installSelectionClipboard(t.renderer);
 try{await t.flush();await t.mockMouse.drag(0,0,8,0);await new Promise(r=>setTimeout(r,20));expect(copies.length).toBe(1);expect(copies[0]).toBe(t.renderer.getSelection()?.getSelectedText()??'');expect(copies[0]?.length).toBeGreaterThan(0);expect(copySelection(t.renderer)).toBe(true);dispose();await t.mockMouse.drag(0,0,4,0);await new Promise(r=>setTimeout(r,20));expect(copies.length).toBe(2);t.renderer.clearSelection();expect(copySelection(t.renderer)).toBe(false)}finally{dispose();t.renderer.destroy()}
})
