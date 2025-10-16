import { TFile } from 'obsidian';
import AIMCPPlugin from '../main';

export interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export interface BatchJob {
  id: string;
  type: 'embedding' | 'indexing' | 'sync';
  data: any;
  priority: number;
  timestamp: number;
}

export class PerformanceOptimizer {
  private cache = new Map<string, CacheEntry>();
  private batchQueue: BatchJob[] = [];
  private isProcessing = false;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 1000; // 1 second

  constructor(private plugin: AIMCPPlugin) {
    this.startBatchProcessor();
    this.startCacheCleanup();
  }

  // Cache Management
  setCache(key: string, data: any, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clearCache(): void {
    this.cache.clear();
  }

  // Lazy Loading for Large Files
  async lazyLoadFile(file: TFile): Promise<string | null> {
    const cacheKey = `file_${file.path}_${file.stat.mtime}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    // Check file size before loading
    if (file.stat.size > this.plugin.projectInstructions.mcp_config.memory_graph.vault_integration.max_file_size) {
      console.warn(`File ${file.path} too large, skipping`);
      return null;
    }

    try {
      const content = await this.plugin.app.vault.read(file);
      this.setCache(cacheKey, content);
      return content;
    } catch (e) {
      console.error(`Failed to load file ${file.path}:`, e);
      return null;
    }
  }

  // Batch Processing
  addToBatch(job: Omit<BatchJob, 'id' | 'timestamp'>): string {
    const id = `${job.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const batchJob: BatchJob = {
      ...job,
      id,
      timestamp: Date.now()
    };

    this.batchQueue.push(batchJob);
    this.batchQueue.sort((a, b) => b.priority - a.priority);

    return id;
  }

  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.isProcessing || this.batchQueue.length === 0) return;

      this.isProcessing = true;
      const batch = this.batchQueue.splice(0, this.BATCH_SIZE);

      try {
        await this.processBatch(batch);
      } catch (e) {
        console.error('Batch processing failed:', e);
      } finally {
        this.isProcessing = false;
      }
    }, this.BATCH_DELAY);
  }

  private async processBatch(jobs: BatchJob[]): Promise<void> {
    const embeddingJobs = jobs.filter(job => job.type === 'embedding');
    const indexingJobs = jobs.filter(job => job.type === 'indexing');
    const syncJobs = jobs.filter(job => job.type === 'sync');

    // Process embeddings in parallel (limited concurrency)
    if (embeddingJobs.length > 0) {
      await this.processEmbeddingBatch(embeddingJobs);
    }

    // Process indexing jobs
    if (indexingJobs.length > 0) {
      await this.processIndexingBatch(indexingJobs);
    }

    // Process sync jobs
    if (syncJobs.length > 0) {
      await this.processSyncBatch(syncJobs);
    }
  }

  private async processEmbeddingBatch(jobs: BatchJob[]): Promise<void> {
    const maxConcurrent = this.plugin.projectInstructions.performance?.max_concurrent_requests || 3;
    const chunks = this.chunkArray(jobs, maxConcurrent);

    for (const chunk of chunks) {
      const promises = chunk.map(async (job) => {
        try {
          const embedding = await this.plugin.embeddings.embedQuery(job.data.text);
          
          // Cache the embedding
          const cacheKey = `embedding_${this.hashString(job.data.text)}`;
          this.setCache(cacheKey, embedding, 24 * 60 * 60 * 1000); // 24 hours

          // Store in memory graph
          await this.plugin.memoryGraph.addNode({
            type: job.data.type || 'context',
            content: job.data.text,
            sources: job.data.sources || []
          }, embedding);

          // Store in Qdrant
          await this.plugin.ragIntegrator.upsertToQdrant(
            job.id,
            embedding,
            job.data.text
          );

        } catch (e) {
          console.error(`Failed to process embedding job ${job.id}:`, e);
        }
      });

      await Promise.allSettled(promises);
    }
  }

  private async processIndexingBatch(jobs: BatchJob[]): Promise<void> {
    for (const job of jobs) {
      try {
        // Process indexing job
        await this.indexContent(job.data);
      } catch (e) {
        console.error(`Failed to process indexing job ${job.id}:`, e);
      }
    }
  }

  private async processSyncBatch(jobs: BatchJob[]): Promise<void> {
    for (const job of jobs) {
      try {
        // Process sync job
        await this.syncData(job.data);
      } catch (e) {
        console.error(`Failed to process sync job ${job.id}:`, e);
      }
    }
  }

  private async indexContent(data: any): Promise<void> {
    // Implementation for content indexing
    console.log('Indexing content:', data);
  }

  private async syncData(data: any): Promise<void> {
    // Implementation for data synchronization
    if (this.plugin.settings.enableCustomCloudSync) {
      await this.plugin.exportToCustomCloud(data.type);
    }
  }

  // Debounced File Processing
  private fileProcessingTimeouts = new Map<string, NodeJS.Timeout>();

  debounceFileProcessing(file: TFile, delay: number = 2000): void {
    const existing = this.fileProcessingTimeouts.get(file.path);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      await this.processFileChange(file);
      this.fileProcessingTimeouts.delete(file.path);
    }, delay);

    this.fileProcessingTimeouts.set(file.path, timeout);
  }

  private async processFileChange(file: TFile): Promise<void> {
    const content = await this.lazyLoadFile(file);
    if (!content) return;

    // Check if content actually changed
    const contentHash = this.hashString(content);
    const lastHash = this.plugin.lastHashes.get(file.path);
    
    if (lastHash === contentHash) return;

    // Add to batch for processing
    this.addToBatch({
      type: 'embedding',
      data: {
        text: content,
        type: 'markdown',
        sources: [{
          type: 'vault_file',
          id: file.path,
          description: file.name
        }]
      },
      priority: 1
    });

    this.plugin.lastHashes.set(file.path, contentHash);
  }

  // Memory Management
  async optimizeMemoryUsage(): Promise<void> {
    // Clear old cache entries
    this.cleanupCache();

    // Prune memory graph
    await this.pruneMemoryGraph();

    // Clean up old batch jobs
    this.cleanupBatchQueue();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private async pruneMemoryGraph(): Promise<void> {
    const graph = await this.plugin.memoryGraph.load();
    const threshold = this.plugin.projectInstructions.mcp_config.memory_graph.prune_threshold;
    
    // Remove nodes with low confidence
    graph.nodes = graph.nodes.filter(node => node.confidence >= threshold);
    
    // Remove orphaned edges
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    graph.edges = graph.edges.filter(edge => 
      nodeIds.has(edge.from) && nodeIds.has(edge.to)
    );

    await this.plugin.memoryGraph.save(graph);
  }

  private cleanupBatchQueue(): void {
    const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    this.batchQueue = this.batchQueue.filter(job => job.timestamp > cutoff);
  }

  private startCacheCleanup(): void {
    // Clean cache every 10 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 10 * 60 * 1000);
  }

  // Utility Methods
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }

  // Performance Monitoring
  private performanceMetrics = {
    embeddingRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchJobsProcessed: 0,
    averageResponseTime: 0
  };

  recordEmbeddingRequest(): void {
    this.performanceMetrics.embeddingRequests++;
  }

  recordCacheHit(): void {
    this.performanceMetrics.cacheHits++;
  }

  recordCacheMiss(): void {
    this.performanceMetrics.cacheMisses++;
  }

  recordBatchJobProcessed(): void {
    this.performanceMetrics.batchJobsProcessed++;
  }

  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  getCacheStats(): { size: number; hitRate: number } {
    const total = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    const hitRate = total > 0 ? this.performanceMetrics.cacheHits / total : 0;
    
    return {
      size: this.cache.size,
      hitRate: Math.round(hitRate * 100) / 100
    };
  }

  // Cleanup
  destroy(): void {
    // Clear all timeouts
    for (const timeout of this.fileProcessingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.fileProcessingTimeouts.clear();

    // Clear cache
    this.clearCache();

    // Clear batch queue
    this.batchQueue = [];
  }
}
