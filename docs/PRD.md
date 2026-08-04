# Substrate V1 Product Requirements Document

Last updated: August 3, 2026

## 1. Purpose

Substrate is an iOS-first and web-supported skincare intelligence application that helps users understand what may be influencing their skin on a given day.

This PRD defines the first working version of the product. It is intended to serve as a north star for the founder and for any design, engineering, or agentic development work that follows.

V1 should not be treated as a throwaway mockup. It should be a real, testable product foundation with real user data capture, real photo storage, basic analysis, and AI-generated recommendations, while remaining scoped tightly enough to support a 10-20 user private test.

## 2. Product Goal

Build a polished, mobile-first prototype that can be used by 10-20 private testers and can technically scale to roughly 100 users without major architectural rewrites.

The product should demonstrate the full daily workflow:

1. User signs in.
2. User captures a daily face photo.
3. User completes a short daily check-in.
4. Substrate stores the data.
5. Substrate performs basic analysis.
6. Substrate generates a personalized Today’s Skin Story.
7. Substrate generates a focused daily plan.

The central value proposition is not a generic skin score. The central value is helping the user answer:

- What changed?
- What may be contributing to it?
- What should I do today?

## 3. Target Users

Primary early users:

- Women interested in skincare, aesthetic health, and skin optimization.
- Users willing to complete a daily photo and short check-in.
- Users comfortable testing an early product and giving feedback.

Early tester profile:

- 10-20 invited users for V1 validation.
- Technically scalable to around 100 users.
- Users may use either mobile web or Expo Go during prototype testing.

## 4. Platforms

V1 targets:

- Expo Go prototype experience.
- Web prototype experience.
- iOS-first product design and interaction model.

The web version exists to support fast development and private testing, but the interface should remain designed as a phone application.

V1 does not require:

- App Store distribution.
- TestFlight distribution.
- Android-specific polish.
- Production-grade native development build.

## 5. Current App Baseline

The current prototype includes these Expo Router screens:

- `Welcome`
- `Take Photo`
- `Daily Check-In`
- `Today’s Skin Story`
- `Daily Plan`

Current implementation status:

- The visual system is mobile-first and wellness-oriented.
- The flow is mostly deterministic and local.
- The photo screen currently uses a generated placeholder portrait.
- There is no authentication, backend, camera access, data persistence, or AI integration yet.

V1 should evolve this baseline into a real end-to-end workflow.

## 6. V1 Scope

### 6.1 In Scope

V1 must include:

- Authentication.
- Real camera capture or photo upload.
- Stored daily face photos.
- Stored daily check-in data.
- User-specific daily entries.
- Basic skin/photo analysis.
- AI-generated Today’s Skin Story.
- AI-generated Daily Plan.
- Mobile-first UI for the five core screens.
- Web support for development and testing.
- Basic admin/developer observability for debugging tester issues.

### 6.2 Out of Scope

V1 should not include:

- E-commerce or product purchasing.
- Full wearable integrations.
- Lab/biomarker integrations.
- Menstrual-cycle app integrations.
- Provider-facing dashboards.
- Complex longitudinal analytics dashboards.
- Medical diagnosis.
- Regulated clinical claims.
- Social features.
- Payments.
- Push notifications unless explicitly added later.
- Production-grade computer vision accuracy.

## 7. Product Principles

Substrate should feel:

- Premium.
- Calm.
- Personal.
- Scientific without feeling clinical.
- Clear and easy to understand.
- Designed for skincare and aesthetic health.

Substrate should avoid feeling like:

- A generic beauty-commerce app.
- A hospital application.
- A dense analytics dashboard.
- An AI chatbot.
- A collection of disconnected scores.

## 8. Core User Flow

### 8.1 Welcome

Purpose:

- Introduce Substrate.
- Communicate the core idea.
- Start the daily flow.

Requirements:

- Show Substrate branding.
- Communicate that outcomes begin beneath the surface.
- Provide a primary action to start today’s flow.

Acceptance criteria:

- User understands the product’s purpose within one screen.
- User can start the daily workflow with one clear action.

### 8.2 Authentication

Purpose:

- Identify the user.
- Associate photos, check-ins, analysis, and generated plans with the correct user.

Requirements:

- User can sign up.
- User can sign in.
- User can sign out.
- Auth state persists across app reloads.
- Auth is required before storing personal data.

Preferred V1 auth options:

- Email magic link.
- Email/password.
- OAuth can be considered later if it slows implementation.

Acceptance criteria:

- A tester can create an account and complete the daily flow under their own user profile.
- Another tester cannot access that user’s data.

### 8.3 Take Photo

Purpose:

- Capture the user’s daily face image for comparison and analysis.

Requirements:

- User can open camera capture on supported devices.
- User can submit a photo.
- App provides simple capture guidance:
  - Face the camera directly.
  - Use soft, even lighting.
  - Remove glasses where appropriate.
  - Keep face centered.
- Photo is uploaded to storage.
- Photo is associated with the authenticated user and the current daily entry.

Web fallback:

- If camera access is limited in web testing, allow photo upload.

Acceptance criteria:

- A real photo can be captured or uploaded.
- The photo is stored and can be retrieved for the daily entry.
- Failed upload states are visible and recoverable.

### 8.4 Daily Check-In

Purpose:

- Capture daily context that may help explain changes in the user’s skin.

V1 fields:

- Skin feel.
- Stress level.
- Sleep quality.
- Activity level.
- Optional cycle phase.

Requirements:

- Inputs are fast to complete.
- Selections are stored with the daily entry.
- User can continue only after required fields are completed.
- Optional fields remain clearly optional.

Acceptance criteria:

- A user can complete the check-in in under one minute.
- Check-in data is stored and available to analysis and recommendation generation.

### 8.5 Basic Analysis

Purpose:

- Produce an initial attempt at interpreting the user’s photo and check-in data.

V1 analysis does not need to be highly accurate, but it must be real. It should attempt to produce useful structured signals from actual user data.

Potential V1 signals:

- Redness/inflammation estimate.
- Dryness or dullness estimate.
- Visible breakout/congestion estimate.
- Under-eye or fatigue signal.
- Photo quality score.
- Check-in-derived recovery/stress context.

Requirements:

- Analysis result is stored.
- Analysis result includes confidence or caveat language where appropriate.
- Analysis should gracefully handle poor image quality.
- Analysis should avoid medical diagnosis.

Implementation options:

- AI vision model analysis.
- Lightweight image-processing heuristics.
- A hybrid approach using image metadata, model output, and check-in inputs.

Acceptance criteria:

- The system analyzes the submitted daily entry and stores structured results.
- The analysis output can be used as input to Skin Story and Daily Plan generation.
- The user sees a clear result, not a raw technical output.

### 8.6 Today’s Skin Story

Purpose:

- Present the core value of Substrate: a clear explanation of what appears different today and what may be contributing.

Requirements:

- Uses the user’s actual submitted photo and check-in data.
- Uses stored analysis results.
- Generates a concise user-facing narrative.
- Identifies likely contributors.
- Uses calm, non-alarming language.
- Avoids medical claims and diagnosis.

Example output themes:

- “Your skin appears more inflamed today.”
- “Visible redness is trending above your recent baseline.”
- “Poor sleep and higher stress may be contributing.”

Acceptance criteria:

- User understands what changed.
- User understands likely contributing factors.
- User does not feel overwhelmed by scores or raw metrics.

### 8.7 Daily Plan

Purpose:

- Convert the Skin Story into practical, prioritized actions.

Requirements:

- Recommendations are AI-generated for the user’s daily entry.
- Recommendations are organized by priority, not generic product category.
- The plan can include:
  - Ingredients.
  - Product types.
  - Nutrition suggestions.
  - Lifestyle actions.
  - Things to avoid.
- Recommendations must avoid medical claims.
- Recommendations should be understandable without expert skincare knowledge.

Acceptance criteria:

- User receives a clear, practical plan for today.
- Plan references the likely skin state and contributors.
- Plan is specific enough to act on, but not overconfident.

## 9. Data Model Requirements

V1 should support these core entities:

### User

- User ID.
- Email.
- Auth provider metadata.
- Created timestamp.

### Daily Entry

- Entry ID.
- User ID.
- Date.
- Photo reference.
- Check-in responses.
- Analysis result reference.
- Generated Skin Story.
- Generated Daily Plan.
- Created timestamp.
- Updated timestamp.

### Photo

- Photo ID.
- User ID.
- Storage path.
- Capture/upload timestamp.
- Basic metadata.
- Optional quality checks.

### Analysis Result

- Analysis ID.
- Entry ID.
- Structured signal estimates.
- Confidence/caveat fields.
- Raw provider response if useful for debugging.
- Created timestamp.

### Recommendation Result

- Recommendation ID.
- Entry ID.
- Skin Story text.
- Daily Plan text/structured sections.
- Model/provider metadata.
- Created timestamp.

## 10. Backend Requirements

V1 requires a real backend.

Capabilities:

- Authentication.
- Database persistence.
- File/photo storage.
- Server-side analysis orchestration.
- Server-side AI recommendation generation.
- Basic error logging.

Implementation preference can be decided separately, but candidates include:

- Supabase for auth, database, and storage.
- Serverless functions for analysis and AI generation.
- OpenAI API for image/text analysis and recommendation generation.

Security requirements:

- Users can access only their own data.
- Photos must not be publicly readable.
- API keys must never be exposed in the client.
- AI calls must happen server-side.

## 11. AI Requirements

V1 AI output should be useful but conservative.

Requirements:

- Use actual user entry data as input.
- Return structured output where possible.
- Separate internal analysis fields from user-facing copy.
- Include safety/caveat language where appropriate.
- Avoid diagnosis, treatment claims, and clinical certainty.
- Avoid sounding like a chatbot.

Desired AI output structure:

- Summary.
- Observed skin state.
- Potential contributors.
- Today’s priority.
- Recommended actions.
- What to avoid.
- Confidence/caveats.

## 12. Privacy And Trust

V1 collects sensitive personal images and wellness data. Privacy must be treated as a core product requirement.

Requirements:

- Explain why photos are collected.
- Explain how photos are used.
- Store data under authenticated user ownership.
- Do not expose private photos in public URLs.
- Provide a basic way to delete test user data manually during the private beta.

Future requirement:

- User-facing data deletion flow.

## 13. Visual And UX Requirements

The app should maintain the established visual direction:

- Mobile-first phone proportions.
- Centered mobile experience on wide web screens.
- Muted neutral background.
- Burgundy, berry, or plum accent treatment.
- Rounded cards and calm controls.
- Clear hierarchy.
- Minimal scrolling unless content requires it.
- Primary actions visible and reachable.

The interface should not become:

- Overly decorative.
- Dashboard-heavy.
- Product-commerce oriented.
- Clinical or hospital-like.

## 14. Technical Requirements

Current technical foundation:

- Expo.
- React Native.
- TypeScript.
- Expo Router.
- React Native Web.
- SDK 54 for Expo Go compatibility.

V1 technical requirements:

- Keep one shared Expo/React Native codebase for mobile and web.
- Do not create a separate web application.
- Maintain strict TypeScript.
- Keep route structure simple until product complexity requires otherwise.
- Use real backend services for auth, storage, and persistence.
- Keep AI provider calls server-side.
- Keep environment-specific secrets out of the client bundle.

## 15. Success Criteria

V1 works when:

- A new tester can sign up or sign in.
- A tester can capture or upload a real face photo.
- A tester can complete the daily check-in.
- The system stores the real daily data.
- The system performs basic analysis.
- The system generates a Today’s Skin Story.
- The system generates a Daily Plan.
- The full workflow is visually polished and understandable.
- 10-20 testers can complete the flow.
- The technical architecture could plausibly support about 100 users.
- The visual direction feels validated enough to continue building.

## 16. Key Risks

### Analysis Quality

The first analysis may be imperfect. V1 should frame results as early signals and avoid overconfidence.

### Photo Quality

Poor lighting, makeup, glasses, or inconsistent framing may reduce analysis usefulness. The app should guide the user and identify low-quality captures.

### Privacy Sensitivity

Face photos are sensitive. Poor privacy handling would undermine trust quickly.

### AI Overreach

AI-generated advice can sound too certain. Prompts and output constraints must avoid medical claims.

### Scope Creep

Substrate has many possible integrations. V1 should stay focused on the daily photo, check-in, skin story, and plan.

## 17. Open Decisions

These should be resolved before backend implementation begins:

- Backend provider.
- Authentication method.
- Photo storage provider and access-control model.
- AI provider and model selection.
- Whether analysis is vision-model-first, heuristic-first, or hybrid.
- Data retention policy for private testers.
- Manual admin process for deleting tester data.
- Whether testers use Expo Go, web, or both.

## 18. Near-Term Implementation Milestones

### Milestone 1: Product Shell

- Keep current visual flow.
- Refine screen copy.
- Confirm mobile layout.

### Milestone 2: Authentication

- Add sign up, sign in, sign out.
- Protect the daily flow behind auth.

### Milestone 3: Real Photo Capture

- Add camera capture and/or upload.
- Store photo securely.
- Associate photo with daily entry.

### Milestone 4: Daily Entry Persistence

- Store check-in fields.
- Create one daily entry per user per day.

### Milestone 5: Basic Analysis

- Generate structured analysis from photo and check-in.
- Store analysis result.

### Milestone 6: AI Skin Story And Daily Plan

- Generate personalized user-facing output.
- Render stored generated results in the existing screens.

### Milestone 7: Private Tester Readiness

- Add error handling.
- Add loading states.
- Add empty states.
- Add basic manual support/debugging workflow.
- Run end-to-end testing with seeded and real tester accounts.

