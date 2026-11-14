import type { Deck, Step } from './types'

// Persone inventate, solo per vedere le schermate senza accedere. Nessun dato reale.
const iso = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const steps = (s: Step['status'][]): Step[] =>
  (['interview', 'test', 'career', 'documents', 'ready_confirmation'] as const).map((kind, i) => ({
    kind, position: i + 1, status: s[i], done_at: s[i] === 'done' ? iso(-30 * (5 - i)) : null,
  }))

const base = {
  identity: [], insurance: [], skills: [], logbook: [], tax: null,
  preferences: { privacy_consent_at: iso(-200), marketing_opt_out: false, showcase_consent: false },
}

export const demoDecks: Record<string, Deck> = {
  registrato: {
    ...base,
    person: { id: 'd1', first_name: 'Elena', last_name: 'Prova', email: 'elena@example.test', phone: null, birth_date: null, ui_language: 'it', family: 'skipper', status: 'registered', applied_as: 'skipper' },
    capabilities: [], plans: [], titles: [],
    compliance: [
      { requirement: 'command', covered: false, covered_until: null, by_title: null },
      { requirement: 'src', covered: false, covered_until: null, by_title: null },
      { requirement: 'first_aid', covered: false, covered_until: null, by_title: null },
    ],
  },
  percorso: {
    ...base,
    person: { id: 'd2', first_name: 'Marco', last_name: 'Esempio', email: 'marco@example.test', phone: '+39 333 0000000', birth_date: '1991-04-12', ui_language: 'it', family: 'skipper', status: 'in_path', applied_as: 'skipper' },
    capabilities: [{ capability: 'skipper_fleet', status: 'pending' }],
    plans: [{ id: 'p1', goal_capability: 'skipper_fleet', status: 'active', steps: steps(['done', 'done', 'in_progress', 'todo', 'todo']) }],
    titles: [
      { id: 't1', code: 'PATENTE_SL', name_it: 'Patente nautica senza limiti dalla costa, vela e motore', status: 'verified', expires_on: iso(900), has_file: true, rejection_reason: null },
      { id: 't2', code: 'SRC', name_it: 'Certificato radio SRC', status: 'declared', expires_on: null, has_file: true, rejection_reason: null },
      { id: 't3', code: 'FIRST_AID', name_it: 'First Aid', status: 'rejected', expires_on: iso(300), has_file: true, rejection_reason: 'Il file non è leggibile: caricalo di nuovo.' },
    ],
    compliance: [
      { requirement: 'command', covered: true, covered_until: iso(900), by_title: 'PATENTE_SL' },
      { requirement: 'src', covered: true, covered_until: null, by_title: 'SRC' },
      { requirement: 'first_aid', covered: false, covered_until: null, by_title: null },
    ],
    skills: [
      { kind: 'language', value: 'Italiano', level: 'Madrelingua' }, { kind: 'language', value: 'Inglese', level: 'B2' },
      { kind: 'boat_type', value: 'Monoscafo a vela', level: null }, { kind: 'area', value: 'Tirreno', level: null },
    ],
    logbook: [
      { id: 'l1', from_date: iso(-120), to_date: iso(-113), route: 'Portisco – Bonifacio – Portisco', miles: 210, days: 7, nights: 2, source: 'declared' },
      { id: 'l2', from_date: iso(-400), to_date: iso(-386), route: 'Lefkada – Zante – Lefkada', miles: 380, days: 14, nights: 3, source: 'declared' },
    ],
  },
  ready: {
    ...base,
    person: { id: 'd3', first_name: 'Sara', last_name: 'Campione', email: 'sara@example.test', phone: '+39 333 1111111', birth_date: '1988-09-03', ui_language: 'it', family: 'skipper', status: 'ready', applied_as: 'skipper' },
    capabilities: [{ capability: 'skipper_fleet', status: 'active' }, { capability: 'trainer', status: 'active' }],
    plans: [{ id: 'p2', goal_capability: 'skipper_fleet', status: 'completed', steps: steps(['done', 'done', 'done', 'done', 'done']) }],
    titles: [
      { id: 't4', code: 'YM_OFFSHORE', name_it: 'Yachtmaster Offshore', status: 'verified', expires_on: iso(1400), has_file: true, rejection_reason: null },
      { id: 't5', code: 'FIRST_AID', name_it: 'First Aid', status: 'verified', expires_on: iso(41), has_file: true, rejection_reason: null },
    ],
    compliance: [
      { requirement: 'command', covered: true, covered_until: iso(1400), by_title: 'YM_OFFSHORE' },
      { requirement: 'src', covered: true, covered_until: iso(1400), by_title: 'YM_OFFSHORE' },
      { requirement: 'first_aid', covered: true, covered_until: iso(41), by_title: 'FIRST_AID' },
    ],
    identity: [{ id: 'i1', kind: 'passport', expires_on: iso(2000) }],
    insurance: [{ id: 'a1', kind: 'Responsabilità civile skipper', company: 'Compagnia di esempio', expires_on: iso(200) }],
    skills: [
      { kind: 'language', value: 'Italiano', level: 'Madrelingua' }, { kind: 'language', value: 'Inglese', level: 'C1' }, { kind: 'language', value: 'Francese', level: 'B1' },
      { kind: 'technical', value: 'Motori diesel', level: null }, { kind: 'boat_type', value: 'Catamarano', level: null }, { kind: 'area', value: 'Grecia ionica', level: null },
    ],
    logbook: [
      { id: 'l3', from_date: iso(-60), to_date: iso(-53), route: 'Olbia – La Maddalena – Olbia', miles: 160, days: 7, nights: 0, source: 'generated' },
      { id: 'l4', from_date: iso(-300), to_date: iso(-280), route: 'Las Palmas – Mindelo', miles: 870, days: 8, nights: 7, source: 'declared' },
    ],
    tax: { tax_code: '••••••••••••X123', tax_regime: 'Forfettario', vat_number: '•••••••4321', iban: 'IT•• •••• •••• 9876' },
  },
}
