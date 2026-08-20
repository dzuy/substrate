# Skin Score TRD

## Purpose

Substrate needs a single longitudinal score that helps users understand whether their skin state is improving, stable, or worsening over time.

The Skin Score is a 1-100 composite metric where higher means the user's skin appears to be in a calmer, more resilient, lower-stress state.

This score should become the primary progress metric across Skin Story, Daily Plan, and Progress.

## Product Goals

- Give users one clear metric to track across repeated check-ins.
- Connect daily context signals to visible skin outcomes.
- Support prototype testing before AI/image/environment analysis is fully implemented.
- Preserve a clear path to incorporate richer future inputs such as image analysis, weather, resting heart rate, HRV, wearable sleep data, and environmental exposure.
- Avoid overstating medical certainty. The score is a wellness and aesthetic-health signal, not a diagnosis.

## V1 Input Scope

V1 should use the signals currently collected by the prototype plus a stored daily environment snapshot:

- Facial photo presence
- Sleep quality
- Stress level
- Alcohol consumption
- Cycle phase
- Skincare context or routine change
- Local temperature
- Humidity
- UV index
- Air quality
- PM2.5, PM10, and ozone where available

The facial image is not yet analyzed visually in V1. It should affect confidence and completion quality, but should not create fake redness, texture, blemish, or dryness measurements until real image analysis exists.

## Future Input Scope

The score should be designed to accept future signals without rewriting the UI model:

- Image-derived redness
- Image-derived congestion or blemish activity
- Image-derived dryness or flaking
- Image-derived texture or tone evenness
- Pollen
- Historical weather exposure
- Temperature swings
- Resting heart rate
- HRV
- Wearable sleep duration and sleep quality
- Workout or heat exposure
- Medication, supplement, or treatment events if later supported

## Score Definition

The Skin Score is calculated as:

```txt
Skin Score = clamp(100 - weighted penalties + recovery bonuses, 1, 100)
```

Higher score means:

- Better apparent stability
- Lower likely skin stress
- Better recovery context
- Fewer negative daily contributors

Lower score means:

- More context-based risk for redness, congestion, dryness, or fatigue
- More deviation from a calm baseline
- More need for a conservative routine

## V1 Weighting Philosophy

Because true image analysis is not yet active, V1 should be conservative and context-led.

Target weighting:

- Image signal: 45%
- Check-in context: 30%
- Environment context: 15%
- Baseline and consistency: 10%

In the current prototype, image signal is limited to photo presence and future readiness. The actual V1 implementation may approximate this through penalties and confidence until visual analysis exists.

## V1 Penalty Rules

Start with a base score of `100`.

Apply penalties:

| Signal | Value | Score Impact |
| --- | --- | ---: |
| Sleep quality | Poor | -10 |
| Sleep quality | Okay | -4 |
| Stress level | High | -12 |
| Stress level | Medium | -6 |
| Alcohol consumption | Moderate | -6 |
| Alcohol consumption | High | -12 |
| Cycle phase | Luteal | -4 |
| Cycle phase | Menstrual | -3 |
| Skincare context | Strong actives | -10 |
| Skincare context | New product | -5 |
| Skincare context | Treatment | -8 |
| Photo | Missing | -8 |
| Environment | Missing | -5 |
| UV index | 6-7 | -4 |
| UV index | 8+ | -8 |
| Humidity | < 40% | -4 |
| Humidity | < 30% | -7 |
| US AQI | 51-100 | -3 |
| US AQI | 101-150 | -6 |
| US AQI | 151+ | -10 |
| PM2.5 | > 35 | -4 |
| Temperature | 90°F+ | -4 |
| Temperature | 35°F or lower | -3 |

Apply recovery bonuses:

| Signal | Value | Score Impact |
| --- | --- | ---: |
| Sleep quality | Rested | +3 |
| Stress level | Low | +3 |
| Alcohol consumption | None | +2 |
| Skincare context | No change | +2 |
| UV index | 0-2 | +1 |
| Humidity | 40-60% | +2 |

Clamp final score to `1-100`.

## Score Bands

The score should map to human-readable bands:

| Score Range | Band | Product Language |
| --- | --- | --- |
| 85-100 | Stable | Stable and resilient |
| 70-84 | Balanced | Generally balanced |
| 55-69 | Stressed | Some stress showing |
| 40-54 | Reactive | Elevated reactivity |
| 1-39 | High stress | High skin stress state |

These labels should be treated as product copy and can be refined later.

## Drivers

The scoring system should output drivers in addition to the final score.

Each driver should include:

```ts
type SkinHealthDriver = {
  label: string;
  impact: number;
  direction: 'positive' | 'negative';
};
```

Examples:

- `Poor sleep`, impact `-10`
- `High stress`, impact `-12`
- `No alcohol`, impact `+2`
- `Strong actives`, impact `-10`
- `High UV`, impact `-4`
- `Low humidity`, impact `-4`

Drivers power the Skin Story explanation and help users understand why the score changed.

## Data Contract

No database migration is required for V1 if the score is stored in existing JSON fields.

Recommended shape inside `analysis_results.signals`:

```ts
type AnalysisSignals = {
  redness?: number;
  dryness?: number;
  congestion?: number;
  fatigue?: number;
  photoQuality?: number;
  environment?: EnvironmentSnapshot;
  skinHealthScore?: number;
  scoreBand?: 'stable' | 'balanced' | 'stressed' | 'reactive' | 'high_stress';
  scoreDelta?: number;
  drivers?: SkinHealthDriver[];
  confidence?: number;
};

type EnvironmentSnapshot = {
  temperatureF?: number;
  humidity?: number;
  uvIndex?: number;
  usAqi?: number;
  pm25?: number;
  pm10?: number;
  ozone?: number;
  locationLabel?: string;
  provider?: string;
};
```

`scoreDelta` should compare the current entry against the most recent prior completed entry for the same user.

If no prior entry exists, `scoreDelta` should be omitted or `null` in UI-facing logic.

## UI Requirements

### Skin Story

Skin Story should lead with the Skin Score.

Primary display:

```txt
Skin Score
78
Generally balanced
```

Secondary display:

```txt
+4 from last check-in
```

If no prior score exists:

```txt
First scored check-in
```

Skin Story should show the top drivers instead of generic contributors.

Example:

- Poor sleep
- Medium stress
- Strong actives
- High UV
- Low humidity

The priority statement should be generated from the dominant negative driver or score band.

Skin Story should also show a compact environment card when environment data exists.

### Daily Plan

Daily Plan should use the score band and drivers to choose plan emphasis.

Examples:

- Low score with strong actives: simplify routine and reduce actives.
- Low score with poor sleep/high stress: recovery and barrier support.
- Balanced score: maintain consistency.

### Progress

Progress should show the Skin Score for each completed entry.

V1 Progress can list the score per entry without a chart.

Future Progress should show:

- Score trend over time
- Average score
- Best/worst recent score
- Driver frequency

## Confidence

The score should include a confidence value from `0-100`.

Suggested V1 confidence:

- Photo present: base `70`
- Photo missing: base `45`
- Complete check-in: add `10`
- Missing check-in values: subtract `5-15`

Confidence should not be displayed prominently in V1 unless needed for debugging or explanatory copy.

## Non-Goals

V1 should not:

- Claim medical diagnosis
- Infer visual conditions from the photo without actual image analysis
- Present the score as clinically validated
- Overweight cycle phase or alcohol in a way that feels judgmental
- Require wearable data

## Future Algorithm Direction

When image analysis exists, score calculation should shift toward a true weighted model:

```txt
skin_health_score =
  image_component * 0.45 +
  check_in_component * 0.25 +
  environment_component * 0.15 +
  biometric_component * 0.10 +
  consistency_component * 0.05
```

The exact weights should be adjusted after tester feedback and data review.

Future image component may include:

- Redness
- Texture
- Congestion
- Dryness
- Tone evenness
- Under-eye fatigue

Environment component currently includes:

- UV
- Humidity
- Air quality
- Temperature

Future environment component may include:

- Pollen
- Weather trend versus recent personal baseline
- Seasonality

Future biometric component may include:

- Resting heart rate deviation
- HRV deviation
- Sleep duration
- Sleep efficiency

## Implementation Plan

1. Add score fields to TypeScript types.
2. Add scoring helper in `src/services/recommendations.ts`.
3. Generate `skinHealthScore`, `scoreBand`, `drivers`, `confidence`, and `scoreDelta`.
4. Store generated values in `analysis_results.signals`.
5. Update Skin Story to lead with Skin Score.
6. Update Progress to display score per entry.
7. Add environment snapshot storage and Open-Meteo lookup.
8. Feed environment drivers into the score and Skin Story.
9. Keep the existing rule-based recommendations until AI-backed generation is introduced.

## Open Questions

- Should the score reset its baseline after a user changes routine intentionally?
- How much should cycle phase affect score versus only appearing as a contextual driver?
- Should score compare against absolute health or personal baseline?
- Should photo quality affect score directly or only confidence?
- Should testers see confidence, or should it stay internal?
