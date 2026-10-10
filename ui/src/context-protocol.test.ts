import {test,expect} from 'bun:test'
import {Schema} from 'effect'
import {ContextPage,ContextCalls} from './protocol'
test('context protocol preserves unavailable and explicit zero',()=>{
 const decode=Schema.decodeUnknownSync(ContextPage)
 expect(decode({available:false})).toEqual({available:false})
 const page=decode({available:true,id:'session:1',terminal:true,outcome:'completed',offset:0,end:0,total:0,text:'',observation:{source:'fixture',receivedAt:123,metrics:{last:{input:10,'cached-input':0}}}})
 expect(page.available&&page.observation?.metrics?.last?.['cached-input']).toBe(0)
 expect(page.available&&page.observation?.metrics?.last?.output).toBeUndefined()
 expect(()=>decode({available:true,id:12})).toThrow()
 expect(Schema.decodeUnknownSync(ContextCalls)({total:0,offset:0,calls:[]}).calls).toEqual([])
})
test('memory accounting is available without a retained snapshot',()=>{
 const page=Schema.decodeUnknownSync(ContextPage)({available:false,memoryUsage:{started:2,input:10,output:0,inputObserved:1,outputObserved:1}})
 expect(page.memoryUsage).toEqual({started:2,input:10,output:0,inputObserved:1,outputObserved:1})
})
