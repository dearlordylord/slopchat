export const uiCommands={map:'/map',chat:'/chat',models:'/models',context:'/context',help:'/help'} as const

const focusKey='tab'; export const focusBinding={name:focusKey,label:focusKey[0]!.toUpperCase()+focusKey.slice(1)} as const

export const localHelp = `Local UI help (not sent to the agent)
 /map - memory map
 /chat - conversation
 /models - model selection
 /context - captured context and tokens
 /help - local help
Enter - send; Ctrl+Enter - newline
Tab - focus with empty input; complete commands; otherwise queue
Ctrl+O - toggle memory map
Ctrl+C - clear input; twice on empty input to exit
Esc - cancel active round, otherwise clear input
Ctrl+P - older messages
Up/Down - input history at composer boundaries
Ctrl+Y - toggle application mouse / terminal selection`;
