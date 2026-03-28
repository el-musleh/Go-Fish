export interface User {
  id: string;
  email: string;
  name: string | null;
  auth_provider: 'google' | 'email';
  has_taste_benchmark: boolean;
  ai_api_key: string | null;
  ai_model: string | null;
  created_at: Date;
}
