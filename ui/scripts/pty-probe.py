import os,pty,subprocess,select,time,fcntl,termios,struct,signal,json
master,slave=pty.openpty()
fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',40,120,0,0))
p=subprocess.Popen(['./scripts/chat-tui'],cwd='/workspace/formal-proofs/slopchat',stdin=slave,stdout=slave,stderr=slave,env=dict(os.environ,TERM='xterm-256color',LC_ALL='C.UTF-8'),start_new_session=True)
os.close(slave)
def collect(seconds):
 out=bytearray(); end=time.monotonic()+seconds
 while time.monotonic()<end:
  if select.select([master],[],[],.05)[0]:
   try: out.extend(os.read(master,65536))
   except OSError: break
 return bytes(out)
try:
 initial=collect(3)
 assert b'SLOPCHAT' in initial, initial[-2000:]
 os.write(master,bytes([19]))
 os.write(master,bytes([27])+b'[200~'+bytes.fromhex('d09fd180d0b8d0b2d0b5d182')+bytes([27])+b'[201~')
 collect(.5)
 fcntl.ioctl(master,termios.TIOCSWINSZ,struct.pack('HHHH',24,60,0,0)); os.killpg(p.pid,signal.SIGWINCH)
 resized=collect(.5)
 os.write(master,bytes([17])); closing=collect(2)
 code=p.wait(timeout=3)
 print(json.dumps({'startup':True,'exitCode':code,'terminalRestored':bytes([27])+b'[?1049l' in closing,'resizeBytes':len(resized),'limits':'PTY emission only; paste not asserted; no sends'},indent=2))
finally:
 try: os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError: pass
 os.close(master)
