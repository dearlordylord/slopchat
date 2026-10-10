import type {CliRenderer} from '@opentui/core'

export function copySelection(renderer: CliRenderer): boolean {
 const text=renderer.getSelection()?.getSelectedText()??'';
 return text.length>0 && renderer.copyToClipboardOSC52(text);
}

// Command+C usually stays in the terminal. Copy on mouse release instead.
export function installSelectionClipboard(renderer: CliRenderer): ()=>void {
 let pending=false;
 const copy=()=>{if(pending){pending=false;if(!renderer.isDestroyed)copySelection(renderer)}};
 const selected=()=>{pending=true;renderer.requestRender()};
 renderer.on('selection',selected);
 renderer.on('frame',copy);
 return ()=>{renderer.off('selection',selected);renderer.off('frame',copy);pending=false};
}
