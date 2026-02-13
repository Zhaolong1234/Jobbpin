export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

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
  userId?: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
}

export interface ProfileRecord {
  userId: string;
  name: string;
  firstName: string;
  lastName: string;
  targetRole: string;
  yearsExp: string;
  country: string;
  city: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  allowLinkedinAnalysis: boolean;
  employmentTypes: string[];
  profileSkipped: boolean;
  createdAt?: string;
  updatedAt?: string;
  isCompleted?: boolean;
}

export interface OnboardingStateRecord {
  userId: string;
  currentStep: 1 | 2 | 3 | 4;
  isCompleted: boolean;
  profileSkipped: boolean;
  updatedAt?: string;
}
