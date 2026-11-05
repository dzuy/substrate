# Beta QA boundaries

Before calling a native release verified, exercise actual hardware audio and cameras. Compile checks, simulator UI checks and mocked speech results do not establish device microphone/transcription accuracy.

- Speech: allow and deny each permission; stop while listening; retry after no speech/network interruption; review partial transcription; append to existing text; navigate away/background; return and retry. Confirm no duplicate transcript or lost typed text.
- Product recognition: incomplete identities show an explicit review state, never an uncalibrated confidence percentage. Check exact label text; acceptance requires brand and name. Review does not imply catalog or formula verification.
- Camera: capture, preview, retake, confirm; file selection; denial and retry on desktop and mobile.
- Metrics: save without regeneration; use Update my routine once; retain prior routine and inputs on failure.
- Profile: preserve hidden legacy data while simplifying fields. Supplement label transcription requires editable review before profile save; no inferred identity or dose.
- Wardrobe: repeated catalog Add taps create one owned record; manual brand/name-only entry works after migration; legacy notes remain accessible.

Use a test account for live model requests. Keep private photos, account information and raw responses out of this public repository. Current private validation evidence is maintained outside the checkout.
