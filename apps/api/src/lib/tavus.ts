import { z } from "zod";

const env = z
  .object({
    TAVUS_API_KEY: z.string().min(1),
    TAVUS_PERSONA_ID: z.string().min(1),
    TAVUS_REPLICA_ID: z.string().optional(),
    API_BASE_URL: z.string().url(),
  })
  .parse(process.env);

const TAVUS_API_BASE = "https://api.tavus.io";

export interface TavusConversation {
  conversation_id: string;
  conversation_url: string; // Daily/WebRTC URL
  status: string;
}

export interface CreateConversationParams {
  callbackUrl: string; // Your webhook endpoint
  userId: string; // Internal user ID
  jobId?: string; // Optional job ID
}

export async function createConversation(params: CreateConversationParams): Promise<TavusConversation> {
  const response = await fetch(`${TAVUS_API_BASE}/v2/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.TAVUS_API_KEY,
    },
    body: JSON.stringify({
      persona_id: env.TAVUS_PERSONA_ID,
      replica_id: env.TAVUS_REPLICA_ID || undefined,
      callback_url: params.callbackUrl,
      metadata: {
        user_id: params.userId,
        job_id: params.jobId || null,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "Unknown error");
    throw new Error(`Tavus API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    conversation_id: data.conversation_id || data.id,
    conversation_url: data.conversation_url || data.url,
    status: data.status || "pending",
  };
}

export interface TavusWebhookEvent {
  event_type: string;
  conversation_id: string;
  transcript?: string;
  transcript_url?: string;
  metadata?: Record<string, unknown>;
}

export async function fetchTranscript(transcriptUrl: string): Promise<string> {
  const response = await fetch(transcriptUrl, {
    headers: {
      "x-api-key": env.TAVUS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch transcript: ${response.status}`);
  }

  return response.text();
}

// Generate webhook URL for a specific job
export function getWebhookUrl(jobId: string): string {
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  return `${base}/webhooks/tavus/${jobId}`;
}

