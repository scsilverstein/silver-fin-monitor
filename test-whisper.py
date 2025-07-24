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
