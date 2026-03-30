import { AIMessage, type BaseMessageLike } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import type { BrowserAutomationCapable } from '../browser/types.js';
import { loadConfig } from '../config/loadConfig.js';
import { getEnv } from '../config/env.js';
import type { AutomationRuntime, ManagedSession, RuntimeResult } from './types.js';

export class GeminiLangGraphRuntime implements AutomationRuntime {
  async runInstruction(session: ManagedSession, instruction: string): Promise<RuntimeResult> {
    const env = getEnv();
    const apiKey = env.geminiApiKey;
    if (!apiKey) {
      throw new Error('Set GEMINI_API_KEY or GOOGLE_API_KEY to use the real Gemini runtime.');
    }

    const browserTools = createBrowserTools(this.browserManager, session.user.id);
    const agent = createReactAgent({
      llm: new ChatGoogleGenerativeAI({
        apiKey,
        model: env.model ?? loadConfig().agent.model,
        temperature: 0,
        maxRetries: 2,
      }),
      tools: browserTools,
      prompt: buildSystemPrompt(session),
      checkpointer: this.checkpointer,
    });

    const threadId = session.codexThreadId ?? `langgraph-${session.id}`;
    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content: instruction }],
      },
      {
        configurable: {
          thread_id: threadId,
        },
      },
    );

    return {
      assistantMessage: extractAssistantText(result.messages),
      threadId,
    };
  }

  constructor(private readonly browserManager: BrowserAutomationCapable) {}

  private readonly checkpointer = new MemorySaver();
}

function buildSystemPrompt(session: ManagedSession) {
  const config = loadConfig();
  return [
    config.agent.instruction_prefix,
    `This browser sandbox belongs only to user ${session.user.username}.`,
    'Use the available browser tools directly instead of asking the user to perform browser actions.',
    'Prefer deterministic selectors on the automation playground: [data-testid="playground-note"], [data-testid="playground-submit"], and [data-testid="playground-result"].',
    'When you need to inspect the page, call get_page_state before acting and again after meaningful actions.',
    'Reply with a concise summary of what you did and the end state of the page.',
  ].join('\n\n');
}

function createBrowserTools(browserManager: BrowserAutomationCapable, userId: number) {
  return [
    tool(
      async ({ url }) => {
        const currentUrl = await browserManager.navigate(userId, url);
        return JSON.stringify({ ok: true, currentUrl });
      },
      {
        name: 'open_url',
        description: 'Navigate the isolated browser to a full http or https URL.',
        schema: z.object({ url: z.string().url() }),
      },
    ),
    tool(
      async () => {
        const state = await browserManager.getPageState(userId);
        return JSON.stringify(state);
      },
      {
        name: 'get_page_state',
        description: 'Read the current URL, page title, and a text snippet from the visible page.',
        schema: z.object({}),
      },
    ),
    tool(
      async ({ selector, text }) => browserManager.typeInto(userId, selector, text),
      {
        name: 'type_into',
        description: 'Fill an input or textarea found by a CSS selector.',
        schema: z.object({ selector: z.string().min(1), text: z.string() }),
      },
    ),
    tool(
      async ({ selector }) => browserManager.click(userId, selector),
      {
        name: 'click',
        description: 'Click an element found by a CSS selector.',
        schema: z.object({ selector: z.string().min(1) }),
      },
    ),
    tool(
      async ({ text, timeoutMs }) => {
        const resolvedTimeout = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : 10_000;
        const found = await browserManager.waitForText(userId, text, resolvedTimeout);
        return JSON.stringify({ found, timeoutMs: resolvedTimeout });
      },
      {
        name: 'wait_for_text',
        description: 'Wait until specific text appears on the page.',
        schema: z.object({ text: z.string().min(1), timeoutMs: z.number().optional() }),
      },
    ),
  ];
}

function extractAssistantText(messages: BaseMessageLike[] | undefined) {
  if (!messages?.length) return 'No response produced.';
  const assistant = [...messages].reverse().find((message) => message instanceof AIMessage);
  if (!assistant) return 'No response produced.';
  if (typeof assistant.content === 'string') return assistant.content;
  return assistant.content
    .map((part) => {
      if (typeof part === 'string') return part;
      if ('text' in part && typeof part.text === 'string') return part.text;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim() || 'No response produced.';
}
