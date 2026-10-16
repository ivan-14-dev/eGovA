export type User = { email: string; staff: boolean; kind: string; organization: string; activity: string; city: string }
export type Source = { id: string; title: string; locator: string; warning: string; version: string; text?: string; url: string | null }
export type Procedure = { id: string; title: string; description: string; steps: string[]; suggested: boolean; source: Source; version: number }
export type Evidence = { id: number; name: string; expires_on: string | null; expired: boolean; superseded: boolean; url: string; preview_url: string }
export type Budget = { id: number; label: string; amount: string | null; category: string; tax: string; basis: string }
export type Case = {
  id: number; title: string; status: string; receipt: string; due_date: string | null;
  procedure: string; version: number; outdated: boolean; description: string; source: Source;
  steps: { label: string; done: boolean }[]; evidence: Evidence[]; budget: Budget[];
  totals: Record<string, string>; unknown_amounts: number;
  revisions: { at: string; before: Record<string, unknown>; changes: Record<string, unknown> }[];
}
export type Summary = { total: number; evaluated: number; score: number | null; coverage: number | null; blocking: number }
export type Summaries = { reglementaire: Summary; marche: Summary }
export type Control = {
  id: string; text: string; condition: string; source: string; domain: string; critical: boolean;
  applicability: string; status: string; justification: string; evidence: number | null; proof_invalid: boolean;
}
export type Audit = { groups: Record<string, Control[]>; summaries: Summaries }
export type Notice = {
  id: string; kind: string; title: string; message: string; target: string; revision: string; read: boolean;
  case_id?: number; deadline?: string; body?: string; action?: string; consequence?: string;
  missing_controls?: string[]; required_count?: number; source?: Source; summaries?: Summaries;
}
export type Notifications = { items: Notice[]; unread: number; summaries: Summaries; checked_at: string }
export type Bulletin = { id: number; title: string; body: string; action: string; consequence: string; source: Source; read: boolean; effective_on: string | null; closes_at: string | null }
export type Proposal = { id: string; message: string; before: Record<string, unknown>; changes: Record<string, unknown>; expires_at: string }
export type Answer = {
  message: string; sources: Source[]; citations: { id: string; quote: string }[]; mode: string; proposal?: Proposal;
  notifications?: Notifications;
  cases?: { id: number; title: string; status: string; due_date: string | null; outdated: boolean; completed: number; total: number }[];
}
export type Document = { id: string; title: string; kindLabel: string; group: string; pageCount: number; draft: boolean; status: string; notes: string[]; pdfUrl: string }
export type Catalogue = { documents: Document[]; groups: { id: string; label: string }[]; stats: Record<string, number> }
export type DocumentPage = { citation: string; pageNumber: number; document: Document; method: string; confidence: number | null; warnings: string[]; pdfUrl: string; text: string }
export type SearchResult = Omit<DocumentPage, 'text'> & { excerpt: string }
export type Viewer = { title: string; uri: string; mime: string; headers: Record<string, string>; page?: number }
export type Run = (operation: () => Promise<void>) => Promise<void>
