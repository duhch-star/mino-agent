from PIL import Image, ImageDraw, ImageFont

op = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_open_final.png").convert("RGB")
cl = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_closed_final.png").convert("RGB")

# eye band: rows 240-560, cols 120-800
crop = (120, 240, 800, 560)
a = op.crop(crop); b = cl.crop(crop)
W = a.width + b.width + 40
canvas = Image.new("RGB", (W, a.height), (240,240,240))
canvas.paste(a, (0,0)); canvas.paste(b, (a.width+40, 0))
d = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 30)
except Exception:
    font = ImageFont.load_default()
d.text((a.width//2-110, 6), "开眼 v2", fill=(0,0,0), font=font)
d.text((a.width+40+b.width//2-110, 6), "闭眼 v2", fill=(0,0,0), font=font)
p = r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_compare_v2.png"
canvas.save(p)
print("saved", canvas.size)