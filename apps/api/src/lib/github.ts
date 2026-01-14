import { App, Octokit } from "@octokit/app";
import { z } from "zod";

const env = z
  .object({
    GITHUB_APP_ID: z.string().min(1),
    GITHUB_PRIVATE_KEY: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
  })
  .parse(process.env);

export const githubApp = new App({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY,
  oauth: env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      }
    : undefined,
});

export async function getInstallationToken(installationId: number): Promise<string> {
  const octokit = await githubApp.getInstallationOctokit(installationId);
  const { data } = await octokit.request("POST /app/installations/{installation_id}/access_tokens", {
    installation_id: installationId,
  });
  return data.token;
}

export async function createOrUpdateOctokit(installationId: number): Promise<Octokit> {
  return githubApp.getInstallationOctokit(installationId);
}

export interface GitHubRepo {
  owner: string;
  name: string;
  defaultBranch: string;
  fullName: string;
}

export async function getRepo(octokit: Octokit, owner: string, repo: string): Promise<GitHubRepo> {
  const { data } = await octokit.repos.get({ owner, repo });
  return {
    owner: data.owner.login,
    name: data.name,
    defaultBranch: data.default_branch,
    fullName: data.full_name,
  };
}

export async function createBranch(octokit: Octokit, owner: string, repo: string, branchName: string, fromBranch: string): Promise<void> {
  // Get the SHA of the base branch
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${fromBranch}`,
  });

  // Create new branch
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: refData.object.sha,
  });
}

export async function commitFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  message: string,
  files: Array<{ path: string; content: string; mode?: "100644" | "100755" | "040000" | "160000" | "120000" }>
): Promise<string> {
  // Get current tree SHA
  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });

  const baseTreeSha = refData.object.sha;

  // Create blobs for files
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });
      return {
        path: file.path,
        mode: file.mode || "100644",
        type: "blob" as const,
        sha: blob.sha,
      };
    })
  );

  // Create tree
  const { data: tree } = await octokit.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: treeItems,
  });

  // Create commit
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message,
    tree: tree.sha,
    parents: [baseTreeSha],
  });

  // Update branch reference
  await octokit.git.updateRef({
    owner,
    repo,
    ref: `heads/${branch}`,
    sha: commit.sha,
  });

  return commit.sha;
}

export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string
): Promise<{ number: number; url: string }> {
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });
  return { number: data.number, url: data.html_url };
}

export async function updatePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number,
  body: string
): Promise<void> {
  await octokit.pulls.update({
    owner,
    repo,
    pull_number: pullNumber,
    body,
  });
}

