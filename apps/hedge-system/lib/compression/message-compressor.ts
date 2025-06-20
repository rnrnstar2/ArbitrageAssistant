import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);
const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'deflate' | 'brotli';
  threshold: number;  // bytes - minimum size to compress
  level: number;      // compression level 1-9
  chunkSize?: number; // for streaming compression
}

export interface CompressedData {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  data: Uint8Array;
  compressionRatio: number;
}

export interface CompressionStats {
  totalMessages: number;
  compressedMessages: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  compressionRatio: number;
  bandwidthSaved: number;
  averageCompressionTime: number;
  processingTime: number;
}

export interface CompressionResult {
  compressed: CompressedData;
  stats: CompressionStats;
  shouldCompress: boolean;
}

interface CompressionOperation {
  startTime: number;
  originalSize: number;
  algorithm: string;
}

export class CompressionManager {
  private config: CompressionConfig;
  private stats: CompressionStats;
  private compressionHistory: number[] = [];
  private timeHistory: number[] = [];

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      enabled: true,
      algorithm: 'gzip',
      threshold: 1024, // 1KB
      level: 6,        // balanced compression
      chunkSize: 16384, // 16KB
      ...config,
    };

    this.stats = {
      totalMessages: 0,
      compressedMessages: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      compressionRatio: 1.0,
      bandwidthSaved: 0,
      averageCompressionTime: 0,
      processingTime: 0,
    };
  }

  /**
   * Compress data with automatic compression decision
   */
  async compress(data: any): Promise<CompressedData> {
    const operation = this.startOperation('compress');
    
    try {
      const serialized = JSON.stringify(data);
      const originalBuffer = Buffer.from(serialized, 'utf8');
      const originalSize = originalBuffer.length;

      // Check if compression should be applied
      if (!this.shouldCompress(originalSize)) {
        return {
          algorithm: 'none',
          originalSize,
          compressedSize: originalSize,
          data: new Uint8Array(originalBuffer),
          compressionRatio: 1.0,
        };
      }

      const compressedBuffer = await this.compressBuffer(originalBuffer);
      const compressedSize = compressedBuffer.length;
      const compressionRatio = originalSize / compressedSize;

      // Update statistics
      this.updateCompressionStats(originalSize, compressedSize, operation);

      return {
        algorithm: this.config.algorithm,
        originalSize,
        compressedSize,
        data: new Uint8Array(compressedBuffer),
        compressionRatio,
      };
    } catch (error) {
      console.error('Compression failed:', error);
      // Fallback to uncompressed data
      const serialized = JSON.stringify(data);
      const originalBuffer = Buffer.from(serialized, 'utf8');
      return {
        algorithm: 'none',
        originalSize: originalBuffer.length,
        compressedSize: originalBuffer.length,
        data: new Uint8Array(originalBuffer),
        compressionRatio: 1.0,
      };
    }
  }

  /**
   * Decompress data
   */
  async decompress(compressedData: CompressedData): Promise<any> {
    const operation = this.startOperation('decompress');
    
    try {
      let decompressedBuffer: Buffer;

      if (compressedData.algorithm === 'none') {
        decompressedBuffer = Buffer.from(compressedData.data);
      } else {
        decompressedBuffer = await this.decompressBuffer(
          Buffer.from(compressedData.data),
          compressedData.algorithm as CompressionConfig['algorithm']
        );
      }

      const result = JSON.parse(decompressedBuffer.toString('utf8'));
      this.endOperation(operation);
      return result;
    } catch (error) {
      console.error('Decompression failed:', error);
      throw new Error(`Failed to decompress data: ${error.message}`);
    }
  }

  /**
   * Batch compression for multiple messages
   */
  async compressBatch(messages: any[]): Promise<CompressedData[]> {
    const results: CompressedData[] = [];
    
    for (const message of messages) {
      const compressed = await this.compress(message);
      results.push(compressed);
    }

    return results;
  }

  /**
   * Stream compression for large data
   */
  async compressStream(data: any): Promise<AsyncGenerator<Uint8Array, void, unknown>> {
    const serialized = JSON.stringify(data);
    const buffer = Buffer.from(serialized, 'utf8');
    
    const compressor = this.createCompressor();
    
    return this.processStreamInChunks(buffer, compressor);
  }

  /**
   * Check if data should be compressed
   */
  shouldCompress(dataSize: number): boolean {
    if (!this.config.enabled) {
      return false;
    }

    // Don't compress small data (overhead > benefit)
    if (dataSize < this.config.threshold) {
      return false;
    }

    // Don't compress if recent compression ratio is poor
    if (this.stats.compressionRatio < 1.1 && this.stats.compressedMessages > 10) {
      return false;
    }

    return true;
  }

  /**
   * Get current compression statistics
   */
  getCompressionStats(): CompressionStats {
    return { ...this.stats };
  }

  /**
   * Update compression configuration
   */
  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset compression statistics
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      compressedMessages: 0,
      totalOriginalBytes: 0,
      totalCompressedBytes: 0,
      compressionRatio: 1.0,
      bandwidthSaved: 0,
      averageCompressionTime: 0,
      processingTime: 0,
    };
    this.compressionHistory = [];
    this.timeHistory = [];
  }

  /**
   * Get compression recommendations based on statistics
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.stats.compressionRatio < 1.2) {
      recommendations.push('圧縮効果が低いです。データ形式を見直すか、圧縮を無効にすることを検討してください。');
    }

    if (this.stats.averageCompressionTime > 10) {
      recommendations.push('圧縮処理時間が長いです。圧縮レベルを下げることを検討してください。');
    }

    if (this.stats.compressedMessages / this.stats.totalMessages < 0.5) {
      recommendations.push('圧縮しきい値が高すぎる可能性があります。しきい値を下げることを検討してください。');
    }

    if (this.stats.bandwidthSaved > 1000000) { // 1MB
      recommendations.push(`圧縮により${this.formatBytes(this.stats.bandwidthSaved)}の帯域幅を節約しています。`);
    }

    if (recommendations.length === 0) {
      recommendations.push('圧縮設定は適切です。');
    }

    return recommendations;
  }

  private async compressBuffer(buffer: Buffer): Promise<Buffer> {
    const options = { level: this.config.level };

    switch (this.config.algorithm) {
      case 'gzip':
        return await gzip(buffer, options);
      case 'deflate':
        return await deflate(buffer, options);
      case 'brotli':
        return await brotliCompress(buffer, { 
          params: { 
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level 
          } 
        });
      default:
        throw new Error(`Unsupported compression algorithm: ${this.config.algorithm}`);
    }
  }

  private async decompressBuffer(buffer: Buffer, algorithm: CompressionConfig['algorithm']): Promise<Buffer> {
    switch (algorithm) {
      case 'gzip':
        return await gunzip(buffer);
      case 'deflate':
        return await inflate(buffer);
      case 'brotli':
        return await brotliDecompress(buffer);
      default:
        throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
    }
  }

  private createCompressor(): zlib.Gzip | zlib.Deflate | zlib.BrotliCompress {
    const options = { level: this.config.level };

    switch (this.config.algorithm) {
      case 'gzip':
        return zlib.createGzip(options);
      case 'deflate':
        return zlib.createDeflate(options);
      case 'brotli':
        return zlib.createBrotliCompress({
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.config.level
          }
        });
      default:
        throw new Error(`Unsupported compression algorithm: ${this.config.algorithm}`);
    }
  }

  private async* processStreamInChunks(
    buffer: Buffer, 
    compressor: zlib.Gzip | zlib.Deflate | zlib.BrotliCompress
  ): AsyncGenerator<Uint8Array, void, unknown> {
    const chunkSize = this.config.chunkSize || 16384;
    
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.slice(i, i + chunkSize);
      const compressedChunk = await new Promise<Buffer>((resolve, reject) => {
        compressor.write(chunk, (error) => {
          if (error) reject(error);
        });

        compressor.once('data', (data) => {
          resolve(data);
        });
      });

      yield new Uint8Array(compressedChunk);
    }

    // Finalize compression
    const finalChunk = await new Promise<Buffer>((resolve, reject) => {
      compressor.end((error) => {
        if (error) reject(error);
      });

      compressor.once('data', (data) => {
        resolve(data);
      });
    });

    if (finalChunk.length > 0) {
      yield new Uint8Array(finalChunk);
    }
  }

  private startOperation(operation: string): CompressionOperation {
    return {
      startTime: performance.now(),
      originalSize: 0,
      algorithm: this.config.algorithm,
    };
  }

  private endOperation(operation: CompressionOperation): void {
    const duration = performance.now() - operation.startTime;
    this.timeHistory.push(duration);
    
    // Keep only recent history
    if (this.timeHistory.length > 100) {
      this.timeHistory.shift();
    }

    // Update average processing time
    this.stats.averageCompressionTime = 
      this.timeHistory.reduce((sum, time) => sum + time, 0) / this.timeHistory.length;
    
    this.stats.processingTime += duration;
  }

  private updateCompressionStats(
    originalSize: number, 
    compressedSize: number, 
    operation: CompressionOperation
  ): void {
    this.stats.totalMessages++;
    this.stats.compressedMessages++;
    this.stats.totalOriginalBytes += originalSize;
    this.stats.totalCompressedBytes += compressedSize;

    // Update compression ratio
    this.stats.compressionRatio = this.stats.totalCompressedBytes > 0 
      ? this.stats.totalOriginalBytes / this.stats.totalCompressedBytes 
      : 1.0;

    // Update bandwidth saved
    this.stats.bandwidthSaved = this.stats.totalOriginalBytes - this.stats.totalCompressedBytes;

    // Track compression ratio history
    const currentRatio = originalSize / compressedSize;
    this.compressionHistory.push(currentRatio);
    
    if (this.compressionHistory.length > 100) {
      this.compressionHistory.shift();
    }

    this.endOperation(operation);
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const compressionManager = new CompressionManager();