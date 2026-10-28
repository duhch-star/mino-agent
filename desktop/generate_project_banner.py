"""Generate README artwork from the approved source logo (no invented replacement mark)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'assets/brand';out.mkdir(parents=True,exist_ok=True)
w,h=1600,640
im=Image.new('RGB',(w,h),'#f6f8fb');d=ImageDraw.Draw(im)
d.rounded_rectangle((24,24,w-24,h-24),radius=28,fill='white',outline='#dce3ed',width=2)
d.rounded_rectangle((570,72,1518,568),radius=22,fill='#101b2c')
with Image.open(ROOT/'assets/logo.png') as source:
 logo=source.convert('RGB').resize((480,480),Image.Resampling.LANCZOS)
 im.paste(logo,(68,80))
font=Path('C:/Windows/Fonts')
def f(size,bold=False):return ImageFont.truetype(str(font/('arialbd.ttf' if bold else 'arial.ttf')),size)
d.text((622,109),'MINOS',font=f(88,True),fill='white')
d.text((627,222),'YOUR AI CAREER WORKSPACE',font=f(30,True),fill='#89d5c6')
d.text((627,284),'Prepare with evidence. Move with confidence.',font=f(28),fill='#d5deeb')
for i,(a,b) in enumerate([('PI AGENT','Conversation & tools'),('LATEX','Resume & PDF'),('PRACTICE','Interview & learning')]):
 x=627+i*286
 d.rounded_rectangle((x,369,x+266,477),radius=12,fill='#1c2b41',outline='#30445e')
 d.text((x+18,386),a,font=f(22,True),fill='#8bd5c6')
 d.text((x+18,429),b,font=f(19),fill='#edf2f8')
d.text((627,518),'LOCAL DESKTOP  /  YOUR MODELS  /  ONE FRONTEND',font=f(18),fill='#a6b7ce')
im.save(out/'minos-project-banner.png',optimize=True)
print(out/'minos-project-banner.png')
