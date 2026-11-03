from pathlib import Path
import subprocess,json,time
base=Path(__file__).resolve().parent
report=[]
for folder,name in [('xiaohongshu','xiaohongshu'),('social','douyin'),('website','website')]:
 p=base/folder/f'qinggairugu-{name}.mp4'
 while not p.exists():time.sleep(2)
 # The CLI creates the output only after muxing; verify before audio mastering.
 while subprocess.run(['ffprobe','-v','error',str(p)],capture_output=True).returncode:time.sleep(2)
 q=p.with_name('master.mp4')
 subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(p),'-c:v','copy','-af','loudnorm=I=-16:TP=-1:LRA=11','-c:a','aac','-b:a','192k','-movflags','+faststart',str(q)],check=True)
 q.replace(p)
 subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True)
 data=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate','-of','json',str(p)]))
 report.append({'file':str(p),'probe':data,'decode':'通过'})
 subprocess.run(['ffmpeg','-y','-loglevel','error','-ss','2','-i',str(p),'-frames:v','1',str(base/folder/'封面.jpg')],check=True)
 print(name,'完整解码通过',flush=True)
(base/'技术验收.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
