import struct, zlib, os

def create_png(width, height, r, g, b, shape='envelope'):
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = width/2, height/2
            if shape == 'envelope':
                body = abs(x-cx) < width*0.38 and abs(y-cy) < height*0.22
                flap = abs(x-cx) < width*0.38 and abs(y-cy) < height*0.15 and (y < cy)
                if body: raw += bytes([r, g, b])
                elif flap: raw += bytes([min(r+40,255), min(g+40,255), min(b+40,255)])
                else: raw += bytes([5,5,5])
            elif shape == 'key':
                head = (x-cx)**2 + (y-cy)**2 < (width*0.2)**2
                shaft = abs(x-cx) < width*0.08 and abs(y-cy) < height*0.15
                if head: raw += bytes([r, g, b])
                elif shaft: raw += bytes([r, g, b])
                else: raw += bytes([5,5,5])
            else:
                raw += bytes([5,5,5])
    idat = make_chunk(b'IDAT', zlib.compress(raw))
    iend = make_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

# email app icons (envelope shape)
os.makedirs('/home/house/email/mobile/android/app/src/main/res/mipmap-hdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile/android/app/src/main/res/mipmap-mdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile/android/app/src/main/res/mipmap-xhdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile/android/app/src/main/res/mipmap-xxhdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile/android/app/src/main/res/mipmap-xxxhdpi', exist_ok=True)

for (size, folder) in [(48, 'mdpi'), (72, 'hdpi'), (96, 'xhdpi'), (144, 'xxhdpi'), (192, 'xxxhdpi')]:
    png = create_png(size, size, 246, 176, 18, 'envelope')
    with open(f'/home/house/email/mobile/android/app/src/main/res/mipmap-{folder}/ic_launcher.png', 'wb') as f:
        f.write(png)
    with open(f'/home/house/email/mobile/android/app/src/main/res/mipmap-{folder}/ic_launcher_foreground.png', 'wb') as f:
        f.write(create_png(size, size, 246, 176, 18, 'envelope'))

# passwords app icons (key shape)
os.makedirs('/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-hdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-mdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-xhdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-xxhdpi', exist_ok=True)
os.makedirs('/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-xxxhdpi', exist_ok=True)

for (size, folder) in [(48, 'mdpi'), (72, 'hdpi'), (96, 'xhdpi'), (144, 'xxhdpi'), (192, 'xxxhdpi')]:
    png = create_png(size, size, 60, 159, 221, 'key')
    with open(f'/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-{folder}/ic_launcher.png', 'wb') as f:
        f.write(png)
    with open(f'/home/house/email/mobile-passwords/android/app/src/main/res/mipmap-{folder}/ic_launcher_foreground.png', 'wb') as f:
        f.write(create_png(size, size, 60, 159, 221, 'key'))

print("icons generated for both apps")