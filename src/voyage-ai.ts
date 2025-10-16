import { Notice } from 'obsidian';
import AIMCPPlugin from '../main';

// Note: Using direct fetch API instead of voyageai package for compatibility

export interface VoyageAIConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface RerankRequest {
  query: string;
  documents: string[];
  model?: string;
  top_k?: number;
  return_documents?: boolean;
}

export interface RerankResult {
  index: number;
  relevance_score: number;
  document?: string;
}

export interface RerankResponse {
  object: string;
  data: RerankResult[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
  input_type?: 'query' | 'document';
  truncation?: boolean;
}

export interface EmbeddingResult {
  object: string;
  embedding: number[];
  index: number;
}

export interface EmbeddingResponse {
  object: string;
  data: EmbeddingResult[];
  model: string;
  usage: {
    total_tokens: number;
  };
}

export class VoyageAIProvider {
  private config: VoyageAIConfig;
  private baseUrl: string;

  constructor(private plugin: AIMCPPlugin, config: VoyageAIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.voyageai.com/v1';
  }

  async rerank(request: RerankRequest): Promise<RerankResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/rerank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'rerank-lite-1',
          query: request.query,
          documents: request.documents,
          top_k: request.top_k || 10,
          return_documents: request.return_documents !== false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage AI rerank failed: ${response.status} ${errorText}`);
      }

      const result = await response.json() as RerankResponse;
      return result;
    } catch (error) {
      console.error('Voyage AI rerank error:', error);
      throw error;
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'voyage-large-2',
          input: request.input,
          input_type: request.input_type || 'document',
          truncation: request.truncation !== false
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voyage AI embedding failed: ${response.status} ${errorText}`);
      }

      const result = await response.json() as EmbeddingResponse;
      return result;
    } catch (error) {
      console.error('Voyage AI embedding error:', error);
      throw error;
    }
  }

  async rerankSearchResults(
    query: string, 
    searchResults: Array<{text: string, score: number, metadata?: any}>,
    options: {
      topK?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{text: string, score: number, rerankScore: number, metadata?: any}>> {
    const { topK = 10, threshold = 0.0 } = options;
    
    if (searchResults.length === 0) return [];

    try {
      const documents = searchResults.map(result => result.text);
      const rerankResponse = await this.rerank({
        query,
        documents,
        top_k: Math.min(topK, documents.length),
        return_documents: true
      });

      const rerankedResults = rerankResponse.data
        .filter(result => result.relevance_score >= threshold)
        .map(result => ({
          text: result.document || searchResults[result.index].text,
          score: searchResults[result.index].score,
          rerankScore: result.relevance_score,
          metadata: {
            ...searchResults[result.index].metadata,
            originalIndex: result.index,
            rerankModel: rerankResponse.model
          }
        }));

      return rerankedResults;
    } catch (error) {
      console.error('Rerank search results failed:', error);
      // Fallback to original results if rerank fails
      return searchResults.slice(0, topK).map(result => ({
        ...result,
        rerankScore: result.score
      }));
    }
  }

  async batchEmbed(
    texts: string[], 
    options: {
      inputType?: 'query' | 'document';
      batchSize?: number;
    } = {}
  ): Promise<number[][]> {
    const { inputType = 'document', batchSize = 100 } = options;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      try {
        const response = await this.embed({
          input: batch,
          input_type: inputType
        });

        const batchEmbeddings = response.data
          .sort((a, b) => a.index - b.index)
          .map(result => result.embedding);
        
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        console.error(`Batch embedding failed for batch ${i / batchSize + 1}:`, error);
        // Add zero vectors for failed batch
        const zeroVector = new Array(1024).fill(0); // Assuming 1024 dimensions
        for (let j = 0; j < batch.length; j++) {
          embeddings.push(zeroVector);
        }
      }
    }

    return embeddings;
  }

  async getModelInfo(): Promise<{
    embedding_models: string[];
    rerank_models: string[];
    default_embedding: string;
    default_rerank: string;
  }> {
    // Static model info since Voyage AI doesn't have a models endpoint
    return {
      embedding_models: [
        'voyage-large-2',
        'voyage-code-2',
        'voyage-2',
        'voyage-lite-02-instruct'
      ],
      rerank_models: [
        'rerank-lite-1',
        'rerank-1'
      ],
      default_embedding: 'voyage-large-2',
      default_rerank: 'rerank-lite-1'
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const testResponse = await this.embed({
        input: 'test connection',
        input_type: 'query'
      });
      return testResponse.data.length > 0;
    } catch (error) {
      console.error('Voyage AI connection test failed:', error);
      return false;
    }
  }

  // Utility methods for search enhancement
  async enhanceSearch(
    query: string,
    initialResults: Array<{text: string, score: number, metadata?: any}>,
    options: {
      rerankTopK?: number;
      rerankThreshold?: number;
      useSemanticBoost?: boolean;
    } = {}
  ): Promise<Array<{text: string, score: number, rerankScore: number, finalScore: number, metadata?: any}>> {
    const { 
      rerankTopK = 20, 
      rerankThreshold = 0.1,
      useSemanticBoost = true 
    } = options;

    // Step 1: Rerank the initial results
    const rerankedResults = await this.rerankSearchResults(
      query, 
      initialResults.slice(0, rerankTopK * 2), // Take more for reranking
      { topK: rerankTopK, threshold: rerankThreshold }
    );

    // Step 2: Calculate final scores combining original and rerank scores
    const enhancedResults = rerankedResults.map(result => {
      let finalScore = result.rerankScore;
      
      if (useSemanticBoost) {
        // Combine original semantic score with rerank score
        finalScore = (result.score * 0.3) + (result.rerankScore * 0.7);
      }

      return {
        ...result,
        finalScore
      };
    });

    // Step 3: Sort by final score
    enhancedResults.sort((a, b) => b.finalScore - a.finalScore);

    return enhancedResults;
  }

  async generateQueryVariations(query: string): Promise<string[]> {
    // Simple query expansion - in a real implementation, you might use an LLM
    const variations = [query];
    
    // Add some basic variations
    const words = query.toLowerCase().split(/\s+/);
    
    // Synonym-like variations (simplified)
    const synonymMap: Record<string, string[]> = {
      'find': ['search', 'locate', 'discover'],
      'how': ['what', 'which way'],
      'create': ['make', 'build', 'generate'],
      'delete': ['remove', 'eliminate'],
      'update': ['modify', 'change', 'edit']
    };

    for (const [word, synonyms] of Object.entries(synonymMap)) {
      if (words.includes(word)) {
        for (const synonym of synonyms) {
          const variation = query.replace(new RegExp(`\\b${word}\\b`, 'gi'), synonym);
          if (variation !== query) {
            variations.push(variation);
          }
        }
      }
    }

    return variations.slice(0, 5); // Limit to 5 variations
  }
}

// Voyage AI Integration Manager
export class VoyageAIIntegration {
  private provider: VoyageAIProvider | null = null;
  private isEnabled = false;

  constructor(private plugin: AIMCPPlugin) {}

  async initialize(config: VoyageAIConfig): Promise<boolean> {
    try {
      this.provider = new VoyageAIProvider(this.plugin, config);
      const isConnected = await this.provider.testConnection();
      
      if (isConnected) {
        this.isEnabled = true;
        new Notice('Voyage AI connected successfully');
        return true;
      } else {
        throw new Error('Connection test failed');
      }
    } catch (error) {
      console.error('Voyage AI initialization failed:', error);
      new Notice(`Voyage AI initialization failed: ${(error as Error).message}`);
      this.isEnabled = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.isEnabled && this.provider !== null;
  }

  getProvider(): VoyageAIProvider | null {
    return this.provider;
  }

  async enhancedSearch(
    query: string,
    initialResults: Array<{text: string, score: number, metadata?: any}>
  ): Promise<Array<{text: string, score: number, rerankScore: number, finalScore: number, metadata?: any}>> {
    if (!this.isReady() || !this.provider) {
      // Return original results if Voyage AI is not available
      return initialResults.map(result => ({
        ...result,
        rerankScore: result.score,
        finalScore: result.score
      }));
    }

    return await this.provider.enhanceSearch(query, initialResults);
  }

  async rerankOnly(
    query: string,
    documents: string[],
    topK?: number
  ): Promise<RerankResponse | null> {
    if (!this.isReady() || !this.provider) {
      return null;
    }

    return await this.provider.rerank({
      query,
      documents,
      top_k: topK
    });
  }

  async embedBatch(
    texts: string[],
    inputType: 'query' | 'document' = 'document'
  ): Promise<number[][] | null> {
    if (!this.isReady() || !this.provider) {
      return null;
    }

    return await this.provider.batchEmbed(texts, { inputType });
  }

  destroy() {
    this.provider = null;
    this.isEnabled = false;
  }
}
