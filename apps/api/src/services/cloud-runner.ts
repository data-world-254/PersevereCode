/**
 * Cloud Runner Service
 * 
 * This service handles the autonomous development agent loop:
 * - Clone repository
 * - Analyze codebase
 * - Plan implementation
 * - Implement changes
 * - Run tests/builds
 * - Commit and push changes
 * - Create/update PR
 * 
 * In production, this would run in an isolated container/VM
 */

import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { createOrUpdateOctokit, createBranch, commitFiles, createPullRequest, updatePullRequest } from "../lib/github.js";
import { complete, extractStructuredData } from "../lib/llm.js";
import { uploadArtifact } from "../lib/storage.js";

const JobConfigSchema = z.object({
  job_id: z.string().uuid(),
  project_id: z.string().uuid(),
  goal: z.string(),
  acceptance_criteria: z.array(z.string()),
  tech_stack: z.record(z.unknown()),
  time_budget_hours: z.number().positive(),
  autopilot_policy: z.enum(["standard", "restricted"]),
  repo_owner: z.string(),
  repo_name: z.string(),
  default_branch: z.string(),
  github_installation_id: z.number(),
});

export interface JobConfig {
  jobId: string;
  projectId: string;
  goal: string;
  acceptanceCriteria: string[];
  techStack: Record<string, unknown>;
  timeBudgetHours: number;
  autopilotPolicy: "standard" | "restricted";
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  githubInstallationId: number;
  branchName?: string; // Set after branch creation
}

/**
 * Start cloud runner for a job
 * This would typically be triggered by a queue/worker system
 */
export async function startCloudRunner(jobId: string): Promise<void> {
  try {
    // Get job config
    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("*, projects(*)")
      .eq("id", jobId)
      .single();

    if (jobError || !job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.status !== "queued") {
      throw new Error(`Job is not in queued status: ${job.status}`);
    }

    const project = job.projects;
    if (!project || typeof project !== "object" || !("github_installation_id" in project)) {
      throw new Error("Project not found or missing GitHub installation");
    }

    const config: JobConfig = {
      jobId: job.id,
      projectId: job.project_id,
      goal: job.goal || "",
      acceptanceCriteria: (job.acceptance_criteria as string[]) || [],
      techStack: (job.tech_stack as Record<string, unknown>) || {},
      timeBudgetHours: job.time_budget_hours || 5,
      autopilotPolicy: job.autopilot_policy || "standard",
      repoOwner: project.repo_owner,
      repoName: project.repo_name,
      defaultBranch: project.default_branch || "main",
      githubInstallationId: Number((project as { github_installation_id: string }).github_installation_id),
    };

    // Update job status
    await supabaseAdmin.from("jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId);

    // Create job step
    await supabaseAdmin.from("job_steps").insert({
      job_id: jobId,
      step_type: "PLAN_CREATED",
      step_order: 3,
      payload: {
        message: "Starting cloud runner...",
      },
    });

    // Run the agent loop
    await runAgentLoop(config);
  } catch (error) {
    console.error(`Cloud runner error for job ${jobId}:`, error);
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", jobId);
    throw error;
  }
}

/**
 * Main agent loop
 */
async function runAgentLoop(config: JobConfig): Promise<void> {
  const startTime = Date.now();
  const deadline = startTime + config.timeBudgetHours * 60 * 60 * 1000;

  // Get GitHub client
  const octokit = await createOrUpdateOctokit(config.githubInstallationId);

  // Create working branch
  const branchName = `persevere/${config.jobId.substring(0, 8)}-${Date.now()}`;
  await createBranch(octokit, config.repoOwner, config.repoName, branchName, config.defaultBranch);

  await supabaseAdmin.from("jobs").update({ branch_name: branchName }).eq("id", config.jobId);

  await supabaseAdmin.from("job_steps").insert({
    job_id: config.jobId,
    step_type: "BRANCH_CREATED",
    step_order: 4,
    payload: { branch_name: branchName },
  });

  try {
    // Analyze repository structure
    const analysis = await analyzeRepository(octokit, config);

    // Generate implementation plan
    const plan = await generatePlan(config, analysis);

    await supabaseAdmin.from("job_steps").insert({
      job_id: config.jobId,
      step_type: "PLAN_CREATED",
      step_order: 5,
      payload: { plan },
    });

    // Update config with branch name
    config.branchName = branchName;

    // Implement milestones
    for (const milestone of plan.milestones) {
      if (Date.now() >= deadline) {
        break; // Time budget exhausted
      }

      await implementMilestone(octokit, config, milestone);
      // In a real implementation, you'd run tests, commit, etc.
    }

    // Create PR
    const pr = await createPullRequest(
      octokit,
      config.repoOwner,
      config.repoName,
      `[Persevere] ${config.goal.substring(0, 100)}`,
      generatePRDescription(config, plan),
      branchName,
      config.defaultBranch
    );

    await supabaseAdmin.from("jobs").update({ pr_number: pr.number, pr_url: pr.url }).eq("id", config.jobId);

    await supabaseAdmin.from("job_steps").insert({
      job_id: config.jobId,
      step_type: "PR_CREATED",
      step_order: 100,
      payload: { pr_number: pr.number, pr_url: pr.url },
    });

    // Mark job as completed
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        execution_summary: {
          branch_name: branchName,
          pr_number: pr.number,
          pr_url: pr.url,
          execution_time_ms: Date.now() - startTime,
        },
      })
      .eq("id", config.jobId);

    await supabaseAdmin.from("job_steps").insert({
      job_id: config.jobId,
      step_type: "JOB_COMPLETED",
      step_order: 101,
      payload: { completed_at: new Date().toISOString() },
    });
  } catch (error) {
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "failed",
        failed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq("id", config.jobId);

    await supabaseAdmin.from("job_steps").insert({
      job_id: config.jobId,
      step_type: "JOB_FAILED",
      step_order: 200,
      payload: { error: error instanceof Error ? error.message : String(error) },
    });

    throw error;
  }
}

/**
 * Analyze repository structure
 */
async function analyzeRepository(octokit: any, config: JobConfig): Promise<Record<string, unknown>> {
  // Get repository structure
  const { data: repo } = await octokit.repos.get({ owner: config.repoOwner, repo: config.repoName });
  
  // Get repository tree
  const { data: tree } = await octokit.git.getTree({
    owner: config.repoOwner,
    repo: config.repoName,
    tree_sha: config.defaultBranch,
    recursive: "1",
  });

  const files = (tree.tree || []).map((item: any) => item.path);
  
  return {
    language: repo.language,
    default_branch: repo.default_branch,
    has_package_json: files.includes("package.json"),
    has_requirements_txt: files.includes("requirements.txt"),
    has_pom_xml: files.includes("pom.xml"),
    has_cargo_toml: files.includes("Cargo.toml"),
    file_count: files.length,
    files: files.slice(0, 50), // Sample of files
  };
}

/**
 * Generate implementation plan
 */
async function generatePlan(config: JobConfig, analysis: Record<string, unknown>): Promise<{
  milestones: Array<{ title: string; description: string; estimated_hours: number; tasks: string[] }>;
}> {
  const prompt = `Generate an implementation plan for this project:

Goal: ${config.goal}
Acceptance Criteria: ${config.acceptanceCriteria.join(", ")}
Tech Stack: ${JSON.stringify(config.techStack)}
Time Budget: ${config.timeBudgetHours} hours
Repository Analysis: ${JSON.stringify(analysis)}

Break down into milestones with:
- Title
- Description
- Estimated hours
- List of specific tasks

Respond with JSON only.`;

  const schema = z.object({
    milestones: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        estimated_hours: z.number(),
        tasks: z.array(z.string()),
      })
    ),
  });

  return extractStructuredData(prompt, schema, {
    provider: "openai",
    model: "gpt-4-turbo-preview",
    temperature: 0.3,
  });
}

/**
 * Implement a milestone
 */
async function implementMilestone(octokit: any, config: JobConfig, milestone: { title: string; description: string; tasks: string[] }): Promise<void> {
  // This would actually:
  // 1. Clone repo to temp directory
  // 2. Make code changes
  // 3. Run tests
  // 4. Commit changes
  // For now, create a placeholder implementation

  const files = [
    {
      path: `persevere/${milestone.title.replace(/\s+/g, "-").toLowerCase()}.md`,
      content: `# ${milestone.title}\n\n${milestone.description}\n\n## Tasks\n\n${milestone.tasks.map((t) => `- ${t}`).join("\n")}`,
    },
  ];

  if (!config.branchName) {
    throw new Error("Branch name not set");
  }
  await commitFiles(octokit, config.repoOwner, config.repoName, config.branchName, `[Persevere] ${milestone.title}`, files);
}

/**
 * Generate PR description
 */
function generatePRDescription(config: JobConfig, plan: { milestones: Array<{ title: string; description: string }> }): string {
  return `## Goal

${config.goal}

## Acceptance Criteria

${config.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}

## Implementation Plan

${plan.milestones.map((m) => `### ${m.title}\n\n${m.description}`).join("\n\n")}

---

*This PR was automatically generated by Persevere.*`;
}

