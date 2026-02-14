import base64

# Simple 1x1 pixel blue PNG (base64 encoded)
# This is just a placeholder - ideally would be a proper icon
blue_pixel_png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

# Create a simple script to generate basic colored PNG files
import struct
import zlib

def create_simple_png(width, height, bg_color):
    """Create a simple PNG with solid background color"""
    img = []
    for y in range(height):
        row = [0]  # Filter type
        for x in range(width):
            row.extend(bg_color)
        img.append(bytes(row))
    
    img_data = b''.join(img)
    compressed = zlib.compress(img_data, 9)
    
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    def chunk(type, data):
        length = struct.pack('>I', len(data))
        crc = zlib.crc32(type + data) & 0xffffffff
        return length + type + data + struct.pack('>I', crc)
    
    # IHDR chunk
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    png += chunk(b'IHDR', ihdr)
    
    # IDAT chunk
    png += chunk(b'IDAT', compressed)
    
    # IEND chunk
    png += chunk(b'IEND', b'')
    
    return png

# Blue color #2563eb in RGB
blue = [37, 99, 235]

# Create icons
for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    png_data = create_simple_png(size, size, blue)
    with open(name, 'wb') as f:
        f.write(png_data)
    print(f"Created {name} ({size}x{size})")

