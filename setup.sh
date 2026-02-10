#!/bin/bash

# Offline SCORM Player - Installation Script
# This script will set up the project for first-time use

echo "================================================"
echo "  Offline SCORM Player - Setup"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 16 or higher from https://nodejs.org/"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️  Node.js version is too old ($(node -v))"
    echo "Please upgrade to Node.js 16 or higher"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Dependencies installed successfully"
echo ""

# Create storage directories
echo "📁 Creating storage directories..."
mkdir -p storage/packages
mkdir -p storage/uploads
mkdir -p storage/db

echo "✅ Storage directories created"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created (you can customize it later)"
else
    echo "ℹ️  .env file already exists, skipping..."
fi

echo ""
echo "================================================"
echo "  ✅ Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the server:"
echo "     npm run dev (development with auto-reload)"
echo "     npm start (production)"
echo ""
echo "  2. Open your browser to:"
echo "     http://localhost:3000"
echo ""
echo "  3. Upload a SCORM package:"
echo "     curl -X POST http://localhost:3000/api/packages/upload \\"
echo "       -F \"package=@your-course.zip\""
echo ""
echo "  4. Read the documentation:"
echo "     - QUICKSTART.md for quick start guide"
echo "     - INTEGRATION.md for integration details"
echo "     - PROJECT_SUMMARY.md for complete overview"
echo ""
echo "================================================"
echo "  Happy Learning! 📚"
echo "================================================"
