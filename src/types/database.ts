import type { SkinStory, SkinStoryScores } from '@/skin-intelligence/skinStoryTypes';

export type { SkinStory } from '@/skin-intelligence/skinStoryTypes';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CheckInResponses = {
  sleepQuality?: 'Poor' | 'Okay' | 'Rested';
  stressLevel?: 'Low' | 'Medium' | 'High';
  alcoholConsumption?: 'None' | 'Light' | 'Moderate' | 'High';
  cyclePhase?: 'Follicular' | 'Ovulatory' | 'Luteal' | 'Menstrual' | 'Not tracking';
  routineNote?: string;
  movementPlan?: ('Yoga' | 'Pilates' | 'Indoors' | 'Outdoors')[];
  movementPlanNote?: string;
  skinFeelToday?: 'Dry' | 'Itchy' | 'Oily' | 'Normal';
  yesterdayNote?: string;
  // Legacy prototype field kept so earlier test entries remain readable.
  routineChange?: 'No change' | 'Strong actives' | 'New product' | 'Treatment';
  // Legacy prototype fields kept so earlier test entries remain readable.
  skinFeel?: 'Calm' | 'Dry' | 'Reactive' | 'Congested';
  activityLevel?: 'Light' | 'Moderate' | 'Intense';
};

export type AnalysisSignals = {
  redness?: number;
  dryness?: number;
  congestion?: number;
  fatigue?: number;
  photoQuality?: number;
  photoAnalysis?: PhotoAnalysis;
  environment?: EnvironmentSnapshot;
  skinHealthScore?: number;
  scoreBand?: 'stable' | 'balanced' | 'stressed' | 'reactive' | 'high_stress';
  scoreDelta?: number;
  skinStateScores?: SkinStoryScores;
  drivers?: Array<{
    label: string;
    impact: number;
    direction: 'positive' | 'negative';
  }>;
  confidence?: number;
};

export type PhotoAnalysis = {
  provider?: string;
  model?: string;
  analyzedAt?: string;
  faceDetected?: boolean;
  lighting?: number;
  sharpness?: number;
  framing?: number;
  redness?: number;
  dryness?: number;
  congestion?: number;
  fatigue?: number;
  toneUnevenness?: number;
  confidence?: number;
  summary?: string;
  retakeReasons?: string[];
};

export type EnvironmentSnapshot = {
  temperatureF?: number;
  humidity?: number;
  elevationM?: number;
  uvIndex?: number;
  usAqi?: number;
  pm25?: number;
  pm10?: number;
  ozone?: number;
  locationLabel?: string;
  provider?: string;
};

export type ProfileLocation = {
  query?: string;
  label?: string;
  latitude: number;
  longitude: number;
};

export type ProfileContext = {
  displayName?: string;
  age?: string;
  ageRange?: string;
  height?: string;
  skinAncestry?: string;
  skinType?: string;
  sensitivityLevel?: string;
  skinGoals?: string[];
  skinHistory?: string[];
  medicalHistory?: string[];
  regularCycles?: string;
  averageCycleLength?: string;
  lastPeriodStart?: string;
  perimenopause?: string;
  menopause?: string;
  hrt?: string;
  birthControl?: string;
  testosterone?: string;
  glp1Medications?: string;
  reproductiveHormonalStatus?: string[];
  smoking?: string;
  alcohol?: string;
  exerciseFrequency?: string;
  sauna?: string;
  swimming?: string;
  sunExposure?: string;
  spfUse?: string;
  typicalDiet?: string[];
  dailyProtein?: string;
  dailyWater?: string;
  dailyFruit?: string;
  dailyVegetables?: string;
  supplements?: string[];
  supplementNote?: string;
  proceduresHistory?: string[];
  skincareProducts?: string;
  skincareSearch?: string;
  knownTriggers?: string[];
  skinContextNote?: string;
};

export type DailyPlan = {
  id?: string;
  date?: string;
  skinStoryId?: string;
  context?: string;
  items?: Array<{
    id: string;
    moment: 'morning' | 'day' | 'evening';
    label: string;
    reason?: string;
    completed: boolean;
  }>;
  priorities?: Array<{
    title: string;
    detail: string;
    actions: string[];
  }>;
  ingredientsToFavor?: string[];
  ingredientsToAvoid?: string[];
  checklist?: Array<{
    id: string;
    moment?: 'morning' | 'day' | 'evening';
    title?: string;
    detail?: string;
    label: string;
    sectionTitle: string;
    completed: boolean;
  }>;
  avoid?: string[];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          age_range: string | null;
          skin_type: string | null;
          sensitivity_level: string | null;
          skin_goals: string[];
          known_triggers: string[];
          skin_context_note: string | null;
          profile_data: ProfileContext;
          location_query: string | null;
          location_label: string | null;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          age_range?: string | null;
          skin_type?: string | null;
          sensitivity_level?: string | null;
          skin_goals?: string[];
          known_triggers?: string[];
          skin_context_note?: string | null;
          profile_data?: ProfileContext;
          location_query?: string | null;
          location_label?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
          age_range?: string | null;
          skin_type?: string | null;
          sensitivity_level?: string | null;
          skin_goals?: string[];
          known_triggers?: string[];
          skin_context_note?: string | null;
          profile_data?: ProfileContext;
          location_query?: string | null;
          location_label?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      daily_entries: {
        Row: {
          id: string;
          user_id: string;
          entry_date: string;
          check_in: CheckInResponses;
          status: 'draft' | 'photo_added' | 'check_in_added' | 'analyzed' | 'planned';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entry_date?: string;
          check_in?: CheckInResponses;
          status?: 'draft' | 'photo_added' | 'check_in_added' | 'analyzed' | 'planned';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          check_in?: CheckInResponses;
          status?: 'draft' | 'photo_added' | 'check_in_added' | 'analyzed' | 'planned';
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          user_id: string;
          daily_entry_id: string;
          storage_bucket: string;
          storage_path: string;
          content_type: string | null;
          size_bytes: number | null;
          quality_checks: Json;
          captured_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_entry_id: string;
          storage_bucket?: string;
          storage_path: string;
          content_type?: string | null;
          size_bytes?: number | null;
          quality_checks?: Json;
          captured_at?: string | null;
          created_at?: string;
        };
        Update: {
          quality_checks?: Json;
          content_type?: string | null;
          size_bytes?: number | null;
        };
        Relationships: [];
      };
      environment_snapshots: {
        Row: {
          id: string;
          user_id: string;
          daily_entry_id: string;
          provider: string;
          latitude: number | null;
          longitude: number | null;
          location_label: string | null;
          temperature_f: number | null;
          humidity: number | null;
          elevation_m: number | null;
          uv_index: number | null;
          us_aqi: number | null;
          pm2_5: number | null;
          pm10: number | null;
          ozone: number | null;
          captured_at: string;
          raw_response: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_entry_id: string;
          provider?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_label?: string | null;
          temperature_f?: number | null;
          humidity?: number | null;
          elevation_m?: number | null;
          uv_index?: number | null;
          us_aqi?: number | null;
          pm2_5?: number | null;
          pm10?: number | null;
          ozone?: number | null;
          captured_at?: string;
          raw_response?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          provider?: string;
          latitude?: number | null;
          longitude?: number | null;
          location_label?: string | null;
          temperature_f?: number | null;
          humidity?: number | null;
          elevation_m?: number | null;
          uv_index?: number | null;
          us_aqi?: number | null;
          pm2_5?: number | null;
          pm10?: number | null;
          ozone?: number | null;
          captured_at?: string;
          raw_response?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      analysis_results: {
        Row: {
          id: string;
          user_id: string;
          daily_entry_id: string;
          photo_id: string | null;
          provider: string | null;
          model: string | null;
          signals: AnalysisSignals;
          confidence: Json;
          caveats: string[];
          raw_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_entry_id: string;
          photo_id?: string | null;
          provider?: string | null;
          model?: string | null;
          signals?: AnalysisSignals;
          confidence?: Json;
          caveats?: string[];
          raw_response?: Json | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      recommendation_results: {
        Row: {
          id: string;
          user_id: string;
          daily_entry_id: string;
          provider: string | null;
          model: string | null;
          skin_story: SkinStory;
          daily_plan: DailyPlan;
          safety_notes: string[];
          raw_response: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          daily_entry_id: string;
          provider?: string | null;
          model?: string | null;
          skin_story?: SkinStory;
          daily_plan?: DailyPlan;
          safety_notes?: string[];
          raw_response?: Json | null;
          created_at?: string;
        };
        Update: {
          skin_story?: SkinStory;
          daily_plan?: DailyPlan;
          safety_notes?: string[];
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
