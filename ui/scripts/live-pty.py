import os,pty,subprocess,select,time,signal,json,pathlib,tempfile,shutil
root=pathlib.Path('/workspace/formal-proofs/slopchat'); production=root/'ui/.revisions'; manifest=json.loads((production/'current.json').read_text());source=(production/manifest['file']).read_text();folder=pathlib.Path(tempfile.mkdtemp(prefix='.test-live-',dir=root/'ui'));pointer=folder/'current.json';pointer.write_text(json.dumps(manifest));(folder/manifest['file']).write_text(source); master,slave=pty.openpty()
p=subprocess.Popen(['./scripts/chat-tui'],cwd=root,stdin=slave,stdout=slave,stderr=slave,env=dict(os.environ,TERM='xterm-256color',SLOPCHAT_UI_REVISIONS=str(folder)),start_new_session=True);os.close(slave)
def wait(token):
 end=time.monotonic()+8;out=b''
 while time.monotonic()<end:
  if select.select([master],[],[],.05)[0]:
   try:out+=os.read(master,65536)
   except OSError:break
  if token in out:return out
 raise RuntimeError(out[-2000:])
try:
 wait(b'SLOPCHAT'); pid=p.pid;deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  try:initial=json.loads((folder/'activation.json').read_text())
  except FileNotFoundError:
   time.sleep(.02);continue
  if initial.get('file')==manifest['file']:break
  time.sleep(.02)
 host_pid=initial['pid']
 file='view-pty-'+str(pid)+'.mjs';(folder/file).write_text(source.replace('SLOPCHAT -','SLOPCHAT LIVE -'));tmp=folder/'pty.tmp';tmp.write_text(json.dumps({'api':1,'file':file}));tmp.replace(pointer)
 wait(b'LIVE -');deadline=time.monotonic()+5
 while time.monotonic()<deadline:
  ack=json.loads((folder/'activation.json').read_text())
  if ack.get('file')==file:break
  time.sleep(.02)
 assert ack['file']==file and p.poll() is None
 assert ack['pid']==host_pid
 os.write(master,bytes([3]));closing=wait(bytes([27])+b'[?1049l');code=p.wait(timeout=3);assert code==0
 print(json.dumps({'pid':pid,'samePid':True,'actualPresentationUpdated':True,'ack':ack,'exitCode':code,'limits':'PTY output and live read-only polling; no send or cursor assertion'}))
finally:
 # Production pointer is never modified.
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
 try:p.wait(timeout=3)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
 shutil.rmtree(folder);os.close(master)
