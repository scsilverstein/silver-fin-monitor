#!/usr/bin/env python3
"""Simple test of Whisper transcription"""

import whisper
import sys
import warnings
warnings.filterwarnings("ignore")

print("Loading Whisper model...")
# Try CPU first to avoid MPS compatibility issues
model = whisper.load_model("base", device="cpu")
print("Model loaded successfully on CPU!")

# Test with a simple audio file if provided
if len(sys.argv) > 1:
    audio_path = sys.argv[1]
    print(f"\nTranscribing: {audio_path}")
    
    result = model.transcribe(
        audio_path,
        fp16=True,
        language=None,
        task='transcribe',
        temperature=0.0,
        verbose=False
    )
    
    print(f"\nLanguage detected: {result.get('language', 'unknown')}")
    print(f"Text length: {len(result['text'])} characters")
    print("\nTranscript preview:")
    print("---")
    print(result['text'][:500] + "..." if len(result['text']) > 500 else result['text'])
    print("---")
else:
    print("\nModel is ready! Provide an audio file path to transcribe.")
    print("Usage: python test-whisper-simple.py <audio_file>")