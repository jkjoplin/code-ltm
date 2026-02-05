export interface EmbeddingResult {
  embedding: Float32Array;
  model: string;
  provider: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  isAvailable(): Promise<boolean>;
  embed(text: string): Promise<EmbeddingResult>;
}
