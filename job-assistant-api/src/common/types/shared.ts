export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface ResumeParsed {
  basics: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    link?: string;
    summary?: string;
  };
  skills: string[];
  experiences: Array<{
    company?: string;
    title?: string;
    start?: string;
    end?: string;
    summary?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    school?: string;
    degree?: string;
    gpa?: string;
    date?: string;
    descriptions?: string[];
  }>;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  parsed: ResumeParsed;
  createdAt: string;
}

export interface SubscriptionRecord {
  userId: string;
  plan: string;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
}
