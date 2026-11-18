/** Lazy entry point: loads the chat host on first use. Safe to import from anywhere (no React, no stores). */
export const openWorkspaceChat = (): void => { void import('./workspaceChatHost').then(m => m.openWorkspaceChat()); };
export const toggleWorkspaceChat = (): void => { void import('./workspaceChatHost').then(m => m.toggleWorkspaceChat()); };
