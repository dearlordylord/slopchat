import { Schema } from 'effect'
export const Message = Schema.Struct({ i: Schema.Number, kind: Schema.String, text: Schema.String, size: Schema.Number, date: Schema.String })
export interface Message extends Schema.Schema.Type<typeof Message> {}
export const History = Schema.Struct({ count: Schema.Number, start: Schema.Number, end: Schema.Number, messages: Schema.Array(Message) })
export const Status = Schema.Struct({ count: Schema.Number, cursor: Schema.Number, working: Schema.Boolean, summaryActive: Schema.Number, summaryFailed: Schema.Number, contextBytes: Schema.Number, viewTotal: Schema.Number, offset: Schema.Number, nodes: Schema.Array(Schema.Struct({id: Schema.Number,n: Schema.Number,text: Schema.String})) })
export interface Status extends Schema.Schema.Type<typeof Status> {}
