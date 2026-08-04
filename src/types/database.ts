export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CheckInResponses = {
  skinFeel?: 'Calm' | 'Dry' | 'Reactive' | 'Congested';
  stressLevel?: 'Low' | 'Medium' | 'High';
  sleepQuality?: 'Poor' | 'Okay' | 'Rested';
  activityLevel?: 'Light' | 'Moderate' | 'Intense';
  cyclePhase?: 'Follicular' | 'Ovulatory' | 'Luteal' | 'Not tracking';
};

export type AnalysisSignals = {
  redness?: number;
  dryness?: number;
  congestion?: number;
  fatigue?: number;
  photoQuality?: number;
};

export type SkinStory = {
  headline?: string;
  summary?: string;
  contributors?: Array<{ label: string; detail: string }>;
  priority?: string;
};

export type DailyPlan = {
  priorities?: Array<{
    title: string;
    detail: string;
    actions: string[];
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
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
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
