import type { BrowserAutomationCapable, BrowserSessionManager, MockInstructionCapable } from '../browser/types.js';
import { getEnv } from '../config/env.js';
import { GeminiLangGraphRuntime } from './geminiLangGraphRuntime.js';
import { MockAutomationRuntime } from './mockAutomationRuntime.js';
import type { AutomationRuntime } from './types.js';

export function createAutomationRuntime(
  browserManager: BrowserAutomationCapable & BrowserSessionManager & Partial<MockInstructionCapable>,
): AutomationRuntime {
  if (getEnv().mockRuntime) {
    if (!isMockRuntimeBrowserManager(browserManager)) {
      throw new Error('Mock runtime requires a browser manager that implements applyMockInstruction().');
    }
    return new MockAutomationRuntime(browserManager);
  }
  return new GeminiLangGraphRuntime(browserManager);
}

function isMockRuntimeBrowserManager(
  browserManager: BrowserAutomationCapable & BrowserSessionManager & Partial<MockInstructionCapable>,
): browserManager is BrowserAutomationCapable & BrowserSessionManager & MockInstructionCapable {
  return typeof browserManager.applyMockInstruction === 'function';
}
