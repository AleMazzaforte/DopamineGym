// Este archivo se generará automáticamente más adelante con la CLI de Supabase.
// Por ahora lo dejamos vacío para que el proyecto compile.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {};
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}