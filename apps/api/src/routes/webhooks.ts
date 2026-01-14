import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { fetchTranscript } from "../lib/tavus.js";
import { extractStructuredData } from "../lib/llm.js";

const SpecSchema = z.object({
  goal: z.string(),
  acceptance_criteria: z.array(z.string()),
  tech_stack: z.record(z.unknown()),
  time_budget_hours: z.number().positive(),
  milestones: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      estimated_hours: z.number().positive(),
    })
  ),
});

export async function webhookRoutes(fastify: FastifyInstance) {
  // Tavus webhook handler
  fastify.post<{ Params: { jobId: string } }>("/webhooks/tavus/:jobId", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { jobId } = request.params as { jobId: string };
      const body = request.body as {
        event_type?: string;
        conversation_id?: string;
        transcript_url?: string;
        transcript?: string;
        metadata?: Record<string, unknown>;
      };

      fastify.log.info({ jobId, event: body.event_type }, "Tavus webhook received");

      // Handle transcript ready event
      if (body.event_type === "application.transcription_ready" || body.event_type === "transcription_ready") {
        const conversationId = body.conversation_id;
        if (!conversationId) {
          return reply.code(400).send({ error: "missing_conversation_id" });
        }

        // Get Tavus conversation record
        const { data: tavusConv, error: convError } = await supabaseAdmin
          .from("tavus_conversations")
          .select("*")
          .eq("tavus_conversation_id", conversationId)
          .single();

        if (convError || !tavusConv) {
          fastify.log.warn({ conversationId }, "Tavus conversation not found");
          return reply.code(404).send({ error: "conversation_not_found" });
        }

        // Fetch transcript
        let transcript = body.transcript || "";
        if (!transcript && body.transcript_url) {
          try {
            transcript = await fetchTranscript(body.transcript_url);
          } catch (error) {
            fastify.log.error({ error }, "Failed to fetch transcript");
            return reply.code(500).send({ error: "failed_to_fetch_transcript" });
          }
        }

        if (!transcript) {
          return reply.code(400).send({ error: "missing_transcript" });
        }

        // Update Tavus conversation with transcript
        await supabaseAdmin
          .from("tavus_conversations")
          .update({
            transcript: { raw: transcript, processed_at: new Date().toISOString() },
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tavusConv.id);

        // If job exists, process transcript and create spec
        if (tavusConv.job_id) {
          const { data: job } = await supabaseAdmin.from("jobs").select("*").eq("id", tavusConv.job_id).single();

          if (job) {
            try {
              // Extract structured spec from transcript using LLM
              const prompt = `Extract the following information from this meeting transcript:
- Goal: What is the project goal?
- Acceptance Criteria: List all acceptance criteria
- Tech Stack: What technologies should be used? (as a JSON object with keys like frontend, backend, database, etc.)
- Time Budget: Estimated hours to complete (as a number)
- Milestones: Break down into milestones with title, description, and estimated hours each

Transcript:
${transcript.substring(0, 10000)}`; // Limit transcript length

              const spec = await extractStructuredData(prompt, SpecSchema, {
                provider: "openai",
                model: "gpt-4-turbo-preview",
                temperature: 0.3,
              });

              // Update job with spec
              await supabaseAdmin
                .from("jobs")
                .update({
                  goal: spec.goal,
                  acceptance_criteria: spec.acceptance_criteria,
                  tech_stack: spec.tech_stack,
                  time_budget_hours: spec.time_budget_hours,
                })
                .eq("id", job.id);

              // Create job step for spec
              await supabaseAdmin.from("job_steps").insert({
                job_id: job.id,
                step_type: "SPEC_CREATED",
                step_order: 2,
                payload: {
                  spec,
                  transcript_length: transcript.length,
                },
              });

              // Store spec in Tavus conversation
              await supabaseAdmin
                .from("tavus_conversations")
                .update({
                  spec,
                })
                .eq("id", tavusConv.id);

              fastify.log.info({ jobId: job.id }, "Spec extracted and job updated");
            } catch (error) {
              fastify.log.error({ error, jobId: job.id }, "Failed to extract spec from transcript");
              // Continue anyway - user can manually process transcript
            }
          }
        }

        return reply.send({ ok: true, processed: true });
      }

      // Handle other Tavus events
      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error(error, "Tavus webhook error");
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // GitHub webhook handler (for GitHub App events)
  fastify.post("/webhooks/github", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as {
        action?: string;
        installation?: { id: number; account?: { login: string; type: string } };
        repositories?: Array<{ full_name: string; name: string; owner: { login: string } }>;
      };

      fastify.log.info({ action: body.action }, "GitHub webhook received");

      // Handle installation created/added events
      if (body.action === "created" || body.action === "added") {
        const installation = body.installation;
        if (!installation || !installation.account) {
          return reply.send({ ok: true });
        }

        // Note: We'll need to map GitHub user to our user_id
        // For now, we'll store the installation and let users manually connect
        const { data: existingInstall } = await supabaseAdmin
          .from("github_installations")
          .select("*")
          .eq("installation_id", installation.id)
          .single();

        if (!existingInstall) {
          // Store installation (user_id will be set when user connects)
          await supabaseAdmin.from("github_installations").insert({
            installation_id: installation.id,
            account_login: installation.account.login,
            account_type: installation.account.type || "User",
            repositories: body.repositories?.map((r) => ({
              full_name: r.full_name,
              name: r.name,
              owner: r.owner.login,
            })) || [],
          });
        }
      }

      return reply.send({ ok: true });
    } catch (error) {
      fastify.log.error(error, "GitHub webhook error");
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });
}

