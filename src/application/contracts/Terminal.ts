export interface Terminal {
  readLine(prompt: string): Promise<string | undefined>;
  writeLine(text: string): void;
  close(): void;
}
