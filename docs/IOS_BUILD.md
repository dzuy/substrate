# iOS beta builds

Use Expo SDK 54 / React Native 0.81.5 with the locked dependencies. Native directories are generated and ignored; signing material and private QA images must never be committed.

The beta identity is `com.dzuylinh.substrate.beta`, Apple team `MB6W7WXD2R`, App Store Connect app `6829798685`. Version 1.0.0 build 2 includes the feedback fixes and native speech module. Increment the build number for each upload. The configured Router origin is required for native Expo Head.

Set the public Supabase settings and all four HTTPS API endpoints in ignored `.env.local`; see `.env.example`. Provider secrets and service-role keys must never use an `EXPO_PUBLIC_` prefix. Run `npm run ios:check`, then `npm run ios:prebuild` on a clean checkout and `pod install --project-directory=ios`.

The local `modules/substrate-speech` module autolinks through Expo. It uses Apple's Speech/AVFoundation frameworks and Android's SpeechRecognizer, with OS permission prompts on microphone activation. Device speech services may process audio online. Transcripts remain editable and are not automatically sent to Tate. A new native binary is required; Expo Go and older builds cannot load this module.

Before every Release archive, especially after `pod install`, run `npm run ios:release:prepare`. React Native 0.81.5 can reinstall Debug Hermes while preserving `ios/Pods/.last_build_configuration` as Release; without resetting that generated marker, a Release build can embed Debug Hermes and crash immediately during runtime initialization.

Archive with the generated SubstrateBeta workspace/scheme in a fresh derived-data directory. Then run `npm run ios:release:verify -- /absolute/path/to/SubstrateBeta.xcarchive`. This compares the embedded arm64 Hermes UUID against the installed RN version's Release artifact and fails closed on a mismatch. Do not upload if this check fails. Verify Release app launch on simulator or device as well: compile/archive success and web tests are not native launch tests. Do not run Debug and Release builds concurrently against the same Pods directory.

Archive with the generated SubstrateBeta workspace/scheme. Use the existing Apple account and signing assets; do not create or revoke credentials as an incidental build step. Upload only with release authorization. TestFlight upload is not a public release, and tester invitations are a separate action. Confirm processing and manual internal-group assignment after upload.

Required backend rollout: apply `202611050001_personal_wardrobe_products.sql`, deploy `analyze-products`, and deploy the web/server changes including `/api/supplement-label`. The personal-product migration is additive and preserves existing profile/catalog/wardrobe data. Validate in a transaction or isolated database before production. Existing product recognition remains usable while updated functions are rolled out.

References: https://docs.expo.dev/modules/get-started/ and https://docs.expo.dev/workflow/prebuild/
