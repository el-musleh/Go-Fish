export interface User {
  id: string;
  email: string;
  name: string | null;
  auth_provider: 'google' | 'email';
  has_taste_benchmark: boolean;
  created_at: Date;
}
