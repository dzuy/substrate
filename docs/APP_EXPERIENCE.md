# SUBSTRATE app experience

Emma’s email is the behavioral source of truth. The two flow boards guide visual presentation.

## Current navigation

- Your Day: `/home` opens check-in or the saved daily overview.
- Explore: all nine categories from Emma’s email.
- Plan: Morning / Pre-workout / Evening routine details.
- Shop: published product discovery; no checkout.
- Profile: Your Products, Membership, personal details and saved insights.
- Tate: the top-right chat icon, outside the main tabs.

My Routine has Morning / Pre-workout / Evening tabs and existing saved completion tracking. My Progress compares up to two saved daily photos, with links to reports and check-in history. Photos and measurements are never substituted with example user data.

Onboarding remains Welcome → Profile → Photos → Wardrobe → Membership preview → Quick Insights → Welcome to Daily. Billing is simulated. Initial photo analysis and summary creation continue to use the existing analysis and ingredient systems. Front photos are analyzed; side views are optional storage only.

Skin Plate, Beauty from Within, Procedure Planning, Emerging Science, Collabs and the shopping cart have clearly labeled upcoming pages. They do not imply working integrations or transactions. Browser microphone dictation is available when supported; wearable connections remain unavailable. Tate can discuss the wardrobe but does not directly change routines.

## Implementation notes

`src/experience/categories.ts` defines category names and destinations. `src/experience/day.ts` loads saved dashboard data without starting analysis. Routine generation remains explicit and uses the existing recommendation service, including changed-input checks. Check-in still requires review before saving. Existing report and admin routes remain available.

## Navigation agreed October 23

Main tabs: Your Day (`/home` entry gate), Explore (`/explore`), Plan (`/routine`), Shop (`/shop`), Profile (`/profile`). Tate is the top-right chat link, outside the main navigation. Profile links to Your Products, Membership, personal details and saved insights. Plan uses Morning / Pre-workout / Evening.

Your Day opens check-in until today's entry is confirmed or skipped. A skip remembers only today's date on the current device and account; it does not create or overwrite observations. The next calendar date starts check-in again. `/your-day` is the dashboard; `/daily-check-in` stays available to edit. Microphone dictation uses browser SpeechRecognition when available, on explicit tap, with editable results and keyboard-dictation fallback. No microphone permission is requested automatically.
