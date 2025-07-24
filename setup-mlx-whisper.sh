#!/bin/bash

# Setup MLX Whisper for Apple Silicon optimization

echo "🚀 Setting up MLX Whisper for Apple Silicon..."

# Activate virtual environment
source ./venv/bin/activate

# Install MLX and MLX Whisper
echo "📦 Installing MLX and MLX Whisper..."
pip install -U mlx mlx-whisper

# Test MLX installation
echo "🧪 Testing MLX installation..."
python -c "import mlx; print(f'MLX version: {mlx.__version__}')"

# Download MLX Whisper models
echo "📥 Downloading MLX Whisper models..."
python -c "
import mlx_whisper
# This will download the model on first use
print('MLX Whisper is ready!')
"

echo "✅ MLX Whisper setup complete!"
echo "MLX uses Apple's Metal Performance Shaders for optimal performance on M1/M2 chips"