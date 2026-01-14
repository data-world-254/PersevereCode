import { z } from "zod";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

const env = z
  .object({
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    DEFAULT_LLM_PROVIDER: z.enum(["openai", "anthropic", "gemini"]).default("openai"),
    DEFAULT_LLM_MODEL: z.string().default("gpt-4-turbo-preview"),
  })
  .parse(process.env);

export type LLMProvider = "openai" | "anthropic" | "gemini";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionOptions {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY not configured");
    }
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) {
    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    geminiClient = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return geminiClient;
}

export async function complete(
  messages: LLMMessage[],
  options: LLMCompletionOptions = {}
): Promise<string> {
  const provider = options.provider || env.DEFAULT_LLM_PROVIDER;
  const model = options.model || env.DEFAULT_LLM_MODEL;
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2000;

  try {
    switch (provider) {
      case "openai": {
        const client = getOpenAIClient();
        const response = await client.chat.completions.create({
          model,
          messages: messages.map((m) => ({
            role: m.role === "system" ? "system" : m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
          temperature,
          max_tokens: maxTokens,
        });
        return response.choices[0]?.message?.content || "";
      }

      case "anthropic": {
        const client = getAnthropicClient();
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter((m) => m.role !== "system");
        const response = await client.messages.create({
          model: model || "claude-3-5-sonnet-20241022",
          max_tokens: maxTokens,
          temperature,
          system: systemMessage?.content || undefined,
          messages: conversationMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        });
        return response.content[0]?.type === "text" ? response.content[0].text : "";
      }

      case "gemini": {
        const client = getGeminiClient();
        const geminiModel = client.getGenerativeModel({ model: model || "gemini-pro" });
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter((m) => m.role !== "system");
        
        let prompt = "";
        if (systemMessage) {
          prompt = `${systemMessage.content}\n\n`;
        }
        prompt += conversationMessages.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
        prompt += "\n\nAssistant:";

        const result = await geminiModel.generateContent(prompt, {
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        });

        const response = result.response;
        return response.text();
      }

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  } catch (error) {
    // Fallback to another provider if configured
    if (provider !== env.DEFAULT_LLM_PROVIDER) {
      console.warn(`Provider ${provider} failed, falling back to ${env.DEFAULT_LLM_PROVIDER}`, error);
      return complete(messages, { ...options, provider: env.DEFAULT_LLM_PROVIDER });
    }
    throw error;
  }
}

// Helper to extract structured data from LLM responses
export async function extractStructuredData<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  options?: LLMCompletionOptions
): Promise<T> {
  const systemPrompt = `You are a helpful assistant that extracts structured data from conversations. 
Respond ONLY with valid JSON that matches the requested schema. Do not include any explanatory text, only the JSON object.`;

  const messages: LLMMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const response = await complete(messages, { ...options, temperature: 0.3 });
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in LLM response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse structured data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

