export interface User {
  id: string;
  email: string;
  name: string | null;
  auth_provider: 'google' | 'email';
  has_taste_benchmark: boolean;
  ai_api_key: string | null;
  ai_model: string | null;
  ai_provider: string | null;
  created_at: Date;
}
