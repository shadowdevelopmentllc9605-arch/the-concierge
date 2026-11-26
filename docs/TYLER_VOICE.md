# Tyler onboarding narration

Phase Two voice correction. Tyler's established target is a masculine, natural, confident young adult voice. Fixed onboarding prompts are prerecorded with Kokoro-82M v1.0, voice am_michael (American English masculine), speed 0.95. The model is distributed under Apache-2.0: https://huggingface.co/hexgrad/Kokoro-82M . ONNX conversion: https://github.com/thewh1teagle/kokoro-onnx . No model, credentials, customer data, or runtime AI service is shipped. Only seven generated MP3 files containing existing public onboarding copy are bundled; Megan's speech selection remains unchanged.

Generation run: https://github.com/shadowdevelopmentllc9605-arch/the-concierge/actions/runs/45726473394 ; source script scripts/generate_tyler_voice.py; kokoro-onnx==0.4.9; model release model-files-v1.0. Downloaded model SHA-256 7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5; voices SHA-256 bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d. First run failed for missing soundfile dependency; corrected with standard-library WAV writer. Second run succeeded, verifying non-silent finite audio and durations; exact log chunks committed as MP3 assets. The generation workflow is removed after its one-time run; no recurring paid service. Duration and size are objective checks, not proof of subjective voice suitability.

- welcome: 9.88 seconds, 49917 bytes
- profile: 4.16 seconds, 21357 bytes
- measurements: 9.6 seconds, 48477 bytes
- review: 7.77 seconds, 39357 bytes
- style: 4.61 seconds, 23517 bytes
- closet: 7.15 seconds, 36237 bytes
- friends: 4.86 seconds, 24837 bytes

Android acceptance: use the temporary independent review entry with the actual onboarding components; select Tyler, listen, proceed to the profile prompt, replay if autoplay is blocked. Remove the preview-only HTML/entry/build configuration before production merge. No production Auth/DB/Stripe changes, no new Supabase branch. The body-scan pause remains intact. Future dynamic narration requires a separate decision; fixed assets do not provide conversational voice.
