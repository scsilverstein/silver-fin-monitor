#!/usr/bin/env python3
"""Test MPS support for Whisper on M1 Mac"""

import torch
import whisper
import sys
import warnings
warnings.filterwarnings("ignore", category=UserWarning)

print("Python version:", sys.version)
print("PyTorch version:", torch.__version__)
print("MPS available:", torch.backends.mps.is_available())
print("MPS built:", torch.backends.mps.is_built())

if torch.backends.mps.is_available():
    print("\n✅ MPS is available on this system")
    
    # Test creating a tensor on MPS
    try:
        test_tensor = torch.tensor([1.0, 2.0, 3.0]).to("mps")
        print("✅ Can create tensors on MPS")
    except Exception as e:
        print(f"❌ Error creating tensor on MPS: {e}")
    
    # Test Whisper model on MPS
    try:
        print("\n🔄 Loading Whisper model on MPS...")
        # Use torch.set_default_device to ensure all operations use MPS
        torch.set_default_device("mps")
        model = whisper.load_model("base", device="mps")
        print("✅ Whisper model loaded on MPS successfully!")
        
        # Test transcription on MPS
        if len(sys.argv) > 1:
            audio_path = sys.argv[1]
            print(f"\n🔄 Testing transcription on MPS with: {audio_path}")
            
            # Ensure audio processing uses MPS
            result = model.transcribe(
                audio_path,
                fp16=False,  # MPS doesn't support fp16 well
                language=None,
                verbose=True
            )
            
            print(f"\n✅ Transcription successful on MPS!")
            print(f"Language: {result.get('language', 'unknown')}")
            print(f"Text preview: {result['text'][:200]}...")
        else:
            print("\n💡 Provide an audio file path to test transcription")
            
    except Exception as e:
        print(f"\n❌ Error with Whisper on MPS: {e}")
        print(f"Error type: {type(e).__name__}")
        
        # Try to identify the specific issue
        if "sparse" in str(e).lower():
            print("\n⚠️  MPS doesn't support sparse operations. This is a known limitation.")
            print("🔧 Solution: We need to patch Whisper to avoid sparse operations on MPS")
        elif "float16" in str(e).lower() or "fp16" in str(e).lower():
            print("\n⚠️  MPS has limited float16 support.")
            print("🔧 Solution: Use float32 instead")
            
else:
    print("\n❌ MPS is not available on this system")
    print("Are you running on an Apple Silicon Mac?")

# Additional diagnostics
print("\n📊 System info:")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"Number of CPU cores: {torch.get_num_threads()}")

# Check PyTorch MPS operations support
print("\n🔍 Testing specific MPS operations:")
operations_to_test = [
    ("Matrix multiplication", lambda: torch.mm(torch.randn(3, 3).to("mps"), torch.randn(3, 3).to("mps"))),
    ("Convolution", lambda: torch.nn.functional.conv2d(torch.randn(1, 1, 5, 5).to("mps"), torch.randn(1, 1, 3, 3).to("mps"))),
    ("Attention", lambda: torch.nn.functional.scaled_dot_product_attention(
        torch.randn(1, 8, 10, 64).to("mps"),
        torch.randn(1, 8, 10, 64).to("mps"),
        torch.randn(1, 8, 10, 64).to("mps")
    )),
]

for op_name, op_func in operations_to_test:
    try:
        op_func()
        print(f"✅ {op_name}: Supported")
    except Exception as e:
        print(f"❌ {op_name}: {type(e).__name__}")