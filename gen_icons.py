import struct, zlib, os

def create_png(width, height, r, g, b):
    def make_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = width//2, height//2
            envelope = abs(x-cx) < width*0.35 and abs(y-cy) < height*0.2
            if envelope:
                raw += bytes([r, g, b])
            elif abs(x-cx) < width*0.15:
                raw += bytes([60, 159, 221])
            else:
                raw += bytes([5, 5, 5])
    idat = make_chunk(b'IDAT', zlib.compress(raw))
    iend = make_chunk(b'IEND', b'')
    return header + ihdr + idat + iend

os.makedirs('/home/house/email/extension/icons', exist_ok=True)
for size, name in [(16, 'icon16.png'), (32, 'icon32.png'), (48, 'icon48.png'), (128, 'icon128.png')]:
    with open(f'/home/house/email/extension/icons/{name}', 'wb') as f:
        f.write(create_png(size, size, 246, 176, 18))
    print(f'created {name}')