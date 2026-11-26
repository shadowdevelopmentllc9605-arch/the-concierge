"""One-time generation of fixed, public onboarding narration; no secrets or user data."""
import base64
import json
import pathlib
import subprocess
import tempfile
import numpy as np
import wave
from kokoro_onnx import Kokoro

prompts = json.loads(pathlib.Path("src/lib/tylerVoicePrompts.json").read_text())
model = Kokoro("/tmp/tyler-model/kokoro-v1.0.onnx", "/tmp/tyler-model/voices-v1.0.bin")
with tempfile.TemporaryDirectory() as folder:
    for name, text in prompts.items():
        samples, rate = model.create(text, voice="am_michael", speed=0.95, lang="en-us")
        seconds = len(samples) / rate
        if not 1.5 < seconds < 35 or not np.isfinite(samples).all() or float(np.max(np.abs(samples))) < 0.02:
            raise RuntimeError(f"Invalid audio: {name}")
        wav_path = pathlib.Path(folder) / (name + ".wav")
        mp3 = pathlib.Path(folder) / (name + ".mp3")
        with wave.open(str(wav_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(rate)
            wav.writeframes((np.clip(samples, -1.0, 1.0) * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg","-v","error","-y","-i",str(wav_path),"-ac","1","-b:a","40k",str(mp3)],check=True)
        data = mp3.read_bytes()
        if not 1000 < len(data) < 250000:
            raise RuntimeError(f"Invalid MP3 size: {name}")
        encoded = base64.b64encode(data).decode("ascii")
        print(f"TYLER_AUDIO_INFO {name} {seconds:.2f} {len(data)}", flush=True)
        for i in range(0,len(encoded),4000):
            print(f"TYLER_AUDIO_CHUNK {name} {i//4000} {encoded[i:i+4000]}",flush=True)
