#!/bin/bash

# Setup script for OpenAI Whisper on Mac M1
# This script installs all dependencies needed for local transcription

echo "🎙️ Setting up Whisper for Mac M1..."
echo "This will install Python dependencies and download the Whisper model."
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or later."
    echo "   You can install it using: brew install python@3.11"
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "✓ Found Python $PYTHON_VERSION"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew is not installed. Please install Homebrew first."
    echo "   Visit: https://brew.sh"
    exit 1
fi

# Install ffmpeg if not present
if ! command -v ffmpeg &> /dev/null; then
    echo "📦 Installing ffmpeg..."
    brew install ffmpeg
else
    echo "✓ ffmpeg is already installed"
fi

# Create virtual environment
echo ""
echo "🔧 Creating Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
echo "📦 Upgrading pip..."
pip install --upgrade pip

# Install PyTorch for Apple Silicon
echo ""
echo "📦 Installing PyTorch for Apple Silicon (this may take a while)..."
pip install --upgrade torch torchvision torchaudio

# Install OpenAI Whisper
echo ""
echo "📦 Installing OpenAI Whisper..."
pip install --upgrade openai-whisper

# Install additional dependencies
echo ""
echo "📦 Installing additional dependencies..."
pip install --upgrade numpy scipy

# Create whisper cache directory
WHISPER_CACHE="$HOME/.cache/whisper"
mkdir -p "$WHISPER_CACHE"
echo "✓ Created Whisper cache directory at $WHISPER_CACHE"

# Test Whisper installation
echo ""
echo "🧪 Testing Whisper installation..."
python3 -c "
import whisper
import torch
print(f'✓ Whisper version: {whisper.__version__}')
print(f'✓ PyTorch version: {torch.__version__}')
print(f'✓ MPS (Metal) available: {torch.backends.mps.is_available()}')
print(f'✓ MPS built: {torch.backends.mps.is_built()}')
"

# Download base model
echo ""
echo "📥 Downloading Whisper base model (this may take a few minutes)..."
python3 -c "
import whisper
print('Downloading base model...')
model = whisper.load_model('base')
print('✓ Base model downloaded successfully')
"

# Create a test script
cat > test-whisper.py << 'EOF'
#!/usr/bin/env python3
import whisper
import sys
import time

def test_whisper(audio_file=None):
    print("🎙️ Testing Whisper transcription...")
    
    # Load model
    print("Loading model...")
    start_time = time.time()
    model = whisper.load_model("base", device="mps")
    load_time = time.time() - start_time
    print(f"✓ Model loaded in {load_time:.2f} seconds")
    
    if audio_file:
        print(f"\nTranscribing: {audio_file}")
        start_time = time.time()
        result = model.transcribe(audio_file)
        transcribe_time = time.time() - start_time
        
        print(f"\n✓ Transcription completed in {transcribe_time:.2f} seconds")
        print(f"Language: {result['language']}")
        print(f"Text preview: {result['text'][:200]}...")
    else:
        print("\n✓ Whisper is ready to use!")
        print("To test with an audio file: python test-whisper.py <audio_file>")

if __name__ == "__main__":
    audio_file = sys.argv[1] if len(sys.argv) > 1 else None
    test_whisper(audio_file)
EOF

chmod +x test-whisper.py

# Update .env.example
echo ""
echo "📝 Updating .env.example..."
if ! grep -q "WHISPER_MODEL_SIZE" .env.example 2>/dev/null; then
    echo "" >> .env.example
    echo "# Whisper Configuration" >> .env.example
    echo "WHISPER_MODEL_SIZE=base # Options: tiny, base, small, medium, large" >> .env.example
    echo "WHISPER_DEVICE=mps # Use 'mps' for M1 GPU, 'cpu' for CPU-only" >> .env.example
    echo "WHISPER_COMPUTE_TYPE=float16 # Options: int8, float16, float32" >> .env.example
fi

echo ""
echo "✅ Whisper setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Add Whisper configuration to your .env file"
echo "2. Run 'npm run transcription:worker' to start the transcription worker"
echo "3. Test with: ./test-whisper.py <audio_file.mp3>"
echo ""
echo "📚 Available Whisper models:"
echo "   - tiny: 1.5 hours/GB VRAM, fastest, lowest accuracy"
echo "   - base: 3 hours/GB VRAM, good balance (recommended)"
echo "   - small: 5 hours/GB VRAM, better accuracy"
echo "   - medium: 10 hours/GB VRAM, high accuracy"
echo "   - large: 20 hours/GB VRAM, best accuracy"
echo ""
echo "💡 Tip: The 'base' model is recommended for podcasts as it provides"
echo "       good accuracy with reasonable speed on M1 Macs."