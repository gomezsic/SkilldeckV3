export type PersonStatus = 'registered' | 'in_path' | 'ready' | 'not_accepted' | 'excluded'
export type AppliedAs = 'skipper' | 'co_skipper' | 'crew' | 'staff' | 'trainer'
export type StepKind = 'interview' | 'test' | 'career' | 'documents' | 'ready_confirmation'
export type StepStatus = 'todo' | 'in_progress' | 'done' | 'not_required'
export type TitleStatus = 'draft' | 'declared' | 'verified' | 'rejected' | 'replaced'
export type Requirement = 'command' | 'src' | 'first_aid'

export interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  birth_date: string | null
  ui_language: 'it' | 'en'
  family: 'skipper' | 'crew_staff' | 'owner' | 'admin'
  status: PersonStatus
  applied_as: AppliedAs | null
}
export interface Capability { capability: string; status: 'active' | 'pending' | 'revoked' }
export interface Step { id?: string; kind: StepKind; position: number; status: StepStatus; done_at: string | null }
export interface Plan { id: string; goal_capability: string; status: 'active' | 'completed' | 'closed'; steps: Step[] }
export interface Title {
  id: string; code: string; name_it: string; status: TitleStatus
  expires_on: string | null; has_file: boolean; rejection_reason: string | null; file_path?: string | null
}
export interface Compliance { requirement: Requirement; covered: boolean; covered_until: string | null; by_title: string | null }
export interface IdentityDoc { id: string; kind: string; expires_on: string | null }
export interface Insurance { id: string; kind: string; company: string | null; expires_on: string | null }
export interface Skill { kind: 'language' | 'technical' | 'area' | 'boat_type'; value: string; level: string | null }
export interface LogEntry {
  id: string; from_date: string; to_date: string; route: string | null
  miles: number | null; days: number | null; nights: number | null; source: 'declared' | 'imported' | 'generated'
}
export interface TaxProfile { tax_code: string | null; tax_regime: string | null; vat_number: string | null; iban: string | null }
export interface Preferences { privacy_consent_at: string | null; marketing_opt_out: boolean; showcase_consent: boolean }

export interface Deck {
  person: Person
  capabilities: Capability[]
  plans: Plan[]
  titles: Title[]
  compliance: Compliance[]
  identity: IdentityDoc[]
  insurance: Insurance[]
  skills: Skill[]
  logbook: LogEntry[]
  tax: TaxProfile | null
  preferences: Preferences | null
}
