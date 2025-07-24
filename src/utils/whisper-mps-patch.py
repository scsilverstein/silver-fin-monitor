#!/usr/bin/env python3
"""
Whisper MPS patch for M1 Mac compatibility
Wraps Whisper to handle MPS limitations
"""

import torch
import whisper
import numpy as np
from typing import Union, Optional
import warnings

class WhisperMPS:
    """Whisper wrapper that handles MPS limitations"""
    
    def __init__(self, model_name: str = "base"):
        # Set MPS fallback for unsupported operations
        import os
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
        
        # Load model - will use MPS with CPU fallback for unsupported ops
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.model = whisper.load_model(model_name, device=self.device)
        self.model_name = model_name
        
        # Optimize model for MPS
        self._optimize_for_mps()
        
    def _optimize_for_mps(self):
        """Apply MPS-specific optimizations"""
        # Ensure model is in eval mode
        self.model.eval()
        
        # Disable gradient computation for inference
        for param in self.model.parameters():
            param.requires_grad = False
            
    def transcribe(
        self,
        audio: Union[str, np.ndarray],
        *,
        verbose: bool = False,
        temperature: Union[float, tuple] = (0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
        compression_ratio_threshold: Optional[float] = 2.4,
        logprob_threshold: Optional[float] = -1.0,
        no_speech_threshold: Optional[float] = 0.6,
        condition_on_previous_text: bool = True,
        initial_prompt: Optional[str] = None,
        word_timestamps: bool = False,
        prepend_punctuations: str = "\"'"¿([{-",
        append_punctuations: str = "\"'.。,，!！?？:：")]}、",
        fp16: bool = False,  # Force False for MPS
        language: Optional[str] = None,
        task: str = "transcribe",
        beam_size: Optional[int] = None,
        patience: Optional[float] = None,
        length_penalty: Optional[float] = None,
        suppress_tokens: Optional[str] = "-1",
        suppress_blank: bool = True,
        without_timestamps: bool = False,
    ):
        """Transcribe audio with MPS optimizations"""
        
        # Force fp16=False for MPS compatibility
        if self.device == "mps":
            fp16 = False
            if verbose:
                print("Note: Using fp32 for MPS compatibility")
        
        # Suppress warnings during transcription
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            
            # Use MPS with CPU fallback
            result = whisper.transcribe(
                self.model,
                audio,
                verbose=verbose,
                temperature=temperature,
                compression_ratio_threshold=compression_ratio_threshold,
                logprob_threshold=logprob_threshold,
                no_speech_threshold=no_speech_threshold,
                condition_on_previous_text=condition_on_previous_text,
                initial_prompt=initial_prompt,
                word_timestamps=word_timestamps,
                prepend_punctuations=prepend_punctuations,
                append_punctuations=append_punctuations,
                fp16=fp16,
                language=language,
                task=task,
                beam_size=beam_size,
                patience=patience,
                length_penalty=length_penalty,
                suppress_tokens=suppress_tokens,
                suppress_blank=suppress_blank,
                without_timestamps=without_timestamps,
            )
            
        return result


def load_model_mps(name: str, device: Optional[str] = None, download_root: Optional[str] = None):
    """Load Whisper model optimized for MPS"""
    if device is None:
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    
    if device == "mps":
        # Enable MPS fallback
        import os
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
    
    return WhisperMPS(name)


if __name__ == "__main__":
    # Test the MPS-optimized Whisper
    import sys
    
    print("Loading Whisper with MPS optimizations...")
    model = load_model_mps("base")
    print(f"✅ Model loaded on {model.device}")
    
    if len(sys.argv) > 1:
        audio_path = sys.argv[1]
        print(f"\nTranscribing: {audio_path}")
        
        result = model.transcribe(audio_path, verbose=True)
        
        print(f"\n✅ Transcription complete!")
        print(f"Language: {result.get('language', 'unknown')}")
        print(f"Text: {result['text'][:500]}...")
    else:
        print("\nModel ready! Provide an audio file to test transcription.")
        print("Usage: python whisper-mps-patch.py <audio_file>")