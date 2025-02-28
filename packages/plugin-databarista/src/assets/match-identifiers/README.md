# Match Identifier Images

This folder should contain 50 unique images that will be used to help matched users identify each other in a crowded room.

## Image Requirements

1. **Total Count**: 50 unique images
2. **Format**: JPG or PNG files
3. **Size**: Recommended 800x800 pixels, square aspect ratio
4. **File Names**: Use a consistent naming scheme like `identifier-01.jpg` through `identifier-50.jpg`
5. **Content**: Each image should be:
   - Easily recognizable at a distance
   - Visually distinct from each other
   - Simple enough to describe verbally

## Suggested Image Types

As requested, the images should consist of a combination of colors and patterns:

1. **Solid Colors**: 10 images with distinct solid colors (red, blue, green, yellow, purple, orange, pink, teal, brown, black)
2. **Patterns with Colors**: 40 images combining patterns and colors, such as:
   - Stripes (vertical, horizontal, diagonal) in different colors
   - Polka dots of varying sizes and colors
   - Chevron patterns in different colors
   - Checker patterns in different colors
   - Grid patterns in different colors
   - Geometric shapes (triangles, circles, squares) in different colors
   - Simple icons or symbols (star, heart, flower, etc.) in different colors

## How to Generate

You can generate these images using:

1. **Graphic Design Tools**:
   - Adobe Illustrator or Photoshop
   - Canva (free option)
   - GIMP (free option)

2. **Automated Generation**:
   - Using Python with libraries like Pillow or OpenCV
   - Code example (using Python with Pillow):

```python
from PIL import Image, ImageDraw
import random
import os

def create_directory(path):
    if not os.path.exists(path):
        os.makedirs(path)

def generate_solid_color_image(filename, color, size=(800, 800)):
    img = Image.new('RGB', size, color)
    img.save(filename)
    print(f"Created {filename}")

def generate_striped_image(filename, color1, color2, size=(800, 800), stripe_width=40):
    img = Image.new('RGB', size, color1)
    draw = ImageDraw.Draw(img)
    
    for i in range(0, size[0], stripe_width * 2):
        draw.rectangle([(i, 0), (i + stripe_width, size[1])], fill=color2)
    
    img.save(filename)
    print(f"Created {filename}")

def generate_polka_dot_image(filename, bg_color, dot_color, size=(800, 800), dot_radius=30):
    img = Image.new('RGB', size, bg_color)
    draw = ImageDraw.Draw(img)
    
    for i in range(dot_radius, size[0], dot_radius * 3):
        for j in range(dot_radius, size[1], dot_radius * 3):
            draw.ellipse([(i-dot_radius, j-dot_radius), (i+dot_radius, j+dot_radius)], fill=dot_color)
    
    img.save(filename)
    print(f"Created {filename}")

# More pattern generators can be added...

def main():
    output_dir = "match-identifiers"
    create_directory(output_dir)
    
    # Define colors
    colors = [
        (255, 0, 0),     # Red
        (0, 0, 255),     # Blue
        (0, 255, 0),     # Green
        (255, 255, 0),   # Yellow
        (128, 0, 128),   # Purple
        (255, 165, 0),   # Orange
        (255, 192, 203), # Pink
        (0, 128, 128),   # Teal
        (165, 42, 42),   # Brown
        (0, 0, 0)        # Black
    ]
    
    # Generate solid color images (10)
    for i, color in enumerate(colors):
        generate_solid_color_image(f"{output_dir}/solid-{i+1:02d}.jpg", color)
    
    # Generate striped images (10)
    for i in range(10):
        color1 = random.choice(colors)
        color2 = random.choice([c for c in colors if c != color1])
        generate_striped_image(f"{output_dir}/stripes-{i+1:02d}.jpg", color1, color2)
    
    # Generate polka dot images (10)
    for i in range(10):
        bg_color = random.choice(colors)
        dot_color = random.choice([c for c in colors if c != bg_color])
        generate_polka_dot_image(f"{output_dir}/dots-{i+1:02d}.jpg", bg_color, dot_color)
    
    # Add more pattern types as needed...

if __name__ == "__main__":
    main()
```

3. **Online Generators**:
   - Pattern generators like [Patternify](http://www.patternify.com/)
   - Color palette tools like [Coolors](https://coolors.co/)

## Important Note

Once you have created or obtained the images, place them directly in this directory. The system will automatically use them when matching users. 