import os,pty,subprocess,fcntl,termios,struct,select,time,re,json,signal
from pathlib import Path
prototype_dir = Path(__file__).resolve().parents[1]
artifacts_dir = prototype_dir / "artifacts"
artifacts_dir.mkdir(exist_ok=True)
master,slave=pty.openpty()
fcntl.ioctl(slave,termios.TIOCSWINSZ,struct.pack('HHHH',40,120,0,0))
env=dict(os.environ,TERM='xterm-256color',LC_ALL='C.UTF-8')
p=subprocess.Popen(['bun','run','--cwd',str(prototype_dir),'start'],stdin=slave,stdout=slave,stderr=slave,env=env,start_new_session=True)
os.close(slave)
def collect(seconds,until=None):
    out=bytearray();start=time.perf_counter()
    while time.perf_counter()-start<seconds:
        if select.select([master],[],[],0.01)[0]:
            try:data=os.read(master,65536)
            except OSError:break
            if not data:break
            out.extend(data)
            clean=re.sub(rb'\x1b\[[0-?]*[ -/]*[@-~]',b'',bytes(out))
            if until and until in clean:return bytes(out),(time.perf_counter()-start)*1000,True
        if p.poll() is not None:break
    return bytes(out),(time.perf_counter()-start)*1000,False
try:
    initial,start_ms,started=collect(8,b'SLOPCHAT LAB')
    if not started:raise RuntimeError('Initial screen absent')
    collect(.5)
    os.write(master,b's')
    stress,stress_ms,switched=collect(3,b'STRESS')
    if not switched:
        open(artifacts_dir / 'pty-failed-stress.ansi','wb').write(stress)
        raise RuntimeError('Stress screen absent')
    collect(.3)
    output,duration_ms,_=collect(5)
    os.write(master,b'p')
    paused,pause_ms,ack=collect(3,b'PAUSED')
    if not ack:raise RuntimeError('Pause acknowledgement absent')
    os.write(master,b'q')
    exit_output,_,_=collect(3)
    code=p.wait(timeout=3)
    result={'kind':'drained PTY functional/throughput probe; excludes terminal emulator paint',
            'size':'120x40','startupUntilTitleMs':round(start_ms,2),'stressSwitchUntilLabelMs':round(stress_ms,2),
            'observationSeconds':round(duration_ms/1000,3),'ansiBytes':len(output),
            'ansiBytesPerSecond':round(len(output)/(duration_ms/1000)),
            'completedSynchronizedFrames':output.count(b'\x1b[?2026l'),
            'pauseAcknowledgementMs':round(pause_ms,2),'exitCode':code,
            'terminalRestored':b'\x1b[?1049l' in exit_output,'liveSimulationHz':4}
    open(artifacts_dir / 'pty-performance.json','w').write(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
finally:
    # The Bun run wrapper can have a child; clean the probe-owned session group.
    try:
        os.killpg(p.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        p.wait(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        p.wait(timeout=2)
    os.close(master)
