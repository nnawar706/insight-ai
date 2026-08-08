export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type SentimentLabel = "positive" | "neutral" | "negative";
export type BiasLabel = "left" | "center" | "right" | "mixed" | "unclear";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          listing_url: string;
          parser_strategy: string | null;
          is_active: boolean;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          listing_url: string;
          parser_strategy?: string | null;
          is_active?: boolean;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sources"]["Insert"]>;
        Relationships: [];
      };
      articles: {
        Row: {
          id: string;
          source_id: string;
          url: string;
          canonical_url: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at: string;
          analyzed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          url: string;
          canonical_url?: string | null;
          title: string;
          image_url: string;
          published_at: string;
          raw_text: string;
          scraped_at?: string;
          analyzed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["articles"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "articles_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      article_analyses: {
        Row: {
          id: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabel;
          bias_score: number;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes: string;
          loaded_terms: string[];
          disclaimer: string;
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          summary: string;
          sentiment_score: number;
          sentiment_label: SentimentLabel;
          bias_score: number;
          bias_label: BiasLabel;
          left_percentage: number;
          center_percentage: number;
          right_percentage: number;
          confidence: number;
          framing_notes: string;
          loaded_terms?: string[];
          disclaimer: string;
          model: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["article_analyses"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "article_analyses_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: true;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: {
          id: string;
          level: LogLevel;
          event: string;
          message: string | null;
          context: Json | null;
          source_id: string | null;
          article_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          level?: LogLevel;
          event: string;
          message?: string | null;
          context?: Json | null;
          source_id?: string | null;
          article_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["logs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "logs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "logs_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedules: {
        Row: {
          id: string;
          source_id: string;
          oxylabs_schedule_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          oxylabs_schedule_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["oxylabs_schedules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: true;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: {
          id: string;
          schedule_id: string;
          oxylabs_run_id: string | null;
          oxylabs_job_id: string;
          result_status: string;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          oxylabs_run_id?: string | null;
          oxylabs_job_id: string;
          result_status: string;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["oxylabs_schedule_runs"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}

export type Source = Database["public"]["Tables"]["sources"]["Row"];
export type SourceInsert = Database["public"]["Tables"]["sources"]["Insert"];

export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];

export type ArticleAnalysis = Database["public"]["Tables"]["article_analyses"]["Row"];
export type ArticleAnalysisInsert = Database["public"]["Tables"]["article_analyses"]["Insert"];

export type Log = Database["public"]["Tables"]["logs"]["Row"];
export type LogInsert = Database["public"]["Tables"]["logs"]["Insert"];

export type OxylabsSchedule = Database["public"]["Tables"]["oxylabs_schedules"]["Row"];
export type OxylabsScheduleInsert = Database["public"]["Tables"]["oxylabs_schedules"]["Insert"];

export type OxylabsScheduleRun = Database["public"]["Tables"]["oxylabs_schedule_runs"]["Row"];
export type OxylabsScheduleRunInsert = Database["public"]["Tables"]["oxylabs_schedule_runs"]["Insert"];
