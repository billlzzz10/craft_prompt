import { TFile, Notice, Modal, Setting } from 'obsidian';
import AIMCPPlugin from '../main';
import { VoyageAIIntegration } from './voyage-ai';
import { VercelAIIntegration } from './vercel-ai';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  file?: TFile;
  score: number;
  rerankScore?: number;
  finalScore?: number;
  metadata: {
    type: 'file' | 'node' | 'external';
    source: string;
    path?: string;
    tags?: string[];
    created?: string;
    modified?: string;
    wordCount?: number;
    highlights?: string[];
  };
}

export interface SearchOptions {
  query: string;
  searchType: 'semantic' | 'keyword' | 'hybrid' | 'ai_enhanced';
  maxResults: number;
  useRerank: boolean;
  rerankThreshold: number;
  includeContent: boolean;
  fileTypes: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  tags?: string[];
  folders?: string[];
  sortBy: 'relevance' | 'date' | 'title' | 'size';
  sortOrder: 'asc' | 'desc';
}

export interface SearchFilter {
  id: string;
  name: string;
  type: 'tag' | 'folder' | 'date' | 'size' | 'type';
  value: any;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  options: SearchOptions;
  filters: SearchFilter[];
  created: string;
  lastUsed: string;
  useCount: number;
}

export class EnhancedSearchEngine {
  private searchHistory: Array<{query: string; timestamp: string; resultCount: number}> = [];
  private savedSearches: Map<string, SavedSearch> = new Map();
  private searchCache: Map<string, {results: SearchResult[]; timestamp: number}> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(
    private plugin: AIMCPPlugin,
    private voyageAI: VoyageAIIntegration,
    private vercelAI: VercelAIIntegration
  ) {
    this.loadSavedSearches();
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const cacheKey = this.generateCacheKey(options);
    const cached = this.searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.results;
    }

    try {
      let results: SearchResult[] = [];

      switch (options.searchType) {
        case 'semantic':
          results = await this.semanticSearch(options);
          break;
        case 'keyword':
          results = await this.keywordSearch(options);
          break;
        case 'hybrid':
          results = await this.hybridSearch(options);
          break;
        case 'ai_enhanced':
          results = await this.aiEnhancedSearch(options);
          break;
        default:
          results = await this.hybridSearch(options);
      }

      // Apply reranking if enabled
      if (options.useRerank && this.voyageAI.isReady()) {
        results = await this.rerankResults(options.query, results, options);
      }

      // Apply filters and sorting
      results = this.applyFilters(results, options);
      results = this.sortResults(results, options);

      // Limit results
      results = results.slice(0, options.maxResults);

      // Cache results
      this.searchCache.set(cacheKey, {
        results,
        timestamp: Date.now()
      });

      // Update search history
      this.addToHistory(options.query, results.length);

      return results;
    } catch (error) {
      console.error('Enhanced search failed:', error);
      throw error;
    }
  }

  private async semanticSearch(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.plugin.embeddings) {
      throw new Error('Embeddings not available for semantic search');
    }

    const queryEmbedding = await this.plugin.embeddings.embedQuery(options.query);
    const ragResults = await this.plugin.ragIntegrator.searchSimilar(queryEmbedding, options.maxResults * 2);

    return ragResults.map((result, index) => ({
      id: `semantic_${index}`,
      title: this.extractTitle(result.text),
      content: result.text,
      score: result.score,
      metadata: {
        type: 'node' as const,
        source: 'rag',
        highlights: this.extractHighlights(result.text, options.query)
      }
    }));
  }

  private async keywordSearch(options: SearchOptions): Promise<SearchResult[]> {
    const files = this.plugin.app.vault.getMarkdownFiles();
    const results: SearchResult[] = [];
    const queryWords = options.query.toLowerCase().split(/\s+/);

    for (const file of files) {
      try {
        const content = await this.plugin.app.vault.read(file);
        const contentLower = content.toLowerCase();
        
        let score = 0;
        const highlights: string[] = [];

        // Calculate keyword match score
        for (const word of queryWords) {
          const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
          score += matches;
          
          if (matches > 0) {
            highlights.push(...this.findWordContext(content, word));
          }
        }

        if (score > 0) {
          results.push({
            id: `keyword_${file.path}`,
            title: file.basename,
            content: options.includeContent ? content : this.extractSummary(content),
            file,
            score: score / queryWords.length,
            metadata: {
              type: 'file',
              source: 'vault',
              path: file.path,
              created: new Date(file.stat.ctime).toISOString(),
              modified: new Date(file.stat.mtime).toISOString(),
              wordCount: content.split(/\s+/).length,
              highlights: highlights.slice(0, 3)
            }
          });
        }
      } catch (error) {
        console.error(`Failed to search file ${file.path}:`, error);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(options).catch(() => [] as SearchResult[]),
      this.keywordSearch(options)
    ]);

    // Combine and deduplicate results
    const combinedResults = new Map<string, SearchResult>();

    // Add semantic results
    semanticResults.forEach((result: SearchResult) => {
      combinedResults.set(result.id, {
        ...result,
        finalScore: result.score * 0.7 // Weight semantic results
      });
    });

    // Add keyword results, combining scores if duplicate
    keywordResults.forEach((result: SearchResult) => {
      const existing = combinedResults.get(result.id);
      if (existing) {
        existing.finalScore = (existing.finalScore || existing.score) + (result.score * 0.3);
        existing.metadata.highlights = [
          ...(existing.metadata.highlights || []),
          ...(result.metadata.highlights || [])
        ].slice(0, 5);
      } else {
        combinedResults.set(result.id, {
          ...result,
          finalScore: result.score * 0.3 // Weight keyword results
        });
      }
    });

    return Array.from(combinedResults.values())
      .sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));
  }

  private async aiEnhancedSearch(options: SearchOptions): Promise<SearchResult[]> {
    if (!this.vercelAI.isReady()) {
      return await this.hybridSearch(options);
    }

    try {
      // Use AI to expand and improve the query
      const provider = this.vercelAI.getProvider();
      const expandedQueries = await provider.generateQuestions(
        `Search query: ${options.query}`,
        3
      );

      // Perform searches with expanded queries
      const allResults: SearchResult[] = [];
      
      for (const query of [options.query, ...expandedQueries]) {
        const queryOptions = { ...options, query };
        const results = await this.hybridSearch(queryOptions);
        allResults.push(...results);
      }

      // Deduplicate and score
      const uniqueResults = this.deduplicateResults(allResults);
      
      // Use AI to analyze and score results
      const analyzedResults = await this.analyzeResultsWithAI(options.query, uniqueResults);
      
      return analyzedResults;
    } catch (error) {
      console.error('AI enhanced search failed, falling back to hybrid:', error);
      return await this.hybridSearch(options);
    }
  }

  private async rerankResults(
    query: string,
    results: SearchResult[],
    options: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.voyageAI.isReady() || results.length === 0) {
      return results;
    }

    try {
      const documents = results.map(r => r.content);
      const rerankResponse = await this.voyageAI.rerankOnly(query, documents, options.maxResults);
      
      if (!rerankResponse) return results;

      const rerankedResults = rerankResponse.data
        .filter(item => item.relevance_score >= options.rerankThreshold)
        .map(item => {
          const originalResult = results[item.index];
          return {
            ...originalResult,
            rerankScore: item.relevance_score,
            finalScore: (originalResult.score * 0.3) + (item.relevance_score * 0.7)
          };
        });

      return rerankedResults.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));
    } catch (error) {
      console.error('Reranking failed:', error);
      return results;
    }
  }

  private async analyzeResultsWithAI(query: string, results: SearchResult[]): Promise<SearchResult[]> {
    if (!this.vercelAI.isReady() || results.length === 0) {
      return results;
    }

    try {
      const provider = this.vercelAI.getProvider();
      
      // Analyze each result for relevance
      const analyzedResults = await Promise.all(
        results.map(async (result) => {
          try {
            const analysis = await provider.generateText([
              {
                role: 'system',
                content: 'You are a search relevance analyzer. Rate the relevance of the given content to the search query on a scale of 0-1.'
              },
              {
                role: 'user',
                content: `Query: "${query}"\n\nContent: "${result.content.substring(0, 500)}"\n\nRelevance score (0-1):`
              }
            ], { maxTokens: 10 });

            const aiScore = parseFloat(analysis.trim()) || result.score;
            
            return {
              ...result,
              finalScore: (result.score * 0.5) + (aiScore * 0.5)
            };
          } catch (error) {
            console.error('AI analysis failed for result:', error);
            return result;
          }
        })
      );

      return analyzedResults.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));
    } catch (error) {
      console.error('AI result analysis failed:', error);
      return results;
    }
  }

  private applyFilters(results: SearchResult[], options: SearchOptions): SearchResult[] {
    let filtered = results;

    // File type filter
    if (options.fileTypes.length > 0) {
      filtered = filtered.filter(result => {
        if (!result.file) return true;
        return options.fileTypes.includes(result.file.extension);
      });
    }

    // Date range filter
    if (options.dateRange) {
      filtered = filtered.filter(result => {
        if (!result.metadata.modified) return true;
        const modifiedDate = new Date(result.metadata.modified);
        return modifiedDate >= options.dateRange!.from && modifiedDate <= options.dateRange!.to;
      });
    }

    // Tags filter
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(result => {
        if (!result.metadata.tags) return false;
        return options.tags!.some(tag => result.metadata.tags!.includes(tag));
      });
    }

    // Folders filter
    if (options.folders && options.folders.length > 0) {
      filtered = filtered.filter(result => {
        if (!result.metadata.path) return false;
        return options.folders!.some(folder => result.metadata.path!.startsWith(folder));
      });
    }

    return filtered;
  }

  private sortResults(results: SearchResult[], options: SearchOptions): SearchResult[] {
    const sorted = [...results];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (options.sortBy) {
        case 'relevance':
          comparison = (b.finalScore || b.score) - (a.finalScore || a.score);
          break;
        case 'date':
          const aDate = new Date(a.metadata.modified || 0).getTime();
          const bDate = new Date(b.metadata.modified || 0).getTime();
          comparison = bDate - aDate;
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'size':
          comparison = (b.metadata.wordCount || 0) - (a.metadata.wordCount || 0);
          break;
      }

      return options.sortOrder === 'desc' ? comparison : -comparison;
    });

    return sorted;
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const key = result.file?.path || result.title;
      const existing = seen.get(key);

      if (!existing || (result.finalScore || result.score) > (existing.finalScore || existing.score)) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values());
  }

  // Utility methods
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    const firstHeading = lines.find(line => line.startsWith('#'));
    if (firstHeading) {
      return firstHeading.replace(/^#+\s*/, '');
    }
    return content.substring(0, 50).trim() + '...';
  }

  private extractSummary(content: string, maxLength = 200): string {
    const cleaned = content.replace(/#+\s*/g, '').replace(/\n+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }

  private extractHighlights(content: string, query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);
    const highlights: string[] = [];
    
    for (const word of words) {
      const contexts = this.findWordContext(content, word);
      highlights.push(...contexts);
    }
    
    return highlights.slice(0, 3);
  }

  private findWordContext(content: string, word: string, contextLength = 50): string[] {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null && matches.length < 2) {
      const start = Math.max(0, match.index - contextLength);
      const end = Math.min(content.length, match.index + word.length + contextLength);
      const context = content.substring(start, end);
      matches.push(context.trim());
    }

    return matches;
  }

  private generateCacheKey(options: SearchOptions): string {
    return JSON.stringify({
      query: options.query,
      searchType: options.searchType,
      useRerank: options.useRerank,
      fileTypes: options.fileTypes,
      tags: options.tags,
      folders: options.folders
    });
  }

  private addToHistory(query: string, resultCount: number): void {
    this.searchHistory.unshift({
      query,
      timestamp: new Date().toISOString(),
      resultCount
    });

    // Keep only last 100 searches
    this.searchHistory = this.searchHistory.slice(0, 100);
    this.saveSearchHistory();
  }

  // Saved searches management
  saveSearch(name: string, query: string, options: SearchOptions, filters: SearchFilter[] = []): void {
    const savedSearch: SavedSearch = {
      id: `search_${Date.now()}`,
      name,
      query,
      options,
      filters,
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      useCount: 0
    };

    this.savedSearches.set(savedSearch.id, savedSearch);
    this.saveSavedSearches();
  }

  getSavedSearches(): SavedSearch[] {
    return Array.from(this.savedSearches.values())
      .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime());
  }

  async executeSavedSearch(searchId: string): Promise<SearchResult[]> {
    const savedSearch = this.savedSearches.get(searchId);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    savedSearch.lastUsed = new Date().toISOString();
    savedSearch.useCount++;
    this.saveSavedSearches();

    return await this.search(savedSearch.options);
  }

  deleteSavedSearch(searchId: string): void {
    this.savedSearches.delete(searchId);
    this.saveSavedSearches();
  }

  getSearchHistory(): Array<{query: string; timestamp: string; resultCount: number}> {
    return this.searchHistory;
  }

  clearSearchHistory(): void {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  // Persistence methods
  private loadSavedSearches(): void {
    const saved = this.plugin.settings.savedSearches || [];
    saved.forEach((search: SavedSearch) => {
      this.savedSearches.set(search.id, search);
    });
  }

  private saveSavedSearches(): void {
    this.plugin.settings.savedSearches = Array.from(this.savedSearches.values());
    this.plugin.saveSettings();
  }

  private saveSearchHistory(): void {
    this.plugin.settings.searchHistory = this.searchHistory;
    this.plugin.saveSettings();
  }

  // Analytics
  getSearchAnalytics(): {
    totalSearches: number;
    topQueries: Array<{query: string; count: number}>;
    averageResults: number;
    searchTypes: Record<string, number>;
  } {
    const queryCount = new Map<string, number>();
    let totalResults = 0;

    this.searchHistory.forEach(search => {
      queryCount.set(search.query, (queryCount.get(search.query) || 0) + 1);
      totalResults += search.resultCount;
    });

    const topQueries = Array.from(queryCount.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSearches: this.searchHistory.length,
      topQueries,
      averageResults: this.searchHistory.length > 0 ? totalResults / this.searchHistory.length : 0,
      searchTypes: {
        semantic: 0,
        keyword: 0,
        hybrid: 0,
        ai_enhanced: 0
      }
    };
  }

  clearCache(): void {
    this.searchCache.clear();
  }

  destroy(): void {
    this.clearCache();
  }
}
