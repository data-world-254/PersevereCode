import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { createConversation, getWebhookUrl } from "../lib/tavus.js";
import { extractStructuredData } from "../lib/llm.js";
import crypto from "node:crypto";
import { startCloudRunner } from "../services/cloud-runner.js";

const JobCreateSchema = z.object({
  project_id: z.string().uuid(),
  goal: z.string().min(1),
  acceptance_criteria: z.array(z.string()).optional(),
  tech_stack: z.record(z.unknown()).optional(),
  time_budget_hours: z.number().positive().max(100).optional(),
  autopilot_policy: z.enum(["standard", "restricted"]).default("standard"),
});

const SpecSchema = z.object({
  goal: z.string(),
  acceptance_criteria: z.array(z.string()),
  tech_stack: z.record(z.unknown()),
  time_budget_hours: z.number().positive(),
  milestones: z.array(z.object({
    title: z.string(),
    description: z.string(),
    estimated_hours: z.number().positive(),
  })),
});

export async function jobsRoutes(fastify: FastifyInstance) {
  // Create a new job from meeting transcript
  fastify.post<{ Body: z.infer<typeof JobCreateSchema> }>("/jobs", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);
      const body = JobCreateSchema.parse(request.body);

      // Verify project belongs to user
      const { data: project, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", body.project_id)
        .eq("user_id", user.userId)
        .single();

      if (projectError || !project) {
        return reply.code(404).send({ error: "project_not_found" });
      }

      // Create job
      const { data: job, error: jobError } = await supabaseAdmin
        .from("jobs")
        .insert({
          user_id: user.userId,
          project_id: body.project_id,
          goal: body.goal,
          acceptance_criteria: body.acceptance_criteria || [],
          tech_stack: body.tech_stack || {},
          time_budget_hours: body.time_budget_hours || 5,
          autopilot_policy: body.autopilot_policy,
          status: "queued",
        })
        .select()
        .single();

      if (jobError || !job) {
        fastify.log.error(jobError);
        return reply.code(500).send({ error: "failed_to_create_job" });
      }

      // Create initial job step
      await supabaseAdmin.from("job_steps").insert({
        job_id: job.id,
        step_type: "JOB_CREATED",
        step_order: 1,
        payload: {
          goal: body.goal,
          acceptance_criteria: body.acceptance_criteria,
          tech_stack: body.tech_stack,
          time_budget_hours: body.time_budget_hours,
        },
      });

      // Trigger cloud runner to start processing (async)
      // In production, this would be queued via a job queue system
      startCloudRunner(job.id).catch((error) => {
        fastify.log.error({ error, jobId: job.id }, "Cloud runner failed");
      });

      return reply.code(201).send(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "validation_error", details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Create Tavus meeting for a project
  fastify.post<{ Params: { projectId: string } }>("/projects/:projectId/meetings", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);
      const { projectId } = request.params as { projectId: string };

      // Verify project belongs to user
      const { data: project, error: projectError } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", user.userId)
        .single();

      if (projectError || !project) {
        return reply.code(404).send({ error: "project_not_found" });
      }

      // Create a temporary job to link the meeting
      const { data: tempJob } = await supabaseAdmin
        .from("jobs")
        .insert({
          user_id: user.userId,
          project_id: projectId,
          status: "queued",
          goal: "Meeting in progress...",
        })
        .select()
        .single();

      const jobId = tempJob?.id;

      // Create Tavus conversation
      const conversation = await createConversation({
        callbackUrl: getWebhookUrl(jobId || crypto.randomUUID()),
        userId: user.userId,
        jobId: jobId || undefined,
      });

      // Store Tavus conversation
      const { data: tavusConv, error: tavusError } = await supabaseAdmin
        .from("tavus_conversations")
        .insert({
          job_id: jobId || null,
          user_id: user.userId,
          tavus_conversation_id: conversation.conversation_id,
          conversation_url: conversation.conversation_url,
          status: "active",
        })
        .select()
        .single();

      if (tavusError) {
        fastify.log.error(tavusError);
        return reply.code(500).send({ error: "failed_to_create_conversation" });
      }

      return reply.code(201).send({
        conversation_id: conversation.conversation_id,
        conversation_url: conversation.conversation_url,
        job_id: jobId,
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Get job details
  fastify.get<{ Params: { jobId: string } }>("/jobs/:jobId", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);
      const { jobId } = request.params as { jobId: string };

      const { data: job, error } = await supabaseAdmin
        .from("jobs")
        .select("*")
        .eq("id", jobId)
        .eq("user_id", user.userId)
        .single();

      if (error || !job) {
        return reply.code(404).send({ error: "job_not_found" });
      }

      // Get job steps
      const { data: steps } = await supabaseAdmin
        .from("job_steps")
        .select("*")
        .eq("job_id", jobId)
        .order("step_order", { ascending: true });

      // Get artifacts
      const { data: artifacts } = await supabaseAdmin
        .from("artifacts")
        .select("*")
        .eq("job_id", jobId);

      return reply.send({
        ...job,
        steps: steps || [],
        artifacts: artifacts || [],
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // List user's jobs
  fastify.get("/jobs", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);

      const { data: jobs, error } = await supabaseAdmin
        .from("jobs")
        .select("*, projects(*)")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "failed_to_fetch_jobs" });
      }

      return reply.send(jobs || []);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Process Tavus transcript and create job spec
  fastify.post<{ Params: { jobId: string }; Body: { transcript: string } }>(
    "/jobs/:jobId/process-transcript",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = await requireAuth(request);
        const { jobId } = request.params as { jobId: string };
        const { transcript } = z.object({ transcript: z.string().min(1) }).parse(request.body);

        // Verify job belongs to user
        const { data: job, error: jobError } = await supabaseAdmin
          .from("jobs")
          .select("*")
          .eq("id", jobId)
          .eq("user_id", user.userId)
          .single();

        if (jobError || !job) {
          return reply.code(404).send({ error: "job_not_found" });
        }

        // Extract structured spec from transcript using LLM
        const prompt = `Extract the following information from this meeting transcript:
- Goal: What is the project goal?
- Acceptance Criteria: List all acceptance criteria
- Tech Stack: What technologies should be used? (as a JSON object with keys like frontend, backend, database, etc.)
- Time Budget: Estimated hours to complete (as a number)
- Milestones: Break down into milestones with title, description, and estimated hours each

Transcript:
${transcript}`;

        const spec = await extractStructuredData(prompt, SpecSchema, {
          provider: "openai",
          model: "gpt-4-turbo-preview",
          temperature: 0.3,
        });

        // Update job with spec
        const { error: updateError } = await supabaseAdmin
          .from("jobs")
          .update({
            goal: spec.goal,
            acceptance_criteria: spec.acceptance_criteria,
            tech_stack: spec.tech_stack,
            time_budget_hours: spec.time_budget_hours,
          })
          .eq("id", jobId);

        if (updateError) {
          fastify.log.error(updateError);
          return reply.code(500).send({ error: "failed_to_update_job" });
        }

        // Create job step for spec
        await supabaseAdmin.from("job_steps").insert({
          job_id: jobId,
          step_type: "SPEC_CREATED",
          step_order: 2,
          payload: {
            spec,
            transcript: transcript.substring(0, 1000), // Store truncated transcript
          },
        });

        return reply.send({ spec });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({ error: "validation_error", details: error.errors });
        }
        fastify.log.error(error);
        return reply.code(500).send({ error: "internal_server_error" });
      }
    }
  );
}

