from PIL import Image,ImageDraw,ImageFont
import subprocess,pathlib,json
root=pathlib.Path('/Users/peter/code/congcongai/qinggairugu');out=root/'artifacts/google-play/video';work=out/'render';work.mkdir(exist_ok=True)
font='/System/Library/Fonts/STHeiti Medium.ttc'
def F(s):return ImageFont.truetype(font,s)
scenes=[('前台服务原始录屏.mp4',0,9,'1 · 主动发起','打开倾盖如故，主动记录一场活动。',False),('前台服务原始录屏.mp4',26,12,'2 · 选择记录身份','选择发起人，进入录音流程。',False),('前台服务原始录屏.mp4',48,14,'3 · 麦克风权限','系统授权提示；用户决定是否允许。',False),('前台服务原始录屏.mp4',82,20,'4 · 通知权限与开始','用户允许持续通知，随后开始录音。',False),('前台服务原始录屏.mp4',110,9,'5 · 录音持续进行','计时持续推进；本机保留录音。',False),('前台服务原始录屏.mp4',177,4,'6 · 系统持续通知','前台服务让用户知道仍在录音。',True),('前台服务原始录屏-结束.mp4',1,9,'7 · 返回应用','后台切换后，返回仍显示录音计时。',False),('保存结果.mp4',1,9,'8 · 保存后状态','用户结束后，可查看保存的记录。',False)]
for i,(file,start,dur,title,desc,notify) in enumerate(scenes):
 im=Image.new('RGB',(1280,900),'#F7F4EE');d=ImageDraw.Draw(im)
 for xy,text,size,col in [((52,78),'倾盖如故 · 权限用途演示',30,'#273325'),((52,203),title,36,'#42552E'),((52,295),desc,22,'#273325'),((52,409),'FOREGROUND_SERVICE_MICROPHONE',19,'#42552E'),((52,462),'用途：用户主动发起的后台录音',23,'#273325'),((52,540),'正式版本 0.2.2（6）',22,'#646B5B'),((52,585),'华为 Android 12 真机实录',22,'#646B5B'),((52,735),'实录节选，省略等待时间。',20,'#646B5B'),((52,775),'最后一幕为用户保存后的页面。',20,'#646B5B')]:d.text(xy,text,font=F(size),fill=col)
 bg=work/f'bg{i}.png';im.save(bg)
 vf='crop=700:144:12:390,scale=520:-2' if notify else 'scale=-2:850'
 y='350' if notify else '25'
 cmd=['ffmpeg','-hide_banner','-loglevel','error','-y','-loop','1','-i',str(bg),'-ss',str(start),'-t',str(dur),'-i',str(out/file),'-filter_complex',f'[1:v]{vf},setsar=1[v];[0:v][v]overlay=x=730:y={y}:shortest=1,fps=25,format=yuv420p[final]','-map','[final]','-an','-t',str(dur),'-c:v','libx264','-preset','fast','-crf','21',str(work/f'scene{i}.mp4')]
 subprocess.run(cmd,check=True)
(work/'concat.txt').write_text(''.join(f"file '{work / ('scene'+str(i)+'.mp4')}'\n" for i in range(len(scenes))))
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(work/'concat.txt'),'-c','copy','-movflags','+faststart',str(out/'倾盖如故-后台录音权限演示.mp4')],check=True)
(root/'media/google-play-review/分镜.json').write_text(json.dumps(scenes,ensure_ascii=False,indent=2))
