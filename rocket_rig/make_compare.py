from PIL import Image

op = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_open_final.png").convert("RGB")
cl = Image.open(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_closed_final.png").convert("RGB")

# crop eye region (the two eyes are around x 180-780, y 250-530) with margin
crop = (140, 200, 800, 560)
a = op.crop(crop)
b = cl.crop(crop)

W = a.width + b.width + 40
H = a.height
canvas = Image.new("RGB", (W, H), (240, 240, 240))
canvas.paste(a, (0, 0))
canvas.paste(b, (a.width + 40, 0))

from PIL import ImageDraw, ImageFont
d = ImageDraw.Draw(canvas)
try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 34)
except Exception:
    font = ImageFont.load_default()
d.text((a.width//2 - 90, 8), "开眼 (Blink=0)", fill=(0,0,0), font=font)
d.text((a.width + 40 + b.width//2 - 90, 8), "闭眼 (Blink=1)", fill=(0,0,0), font=font)
canvas.save(r"C:\Users\24260\Desktop\教育agent\rocket_rig\blink_compare.png")
print("saved", canvas.size)