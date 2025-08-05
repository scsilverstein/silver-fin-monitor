import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

export class TranscriptionService {
  private tempDir: string;
  private whisperAvailable: boolean = false;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp', 'transcriptions');
    this.checkWhisperAvailability();
  }

  private async checkWhisperAvailability(): Promise<void> {
    try {
      await execAsync('which whisper');
      this.whisperAvailable = true;
    } catch {
      this.whisperAvailable = false;
      console.warn('Whisper not found. Audio transcription will not be available.');
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.whisperAvailable;
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    if (!this.whisperAvailable) {
      throw new Error('Whisper transcription service is not available');
    }

    const audioFile = await this.downloadAudio(audioUrl);
    
    try {
      const transcriptFile = audioFile.replace(path.extname(audioFile), '.txt');
      
      // Run Whisper transcription
      const { stdout, stderr } = await execAsync(
        `whisper "${audioFile}" --model base --language en --output_format txt --output_dir "${path.dirname(audioFile)}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );

      if (stderr && !stderr.includes('Detecting language')) {
        console.error('Whisper stderr:', stderr);
      }

      // Read the transcript
      const transcript = await fs.readFile(transcriptFile, 'utf-8');
      
      // Cleanup
      await this.cleanup(audioFile);
      await this.cleanup(transcriptFile);
      
      return transcript.trim();
    } catch (error) {
      await this.cleanup(audioFile);
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async fetchFromAPI(audioUrl: string, apiEndpoint: string): Promise<string> {
    // Placeholder for fetching transcripts from external APIs
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ audioUrl })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.transcript || '';
    } catch (error) {
      throw new Error(`Failed to fetch transcript from API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async downloadAudio(audioUrl: string): Promise<string> {
    // Ensure temp directory exists
    await fs.mkdir(this.tempDir, { recursive: true });

    const filename = `${uuidv4()}.mp3`;
    const filepath = path.join(this.tempDir, filename);

    try {
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(filepath, Buffer.from(buffer));

      return filepath;
    } catch (error) {
      throw new Error(`Audio download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cleanup(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
    } catch (error) {
      console.warn(`Failed to cleanup file ${filepath}:`, error);
    }
  }
}