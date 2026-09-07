import type { ToolResult } from "./types.js";

export type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>;

export class ToolRegistry {
  private readonly tools = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): void {
    if (this.tools.has(name)) throw new Error(`Tool already registered: ${name}`);
    this.tools.set(name, handler);
  }

  async execute(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const handler = this.tools.get(name);
    if (!handler) return { ok: false, output: `Unknown tool: ${name}` };
    return handler(input);
  }
}
