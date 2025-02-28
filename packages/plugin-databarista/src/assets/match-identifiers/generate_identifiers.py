#!/usr/bin/env python3
"""
Match Identifier Image Generator
This script generates 50 unique images that can be used to help matched users
identify each other in a crowded room.

All images are named with a standardized format: imagematch-XX.jpg
"""

from PIL import Image, ImageDraw
import random
import os
import math

# Configuration
IMAGE_SIZE = (800, 800)
OUTPUT_DIR = "."  # Current directory

# Define colors (RGB)
COLORS = [
    (255, 0, 0),     # Red
    (0, 0, 255),     # Blue
    (0, 255, 0),     # Green
    (255, 255, 0),   # Yellow
    (128, 0, 128),   # Purple
    (255, 165, 0),   # Orange
    (255, 192, 203), # Pink
    (0, 128, 128),   # Teal
    (165, 42, 42),   # Brown
    (0, 0, 0),       # Black
    (255, 255, 255), # White
    (128, 128, 128), # Gray
    (0, 255, 255),   # Cyan
    (255, 0, 255)    # Magenta
]

def create_solid_color_image(index, color, size=IMAGE_SIZE):
    """Create a solid color image"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color)
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_horizontal_stripes(index, color1, color2, size=IMAGE_SIZE, stripe_width=50):
    """Create horizontal stripes"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    for y in range(0, size[1], stripe_width * 2):
        draw.rectangle([(0, y), (size[0], y + stripe_width)], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_vertical_stripes(index, color1, color2, size=IMAGE_SIZE, stripe_width=50):
    """Create vertical stripes"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    for x in range(0, size[0], stripe_width * 2):
        draw.rectangle([(x, 0), (x + stripe_width, size[1])], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_diagonal_stripes(index, color1, color2, size=IMAGE_SIZE, stripe_width=50):
    """Create diagonal stripes"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    # Create a larger canvas to handle the rotation
    diagonal_length = int(math.sqrt(size[0]**2 + size[1]**2))
    offset = diagonal_length - size[0]
    
    for i in range(-offset, diagonal_length, stripe_width * 2):
        points = [
            (i, 0),
            (i + stripe_width, 0),
            (i + stripe_width + size[1], size[1]),
            (i + size[1], size[1])
        ]
        draw.polygon(points, fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_polka_dots(index, bg_color, dot_color, size=IMAGE_SIZE, dot_radius=30):
    """Create polka dots"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, bg_color)
    draw = ImageDraw.Draw(img)
    
    for x in range(dot_radius * 2, size[0], dot_radius * 3):
        for y in range(dot_radius * 2, size[1], dot_radius * 3):
            draw.ellipse(
                [(x - dot_radius, y - dot_radius), 
                 (x + dot_radius, y + dot_radius)], 
                fill=dot_color
            )
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_checkered(index, color1, color2, size=IMAGE_SIZE, square_size=100):
    """Create a checkered pattern"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    for x in range(0, size[0], square_size):
        for y in range(0, size[1], square_size):
            # Only draw squares in alternating positions
            if ((x // square_size) + (y // square_size)) % 2 == 0:
                draw.rectangle(
                    [(x, y), (x + square_size, y + square_size)], 
                    fill=color2
                )
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_triangles(index, color1, color2, size=IMAGE_SIZE, rows=4):
    """Create a triangle pattern"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    triangle_height = size[1] // rows
    triangle_width = size[0] // rows
    
    for row in range(rows):
        for col in range(rows * 2):
            x1 = col * triangle_width // 2
            y1 = row * triangle_height
            x2 = x1 + triangle_width // 2
            y2 = y1 + triangle_height
            
            if (row + col) % 2 == 0:
                # Draw upward triangle
                draw.polygon([(x1, y2), (x2, y1), (x1 + triangle_width, y2)], fill=color2)
            else:
                # Draw downward triangle
                draw.polygon([(x1, y1), (x1 + triangle_width, y1), (x1 + triangle_width // 2, y2)], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_circles(index, color1, color2, size=IMAGE_SIZE, circle_count=3):
    """Create concentric circles"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    center_x, center_y = size[0] // 2, size[1] // 2
    max_radius = min(center_x, center_y)
    
    for i in range(circle_count):
        radius = max_radius * (circle_count - i) / circle_count
        if i % 2 == 0:
            draw.ellipse(
                [(center_x - radius, center_y - radius), 
                 (center_x + radius, center_y + radius)], 
                fill=color2
            )
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_half_and_half(index, color1, color2, size=IMAGE_SIZE, vertical=True):
    """Create an image that's half one color, half another"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    if vertical:
        draw.rectangle([(size[0]//2, 0), (size[0], size[1])], fill=color2)
    else:
        draw.rectangle([(0, size[1]//2), (size[0], size[1])], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_quarters(index, color1, color2, color3, color4, size=IMAGE_SIZE):
    """Create an image divided into four colored quarters"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    # Top right quarter
    draw.rectangle(
        [(size[0]//2, 0), (size[0], size[1]//2)], 
        fill=color2
    )
    
    # Bottom left quarter
    draw.rectangle(
        [(0, size[1]//2), (size[0]//2, size[1])], 
        fill=color3
    )
    
    # Bottom right quarter
    draw.rectangle(
        [(size[0]//2, size[1]//2), (size[0], size[1])], 
        fill=color4
    )
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_grid(index, color1, color2, size=IMAGE_SIZE, grid_size=4):
    """Create a grid pattern"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    cell_width = size[0] // grid_size
    cell_height = size[1] // grid_size
    line_width = max(cell_width // 10, 5)  # Make lines proportional but not too thin
    
    # Draw horizontal grid lines
    for i in range(1, grid_size):
        y = i * cell_height
        draw.rectangle([(0, y - line_width//2), (size[0], y + line_width//2)], fill=color2)
    
    # Draw vertical grid lines
    for i in range(1, grid_size):
        x = i * cell_width
        draw.rectangle([(x - line_width//2, 0), (x + line_width//2, size[1])], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def create_zigzag(index, color1, color2, size=IMAGE_SIZE, rows=8):
    """Create a zigzag pattern"""
    filename = os.path.join(OUTPUT_DIR, f"imagematch-{index:02d}.jpg")
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    row_height = size[1] // rows
    
    for i in range(rows):
        # Draw a zigzag line
        points = []
        step = size[0] // 4
        
        for x in range(0, size[0] + step, step):
            if (i % 2 == 0 and x % (step * 2) == 0) or (i % 2 == 1 and x % (step * 2) != 0):
                y = i * row_height
            else:
                y = (i + 1) * row_height
            
            points.append((x, y))
        
        # Add bottom and top points to close the polygon
        if i % 2 == 0:
            points.append((size[0], (i + 1) * row_height))
            points.append((0, (i + 1) * row_height))
        else:
            points.append((size[0], i * row_height))
            points.append((0, i * row_height))
        
        draw.polygon(points, fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")
    return filename

def main():
    """Generate all match identifier images"""
    # Make sure the output directory exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
    
    print(f"Generating match identifier images in {os.path.abspath(OUTPUT_DIR)}")
    
    # Track the images we've created and the current index
    created_images = []
    current_index = 1
    
    # 1. Create 10 solid color images (one for each primary color)
    for i, color in enumerate(COLORS[:10]):
        filename = create_solid_color_image(current_index, color)
        created_images.append(filename)
        current_index += 1
    
    # 2. Create 5 horizontal striped images
    for i in range(5):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_horizontal_stripes(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 3. Create 5 vertical striped images
    for i in range(5):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_vertical_stripes(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 4. Create 5 diagonal striped images
    for i in range(5):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_diagonal_stripes(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 5. Create 5 polka dot images
    for i in range(5):
        bg_color = random.choice(COLORS)
        dot_color = random.choice([c for c in COLORS if c != bg_color])
        filename = create_polka_dots(current_index, bg_color, dot_color)
        created_images.append(filename)
        current_index += 1
    
    # 6. Create 5 checkered images
    for i in range(5):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_checkered(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 7. Create 3 triangle pattern images
    for i in range(3):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_triangles(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 8. Create 3 concentric circle images
    for i in range(3):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_circles(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 9. Create 3 half-and-half images
    for i in range(3):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        vertical = i % 2 == 0
        filename = create_half_and_half(current_index, color1, color2, vertical=vertical)
        created_images.append(filename)
        current_index += 1
    
    # 10. Create 3 quarters images
    for i in range(3):
        colors = random.sample(COLORS, 4)
        filename = create_quarters(current_index, colors[0], colors[1], colors[2], colors[3])
        created_images.append(filename)
        current_index += 1
    
    # 11. Create 3 grid images
    for i in range(3):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_grid(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # 12. Create 3 zigzag pattern images
    for i in range(3):
        color1 = random.choice(COLORS)
        color2 = random.choice([c for c in COLORS if c != color1])
        filename = create_zigzag(current_index, color1, color2)
        created_images.append(filename)
        current_index += 1
    
    # Check if we have 50 images
    while len(created_images) < 50:
        # Create additional solid color images to make up the difference
        color = COLORS[current_index % len(COLORS)]
        filename = create_solid_color_image(current_index, color)
        created_images.append(filename)
        current_index += 1
    
    # Verify the number of images created
    print(f"Created {len(created_images)} unique identifier images")
    print("Done!")

if __name__ == "__main__":
    main() 