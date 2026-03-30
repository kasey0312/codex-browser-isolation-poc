import type { AutomationRuntime, ManagedSession, RuntimeResult } from './types.js';

type MockableBrowserManager = {
  applyMockInstruction(userId: number, instruction: string): Promise<void>;
  currentUrl(userId: number): Promise<string | null>;
};

export class MockAutomationRuntime implements AutomationRuntime {
  constructor(private readonly browserManager: MockableBrowserManager) {}

  async runInstruction(session: ManagedSession, instruction: string): Promise<RuntimeResult> {
    await this.browserManager.applyMockInstruction(session.user.id, instruction);
    const url = await this.browserManager.currentUrl(session.user.id);
    return {
      assistantMessage: `Mock Gemini runtime executed the instruction in the isolated browser sandbox. Current URL: ${url}`,
      threadId: session.codexThreadId,
    };
  }
}
