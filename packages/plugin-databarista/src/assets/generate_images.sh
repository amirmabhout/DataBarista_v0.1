#!/bin/bash

# Script to generate match identifier images

# Ensure we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clear any existing images
echo "Removing existing match identifier images..."
rm -f imagematch-*.jpg

# Run the Python script to generate new images
echo "Generating new match identifier images..."
python3 generate_identifiers.py

# Make the script executable
chmod +x generate_identifiers.py

echo "Done! Images are ready in: $SCRIPT_DIR"
echo "Total images generated: $(ls imagematch-*.jpg | wc -l)" 