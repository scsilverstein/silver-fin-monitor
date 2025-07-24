#!/usr/bin/env python3
"""Test MLX Whisper transcription with correct model names"""

import mlx_whisper
import sys

print("MLX Whisper Test")
print("================")
print("MLX Whisper uses Apple's Metal Performance Shaders for optimal M1/M2 performance")

if len(sys.argv) > 1:
    audio_path = sys.argv[1]
    print(f"\nTranscribing: {audio_path}")
    
    # Use the correct MLX community model name
    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo="mlx-community/whisper-base",  # Correct model name
        language=None,  # Auto-detect
        task='transcribe',
        temperature=0.0,
        verbose=True
    )
    
    print(f"\n✅ Transcription complete!")
    print(f"Language: {result.get('language', 'unknown')}")
    print(f"Text length: {len(result['text'])} characters")
    print("\nTranscript preview:")
    print("---")
    print(result['text'][:500] + "..." if len(result['text']) > 500 else result['text'])
    print("---")
else:
    print("\nUsage: python test-mlx-whisper-fixed.py <audio_file>")
    print("\nMLX Whisper models available:")
    print("- mlx-community/whisper-tiny")
    print("- mlx-community/whisper-base")  
    print("- mlx-community/whisper-small")
    print("- mlx-community/whisper-medium")
    print("- mlx-community/whisper-large-v3-mlx")
    print("- mlx-community/whisper-large-v3-turbo")
    print("- mlx-community/whisper-turbo")