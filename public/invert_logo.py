from PIL import Image
import numpy as np

img = Image.open('leland-mills-logo.png')
print(f"Original: {img.size}, {img.mode}")

arr = np.array(img)
r, g, b, a = arr[:,:,0], arr[:,:,1], arr[:,:,2], arr[:,:,3]

# Dark pixels (black text) -> white
dark = (r + g + b < 300) * (a > 0)
# Yellow pixels (gold accent) -> keep
yellow = (r > 150) * (g > 120) * (b < 100) * (a > 0)
# Only convert dark non-yellow pixels
mask = dark * (1 - yellow)

arr[:,:,0] = np.where(mask > 0, 255, r)
arr[:,:,1] = np.where(mask > 0, 255, g)
arr[:,:,2] = np.where(mask > 0, 255, b)

result = Image.fromarray(arr, 'RGBA')
result.save('leland-mills-logo-white.png')
print(f"White logo saved: {result.size}")