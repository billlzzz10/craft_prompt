import { TFile, Notice, Modal, Setting } from 'obsidian';
import AIMCPPlugin from '../main';

export interface SmartSuggestion {
  id: string;
  type: 'task' | 'note' | 'connection' | 'research';
  title: string;
  description: string;
  confidence: number;
  action: () => Promise<void>;
  metadata: Record<string, any>;
}

export interface ContextualInsight {
  type: 'pattern' | 'gap' | 'opportunity' | 'trend';
  title: string;
  description: string;
  relevance: number;
  sources: string[];
  suggestions: string[];
}

export class AdvancedFeatures {
  constructor(private plugin: AIMCPPlugin) {}

  // Smart Suggestions System
  async generateSmartSuggestions(context?: string): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    const graph = await this.plugin.memoryGraph.load();
    const activeFile = this.plugin.app.workspace.getActiveFile();

    // Task-based suggestions
    const taskSuggestions = await this.generateTaskSuggestions(graph, activeFile);
    suggestions.push(...taskSuggestions);

    // Note connection suggestions
    const connectionSuggestions = await this.generateConnectionSuggestions(graph, activeFile);
    suggestions.push(...connectionSuggestions);

    // Research suggestions
    const researchSuggestions = await this.generateResearchSuggestions(context);
    suggestions.push(...researchSuggestions);

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  }

  private async generateTaskSuggestions(graph: any, activeFile: TFile | null): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    const taskNodes = graph.nodes.filter((n: any) => n.type === 'task');

    // Suggest completing overdue tasks
    const overdueTasks = taskNodes.filter((task: any) => {
      const dueDate = task.attributes?.due_date;
      return dueDate && new Date(dueDate) < new Date();
    });

    for (const task of overdueTasks.slice(0, 3)) {
      suggestions.push({
        id: `overdue_${task.id}`,
        type: 'task',
        title: `Complete overdue task: ${task.summary}`,
        description: `This task was due on ${task.attributes.due_date}`,
        confidence: 0.9,
        action: async () => {
          await this.createTaskNote(task);
        },
        metadata: { taskId: task.id, type: 'overdue' }
      });
    }

    // Suggest next logical tasks based on dependencies
    const nextTasks = this.findNextLogicalTasks(graph, taskNodes);
    for (const task of nextTasks.slice(0, 2)) {
      suggestions.push({
        id: `next_${task.id}`,
        type: 'task',
        title: `Ready to start: ${task.summary}`,
        description: 'All dependencies completed',
        confidence: 0.8,
        action: async () => {
          await this.createTaskNote(task);
        },
        metadata: { taskId: task.id, type: 'ready' }
      });
    }

    return suggestions;
  }

  private async generateConnectionSuggestions(graph: any, activeFile: TFile | null): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    
    if (!activeFile || !this.plugin.embeddings) return suggestions;

    try {
      const content = await this.plugin.app.vault.read(activeFile);
      const embedding = await this.plugin.embeddings.embedQuery(content.substring(0, 500));
      const similarNodes = await this.findSimilarNodes(graph, embedding);

      for (const node of similarNodes.slice(0, 3)) {
        if (node.sources?.[0]?.id !== activeFile.path) {
          suggestions.push({
            id: `connect_${node.id}`,
            type: 'connection',
            title: `Connect to: ${node.summary}`,
            description: `Similar content found (${(node.similarity * 100).toFixed(1)}% match)`,
            confidence: node.similarity,
            action: async () => {
              await this.createConnection(activeFile, node);
            },
            metadata: { nodeId: node.id, similarity: node.similarity }
          });
        }
      }
    } catch (e) {
      console.error('Failed to generate connection suggestions:', e);
    }

    return suggestions;
  }

  private async generateResearchSuggestions(context?: string): Promise<SmartSuggestion[]> {
    const suggestions: SmartSuggestion[] = [];
    const graph = await this.plugin.memoryGraph.load();

    // Find knowledge gaps
    const gaps = this.identifyKnowledgeGaps(graph);
    for (const gap of gaps.slice(0, 2)) {
      suggestions.push({
        id: `research_${gap.topic}`,
        type: 'research',
        title: `Research: ${gap.topic}`,
        description: `Found ${gap.mentions} mentions but limited depth`,
        confidence: 0.7,
        action: async () => {
          await this.createResearchNote(gap.topic);
        },
        metadata: { topic: gap.topic, mentions: gap.mentions }
      });
    }

    return suggestions;
  }

  // Contextual Insights
  async generateContextualInsights(activeFile?: TFile): Promise<ContextualInsight[]> {
    const insights: ContextualInsight[] = [];
    const graph = await this.plugin.memoryGraph.load();

    // Pattern detection
    const patterns = this.detectPatterns(graph);
    insights.push(...patterns);

    // Knowledge gaps
    const gaps = this.identifyKnowledgeGaps(graph);
    insights.push(...gaps.map(gap => ({
      type: 'gap' as const,
      title: `Knowledge Gap: ${gap.topic}`,
      description: `Topic mentioned ${gap.mentions} times but lacks detailed information`,
      relevance: gap.mentions / 10,
      sources: gap.sources,
      suggestions: [
        `Research ${gap.topic} in depth`,
        `Create a comprehensive note about ${gap.topic}`,
        `Connect existing mentions of ${gap.topic}`
      ]
    })));

    // Trending topics
    const trends = this.identifyTrends(graph);
    insights.push(...trends);

    return insights.sort((a, b) => b.relevance - a.relevance);
  }

  private detectPatterns(graph: any): ContextualInsight[] {
    const patterns: ContextualInsight[] = [];
    
    // Detect recurring themes
    const themes = this.extractThemes(graph);
    for (const theme of themes.slice(0, 3)) {
      patterns.push({
        type: 'pattern',
        title: `Recurring Theme: ${theme.name}`,
        description: `Appears in ${theme.frequency} nodes across different contexts`,
        relevance: theme.frequency / graph.nodes.length,
        sources: theme.sources,
        suggestions: [
          `Create a master note for ${theme.name}`,
          `Tag related content with #${theme.name.toLowerCase()}`,
          `Explore connections between ${theme.name} instances`
        ]
      });
    }

    return patterns;
  }

  private identifyTrends(graph: any): ContextualInsight[] {
    const trends: ContextualInsight[] = [];
    const recentNodes = graph.nodes.filter((n: any) => {
      const created = new Date(n.timestamp.created_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return created > weekAgo;
    });

    if (recentNodes.length > 0) {
      const topicCounts = this.countTopics(recentNodes);
      const trendingTopics = Object.entries(topicCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3);

      for (const [topic, count] of trendingTopics) {
        trends.push({
          type: 'trend',
          title: `Trending: ${topic}`,
          description: `${count} mentions in the past week`,
          relevance: (count as number) / recentNodes.length,
          sources: recentNodes
            .filter((n: any) => n.content.toLowerCase().includes(topic.toLowerCase()))
            .map((n: any) => n.sources?.[0]?.id || 'Unknown')
            .slice(0, 5),
          suggestions: [
            `Consolidate recent work on ${topic}`,
            `Plan next steps for ${topic}`,
            `Review progress on ${topic}-related goals`
          ]
        });
      }
    }

    return trends;
  }

  // Auto-tagging System
  async autoTagContent(file: TFile, content: string): Promise<string[]> {
    if (!this.plugin.embeddings) return [];

    try {
      const embedding = await this.plugin.embeddings.embedQuery(content);
      const graph = await this.plugin.memoryGraph.load();
      const similarNodes = await this.findSimilarNodes(graph, embedding);
      
      const tags = new Set<string>();
      
      // Extract tags from similar content
      for (const node of similarNodes.slice(0, 5)) {
        if (node.similarity > 0.7) {
          const nodeTags = this.extractTagsFromContent(node.content);
          nodeTags.forEach(tag => tags.add(tag));
        }
      }

      // Generate semantic tags
      const semanticTags = await this.generateSemanticTags(content);
      semanticTags.forEach(tag => tags.add(tag));

      return Array.from(tags).slice(0, 10);
    } catch (e) {
      console.error('Auto-tagging failed:', e);
      return [];
    }
  }

  private async generateSemanticTags(content: string): Promise<string[]> {
    // Simple keyword extraction (in a real implementation, you might use NLP)
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(wordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  // Smart Search
  async smartSearch(query: string, options: {
    includeContext?: boolean;
    searchType?: 'semantic' | 'keyword' | 'hybrid';
    maxResults?: number;
  } = {}): Promise<any[]> {
    const { includeContext = true, searchType = 'hybrid', maxResults = 10 } = options;
    
    if (!this.plugin.embeddings) return [];

    try {
      const queryEmbedding = await this.plugin.embeddings.embedQuery(query);
      let results: any[] = [];

      if (searchType === 'semantic' || searchType === 'hybrid') {
        const semanticResults = await this.plugin.ragIntegrator.searchSimilar(queryEmbedding, maxResults);
        results.push(...semanticResults.map(r => ({ ...r, type: 'semantic' })));
      }

      if (searchType === 'keyword' || searchType === 'hybrid') {
        const keywordResults = await this.keywordSearch(query, maxResults);
        results.push(...keywordResults.map(r => ({ ...r, type: 'keyword' })));
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.deduplicateResults(results);
      const sortedResults = uniqueResults.sort((a, b) => (b.score || 0) - (a.score || 0));

      if (includeContext) {
        return await this.enrichResultsWithContext(sortedResults.slice(0, maxResults));
      }

      return sortedResults.slice(0, maxResults);
    } catch (e) {
      console.error('Smart search failed:', e);
      return [];
    }
  }

  private async keywordSearch(query: string, maxResults: number): Promise<any[]> {
    const graph = await this.plugin.memoryGraph.load();
    const queryWords = query.toLowerCase().split(/\s+/);
    
    const results = graph.nodes
      .map((node: any) => {
        const content = node.content.toLowerCase();
        const matches = queryWords.filter(word => content.includes(word));
        const score = matches.length / queryWords.length;
        return { ...node, score, matches };
      })
      .filter((node: any) => node.score > 0)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, maxResults);

    return results;
  }

  // Utility Methods
  private findNextLogicalTasks(graph: any, taskNodes: any[]): any[] {
    const completedTasks = new Set(
      taskNodes
        .filter(task => task.attributes?.status === 'completed')
        .map(task => task.id)
    );

    return taskNodes.filter(task => {
      if (task.attributes?.status === 'completed') return false;
      
      const dependencies = graph.edges
        .filter((edge: any) => edge.to === task.id && edge.type === 'temporal')
        .map((edge: any) => edge.from);
      
      return dependencies.every((dep: string) => completedTasks.has(dep));
    });
  }

  private async findSimilarNodes(graph: any, embedding: number[]): Promise<any[]> {
    return graph.nodes
      .map((node: any) => ({
        ...node,
        similarity: this.cosineSimilarity(embedding, node.embeddings || [])
      }))
      .filter((node: any) => node.similarity > 0.5)
      .sort((a: any, b: any) => b.similarity - a.similarity);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private extractThemes(graph: any): Array<{name: string; frequency: number; sources: string[]}> {
    const themes = new Map<string, {frequency: number; sources: string[]}>();
    
    for (const node of graph.nodes) {
      const words = node.content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 4);
      
      for (const word of words) {
        if (!themes.has(word)) {
          themes.set(word, { frequency: 0, sources: [] });
        }
        const theme = themes.get(word)!;
        theme.frequency++;
        if (node.sources?.[0]?.id && !theme.sources.includes(node.sources[0].id)) {
          theme.sources.push(node.sources[0].id);
        }
      }
    }
    
    return Array.from(themes.entries())
      .map(([name, data]) => ({ name, ...data }))
      .filter(theme => theme.frequency > 2)
      .sort((a, b) => b.frequency - a.frequency);
  }

  private identifyKnowledgeGaps(graph: any): Array<{topic: string; mentions: number; sources: string[]}> {
    const topics = new Map<string, {mentions: number; sources: string[]}>();
    
    for (const node of graph.nodes) {
      const content = node.content.toLowerCase();
      const sentences = content.split(/[.!?]+/);
      
      for (const sentence of sentences) {
        if (sentence.includes('need to learn') || 
            sentence.includes('don\'t understand') || 
            sentence.includes('research') ||
            sentence.includes('find out')) {
          
          const words = sentence.split(/\s+/).filter(word => word.length > 4);
          for (const word of words) {
            if (!topics.has(word)) {
              topics.set(word, { mentions: 0, sources: [] });
            }
            const topic = topics.get(word)!;
            topic.mentions++;
            if (node.sources?.[0]?.id && !topic.sources.includes(node.sources[0].id)) {
              topic.sources.push(node.sources[0].id);
            }
          }
        }
      }
    }
    
    return Array.from(topics.entries())
      .map(([topic, data]) => ({ topic, ...data }))
      .filter(gap => gap.mentions >= 2)
      .sort((a, b) => b.mentions - a.mentions);
  }

  private countTopics(nodes: any[]): Record<string, number> {
    const topics: Record<string, number> = {};
    
    for (const node of nodes) {
      const words = node.content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((word: string) => word.length > 4);
      
      for (const word of words) {
        topics[word] = (topics[word] || 0) + 1;
      }
    }
    
    return topics;
  }

  private extractTagsFromContent(content: string): string[] {
    const tagRegex = /#(\w+)/g;
    const matches = content.match(tagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.id || result.text || JSON.stringify(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async enrichResultsWithContext(results: any[]): Promise<any[]> {
    const graph = await this.plugin.memoryGraph.load();
    
    return results.map(result => {
      const relatedNodes = graph.nodes.filter((node: any) => 
        node.id !== result.id && 
        this.cosineSimilarity(result.embeddings || [], node.embeddings || []) > 0.7
      ).slice(0, 3);
      
      return {
        ...result,
        context: {
          related: relatedNodes.map((node: any) => ({
            id: node.id,
            summary: node.summary,
            type: node.type
          }))
        }
      };
    });
  }

  // Action Methods
  private async createTaskNote(task: any): Promise<void> {
    const fileName = `Task - ${task.summary.replace(/[^\w\s]/g, '')}.md`;
    const content = `# ${task.summary}

## Details
${task.content}

## Status
- [ ] ${task.summary}

## Due Date
${task.attributes?.due_date || 'Not set'}

## Priority
${task.attributes?.priority || 'Normal'}

## Notes
<!-- Add your notes here -->

---
*Created from AI suggestion on ${new Date().toLocaleDateString()}*
`;

    await this.plugin.app.vault.create(fileName, content);
    new Notice(`Created task note: ${fileName}`);
  }

  private async createConnection(file: TFile, node: any): Promise<void> {
    const content = await this.plugin.app.vault.read(file);
    const sourceFile = node.sources?.[0]?.id;
    
    if (sourceFile) {
      const linkText = `\n\n## Related\n- [[${sourceFile}]] - Similar content (AI suggested)\n`;
      await this.plugin.app.vault.modify(file, content + linkText);
      new Notice(`Added connection to ${sourceFile}`);
    }
  }

  private async createResearchNote(topic: string): Promise<void> {
    const fileName = `Research - ${topic}.md`;
    const content = `# Research: ${topic}

## Overview
<!-- What do you want to learn about ${topic}? -->

## Current Knowledge
<!-- What do you already know? -->

## Questions to Explore
- 
- 
- 

## Sources
<!-- Add your research sources here -->

## Notes
<!-- Your research notes -->

---
*Research topic suggested by AI on ${new Date().toLocaleDateString()}*
`;

    await this.plugin.app.vault.create(fileName, content);
    new Notice(`Created research note: ${fileName}`);
  }
}

// Smart Suggestions Modal
export class SmartSuggestionsModal extends Modal {
  constructor(
    private plugin: AIMCPPlugin,
    private suggestions: SmartSuggestion[]
  ) {
    super(plugin.app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Smart Suggestions" });

    if (this.suggestions.length === 0) {
      contentEl.createEl("p", { text: "No suggestions available at the moment." });
      return;
    }

    const suggestionsList = contentEl.createEl("div", { cls: "suggestions-list" });

    for (const suggestion of this.suggestions) {
      const item = suggestionsList.createEl("div", { cls: "suggestion-item" });
      
      item.createEl("div", { cls: "suggestion-header" }, (header) => {
        header.createEl("h3", { text: suggestion.title });
        header.createEl("span", { 
          cls: "suggestion-confidence",
          text: `${Math.round(suggestion.confidence * 100)}%`
        });
      });

      item.createEl("p", { 
        cls: "suggestion-description",
        text: suggestion.description 
      });

      item.createEl("button", { 
        text: "Apply",
        cls: "mod-cta"
      }).onclick = async () => {
        await suggestion.action();
        this.close();
      };
    }
  }
}
