export interface TasteBenchmark {
  id: string;
  user_id: string;
  answers: Record<string, string[]>;
  created_at: Date;
}
