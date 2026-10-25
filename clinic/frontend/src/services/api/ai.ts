import { apiClient } from '@/services/api/client';
import { getFriendlyErrorMessage } from '@/lib/error-handler';

/**
 * Client for the backend AI assistant.
 *
 * <p>The backend is the only place authorisation is decided: it returns the
 * capabilities this caller's role may use, and re-checks them on every request.
 * This module never filters by role itself and never assumes a capability is
 * available — a capability the server omits simply is not offered.
 */

/** One question the assistant can answer, already authorised for this caller. */
/** One input a capability cannot answer without. Declared by the server. */
export interface AiRequiredArgument {
  name: string;
  prompt: string;
}

export interface AiCapability {
  id: string;
  label: string;
  description: string;
  suggestedQuestion: string;
  requiresHumanReview: boolean;
  /**
   * Empty for most capabilities. When non-empty the panel renders an input per
   * argument and sends the values back, so a capability that needs a doctor or a
   * patient is usable instead of failing on every attempt.
   */
  requiredArguments?: AiRequiredArgument[];
}

export interface AiCapabilitiesResponse {
  available: boolean;
  enabled: boolean;
  providerConfigured: boolean;
  provider: string;
  /** Present when unavailable, and safe to show to a user. */
  unavailableReason: string | null;
  capabilities: AiCapability[];
}

export interface AiChatRequest {
  capabilityId: string;
  message: string;
  conversationId?: string | null;
  arguments?: Record<string, string | number | undefined>;
}

export interface AiChatResponse {
  conversationId: string;
  answer: string;
  requiresHumanReview: boolean;
  /** Present when the answer is a draft a clinician must approve. */
  reviewNotice: string | null;
  /** Where the numbers came from, so a reader can check the claim. */
  sources: string[];
  /** When those numbers were computed, shown as data freshness. */
  computedAt: string | null;
  containsIdentifiableData: boolean;
  /**
   * True when the question described something that may need emergency care.
   *
   * The client surfaces an emergency notice on this flag. It is a prompt to seek
   * urgent help, never a triage decision, and never a reason to withhold an
   * answer.
   */
  urgentConcernDetected: boolean;
}

export interface AiForecastResponse {
  facts: Record<string, unknown>;
  sources: string[];
  computedAt: string;
}

export interface AiHistoricalForecastResponse {
  metric: string;
  scope: string;
  from: string;
  to: string;
  computedAt: string;
  method: string;
  observationCount: number;
  sufficientHistory: boolean;
  limitation: string;
  actual: Array<{ date: string; value: number }>;
  predicted: Array<{ date: string; value: number }>;
  sources: string[];
  insights: Array<{ kind: string; title: string; explanation: string; period: string; source: string }>;
}

/** A state-changing operation waiting for a human decision. */
export interface AiPendingAction {
  id: string;
  type: string | null;
  status: string;
  description: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  resultMessage: string | null;
  appointmentId: string | null;
  awaitingDecision?: boolean;
}

export interface AiMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  requiresHumanReview: boolean;
  draft: boolean;
}

/**
 * What the assistant can do for the signed-in user.
 *
 * <p>Resolves `available: false` rather than throwing: a deployment with the
 * feature switched off is a state the screen renders, not an error. The caller
 * uses {@link AiCapabilitiesResponse.unavailableReason} to say why, which is why
 * that field exists at all.
 */
export async function getAiCapabilities(): Promise<AiCapabilitiesResponse> {
  const { data } = await apiClient.get<AiCapabilitiesResponse>('/ai/capabilities');
  return data;
}

export async function askAiAssistant(
  request: AiChatRequest
): Promise<AiChatResponse> {
  const { data } = await apiClient.post<AiChatResponse>('/ai/chat', request);
  return data;
}

export async function getAiForecast(): Promise<AiForecastResponse> {
  const { data } = await apiClient.get<AiForecastResponse>('/ai/forecast');
  return data;
}

export async function getAiAppointmentForecast(from: string, to: string): Promise<AiHistoricalForecastResponse> {
  const { data } = await apiClient.get<AiHistoricalForecastResponse>('/ai/forecast/appointments', { params: { from, to } });
  return data;
}

export async function listAiConversations(): Promise<
  Array<{ id: string; title: string | null; createdAt: string; updatedAt: string }>
> {
  const { data } = await apiClient.get('/ai/conversations');
  return data;
}

export async function getAiConversation(id: string): Promise<AiMessage[]> {
  const { data } = await apiClient.get<AiMessage[]>(`/ai/conversations/${id}`);
  return data;
}

/**
 * Prepares an appointment change for review. Nothing is written yet.
 *
 * <p>A typed request rather than a natural-language instruction: the server
 * validates it, and the response is a proposal a human has to confirm. Asking the
 * model to emit a booking as text would mean confirming a string.
 */
export async function proposeAiAction(payload: {
  type: 'BOOK' | 'RESCHEDULE' | 'CANCEL';
  conversationId?: string | null;
  patientId?: string;
  doctorId?: string;
  appointmentId?: string;
  appointmentDate?: string;
  durationMinutes?: number;
  reason?: string;
}): Promise<AiPendingAction> {
  const { data } = await apiClient.post<AiPendingAction>('/ai/actions/propose', payload);
  return data;
}

/**
 * Applies a proposal the user explicitly approved.
 *
 * <p>Re-checks ownership, expiry, permissions and availability server-side, so a
 * slot that was taken between proposing and confirming fails here rather than
 * silently overwriting.
 */
export async function confirmAiAction(id: string): Promise<AiPendingAction> {
  const { data } = await apiClient.post<AiPendingAction>(`/ai/actions/${id}/confirm`);
  return data;
}

export async function rejectAiAction(id: string): Promise<void> {
  await apiClient.post(`/ai/actions/${id}/reject`);
}

export async function listPendingAiActions(): Promise<AiPendingAction[]> {
  const { data } = await apiClient.get<AiPendingAction[]>('/ai/actions/pending');
  return data;
}

/** Message for an AI failure, in the same voice as the rest of the app. */
export function aiErrorMessage(error: unknown): string {
  return getFriendlyErrorMessage(
    error,
    'The assistant could not answer just now. The rest of the hospital system is unaffected.'
  );
}
