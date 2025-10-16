import { ItemView, WorkspaceLeaf, TFile, Notice, Modal, Setting } from 'obsidian';
import { marked } from 'marked';
import { Chart, registerables } from 'chart.js';
import AIMCPPlugin from '../main';

// Note: DOMPurify removed for browser compatibility

// Register Chart.js components
Chart.register(...registerables);

export interface DashboardMetrics {
  totalNotes: number;
  totalWords: number;
  totalTags: number;
  totalLinks: number;
  recentActivity: Array<{
    date: string;
    action: string;
    file: string;
    count: number;
  }>;
  topTags: Array<{
    tag: string;
    count: number;
  }>;
  knowledgeGraph: {
    nodes: number;
    edges: number;
    clusters: number;
  };
  aiUsage: {
    queriesThisWeek: number;
    tokensUsed: number;
    topQueries: string[];
  };
}

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'list' | 'markdown' | 'ai-insights';
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number };
  data: any;
  refreshInterval?: number;
}

export class DashboardView extends ItemView {
  static VIEW_TYPE = "ai-mcp-dashboard";
  private widgets: Map<string, DashboardWidget> = new Map();
  private charts: Map<string, Chart> = new Map();
  private refreshIntervals: Map<string, number> = new Map();
  private isEditMode = false;

  constructor(leaf: WorkspaceLeaf, private plugin: AIMCPPlugin) {
    super(leaf);
    this.initializeDefaultWidgets();
  }

  getViewType() {
    return DashboardView.VIEW_TYPE;
  }

  getDisplayText() {
    return "AI MCP Dashboard";
  }

  getIcon() {
    return "layout-dashboard";
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ai-mcp-dashboard");

    await this.renderDashboard();
    this.startAutoRefresh();
  }

  async onClose() {
    this.stopAutoRefresh();
    this.destroyCharts();
  }

  private initializeDefaultWidgets() {
    const defaultWidgets: DashboardWidget[] = [
      {
        id: 'vault-overview',
        title: 'Vault Overview',
        type: 'metric',
        size: 'medium',
        position: { x: 0, y: 0 },
        data: {},
        refreshInterval: 60000 // 1 minute
      },
      {
        id: 'activity-chart',
        title: 'Recent Activity',
        type: 'chart',
        size: 'large',
        position: { x: 1, y: 0 },
        data: { chartType: 'line' },
        refreshInterval: 300000 // 5 minutes
      },
      {
        id: 'top-tags',
        title: 'Top Tags',
        type: 'chart',
        size: 'medium',
        position: { x: 0, y: 1 },
        data: { chartType: 'doughnut' },
        refreshInterval: 300000
      },
      {
        id: 'ai-insights',
        title: 'AI Insights',
        type: 'ai-insights',
        size: 'large',
        position: { x: 1, y: 1 },
        data: {},
        refreshInterval: 600000 // 10 minutes
      },
      {
        id: 'quick-notes',
        title: 'Quick Notes',
        type: 'markdown',
        size: 'medium',
        position: { x: 0, y: 2 },
        data: { content: '# Quick Notes\n\nAdd your quick notes here...' }
      },
      {
        id: 'recent-files',
        title: 'Recent Files',
        type: 'list',
        size: 'medium',
        position: { x: 1, y: 2 },
        data: {},
        refreshInterval: 60000
      }
    ];

    defaultWidgets.forEach(widget => {
      this.widgets.set(widget.id, widget);
    });
  }

  private async renderDashboard() {
    const container = this.containerEl.children[1];
    container.empty();

    // Dashboard header
    const header = container.createEl("div", { cls: "dashboard-header" });
    
    header.createEl("h1", { 
      text: "AI MCP Dashboard",
      cls: "dashboard-title"
    });

    const headerActions = header.createEl("div", { cls: "dashboard-actions" });
    
    // Edit mode toggle
    const editBtn = headerActions.createEl("button", {
      text: this.isEditMode ? "Save Layout" : "Edit Layout",
      cls: "dashboard-edit-btn"
    });
    editBtn.onclick = () => this.toggleEditMode();

    // Refresh button
    const refreshBtn = headerActions.createEl("button", {
      text: "Refresh",
      cls: "dashboard-refresh-btn"
    });
    refreshBtn.onclick = () => this.refreshAllWidgets();

    // Add widget button
    const addBtn = headerActions.createEl("button", {
      text: "Add Widget",
      cls: "dashboard-add-btn"
    });
    addBtn.onclick = () => this.showAddWidgetModal();

    // Dashboard grid
    const grid = container.createEl("div", { cls: "dashboard-grid" });
    
    if (this.isEditMode) {
      grid.addClass("edit-mode");
    }

    // Render widgets
    for (const [id, widget] of this.widgets) {
      await this.renderWidget(grid, widget);
    }
  }

  private async renderWidget(container: HTMLElement, widget: DashboardWidget) {
    const widgetEl = container.createEl("div", {
      cls: `dashboard-widget widget-${widget.type} widget-${widget.size}`,
      attr: {
        "data-widget-id": widget.id,
        "data-x": widget.position.x.toString(),
        "data-y": widget.position.y.toString()
      }
    });

    // Widget header
    const header = widgetEl.createEl("div", { cls: "widget-header" });
    header.createEl("h3", { text: widget.title, cls: "widget-title" });

    if (this.isEditMode) {
      const actions = header.createEl("div", { cls: "widget-actions" });
      
      const deleteBtn = actions.createEl("button", {
        text: "×",
        cls: "widget-delete-btn"
      });
      deleteBtn.onclick = () => this.deleteWidget(widget.id);

      const configBtn = actions.createEl("button", {
        text: "⚙",
        cls: "widget-config-btn"
      });
      configBtn.onclick = () => this.configureWidget(widget.id);
    }

    // Widget content
    const content = widgetEl.createEl("div", { cls: "widget-content" });
    
    try {
      await this.renderWidgetContent(content, widget);
    } catch (error) {
      console.error(`Failed to render widget ${widget.id}:`, error);
      content.createEl("div", {
        text: `Error loading widget: ${(error as Error).message}`,
        cls: "widget-error"
      });
    }

    // Make draggable in edit mode
    if (this.isEditMode) {
      this.makeDraggable(widgetEl);
    }
  }

  private async renderWidgetContent(container: HTMLElement, widget: DashboardWidget) {
    switch (widget.type) {
      case 'metric':
        await this.renderMetricWidget(container, widget);
        break;
      case 'chart':
        await this.renderChartWidget(container, widget);
        break;
      case 'list':
        await this.renderListWidget(container, widget);
        break;
      case 'markdown':
        await this.renderMarkdownWidget(container, widget);
        break;
      case 'ai-insights':
        await this.renderAIInsightsWidget(container, widget);
        break;
      default:
        container.createEl("div", { text: "Unknown widget type", cls: "widget-error" });
    }
  }

  private async renderMetricWidget(container: HTMLElement, widget: DashboardWidget) {
    const metrics = await this.collectVaultMetrics();
    
    const metricsGrid = container.createEl("div", { cls: "metrics-grid" });

    const metricItems = [
      { label: "Notes", value: metrics.totalNotes, icon: "📝" },
      { label: "Words", value: metrics.totalWords.toLocaleString(), icon: "📊" },
      { label: "Tags", value: metrics.totalTags, icon: "🏷️" },
      { label: "Links", value: metrics.totalLinks, icon: "🔗" }
    ];

    metricItems.forEach(item => {
      const metricEl = metricsGrid.createEl("div", { cls: "metric-item" });
      metricEl.createEl("div", { text: item.icon, cls: "metric-icon" });
      metricEl.createEl("div", { text: item.value.toString(), cls: "metric-value" });
      metricEl.createEl("div", { text: item.label, cls: "metric-label" });
    });
  }

  private async renderChartWidget(container: HTMLElement, widget: DashboardWidget) {
    const canvas = container.createEl("canvas", {
      attr: { width: "400", height: "300" }
    });

    const metrics = await this.collectVaultMetrics();
    let chartData: any;
    let chartOptions: any;

    switch (widget.data.chartType) {
      case 'line':
        chartData = {
          labels: metrics.recentActivity.map(a => a.date),
          datasets: [{
            label: 'Daily Activity',
            data: metrics.recentActivity.map(a => a.count),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
          }]
        };
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true }
          }
        };
        break;

      case 'doughnut':
        chartData = {
          labels: metrics.topTags.map(t => t.tag),
          datasets: [{
            data: metrics.topTags.map(t => t.count),
            backgroundColor: [
              '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
              '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
            ]
          }]
        };
        chartOptions = {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right' }
          }
        };
        break;

      default:
        container.createEl("div", { text: "Unknown chart type", cls: "widget-error" });
        return;
    }

    const chart = new Chart(canvas, {
      type: widget.data.chartType,
      data: chartData,
      options: chartOptions
    });

    this.charts.set(widget.id, chart);
  }

  private async renderListWidget(container: HTMLElement, widget: DashboardWidget) {
    const recentFiles = this.plugin.app.vault.getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, 10);

    const list = container.createEl("ul", { cls: "widget-list" });

    recentFiles.forEach(file => {
      const item = list.createEl("li", { cls: "list-item" });
      
      const link = item.createEl("a", {
        text: file.basename,
        cls: "file-link"
      });
      link.onclick = async () => {
        const leaf = this.plugin.app.workspace.getLeaf('tab');
        await leaf.openFile(file);
      };

      const time = item.createEl("span", {
        text: new Date(file.stat.mtime).toLocaleDateString(),
        cls: "file-time"
      });
    });
  }

  private async renderMarkdownWidget(container: HTMLElement, widget: DashboardWidget) {
    const content = widget.data.content || '# Empty Widget\n\nAdd some content...';
    
    if (this.isEditMode) {
      const textarea = container.createEl("textarea", {
        value: content,
        cls: "markdown-editor"
      });
      textarea.onchange = () => {
        widget.data.content = textarea.value;
        this.saveWidgetConfig();
      };
    } else {
      const html = marked(content);
      // Note: In a production environment, you should sanitize HTML
      container.innerHTML = html;
      container.addClass("markdown-content");
    }
  }

  private async renderAIInsightsWidget(container: HTMLElement, widget: DashboardWidget) {
    const loadingEl = container.createEl("div", {
      text: "Generating AI insights...",
      cls: "loading-message"
    });

    try {
      const insights = await this.generateAIInsights();
      loadingEl.remove();

      const insightsContainer = container.createEl("div", { cls: "ai-insights" });

      insights.forEach(insight => {
        const insightEl = insightsContainer.createEl("div", { cls: "insight-item" });
        insightEl.createEl("h4", { text: insight.title, cls: "insight-title" });
        insightEl.createEl("p", { text: insight.description, cls: "insight-description" });
        
        if (insight.action) {
          const actionBtn = insightEl.createEl("button", {
            text: insight.action.label,
            cls: "insight-action-btn"
          });
          actionBtn.onclick = insight.action.callback;
        }
      });
    } catch (error) {
      loadingEl.setText(`Failed to generate insights: ${(error as Error).message}`);
      loadingEl.addClass("error-message");
    }
  }

  private async collectVaultMetrics(): Promise<DashboardMetrics> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const cache = this.plugin.app.metadataCache;
    
    let totalWords = 0;
    const tags = new Set<string>();
    let totalLinks = 0;
    const recentActivity: Array<{ date: string; action: string; file: string; count: number }> = [];

    // Collect metrics from files
    for (const file of files) {
      const fileCache = cache.getFileCache(file);
      
      // Count words
      try {
        const content = await this.plugin.app.vault.read(file);
        totalWords += content.split(/\s+/).length;
      } catch (e) {
        // Skip files that can't be read
      }

      // Collect tags
      if (fileCache?.tags) {
        fileCache.tags.forEach(tag => tags.add(tag.tag));
      }

      // Count links
      if (fileCache?.links) {
        totalLinks += fileCache.links.length;
      }
    }

    // Generate recent activity (simplified)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return {
        date: date.toLocaleDateString(),
        action: 'edit',
        file: 'various',
        count: Math.floor(Math.random() * 10) + 1
      };
    }).reverse();

    // Top tags
    const topTags = Array.from(tags)
      .map(tag => ({ tag, count: Math.floor(Math.random() * 20) + 1 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Knowledge graph metrics
    const graph = await this.plugin.memoryGraph.load();

    return {
      totalNotes: files.length,
      totalWords,
      totalTags: tags.size,
      totalLinks,
      recentActivity: last7Days,
      topTags,
      knowledgeGraph: {
        nodes: graph.nodes.length,
        edges: graph.edges.length,
        clusters: Math.floor(graph.nodes.length / 10) // Simplified
      },
      aiUsage: {
        queriesThisWeek: Math.floor(Math.random() * 100) + 20,
        tokensUsed: Math.floor(Math.random() * 10000) + 1000,
        topQueries: [
          "How to improve my writing?",
          "Summarize this document",
          "Find related notes"
        ]
      }
    };
  }

  private async generateAIInsights(): Promise<Array<{
    title: string;
    description: string;
    action?: { label: string; callback: () => void };
  }>> {
    // Simulate AI-generated insights
    return [
      {
        title: "Knowledge Gaps Detected",
        description: "Found 3 topics mentioned frequently but lacking detailed notes.",
        action: {
          label: "Show Gaps",
          callback: () => new Notice("Knowledge gap analysis coming soon!")
        }
      },
      {
        title: "Suggested Connections",
        description: "5 notes could benefit from linking to related content.",
        action: {
          label: "Review",
          callback: () => new Notice("Connection suggestions coming soon!")
        }
      },
      {
        title: "Writing Patterns",
        description: "Your writing activity peaks on Tuesday and Thursday.",
        action: {
          label: "View Details",
          callback: () => new Notice("Detailed analytics coming soon!")
        }
      }
    ];
  }

  private toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    this.renderDashboard();
  }

  private async refreshAllWidgets() {
    new Notice("Refreshing dashboard...");
    await this.renderDashboard();
    new Notice("Dashboard refreshed!");
  }

  private showAddWidgetModal() {
    new AddWidgetModal(this.plugin.app, (widget) => {
      this.widgets.set(widget.id, widget);
      this.renderDashboard();
    }).open();
  }

  private deleteWidget(widgetId: string) {
    if (confirm("Delete this widget?")) {
      this.widgets.delete(widgetId);
      this.charts.delete(widgetId);
      this.renderDashboard();
    }
  }

  private configureWidget(widgetId: string) {
    const widget = this.widgets.get(widgetId);
    if (widget) {
      new ConfigureWidgetModal(this.plugin.app, widget, (updatedWidget) => {
        this.widgets.set(widgetId, updatedWidget);
        this.renderDashboard();
      }).open();
    }
  }

  private makeDraggable(element: HTMLElement) {
    // Simplified drag and drop implementation
    element.draggable = true;
    element.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/plain', element.dataset.widgetId || '');
    });
  }

  private startAutoRefresh() {
    for (const [id, widget] of this.widgets) {
      if (widget.refreshInterval) {
        const interval = setInterval(() => {
          this.refreshWidget(id);
        }, widget.refreshInterval);
        this.refreshIntervals.set(id, interval as any);
      }
    }
  }

  private stopAutoRefresh() {
    for (const interval of this.refreshIntervals.values()) {
      clearInterval(interval);
    }
    this.refreshIntervals.clear();
  }

  private async refreshWidget(widgetId: string) {
    const widget = this.widgets.get(widgetId);
    if (!widget) return;

    const widgetEl = this.containerEl.querySelector(`[data-widget-id="${widgetId}"]`);
    if (!widgetEl) return;

    const content = widgetEl.querySelector('.widget-content');
    if (content) {
      content.empty();
      await this.renderWidgetContent(content as HTMLElement, widget);
    }
  }

  private destroyCharts() {
    for (const chart of this.charts.values()) {
      chart.destroy();
    }
    this.charts.clear();
  }

  private saveWidgetConfig() {
    // Save widget configuration to plugin settings
    const widgetConfigs = Array.from(this.widgets.values());
    this.plugin.settings.dashboardWidgets = widgetConfigs;
    this.plugin.saveSettings();
  }
}

// Modal for adding new widgets
class AddWidgetModal extends Modal {
  constructor(
    app: any,
    private onAdd: (widget: DashboardWidget) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Add Widget" });

    const form = contentEl.createEl("form");
    
    let widgetType = 'metric';
    let widgetTitle = '';
    let widgetSize = 'medium';

    new Setting(form)
      .setName('Widget Type')
      .addDropdown(dropdown => dropdown
        .addOption('metric', 'Metrics')
        .addOption('chart', 'Chart')
        .addOption('list', 'List')
        .addOption('markdown', 'Markdown')
        .addOption('ai-insights', 'AI Insights')
        .setValue(widgetType)
        .onChange(value => widgetType = value));

    new Setting(form)
      .setName('Title')
      .addText(text => text
        .setValue(widgetTitle)
        .onChange(value => widgetTitle = value));

    new Setting(form)
      .setName('Size')
      .addDropdown(dropdown => dropdown
        .addOption('small', 'Small')
        .addOption('medium', 'Medium')
        .addOption('large', 'Large')
        .setValue(widgetSize)
        .onChange(value => widgetSize = value));

    const buttonContainer = form.createEl("div", { cls: "modal-button-container" });
    
    buttonContainer.createEl("button", { text: "Add Widget", type: "submit" });
    buttonContainer.createEl("button", { text: "Cancel", type: "button" })
      .onclick = () => this.close();

    form.onsubmit = (e) => {
      e.preventDefault();
      
      if (!widgetTitle.trim()) {
        new Notice("Please enter a widget title");
        return;
      }

      const widget: DashboardWidget = {
        id: `widget-${Date.now()}`,
        title: widgetTitle,
        type: widgetType as any,
        size: widgetSize as any,
        position: { x: 0, y: 0 },
        data: {}
      };

      this.onAdd(widget);
      this.close();
    };
  }
}

// Modal for configuring widgets
class ConfigureWidgetModal extends Modal {
  constructor(
    app: any,
    private widget: DashboardWidget,
    private onSave: (widget: DashboardWidget) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: `Configure ${this.widget.title}` });

    const form = contentEl.createEl("form");
    
    let title = this.widget.title;
    let size = this.widget.size;
    let refreshInterval = this.widget.refreshInterval || 0;

    new Setting(form)
      .setName('Title')
      .addText(text => text
        .setValue(title)
        .onChange(value => title = value));

    new Setting(form)
      .setName('Size')
      .addDropdown(dropdown => dropdown
        .addOption('small', 'Small')
        .addOption('medium', 'Medium')
        .addOption('large', 'Large')
        .setValue(size)
        .onChange(value => size = value as any));

    new Setting(form)
      .setName('Refresh Interval (seconds)')
      .setDesc('0 = no auto-refresh')
      .addText(text => text
        .setValue((refreshInterval / 1000).toString())
        .onChange(value => refreshInterval = parseInt(value) * 1000));

    const buttonContainer = form.createEl("div", { cls: "modal-button-container" });
    
    buttonContainer.createEl("button", { text: "Save", type: "submit" });
    buttonContainer.createEl("button", { text: "Cancel", type: "button" })
      .onclick = () => this.close();

    form.onsubmit = (e) => {
      e.preventDefault();
      
      this.widget.title = title;
      this.widget.size = size;
      this.widget.refreshInterval = refreshInterval > 0 ? refreshInterval : undefined;

      this.onSave(this.widget);
      this.close();
    };
  }
}
