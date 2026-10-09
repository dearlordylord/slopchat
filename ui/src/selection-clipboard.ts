import type {CliRenderer} from '@opentui/core'

export function copySelection(renderer: CliRenderer): boolean {
 const text=renderer.getSelection()?.getSelectedText()??'';
 return text.length>0 && renderer.copyToClipboardOSC52(text);
}

// Command+C usually stays in the terminal. Copy on mouse release instead.
export function installSelectionClipboard(renderer: CliRenderer): ()=>void {
 let timer:ReturnType<typeof setTimeout>|undefined;
 const selected=()=>{
  if(timer)clearTimeout(timer);
  // Selection is emitted before OpenTUI refreshes selected renderables.
  timer=setTimeout(()=>{timer=undefined;if(!renderer.isDestroyed)copySelection(renderer)},0);
 };
 renderer.on('selection',selected);
 return ()=>{renderer.off('selection',selected);if(timer)clearTimeout(timer)};
}
