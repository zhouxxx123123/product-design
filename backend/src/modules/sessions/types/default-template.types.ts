export interface DefaultQuestion {
  id: string;
  text: string;
  type: 'open' | 'scale' | 'choice';
}

export interface DefaultSection {
  id: string;
  title: string;
  description?: string;
  questions: DefaultQuestion[];
}
