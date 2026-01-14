import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { githubApp, createOrUpdateOctokit, getRepo } from "../lib/github.js";
import crypto from "node:crypto";

const ProjectCreateSchema = z.object({
  github_installation_id: z.string().uuid(),
  repo_owner: z.string().min(1),
  repo_name: z.string().min(1),
});

export async function projectsRoutes(fastify: FastifyInstance) {
  // List user's projects
  fastify.get("/projects", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);

      const { data: projects, error } = await supabaseAdmin
        .from("projects")
        .select("*, github_installations(*)")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false });

      if (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "failed_to_fetch_projects" });
      }

      return reply.send(projects || []);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Create or connect a project
  fastify.post<{ Body: z.infer<typeof ProjectCreateSchema> }>("/projects", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);
      const body = ProjectCreateSchema.parse(request.body);

      // Verify GitHub installation belongs to user
      const { data: installation, error: instError } = await supabaseAdmin
        .from("github_installations")
        .select("*")
        .eq("id", body.github_installation_id)
        .eq("user_id", user.userId)
        .single();

      if (instError || !installation) {
        return reply.code(404).send({ error: "github_installation_not_found" });
      }

      // Verify repo exists and installation has access
      let repo;
      try {
        const octokit = await createOrUpdateOctokit(Number(installation.installation_id));
        repo = await getRepo(octokit, body.repo_owner, body.repo_name);
      } catch (error) {
        fastify.log.error({ error, owner: body.repo_owner, repo: body.repo_name }, "Failed to access repo");
        return reply.code(403).send({ error: "repo_access_denied" });
      }

      // Check if project already exists
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("*")
        .eq("user_id", user.userId)
        .eq("repo_owner", body.repo_owner)
        .eq("repo_name", body.repo_name)
        .single();

      if (existing) {
        return reply.send(existing);
      }

      // Create project (repo already fetched above)
      const { data: project, error: projectError } = await supabaseAdmin
        .from("projects")
        .insert({
          user_id: user.userId,
          github_installation_id: body.github_installation_id,
          repo_owner: body.repo_owner,
          repo_name: body.repo_name,
          default_branch: repo.defaultBranch,
          full_name: repo.fullName,
        })
        .select()
        .single();

      if (projectError || !project) {
        fastify.log.error(projectError);
        return reply.code(500).send({ error: "failed_to_create_project" });
      }

      return reply.code(201).send(project);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "validation_error", details: error.errors });
      }
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Get GitHub installations for user
  fastify.get("/github/installations", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);

      const { data: installations, error } = await supabaseAdmin
        .from("github_installations")
        .select("*")
        .eq("user_id", user.userId)
        .order("created_at", { ascending: false });

      if (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "failed_to_fetch_installations" });
      }

      return reply.send(installations || []);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Connect GitHub App (initiate OAuth flow)
  fastify.get("/github/connect", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = await requireAuth(request);

      // Generate GitHub App installation URL
      // Note: This should be configured in your GitHub App settings
      const installationUrl = githubApp.getInstallationUrl({
        state: crypto.randomUUID(), // Store in session/DB for verification
      });

      // For now, return instructions
      // In production, redirect to installation URL
      return reply.send({
        message: "Redirect user to GitHub App installation",
        url: installationUrl,
        instructions: [
          "1. Visit the GitHub App installation URL",
          "2. Select the repositories you want to grant access to",
          "3. After installation, GitHub will send a webhook to /webhooks/github",
          "4. The installation will be linked to your account",
        ],
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "internal_server_error" });
    }
  });

  // Get repositories for an installation
  fastify.get<{ Params: { installationId: string } }>(
    "/github/installations/:installationId/repositories",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = await requireAuth(request);
        const { installationId } = request.params as { installationId: string };

        // Verify installation belongs to user
        const { data: installation, error: instError } = await supabaseAdmin
          .from("github_installations")
          .select("*")
          .eq("id", installationId)
          .eq("user_id", user.userId)
          .single();

        if (instError || !installation) {
          return reply.code(404).send({ error: "installation_not_found" });
        }

        // Get repositories from GitHub
        try {
          const octokit = await createOrUpdateOctokit(Number(installation.installation_id));
          const { data: repos } = await octokit.apps.listInstallationReposForAuthenticatedUser({
            per_page: 100,
          });

          return reply.send({
            repositories: repos.repositories.map((repo) => ({
              id: repo.id,
              name: repo.name,
              full_name: repo.full_name,
              owner: repo.owner.login,
              private: repo.private,
              default_branch: repo.default_branch,
              description: repo.description,
            })),
            total_count: repos.total_count,
          });
        } catch (error) {
          fastify.log.error({ error }, "Failed to fetch repositories");
          return reply.code(500).send({ error: "failed_to_fetch_repositories" });
        }
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "internal_server_error" });
      }
    }
  );
}

