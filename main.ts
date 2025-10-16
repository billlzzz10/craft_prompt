import { 
  App, 
  Plugin, 
  PluginSettingTab, 
  Setting, 
  TFile, 
  Notice, 
  WorkspaceLeaf, 
  ItemView,
  Modal,
  TextComponent,
  DropdownComponent,
  ToggleComponent,
  Platform
} from 'obsidian';
import { v4 as uuidv4 } from 'uuid';
import { MistralAIEmbeddings } from "@langchain/mistralai";
import { QdrantClient } from '@qdrant/js-client-rest';
import { z } from 'zod';
import { PerformanceOptimizer } from './src/performance';
import { AdvancedFeatures, SmartSuggestionsModal } from './src/advanced-features';
import { VoyageAIIntegration } from './src/voyage-ai';
import { VercelAIIntegration } from './src/vercel-ai';
import { DashboardView } from './src/dashboard';
import { EmailService, FileShareService, NotificationManager, DEFAULT_EMAIL_TEMPLATES } from './src/email-notifications';
import { EnhancedSearchEngine } from './src/enhanced-search';
import { SearchResultsModal } from './src/search-results-modal';

// Types & Interfaces
interface PluginSettings {
  projectInstructionsPath: string;
  mistralApiKey: string;
  qdrantUrl: string;
  qdrantApiKey: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  enableCloudflareRag: boolean;
  defaultRole: 'assistant' | 'planner' | 'researcher';
  customCloudEndpoint: string;
  customCloudApiKey: string;
  enableCustomCloudSync: boolean;
  
  // Voyage AI settings
  voyageApiKey: string;
  voyageModel: string;
  enableVoyageRerank: boolean;
  
  // Vercel AI settings
  vercelProviders: Array<{
    name: string;
    apiKey: string;
    model: string;
    enabled: boolean;
  }>;
  defaultAIProvider: string;
  
  // Email settings
  emailConfig: {
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  };
  emailTemplates: any[];
  notificationRules: any[];
  
  // Dashboard settings
  dashboardWidgets: any[];
  
  // Enhanced search settings
  searchHistory: any[];
  savedSearches: any[];
  defaultSearchType: 'semantic' | 'keyword' | 'hybrid' | 'ai_enhanced';
  enableSearchRerank: boolean;
  rerankThreshold: number;
}

interface MemoryNode {
  id: string;
  type: 'fact' | 'event' | 'task' | 'context' | 'markdown';
  content: string;
  summary: string;
  timestamp: { 
    created_at: string; 
    updated_at: string; 
    valid_from: string; 
    valid_until: string | null 
  };
  confidence: number;
  sources: Array<{ 
    type: string; 
    id: string; 
    description: string; 
    url?: string 
  }>;
  embeddings: number[];
  attributes: Record<string, any>;
  group_id: string;
  version: number;
  properties: Record<string, any>;
}

interface MemoryEdge {
  id: string;
  from: string;
  to: string;
  type: 'causal' | 'temporal' | 'similar' | 'references';
  fact: string;
  weight: number;
  timestamp: { created_at: string; updated_at: string };
}

interface GraphData {
  schema_version: string;
  graph_metadata: {
    total_nodes: number;
    total_edges: number;
    last_sync: string;
    device_id: string;
    version: number;
  };
  nodes: MemoryNode[];
  edges: MemoryEdge[];
}

const DEFAULT_SETTINGS: PluginSettings = {
  projectInstructionsPath: 'ai-mcp-instructions.json',
  mistralApiKey: '',
  qdrantUrl: 'http://localhost:6333',
  qdrantApiKey: '',
  cloudflareAccountId: '',
  cloudflareApiToken: '',
  enableCloudflareRag: false,
  defaultRole: 'assistant',
  customCloudEndpoint: '',
  customCloudApiKey: '',
  enableCustomCloudSync: false,
  
  // Voyage AI settings
  voyageApiKey: '',
  voyageModel: 'voyage-large-2',
  enableVoyageRerank: false,
  
  // Vercel AI settings
  vercelProviders: [],
  defaultAIProvider: 'mistral',
  
  // Email settings
  emailConfig: {
    smtpHost: '',
    smtpPort: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Obsidian AI MCP'
  },
  emailTemplates: DEFAULT_EMAIL_TEMPLATES,
  notificationRules: [],
  
  // Dashboard settings
  dashboardWidgets: [],
  
  // Enhanced search settings
  searchHistory: [],
  savedSearches: [],
  defaultSearchType: 'hybrid',
  enableSearchRerank: false,
  rerankThreshold: 0.1
};

const DEFAULT_INSTRUCTIONS = {
  project_name: "Obsidian AI MCP Plugin",
  ai_behavior: {
    default_provider: "mistral",
    preferred_models: { mistral: ["mistral-embed"] },
    tone: "professional",
    language: "th, en",
    max_response_length: 2000,
    context_sources: ["memory_graph", "rag_vault"],
    fallback_providers: ["local"],
    roles: {
      assistant: "Helpful assistant recalling vault context via graph.",
      planner: "Plan tasks using temporal edges in memory graph.",
      researcher: "Search meanings/similarities with Qdrant vectors."
    }
  },
  mcp_config: {
    memory_graph: {
      storage: "json",
      file_path: "memory-graph.json",
      schema_version: "1.0.0",
      max_nodes: 10000,
      vault_integration: { 
        enabled: true, 
        scan_interval: 600000, 
        file_types: [".md"], 
        max_file_size: 1048576 
      }
    },
    encrypted_graph_sync: { 
      enabled: true, 
      encryption_key: "vault-derived", 
      sync_protocol: "ws-encrypted", 
      max_sync_batch: 100, 
      conflict_resolution: "last-modified" 
    },
    planning_agent: { 
      task_format: "craft_clickup", 
      max_tasks: 500 
    }
  },
  rag_config: {
    vector_store: "qdrant",
    embedding_model: "mistral-embed",
    chunk_size: 500,
    top_k: 5,
    qdrant_config: { 
      local_enabled: true, 
      collection_name: "obsidian_rag" 
    },
    cloudflare_config: { 
      enabled: true, 
      index_name: "obsidian-vectors", 
      sync_only: true 
    }
  },
  sync_config: { 
    server_port: 8080, 
    sync_interval: 300000, 
    data_types: ["vectors", "memory", "tasks"] 
  }
};

// Chat View Class
class ChatView extends ItemView {
  static VIEW_TYPE = "ai-mcp-chat";
  private mode: 'ask' | 'planning' | 'agent' = 'ask';
  private contextNote: TFile | null = null;
  private roles: Record<string, string> = {};
  
  constructor(leaf: WorkspaceLeaf, private plugin: AIMCPPlugin) {
    super(leaf);
  }

  getViewType() { 
    return ChatView.VIEW_TYPE; 
  }
  
  getDisplayText() { 
    return "AI MCP Chat"; 
  }
  
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ai-mcp-chat-container");
    
    // Load roles
    this.roles = await this.plugin.loadRolesFromVault();
    
    // Header with mode selection
    container.createEl("div", { cls: "ai-mcp-header" }, (header) => {
      const select = header.createEl("select", { 
        cls: "ai-mcp-mode-select", 
        attr: { "aria-label": "Chat Mode" } 
      });
      
      Object.keys(this.roles).forEach(role => {
        const option = select.createEl("option", { 
          text: role.charAt(0).toUpperCase() + role.slice(1), 
          value: role
        });
        if (role === this.mode) {
          option.setAttribute('selected', 'selected');
        }
      });
      
      select.onchange = (e) => this.setMode((e.target as HTMLSelectElement).value as any);
      
      // Role management button
      header.createEl("button", {
        cls: "role-manage-btn",
        text: "⚙️",
        attr: { "aria-label": "Manage Roles" }
      }).onclick = () => this.openRoleManagementModal();
      
      // Mobile: context toggle
      if (Platform.isMobile) {
        header.createEl("button", { 
          cls: "ai-mcp-context-toggle", 
          text: "CTX" 
        }).onclick = () => this.toggleContextPanel();
      }
    });
    
    // Context panel
    const contextPanel = container.createEl("div", { 
      cls: `ai-mcp-context-panel ${Platform.isMobile ? 'mobile-hidden' : ''}` 
    });
    
    // Chat messages container
    const messagesContainer = container.createEl("div", { cls: "ai-mcp-messages" });
    
    // Input area
    container.createEl("div", { cls: "ai-mcp-input-area" }, (inputArea) => {
      const textarea = inputArea.createEl("textarea", { 
        cls: "ai-mcp-input", 
        attr: { placeholder: "Ask something..." } 
      });
      
      const sendBtn = inputArea.createEl("button", { 
        cls: "ai-mcp-send", 
        text: "Send" 
      });
      
      sendBtn.onclick = () => this.sendMessage();
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    });
    
    // Suggested responses
    container.createEl("div", { cls: "ai-mcp-suggestions" }, (suggestions) => {
      suggestions.createEl("div", { 
        cls: "suggestion-item", 
        text: "What's my next task?" 
      }).onclick = () => this.fillInput("What's my next task?");
      
      suggestions.createEl("div", { 
        cls: "suggestion-item", 
        text: "Summarize this note" 
      }).onclick = () => this.fillInput("Summarize this note");
      
      suggestions.createEl("div", { 
        cls: "suggestion-item", 
        text: "Search similar content" 
      }).onclick = () => this.fillInput("Search similar content");
    });
    
    // Export controls
    container.createEl("div", { cls: "ai-mcp-export-controls" }, (exportControls) => {
      exportControls.createEl("button", { 
        text: "Export Graph", 
        cls: "export-btn graph" 
      }).onclick = () => this.plugin.exportData('graph');
      
      exportControls.createEl("button", { 
        text: "Export Vectors", 
        cls: "export-btn vectors" 
      }).onclick = () => this.plugin.exportData('vectors');
      
      if (this.plugin.settings.enableCustomCloudSync) {
        exportControls.createEl("button", { 
          text: "Sync to Cloud", 
          cls: "export-btn cloud mod-cta" 
        }).onclick = () => this.syncToUserCloud();
      }
    });
    
    // Initialize context
    await this.updateContextFromActiveNote();
  }
  
  private fillInput(text: string) {
    const input = this.containerEl.querySelector(".ai-mcp-input") as HTMLTextAreaElement;
    if (input) {
      input.value = text;
      input.focus();
    }
  }
  
  private setMode(mode: 'ask' | 'planning' | 'agent') {
    this.mode = mode;
    const systemPrompt = this.roles[mode] || this.plugin.projectInstructions.ai_behavior.roles[mode];
    new Notice(`Switched to ${mode} mode: ${systemPrompt.substring(0, 50)}...`);
  }
  
  private toggleContextPanel() {
    const panel = this.containerEl.querySelector(".ai-mcp-context-panel");
    if (panel) {
      if (panel.hasClass("mobile-hidden")) {
        panel.removeClass("mobile-hidden");
      } else {
        panel.addClass("mobile-hidden");
      }
    }
  }
  
  private openRoleManagementModal() {
    new RoleManagementModal(this.app, this.plugin, () => {
      this.refreshRoles();
    }).open();
  }
  
  private async refreshRoles() {
    this.roles = await this.plugin.loadRolesFromVault();
    this.updateRoleDropdown();
  }
  
  private updateRoleDropdown() {
    const select = this.containerEl.querySelector(".ai-mcp-mode-select") as HTMLSelectElement;
    if (select) {
      select.innerHTML = '';
      Object.keys(this.roles).forEach(role => {
        const option = select.createEl("option", { 
          text: role.charAt(0).toUpperCase() + role.slice(1), 
          value: role
        });
        if (role === this.mode) {
          option.setAttribute('selected', 'selected');
        }
      });
    }
  }
  
  private async updateContextFromActiveNote() {
    const activeFile = this.plugin.app.workspace.getActiveFile();
    if (activeFile) {
      this.contextNote = activeFile;
      const content = await this.plugin.app.vault.read(activeFile);
      const context = this.extractRelevantContext(content, activeFile);
      
      const contextPanel = this.containerEl.querySelector(".ai-mcp-context-panel");
      if (contextPanel) {
        contextPanel.empty();
        contextPanel.createEl("h4", { text: "Current Context:" });
        contextPanel.createEl("div", { 
          cls: "context-content", 
          text: context.substring(0, 200) + "..." 
        });
      }
    }
  }
  
  private extractRelevantContext(content: string, file: TFile): string {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    // Use resolvedLinks instead of getBacklinksForFile
    const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
    
    let context = content;
    if (resolvedLinks && resolvedLinks[file.path]) {
      const linkedFiles = Object.keys(resolvedLinks[file.path]).slice(0, 3);
      for (const linkedPath of linkedFiles) {
        const linkedFile = this.plugin.app.vault.getAbstractFileByPath(linkedPath);
        if (linkedFile instanceof TFile) {
          context += "\n\n[RELATED: " + linkedFile.name + "]\n" + 
                    content.substring(0, 200);
        }
      }
    }
    return context;
  }
  
  private async sendMessage() {
    const input = this.containerEl.querySelector(".ai-mcp-input") as HTMLTextAreaElement;
    if (!input?.value.trim()) return;
    
    const messagesEl = this.containerEl.querySelector(".ai-mcp-messages");
    if (messagesEl) {
      // Add user message
      messagesEl.createEl("div", { cls: "message user" }, (msg) => {
        msg.createEl("div", { cls: "message-content", text: input.value });
        msg.createEl("div", { cls: "message-time", text: new Date().toLocaleTimeString() });
      });
      
      const userQuery = input.value;
      input.value = "";
      
      // Add bot response placeholder
      const botMsg = messagesEl.createEl("div", { cls: "message bot" }, (msg) => {
        msg.createEl("div", { cls: "message-content loading", text: "กำลังคิด..." });
      });
      
      // Scroll to bottom
      messagesEl.scrollTop = messagesEl.scrollHeight;
      
      try {
        const response = await this.getAIResponse(userQuery);
        const contentEl = botMsg.querySelector(".message-content");
        if (contentEl) {
          contentEl.removeClass("loading");
          contentEl.setText(response);
        }
        botMsg.createEl("div", { cls: "message-time", text: new Date().toLocaleTimeString() });
      } catch (e) {
        const contentEl = botMsg.querySelector(".message-content");
        if (contentEl) {
          contentEl.removeClass("loading");
          contentEl.addClass("error");
          contentEl.setText("Error: " + (e as Error).message);
        }
      }
      
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }
  
  private async getAIResponse(query: string): Promise<string> {
    const context = this.contextNote ? 
      await this.plugin.app.vault.read(this.contextNote) : "";
      
    switch (this.mode) {
      case 'ask':
        if (this.plugin.embeddings) {
          const embedding = await this.plugin.embeddings.embedQuery(query);
          const results = await this.plugin.ragIntegrator.searchSimilar(embedding);
          return results.length > 0 ? 
            `Based on your vault: ${results[0].text}` : 
            "No relevant information found in your vault.";
        }
        return "Please configure Mistral API key first.";
        
      case 'planning':
        return await this.plugin.planningAgent.planWithRole(this.mode, query);
        
      case 'agent':
        return `As ${this.mode} agent analyzing: "${query}"\n\nContext: ${context.substring(0, 200)}...\n\nI'm processing your request using the full capabilities of your vault's knowledge graph.`;
        
      default:
        return "Unknown mode selected.";
    }
  }
  
  private async syncToUserCloud() {
    try {
      await this.plugin.exportData('graph', true);
      await this.plugin.exportData('vectors', true);
      new Notice("Full data synced to your cloud service");
    } catch (e) {
      new Notice("Sync failed: " + (e as Error).message);
    }
  }
}

// Role Management Modal
class RoleManagementModal extends Modal {
  constructor(
    app: App, 
    private plugin: AIMCPPlugin,
    private onRoleChange: () => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Manage AI Roles" });
    
    this.displayRoles();
    
    // Add new role button
    contentEl.createEl("button", { 
      text: "Add New Role", 
      cls: "mod-cta" 
    }).onclick = () => this.addNewRole();
  }
  
  private async displayRoles() {
    const roles = await this.plugin.loadRolesFromVault();
    const rolesList = this.contentEl.createEl("div", { cls: "role-list" });
    
    Object.entries(roles).forEach(([name, prompt]) => {
      const roleItem = rolesList.createEl("div", { cls: "role-item" });
      roleItem.createEl("h3", { text: name });
      
      roleItem.createEl("div", { 
        cls: "prompt-preview", 
        text: prompt.substring(0, 100) + (prompt.length > 100 ? "..." : "") 
      });
      
      const actions = roleItem.createEl("div", { cls: "role-actions" });
      actions.createEl("button", { text: "Edit" }).onclick = () => 
        this.editRole(name, prompt);
      actions.createEl("button", { text: "Export" }).onclick = () => 
        this.exportRole(name);
      actions.createEl("button", { text: "Delete" }).onclick = () => 
        this.deleteRole(name);
    });
  }
  
  private async addNewRole() {
    const name = prompt("Enter role name:");
    if (!name) return;
    
    const rolePrompt = prompt("Enter system prompt for this role:", 
      "You are a helpful AI assistant.");
    if (!rolePrompt) return;
    
    await this.plugin.app.vault.create(
      `AI Roles/${name}.md`, 
      rolePrompt
    );
    
    this.onRoleChange();
    this.close();
  }
  
  private async editRole(name: string, currentPrompt: string) {
    const newPrompt = prompt("Edit system prompt:", currentPrompt);
    if (!newPrompt || newPrompt === currentPrompt) return;
    
    const file = this.plugin.app.vault.getAbstractFileByPath(`AI Roles/${name}.md`);
    if (file instanceof TFile) {
      await this.plugin.app.vault.modify(file, newPrompt);
      this.onRoleChange();
      this.close();
    }
  }
  
  private async exportRole(name: string) {
    const file = this.plugin.app.vault.getAbstractFileByPath(`AI Roles/${name}.md`);
    if (!file || !(file instanceof TFile)) return;
    
    const content = await this.plugin.app.vault.read(file);
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}-role-template.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  private async deleteRole(name: string) {
    if (!confirm(`Delete role "${name}"?`)) return;
    
    const file = this.plugin.app.vault.getAbstractFileByPath(`AI Roles/${name}.md`);
    if (file instanceof TFile) {
      await this.plugin.app.vault.delete(file);
      this.onRoleChange();
      this.close();
    }
  }
}

// Memory Graph Class
class MemoryGraph {
  constructor(private plugin: AIMCPPlugin) {}
  
  async addNode(nodeData: Partial<MemoryNode>, embedding?: number[]): Promise<string> {
    const node: MemoryNode = {
      id: uuidv4(),
      type: nodeData.type || 'context',
      content: nodeData.content || '',
      summary: nodeData.summary || nodeData.content?.substring(0, 100) || '',
      timestamp: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        valid_from: new Date().toISOString(),
        valid_until: null
      },
      confidence: nodeData.confidence || 0.8,
      sources: nodeData.sources || [],
      embeddings: embedding || [],
      attributes: nodeData.attributes || {},
      group_id: nodeData.group_id || 'default',
      version: 1,
      properties: nodeData.properties || {}
    };
    
    const graph = await this.load();
    graph.nodes.push(node);
    await this.save(graph);
    
    return node.id;
  }
  
  async load(): Promise<GraphData> {
    const path = this.plugin.projectInstructions.mcp_config.memory_graph.file_path;
    try {
      if (await this.plugin.app.vault.adapter.exists(path)) {
        const content = await this.plugin.app.vault.adapter.read(path);
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('Failed to load graph:', e);
    }
    
    return this.createEmptyGraph();
  }
  
  async save(graph: GraphData): Promise<void> {
    const path = this.plugin.projectInstructions.mcp_config.memory_graph.file_path;
    graph.graph_metadata.last_sync = new Date().toISOString();
    graph.graph_metadata.total_nodes = graph.nodes.length;
    graph.graph_metadata.total_edges = graph.edges.length;
    
    await this.plugin.app.vault.adapter.write(path, JSON.stringify(graph, null, 2));
  }
  
  private createEmptyGraph(): GraphData {
    return {
      schema_version: "1.0.0",
      graph_metadata: {
        total_nodes: 0,
        total_edges: 0,
        last_sync: new Date().toISOString(),
        device_id: uuidv4(),
        version: 1
      },
      nodes: [],
      edges: []
    };
  }
}

// RAG Integrator Class
class RAGIntegrator {
  constructor(private plugin: AIMCPPlugin) {}
  
  async searchSimilar(queryEmbedding: number[], limit: number = 5): Promise<Array<{text: string, score: number}>> {
    if (!this.plugin.qdrantClient) return [];
    
    try {
      const result = await this.plugin.qdrantClient.search(
        this.plugin.projectInstructions.rag_config.qdrant_config.collection_name,
        {
          vector: queryEmbedding,
          limit,
          with_payload: true
        }
      );
      
      return result.map(point => ({
        text: point.payload?.text as string || '',
        score: point.score || 0
      }));
    } catch (e) {
      console.error('Search failed:', e);
      return [];
    }
  }
  
  async upsertToQdrant(id: string, vector: number[], text: string): Promise<void> {
    if (!this.plugin.qdrantClient) return;
    
    try {
      await this.plugin.qdrantClient.upsert(
        this.plugin.projectInstructions.rag_config.qdrant_config.collection_name,
        {
          points: [{
            id,
            vector,
            payload: { text }
          }]
        }
      );
    } catch (e) {
      console.error('Upsert failed:', e);
    }
  }
  
  async exportVectors(): Promise<any[]> {
    if (!this.plugin.qdrantClient) return [];
    
    try {
      const result = await this.plugin.qdrantClient.scroll(
        this.plugin.projectInstructions.rag_config.qdrant_config.collection_name,
        { limit: 10000, with_payload: true, with_vector: true }
      );
      return result.points;
    } catch (e) {
      console.error('Export failed:', e);
      return [];
    }
  }
  
  async importVectors(points: any[]): Promise<void> {
    if (!this.plugin.qdrantClient) return;
    
    try {
      await this.plugin.qdrantClient.upsert(
        this.plugin.projectInstructions.rag_config.qdrant_config.collection_name,
        { points }
      );
    } catch (e) {
      console.error('Import failed:', e);
    }
  }
}

// Planning Agent Class
class PlanningAgent {
  constructor(private plugin: AIMCPPlugin) {}
  
  async planWithRole(role: string, query?: string): Promise<string> {
    const graph = await this.plugin.memoryGraph.load();
    const systemPrompt = this.plugin.projectInstructions.ai_behavior.roles[role];
    
    const tasks = graph.nodes
      .filter(n => n.type === 'task')
      .slice(0, this.plugin.projectInstructions.mcp_config.planning_agent.max_tasks);
    
    const plan = `Planning as ${role}:\n\nQuery: ${query || 'General planning'}\n\nSystem: ${systemPrompt}\n\nAvailable tasks: ${tasks.map(t => t.content).join('; ')}\n\nRecommended next steps based on your vault's knowledge graph.`;
    
    // Create plan note
    const planFile = `plan-${role}-${new Date().toISOString().slice(0,10)}.md`;
    await this.plugin.app.vault.create(planFile, plan);
    
    return plan;
  }
}

// Main Plugin Class
export default class AIMCPPlugin extends Plugin {
  settings: PluginSettings;
  projectInstructions: any;
  memoryGraph: MemoryGraph;
  ragIntegrator: RAGIntegrator;
  planningAgent: PlanningAgent;
  embeddings: MistralAIEmbeddings;
  qdrantClient: QdrantClient | null = null;
  lastHashes: Map<string, string> = new Map();
  performanceOptimizer: PerformanceOptimizer;
  advancedFeatures: AdvancedFeatures;
  
  // New integrations
  voyageAI: VoyageAIIntegration;
  vercelAI: VercelAIIntegration;
  emailService: EmailService;
  fileShareService: FileShareService;
  notificationManager: NotificationManager;
  enhancedSearch: EnhancedSearchEngine;

  async onload() {
    await this.loadSettings();
    
    // Initialize components
    this.memoryGraph = new MemoryGraph(this);
    this.ragIntegrator = new RAGIntegrator(this);
    this.planningAgent = new PlanningAgent(this);
    this.performanceOptimizer = new PerformanceOptimizer(this);
    this.advancedFeatures = new AdvancedFeatures(this);
    
    // Initialize new integrations
    this.voyageAI = new VoyageAIIntegration(this);
    this.vercelAI = new VercelAIIntegration(this);
    this.emailService = new EmailService(this);
    this.fileShareService = new FileShareService(this, this.emailService);
    this.notificationManager = new NotificationManager(this, this.emailService, this.fileShareService);
    this.enhancedSearch = new EnhancedSearchEngine(this, this.voyageAI, this.vercelAI);
    
    // Initialize integrations with settings
    await this.initializeIntegrations();
    
    await this.loadProjectInstructions();
    
    // Initialize embeddings if API key is available
    if (this.settings.mistralApiKey) {
      this.embeddings = new MistralAIEmbeddings({ 
        apiKey: this.settings.mistralApiKey 
      });
    }
    
    // File watchers
    this.registerEvent(
      this.app.vault.on('modify', (file: TFile) => this.handleFileChange(file))
    );
    this.registerEvent(
      this.app.vault.on('create', (file: TFile) => this.handleFileChange(file))
    );
    
    // Register views
    this.registerView(
      ChatView.VIEW_TYPE,
      (leaf) => new ChatView(leaf, this)
    );
    
    this.registerView(
      DashboardView.VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this)
    );
    
    // Commands
    this.addCommand({
      id: 'open-ai-chat',
      name: 'Open AI Chat Interface',
      callback: () => this.openRoleChat()
    });
    
    this.addCommand({
      id: 'initialize-vault-memory',
      name: 'Initialize Vault Memory (Full Scan)',
      callback: () => this.initializeVault()
    });
    
    this.addCommand({
      id: 'add-markdown-context',
      name: 'Add Markdown as Context to Graph',
      editorCallback: (editor) => this.addMarkdownContext(editor.getValue())
    });
    
    this.addCommand({
      id: 'test-vault-recall',
      name: 'Test Vault Recall',
      callback: () => this.testRecall()
    });
    
    this.addCommand({
      id: 'export-graph',
      name: 'Export Memory Graph',
      callback: () => this.exportData('graph')
    });
    
    this.addCommand({
      id: 'import-graph',
      name: 'Import Memory Graph',
      callback: () => this.importData('graph')
    });
    
    this.addCommand({
      id: 'visualize-graph',
      name: 'Visualize Memory Graph',
      callback: () => this.visualizeInGraphView()
    });
    
    this.addCommand({
      id: 'plan-tasks',
      name: 'Plan Tasks with Role',
      callback: () => this.planningAgent.planWithRole(this.settings.defaultRole)
    });
    
    this.addCommand({
      id: 'import-role-template',
      name: 'Import Role Template from Markdown',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          await this.importRoleFromMarkdown(file);
        } else {
          new Notice('Please open a markdown file first');
        }
      }
    });
    
    this.addCommand({
      id: 'show-smart-suggestions',
      name: 'Show Smart Suggestions',
      callback: async () => {
        const suggestions = await this.advancedFeatures.generateSmartSuggestions();
        new SmartSuggestionsModal(this, suggestions).open();
      }
    });
    
    this.addCommand({
      id: 'auto-tag-current-note',
      name: 'Auto-tag Current Note',
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === 'md') {
          const content = await this.app.vault.read(file);
          const tags = await this.advancedFeatures.autoTagContent(file, content);
          if (tags.length > 0) {
            const tagString = tags.map(tag => `#${tag}`).join(' ');
            await this.app.vault.modify(file, content + '\n\n' + tagString);
            new Notice(`Added ${tags.length} tags to current note`);
          } else {
            new Notice('No suitable tags found');
          }
        } else {
          new Notice('Please open a markdown file first');
        }
      }
    });
    
    this.addCommand({
      id: 'optimize-memory-usage',
      name: 'Optimize Memory Usage',
      callback: async () => {
        await this.performanceOptimizer.optimizeMemoryUsage();
        const stats = this.performanceOptimizer.getCacheStats();
        new Notice(`Memory optimized. Cache: ${stats.size} items, Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      }
    });
    
    this.addCommand({
      id: 'smart-search',
      name: 'Smart Search',
      callback: () => {
        const query = prompt('Enter search query:');
        if (query) {
          this.performSmartSearch(query);
        }
      }
    });
    
    // New commands for enhanced features
    this.addCommand({
      id: 'open-dashboard',
      name: 'Open AI MCP Dashboard',
      callback: () => this.openDashboard()
    });
    
    this.addCommand({
      id: 'enhanced-search',
      name: 'Enhanced Search with Rerank',
      callback: () => this.openEnhancedSearch()
    });
    
    this.addCommand({
      id: 'share-file-email',
      name: 'Share Current File via Email',
      callback: () => this.shareCurrentFileViaEmail()
    });
    
    this.addCommand({
      id: 'send-vault-summary',
      name: 'Send Vault Summary via Email',
      callback: () => this.sendVaultSummaryEmail()
    });
    
    this.addCommand({
      id: 'test-ai-providers',
      name: 'Test AI Providers',
      callback: () => this.testAIProviders()
    });
    
    // Ribbon icons
    this.addRibbonIcon('brain', 'AI Chat with Role', () => this.openRoleChat());
    this.addRibbonIcon('layout-dashboard', 'AI MCP Dashboard', () => this.openDashboard());
    
    // Settings tab
    this.addSettingTab(new AIMCPSettingTab(this.app, this));
    
    new Notice('AI MCP Plugin loaded! 🧠');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async loadProjectInstructions() {
    try {
      const path = this.settings.projectInstructionsPath;
      if (await this.app.vault.adapter.exists(path)) {
        const content = await this.app.vault.adapter.read(path);
        this.projectInstructions = JSON.parse(content);
      } else {
        await this.app.vault.adapter.write(
          path, 
          JSON.stringify(DEFAULT_INSTRUCTIONS, null, 2)
        );
        this.projectInstructions = DEFAULT_INSTRUCTIONS;
      }
      
      this.initQdrant();
    } catch (e) {
      console.error('Failed to load instructions:', e);
      this.projectInstructions = DEFAULT_INSTRUCTIONS;
    }
  }

  initQdrant() {
    if (!this.settings.qdrantUrl) return;
    
    this.qdrantClient = new QdrantClient({ 
      url: this.settings.qdrantUrl, 
      apiKey: this.settings.qdrantApiKey || undefined
    });
    
    // Create collection if not exists
    const config = this.projectInstructions.rag_config.qdrant_config;
    this.qdrantClient.createCollection(config.collection_name, { 
      vectors: { size: 1024, distance: 'Cosine' } 
    }).catch(() => {
      // Collection might already exist
    });
  }

  async loadRolesFromVault(): Promise<Record<string, string>> {
    const roleFolder = 'AI Roles';
    const roles: Record<string, string> = {};
    
    // Create folder if not exists
    if (!(await this.app.vault.adapter.exists(roleFolder))) {
      await this.app.vault.createFolder(roleFolder);
    }
    
    // Load all files in folder
    try {
      const files = await this.app.vault.adapter.list(roleFolder);
      for (const file of files.files) {
        if (file.endsWith('.md')) {
          const roleName = file.split('/').pop()?.replace('.md', '') || '';
          const content = await this.app.vault.adapter.read(file);
          roles[roleName] = content;
        }
      }
    } catch (e) {
      console.error('Failed to load roles:', e);
    }
    
    // Add default roles if empty
    if (Object.keys(roles).length === 0) {
      const defaultRoles = {
        'assistant': 'Helpful assistant recalling vault context via graph.',
        'planner': 'Plan tasks using temporal edges in memory graph.',
        'researcher': 'Search meanings/similarities with Qdrant vectors.'
      };
      
      for (const [name, prompt] of Object.entries(defaultRoles)) {
        await this.app.vault.create(`${roleFolder}/${name}.md`, prompt);
        roles[name] = prompt;
      }
    }
    
    return roles;
  }

  async handleFileChange(file: TFile) {
    if (file.extension !== 'md') return;
    if (!this.embeddings) return;
    
    // Use performance optimizer for debounced processing
    this.performanceOptimizer.debounceFileProcessing(file);
  }

  private hashContent(content: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  async initializeVault() {
    if (!this.embeddings) {
      new Notice('Please set Mistral API key first');
      return;
    }
    
    const files = this.app.vault.getMarkdownFiles()
      .filter(f => f.stat.size <= this.projectInstructions.mcp_config.memory_graph.vault_integration.max_file_size);
    
    let processed = 0;
    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        await this.ingestFileToRAG(file, content);
        processed++;
        
        if (processed % 10 === 0) {
          new Notice(`Processed ${processed}/${files.length} files...`);
        }
      } catch (e) {
        console.error(`Failed to process ${file.path}:`, e);
      }
    }
    
    new Notice(`Initialized ${processed} files to RAG/Graph.`);
  }

  async ingestFileToRAG(file: TFile, content: string) {
    if (!this.embeddings) return;
    
    const chunks = this.chunkText(content, this.projectInstructions.rag_config.chunk_size);
    
    for (const chunk of chunks) {
      try {
        const embedding = await this.embeddings.embedQuery(chunk);
        const nodeId = await this.memoryGraph.addNode({
          type: 'markdown',
          content: chunk,
          sources: [{
            type: 'rag_vault',
            id: file.path,
            description: file.name
          }]
        }, embedding);
        
        // Store in Qdrant
        await this.ragIntegrator.upsertToQdrant(nodeId, embedding, chunk);
        
      } catch (e) {
        console.error(`Failed to process chunk from ${file.path}:`, e);
      }
    }
  }

  private chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.substring(i, i + size));
    }
    return chunks;
  }

  async addMarkdownContext(markdown: string) {
    if (!this.embeddings) {
      new Notice('Please set Mistral API key first');
      return;
    }
    
    try {
      const embedding = await this.embeddings.embedQuery(markdown);
      const nodeId = await this.memoryGraph.addNode({
        type: 'context',
        content: markdown,
        sources: [{
          type: 'user_input',
          id: 'manual',
          description: 'Manual Markdown'
        }]
      }, embedding);
      
      new Notice(`Added Markdown context as node ${nodeId}.`);
    } catch (e) {
      new Notice('Failed to add context: ' + (e as Error).message);
    }
  }

  async testRecall() {
    if (!this.embeddings) {
      new Notice('Please set Mistral API key first');
      return;
    }
    
    const graph = await this.memoryGraph.load();
    if (graph.nodes.length === 0) {
      new Notice('No nodes. Initialize first.');
      return;
    }
    
    const randomNode = graph.nodes[Math.floor(Math.random() * graph.nodes.length)];
    const queryEmbedding = await this.embeddings.embedQuery(
      randomNode.content.substring(0, 50)
    );
    const results = await this.ragIntegrator.searchSimilar(queryEmbedding, 1);
    const score = results[0]?.score || 0;
    const pass = score > 0.7;
    
    console.log({ 
      groundTruth: randomNode.content, 
      score, 
      pass 
    });
    
    new Notice(`Recall Test: ${pass ? 'PASS' : 'FAIL'} (Score: ${score.toFixed(2)})`);
  }

  async exportData(type: 'graph' | 'vectors', toCloud = false) {
    if (toCloud && this.settings.enableCustomCloudSync) {
      return await this.exportToCustomCloud(type);
    }
    
    const data = type === 'graph' ? 
      await this.memoryGraph.load() : 
      await this.ragIntegrator.exportVectors();
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async exportToCustomCloud(type: 'graph' | 'vectors'): Promise<boolean> {
    if (!this.settings.enableCustomCloudSync || !this.settings.customCloudEndpoint) {
      new Notice('Custom cloud sync not configured');
      return false;
    }
    
    try {
      const data = type === 'graph' ? 
        await this.memoryGraph.load() : 
        await this.ragIntegrator.exportVectors();
      
      const response = await fetch(this.settings.customCloudEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.settings.customCloudApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          vaultName: this.app.vault.getName()
        })
      });
      
      if (!response.ok) throw new Error(await response.text());
      
      new Notice(`Successfully exported ${type} to your cloud`);
      return true;
    } catch (e) {
      new Notice(`Cloud export failed: ${(e as Error).message}`);
      console.error('Cloud export error:', e);
      return false;
    }
  }

  async importData(type: 'graph' | 'vectors') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const content = await file.text();
          const data = JSON.parse(content);
          
          if (type === 'graph') {
            await this.memoryGraph.save(data);
          } else {
            await this.ragIntegrator.importVectors(data);
          }
          
          new Notice(`Imported ${type} successfully.`);
        } catch (e) {
          new Notice(`Import failed: ${(e as Error).message}`);
        }
      }
    };
    
    input.click();
  }

  async visualizeInGraphView() {
    const graph = await this.memoryGraph.load();
    
    const graphData = {
      nodes: graph.nodes.map(n => ({
        id: n.id,
        label: n.summary || n.content.slice(0, 20),
        type: n.type,
        x: Math.random() * 1000,
        y: Math.random() * 1000
      })),
      edges: graph.edges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.type,
        weight: e.weight
      }))
    };
    
    const tempFile = `temp-graph-${uuidv4()}.json`;
    await this.app.vault.create(tempFile, JSON.stringify(graphData, null, 2));
    
    const leaf = this.app.workspace.getLeaf('tab');
    const file = this.app.vault.getAbstractFileByPath(tempFile);
    if (file instanceof TFile) {
      await leaf.openFile(file, { active: true });
    }
    
    new Notice('Graph visualized in new tab.');
  }

  async importRoleFromMarkdown(file: TFile) {
    const content = await this.app.vault.read(file);
    let roleName = file.basename;
    let prompt = content;
    
    // Check for frontmatter
    if (content.startsWith('---')) {
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatter = content.substring(3, frontmatterEnd);
        try {
          const yaml = frontmatter.split('\n').reduce((acc, line) => {
            const [key, ...valueParts] = line.split(':');
            if (key && valueParts.length) {
              acc[key.trim()] = valueParts.join(':').trim();
            }
            return acc;
          }, {} as Record<string, string>);
          
          if (yaml.roleName) roleName = yaml.roleName;
        } catch (e) {
          console.error('Failed to parse frontmatter:', e);
        }
        prompt = content.substring(frontmatterEnd + 3).trim();
      }
    }
    
    await this.app.vault.create(`AI Roles/${roleName}.md`, prompt);
    new Notice(`Imported role: ${roleName}`);
  }

  private async performSmartSearch(query: string) {
    try {
      const results = await this.advancedFeatures.smartSearch(query, {
        includeContext: true,
        searchType: 'hybrid',
        maxResults: 10
      });
      
      if (results.length > 0) {
        // Create a temporary note with search results
        const resultsContent = `# Smart Search Results: "${query}"\n\n` +
          results.map((result, index) => 
            `## Result ${index + 1} (${result.type}, Score: ${(result.score || 0).toFixed(2)})\n` +
            `${result.text || result.content || result.summary}\n\n` +
            (result.context?.related?.length ? 
              `**Related:** ${result.context.related.map((r: any) => r.summary).join(', ')}\n\n` : '')
          ).join('---\n\n');
        
        const fileName = `Smart Search - ${query.replace(/[^\w\s]/g, '')} - ${new Date().toISOString().slice(0, 10)}.md`;
        await this.app.vault.create(fileName, resultsContent);
        
        // Open the results file
        const file = this.app.vault.getAbstractFileByPath(fileName);
        if (file instanceof TFile) {
          const leaf = this.app.workspace.getLeaf('tab');
          await leaf.openFile(file, { active: true });
        }
        
        new Notice(`Found ${results.length} results for "${query}"`);
      } else {
        new Notice(`No results found for "${query}"`);
      }
    } catch (e) {
      new Notice(`Search failed: ${(e as Error).message}`);
    }
  }

  private async openRoleChat() {
    const { workspace } = this.app;
    
    let leaf = workspace.getLeavesOfType(ChatView.VIEW_TYPE)[0];
    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({ 
          type: ChatView.VIEW_TYPE, 
          active: true 
        });
      }
    }
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  
  // New methods for enhanced features
  async initializeIntegrations() {
    // Initialize Voyage AI
    if (this.settings.voyageApiKey) {
      await this.voyageAI.initialize({
        apiKey: this.settings.voyageApiKey,
        model: this.settings.voyageModel
      });
    }
    
    // Initialize Vercel AI
    if (this.settings.vercelProviders.length > 0) {
      await this.vercelAI.initialize(this.settings.vercelProviders);
    }
    
    // Initialize Email Service
    if (this.settings.emailConfig.smtpHost) {
      await this.emailService.configure(this.settings.emailConfig);
    }
  }
  
  async openDashboard() {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(DashboardView.VIEW_TYPE);
    
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: DashboardView.VIEW_TYPE, active: true });
    }
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
  
  async openEnhancedSearch() {
    const query = prompt('Enter search query:');
    if (!query) return;
    
    try {
      const results = await this.enhancedSearch.search({
        query,
        searchType: this.settings.defaultSearchType,
        maxResults: 20,
        useRerank: this.settings.enableSearchRerank,
        rerankThreshold: this.settings.rerankThreshold,
        includeContent: true,
        fileTypes: ['md'],
        sortBy: 'relevance',
        sortOrder: 'desc'
      });
      
      // Display results in a modal or new view
      new SearchResultsModal(this.app, results).open();
    } catch (error) {
      new Notice(`Search failed: ${(error as Error).message}`);
    }
  }
  
  async shareCurrentFileViaEmail() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== 'md') {
      new Notice('Please open a markdown file first');
      return;
    }
    
    const recipients = prompt('Enter email addresses (comma-separated):');
    if (!recipients) return;
    
    const recipientList = recipients.split(',').map(email => email.trim());
    const message = prompt('Enter a message (optional):') || '';
    
    try {
      await this.fileShareService.shareFileViaEmail(file, recipientList, message);
    } catch (error) {
      new Notice(`Failed to share file: ${(error as Error).message}`);
    }
  }
  
  async sendVaultSummaryEmail() {
    const recipients = prompt('Enter email addresses (comma-separated):');
    if (!recipients) return;
    
    const recipientList = recipients.split(',').map(email => email.trim());
    
    try {
      await this.fileShareService.shareVaultSummary(recipientList, true, true);
    } catch (error) {
      new Notice(`Failed to send vault summary: ${(error as Error).message}`);
    }
  }
  
  async testAIProviders() {
    if (this.vercelAI.isReady()) {
      const results = await this.vercelAI.testAllProviders();
      const summary = Object.entries(results)
        .map(([provider, success]) => `${provider}: ${success ? '✅' : '❌'}`)
        .join('\n');
      
      new Notice(`AI Provider Test Results:\n${summary}`, 5000);
    } else {
      new Notice('No AI providers configured');
    }
  }

  async onunload() {
    // Cleanup all integrations
    if (this.performanceOptimizer) {
      this.performanceOptimizer.destroy();
    }
    if (this.notificationManager) {
      this.notificationManager.destroy();
    }
    if (this.enhancedSearch) {
      this.enhancedSearch.destroy();
    }
    if (this.voyageAI) {
      this.voyageAI.destroy();
    }
    if (this.vercelAI) {
      this.vercelAI.destroy();
    }
  }
}

// Settings Tab
class AIMCPSettingTab extends PluginSettingTab {
  plugin: AIMCPPlugin;

  constructor(app: App, plugin: AIMCPPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI MCP Plugin Settings" });

    // Project Instructions Path
    new Setting(containerEl)
      .setName('Project Instructions Path')
      .setDesc('Path to the project instructions JSON file')
      .addText(text => text
        .setValue(this.plugin.settings.projectInstructionsPath)
        .onChange(async (value) => {
          this.plugin.settings.projectInstructionsPath = value;
          await this.plugin.saveSettings();
          await this.plugin.loadProjectInstructions();
        }));

    // Mistral API Key
    new Setting(containerEl)
      .setName('Mistral API Key')
      .setDesc('API key for Mistral embeddings (free tier available)')
      .addText(text => text
        .setPlaceholder('Enter your Mistral API key')
        .setValue(this.plugin.settings.mistralApiKey)
        .onChange(async (value) => {
          this.plugin.settings.mistralApiKey = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.embeddings = new MistralAIEmbeddings({ apiKey: value });
          }
        }));

    // Qdrant Settings
    containerEl.createEl("h3", { text: "Qdrant Vector Database" });

    new Setting(containerEl)
      .setName('Qdrant URL')
      .setDesc('URL for Qdrant instance (local: http://localhost:6333)')
      .addText(text => text
        .setValue(this.plugin.settings.qdrantUrl)
        .onChange(async (value) => {
          this.plugin.settings.qdrantUrl = value;
          await this.plugin.saveSettings();
          this.plugin.initQdrant();
        }));

    new Setting(containerEl)
      .setName('Qdrant API Key (Cloud)')
      .setDesc('API key for Qdrant cloud (leave empty for local)')
      .addText(text => text
        .setPlaceholder('Enter API key for cloud Qdrant')
        .setValue(this.plugin.settings.qdrantApiKey)
        .onChange(async (value) => {
          this.plugin.settings.qdrantApiKey = value;
          await this.plugin.saveSettings();
          this.plugin.initQdrant();
        }));

    // Cloudflare Settings
    containerEl.createEl("h3", { text: "Cloudflare Integration" });

    new Setting(containerEl)
      .setName('Cloudflare Account ID')
      .addText(text => text
        .setValue(this.plugin.settings.cloudflareAccountId)
        .onChange(async (value) => {
          this.plugin.settings.cloudflareAccountId = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Cloudflare API Token')
      .addText(text => text
        .setValue(this.plugin.settings.cloudflareApiToken)
        .onChange(async (value) => {
          this.plugin.settings.cloudflareApiToken = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Enable Cloudflare RAG (Fallback)')
      .setDesc('Use Cloudflare as fallback for RAG operations')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableCloudflareRag)
        .onChange(async (value) => {
          this.plugin.settings.enableCloudflareRag = value;
          await this.plugin.saveSettings();
        }));

    // Custom Cloud Sync
    containerEl.createEl("h3", { text: "Custom Cloud Sync" });

    new Setting(containerEl)
      .setName('Enable Custom Cloud Sync')
      .setDesc('Send exports to your own cloud service')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableCustomCloudSync)
        .onChange(async (value) => {
          this.plugin.settings.enableCustomCloudSync = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Custom Cloud Endpoint')
      .setDesc('Your API endpoint for data sync')
      .addText(text => text
        .setPlaceholder('https://your-api.com/sync')
        .setValue(this.plugin.settings.customCloudEndpoint)
        .onChange(async (value) => {
          this.plugin.settings.customCloudEndpoint = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Custom Cloud API Key')
      .addText(text => text
        .setPlaceholder('API Key')
        .setValue(this.plugin.settings.customCloudApiKey)
        .onChange(async (value) => {
          this.plugin.settings.customCloudApiKey = value;
          await this.plugin.saveSettings();
        }));

    // Default Role
    new Setting(containerEl)
      .setName('Default Role')
      .setDesc('Default AI role for chat interface')
      .addDropdown(dropdown => dropdown
        .addOption('assistant', 'Assistant')
        .addOption('planner', 'Planner')
        .addOption('researcher', 'Researcher')
        .setValue(this.plugin.settings.defaultRole)
        .onChange(async (value: any) => {
          this.plugin.settings.defaultRole = value;
          await this.plugin.saveSettings();
        }));
  }
}
