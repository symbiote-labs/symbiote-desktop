#!/bin/bash

# Icon generation script for Symbiote Desktop
# Generates .icns, .ico, and individual sized icons from a single icon.png

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the build directory
if [[ ! -f "icon.png" ]]; then
    print_error "icon.png not found in current directory"
    print_error "Please run this script from the build directory containing icon.png"
    exit 1
fi

print_status "Starting icon generation from icon.png..."

# Check source image properties
pixelHeight=$(sips -g pixelHeight "icon.png" | grep "pixelHeight:" | tail -n 1 | awk '{ print $2; }')
pixelWidth=$(sips -g pixelWidth "icon.png" | grep "pixelWidth:" | tail -n 1 | awk '{ print $2; }')

print_status "Source image dimensions: ${pixelWidth}x${pixelHeight}"

if [ ${pixelHeight} -lt 512 ] || [ ${pixelWidth} -lt 512 ]; then
    print_warning "Source image should be at least 512x512 for best results"
fi

hasAlpha=$(sips -g hasAlpha "icon.png" | grep "hasAlpha:" | awk '{ print $2; }')
if [ "${hasAlpha}" != "yes" ]; then
    print_warning "Icons work best with transparency. Consider using a PNG with alpha channel."
fi

# Create temporary directories
TEMP_ICONSET="temp.iconset"
TEMP_DIR="temp_icons"
ICONS_DIR="icons"

# Clean up any existing temp files
rm -rf "$TEMP_ICONSET" "$TEMP_DIR"

# Create directories
mkdir -p "$TEMP_ICONSET" "$TEMP_DIR" "$ICONS_DIR"

print_status "Generating icon sizes..."

# Scale the input to 1024x1024, padding as necessary to make it square without changing aspect ratio
sips -Z 1024 -p 1024 1024 "icon.png" -o "temp_1024.png" > /dev/null 2>&1

# Create all required icon sizes for ICNS as defined by Apple
# https://developer.apple.com/design/human-interface-guidelines/macos/icons-and-images/app-icon/

# 16x16
sips -z 16 16 "temp_1024.png" --out "$TEMP_ICONSET/icon_16x16.png" > /dev/null 2>&1
sips -z 32 32 "temp_1024.png" --out "$TEMP_ICONSET/icon_16x16@2x.png" > /dev/null 2>&1

# 24x24
sips -z 24 24 "temp_1024.png" --out "$TEMP_ICONSET/icon_24x24png" > /dev/null 2>&1
sips -z 48 48 "temp_1024.png" --out "$TEMP_ICONSET/icon_24x24@2x.png" > /dev/null 2>&1

# 32x32
sips -z 32 32 "temp_1024.png" --out "$TEMP_ICONSET/icon_32x32.png" > /dev/null 2>&1
sips -z 64 64 "temp_1024.png" --out "$TEMP_ICONSET/icon_32x32@2x.png" > /dev/null 2>&1

# 128x128
sips -z 128 128 "temp_1024.png" --out "$TEMP_ICONSET/icon_128x128.png" > /dev/null 2>&1
sips -z 256 256 "temp_1024.png" --out "$TEMP_ICONSET/icon_128x128@2x.png" > /dev/null 2>&1

# 256x256
sips -z 256 256 "temp_1024.png" --out "$TEMP_ICONSET/icon_256x256.png" > /dev/null 2>&1
sips -z 512 512 "temp_1024.png" --out "$TEMP_ICONSET/icon_256x256@2x.png" > /dev/null 2>&1

# 512x512
sips -z 512 512 "temp_1024.png" --out "$TEMP_ICONSET/icon_512x512.png" > /dev/null 2>&1
sips -z 1024 1024 "temp_1024.png" --out "$TEMP_ICONSET/icon_512x512@2x.png" > /dev/null 2>&1

print_success "Generated all icon sizes"

# Generate ICNS file using iconutil
print_status "Creating ICNS file..."
if iconutil -c icns "$TEMP_ICONSET" -o "icon.icns"; then
    print_success "Created icon.icns"
else
    print_error "Failed to create icon.icns"
    exit 1
fi

# Generate individual icon files for the icons directory
print_status "Creating individual icon files..."
for size in 16 24 32 48 64 128 256 512 1024; do
    sips -z $size $size "temp_1024.png" --out "$ICONS_DIR/${size}x${size}.png" > /dev/null 2>&1
    sips -z $size $size "temp_1024.png" --out "$ICONS_DIR/icon_${size}x${size}.png" > /dev/null 2>&1
done

# Copy common sizes to temp directory for ICO creation
for size in 16 24 32 48 64 128 256; do
    cp "$ICONS_DIR/${size}x${size}.png" "$TEMP_DIR/"
done

print_success "Created individual icon files in icons/ directory"

# Generate ICO file
print_status "Creating ICO file..."

# Check if icotool is available (from icoutils)
if command -v icotool &> /dev/null; then
    # Use icotool if available
    if icotool --icon -c -o "icon.ico" "$TEMP_DIR"/*.png; then
        print_success "Created icon.ico using icotool"
    else
        print_error "Failed to create icon.ico with icotool"
        exit 1
    fi
elif command -v magick &> /dev/null; then
    # Use ImageMagick if available
    if magick "$TEMP_DIR"/{16x16,24x24,32x32,48x48,64x64,128x128,256x256}.png "icon.ico"; then
        print_success "Created icon.ico using ImageMagick"
    else
        print_error "Failed to create icon.ico with ImageMagick"
        exit 1
    fi
else
    print_warning "Neither icotool nor ImageMagick found"
    print_warning "To create ICO files, install one of the following:"
    print_warning "  - icoutils: brew install icoutils"
    print_warning "  - ImageMagick: brew install imagemagick"
    print_warning "For now, copying a PNG as placeholder ICO"
    cp "$ICONS_DIR/256x256.png" "icon.ico"
fi

# Create Windows autorun.inf file
print_status "Creating autorun.inf for Windows..."
echo -e "[Autorun]\r\nIcon=\"icon.ico\"\r\n" > autorun.inf
print_success "Created autorun.inf"

# Backup old files
print_status "Backing up old files..."
if [[ -f "icon_old.icns" ]]; then
    mv "icon_old.icns" "icon_backup_$(date +%Y%m%d_%H%M%S).icns"
fi
if [[ -f "icon_old.ico" ]]; then
    mv "icon_old.ico" "icon_backup_$(date +%Y%m%d_%H%M%S).ico"
fi

# Clean up temporary files
print_status "Cleaning up temporary files..."
rm -rf "$TEMP_ICONSET" "$TEMP_DIR" "temp_1024.png"

print_success "Icon generation complete!"
print_status "Generated files:"
print_status "  ✓ icon.icns (macOS app icon)"
print_status "  ✓ icon.ico (Windows app icon)"
print_status "  ✓ icons/ directory with individual sizes"
print_status "  ✓ autorun.inf (Windows volume icon)"

# Show file sizes
print_status "File sizes:"
ls -lah icon.icns icon.ico 2>/dev/null | awk '{print "  " $9 ": " $5}'

print_status "To install the tools needed for ICO generation:"
print_status "  brew install icoutils    # For icotool"
print_status "  brew install imagemagick # For magick"

print_success "Done! Your Electron app should now use the updated icons after rebuilding."