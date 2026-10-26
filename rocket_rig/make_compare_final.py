from PIL import Image, ImageDraw, ImageFont

op = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_open_final.png").convert("RGB")
cl = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_closed_final.png").convert("RGB")

crop = (120, 220, 800, 540)
a = op.crop(crop); b = cl.crop(crop)
W = a.width + b.width + 40
canvas = Image.new("RGB", (W, a.height), (235,235,235))
canvas.paste(a, (0,0)); canvas.paste(b, (a.width+40, 0))
d = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 32)
except Exception:
    font = ImageFont.load_default()
d.text((a.width//2 - 120, 8), "开眼", fill=(20,20,20), font=font)
d.text((a.width+40+b.width//2 - 120, 8), "闭眼", fill=(20,20,20), font=font)
p = r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_compare_final.png"
canvas.save(p)
print("saved", canvas.size)