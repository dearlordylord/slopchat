import {createServer} from 'node:net'
import {mkdir,chmod,unlink} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

// Explicit requests only: no filesystem watcher or publication polling.
export async function listenForReload(apply:(file:string)=>Promise<void>){
 const directory=join(tmpdir(),'slopchat-ui-'+process.getuid?.());
 await mkdir(directory,{recursive:true,mode:0o700});
 const socket=join(directory,process.pid+'.sock');
 const server=createServer(client=>{
  client.setEncoding('utf8');let input='';let handled=false;
  client.on('error',()=>{});
  client.on('data',chunk=>{input+=chunk;if(input.length>8192){client.destroy();return}if(handled||!input.includes('\n'))return;handled=true;
   void (async()=>{try{const request=JSON.parse(input.slice(0,input.indexOf('\n')));if(typeof request.file!=='string'||!request.file.startsWith('/'))throw new Error('Absolute bundle path required');await apply(request.file);client.end(JSON.stringify({status:'committed',pid:process.pid})+'\n')}catch(error){client.end(JSON.stringify({status:'rejected',message:String(error)})+'\n')}})();
  });
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve)});await chmod(socket,0o600);
 return {socket,close:async()=>{server.close();await unlink(socket).catch(()=>{})}};
}
