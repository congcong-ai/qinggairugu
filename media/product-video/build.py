from pathlib import Path
import shutil,subprocess,json,math,wave,struct
root=Path(__file__).resolve().parents[2]; out=root/'media/product-video'
shots=[
('见过面，\n然后呢？','谁来了 · 聊了什么 · 后来怎么找回来','每一次相遇，都值得留下。','一场交流结束，聊过的精彩，你还记得多少？',None),
('先好好聊，\n记录交给倾盖如故。','无需注册，即可开始本地录音','请确保现场人员知情并同意录音','打开倾盖如故，不用注册，就能开始本地录音。','01-recording-roles.png'),
('聊过的，\n整理成重点。','转写 · 发言人 · 摘要 · 行动项','AI 需自备阿里云百炼 Key，费用由百炼账户承担','用自己的百炼服务，把对话整理成摘要、话题和行动项。','02-ai-summary.png'),
('好像聊过？\n真的找得到。','搜索自己设备上的历史记录','回答附上场次与原文来源，便于核对','想起一个话题，搜索本机记录，还能回到原文核对。','03-search-answer.png'),
('认识彼此，\n也留下这场回顾。','微信扫码加入 · 填一句「关于我」','参与者资料按本场设置展示；回顾经组织者确认后发布','微信扫码，认识同场的人。回顾由组织者确认后发布。',None),
('把每一次\n见面留下来。','倾盖如故','Android App · 了解产品与下载','倾盖如故。把每一次见面留下来。',None)]
(out/'旁白与分镜.json').write_text(json.dumps(shots,ensure_ascii=False,indent=2))
for name,w,h in [('douyin',1080,1920),('xiaohongshu',1080,1440),('website',1920,1080)]:
 d=out/name; (d/'assets').mkdir(parents=True,exist_ok=True)
 shutil.copy(root/'assets/logo/logo.png',d/'assets/logo.png')
 for *_,pic in shots:
  if pic: shutil.copy(root/'docs/huawei-app-release/screenshots'/pic,d/'assets'/pic)
 # original quiet ambient music, no third-party copyright
 sr=24000
 with wave.open(str(d/'assets/music.wav'),'wb') as f:
  f.setparams((1,2,sr,0,'NONE','not compressed'))
  notes=[130.81,164.81,196,146.83,174.61,220]
  frames=bytearray()
  for i in range(sr*36):
   t=i/sr; a=min(1,t/2,(36-t)/2); beat=t%0.5; n=notes[int(t//3)%len(notes)]
   v=(math.sin(2*math.pi*n*t)+.4*math.sin(2*math.pi*n*1.5*t))*.04
   v+=math.sin(2*math.pi*523.25*t)*math.exp(-beat*15)*.025
   frames.extend(struct.pack('<h',int(v*a*32767)))
  f.writeframes(frames)
 audio=[]
 for i,(title,sub,foot,vo,pic) in enumerate(shots):
  aiff=Path('/tmp')/f'qinggai-vo-{i}.aiff'
  if not aiff.exists(): subprocess.run(['say','-v','Tingting','-r','210','-o',str(aiff),vo],check=True)
  subprocess.run(['ffmpeg','-y','-loglevel','error','-i',str(aiff),'-af','apad=whole_dur=6','-t','6',str(d/f'assets/voice-{i}.wav')],check=True)
  audio.append(f'<audio src="assets/voice-{i}.wav" at="{i*6}"></audio>')
  visual=(f'<div class="art"><img src="assets/{pic}"></div>' if pic else ('<div class="social"><div class="bubble">最近在做什么？</div><div class="bubble b2">今天，想聊聊 AI 和生活。</div><div class="bubble b3">这场回顾，见面后继续回味。</div></div>' if i==4 else '<div class="orbit"><span>见面</span><span>记录</span><span>回顾</span><div class="center"><img src="assets/logo.png"></div></div>'))
  html=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="style.css"><body class="s{i}"><div class="grain"></div><header><img src="assets/logo.png"><b>倾盖如故</b><span>把每一次见面留下来</span></header><main><div class="copy"><label> {'开始记录' if i<2 else '留下精彩' if i<4 else '让相遇继续'} / 0{i+1}</label><h1>{title.replace(chr(10),'<br>')}</h1><p>{sub}</p>{'<a>qgrg.bebackpacker.com →</a>' if i==5 else ''}</div>{visual}</main><footer>{foot}</footer><div class="progress"></div><script>window.film={{duration:6,frame(t){{const p=Math.min(1,t/0.7);const e=1-Math.pow(1-p,3);document.querySelector('main').style.opacity=e;document.querySelector('.copy').style.transform=`translateY(${{(1-e)*45}}px)`;document.querySelector('.art,.orbit,.social').style.transform=`translateY(${{(1-e)*65}}px) scale(${{.96+.04*e+t*.002}})`;document.querySelector('.progress').style.width=`${{(t/6)*100}}%`;}}}};</script></body></html>'''
  (d/f'shot-{i}.html').write_text(html)
 css='''*{box-sizing:border-box}body{margin:0;background:#f7f4ee;color:#282f28;font-family:"PingFang SC",sans-serif;overflow:hidden}header{position:absolute;left:7%;top:5%;display:flex;align-items:center;gap:18px;font-size:30px}header img{width:62px;height:62px;object-fit:contain}header span{font-size:21px;color:#72786c;margin-left:26px}main{position:absolute;left:7%;right:7%;top:19%;bottom:16%;display:flex;align-items:center;gap:70px}.copy{flex:1;z-index:2}label{font-size:23px;letter-spacing:4px;color:#426b4e}h1{font-size:82px;line-height:1.28;letter-spacing:-3px;margin:28px 0}p{font-size:28px;line-height:1.7;color:#72786c}a{display:inline-block;background:#426b4e;color:white;border-radius:99px;padding:24px 32px;font-size:26px;margin-top:24px}.art{height:100%;width:39%;flex-shrink:0;border-radius:30px;overflow:hidden;box-shadow:0 24px 70px #243a2518;background:#f7f4ee}.art img{width:100%;height:100%;object-fit:contain}footer{position:absolute;bottom:8%;left:7%;right:7%;font-size:22px;line-height:1.7;color:#72786c}.progress{position:absolute;bottom:0;left:0;height:7px;background:#426b4e}.orbit{width:560px;height:560px;border:2px solid #dce3d5;border-radius:50%;position:relative;background:#e8ede155}.center{position:absolute;inset:150px;display:grid;place-items:center;background:#fff;border-radius:64px;box-shadow:0 20px 50px #426b4e18}.center img{width:85%;height:85%;object-fit:contain}.orbit span{position:absolute;background:#426b4e;color:white;padding:18px 34px;border-radius:99px;font-size:27px}.orbit span:nth-child(1){left:15px;top:50px}.orbit span:nth-child(2){right:-10px;top:230px}.orbit span:nth-child(3){left:60px;bottom:0}.social{width:48%}.bubble{background:white;border:1px solid #dce3d5;border-radius:32px;padding:35px;font-size:30px;margin:20px 0;box-shadow:0 15px 50px #426b4e0a}.b2{background:#426b4e;color:white;transform:translateX(30px)}.b3{background:#e8ede1}.s5{background:#e8ede1}.s0 h1,.s5 h1{font-size:100px}@media(max-aspect-ratio:1/1){header{top:5%;font-size:30px}header span{display:none}main{top:17%;bottom:17%;flex-direction:column;align-items:stretch;gap:32px}.copy{flex:0}h1{font-size:76px;margin:22px 0}p{font-size:28px;margin:0}label{font-size:21px}.art{height:0;flex:1;width:100%;box-shadow:none;background:transparent;border-radius:30px}.art img{object-fit:contain}.orbit{width:550px;height:550px;align-self:center;margin:auto}.social{width:94%;margin:auto}.bubble{font-size:32px;padding:35px}footer{bottom:9%;font-size:24px}.s0 h1,.s5 h1{font-size:100px}a{font-size:29px}.s0 main,.s5 main{gap:70px}}'''
 (d/'style.css').write_text(css)
 film=f'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width={w}, height={h}"><body><section>'+''.join(f'<iframe src="shot-{i}.html" at="{i*6}"></iframe>' for i in range(6))+'</section><section>'+''.join(audio)+'</section><section><audio src="assets/music.wav" volume="0.6"></audio></section></body></html>'
 (d/'film.html').write_text(film)
print('已生成三版工程')
