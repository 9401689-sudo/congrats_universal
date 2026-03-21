import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

type PythonRendererWorkerClientOptions = {
  pythonBin: string;
  scriptPath: string;
};

type PendingRequest = {
  reject: (error: Error) => void;
  resolve: (value: { durationMs?: number; outputPath: string }) => void;
};

type WorkerResponse = {
  duration_ms?: number;
  error?: string;
  id?: string;
  ok?: boolean;
  output_path?: string;
  traceback?: string;
};

export class PythonRendererWorkerClient {
  private process?: ChildProcessWithoutNullStreams;
  private readline?: Interface;
  private readonly pending = new Map<string, PendingRequest>();
  private stderrBuffer = "";

  constructor(private readonly options: PythonRendererWorkerClientOptions) {}

  async render(input: Record<string, unknown>): Promise<{ durationMs?: number; outputPath: string }> {
    this.ensureStarted();

    const requestId = randomUUID();

    return await new Promise<{ durationMs?: number; outputPath: string }>((resolve, reject) => {
      this.pending.set(requestId, { reject, resolve });

      try {
        this.process?.stdin.write(`${JSON.stringify({ id: requestId, input })}\n`, "utf8");
      } catch (error) {
        this.pending.delete(requestId);
        reject(asError(error));
      }
    });
  }

  private ensureStarted(): void {
    if (this.process && !this.process.killed) {
      return;
    }

    const child = spawn(this.options.pythonBin, [this.options.scriptPath, "--worker"], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.process = child;
    this.stderrBuffer = "";
    this.readline = createInterface({ input: child.stdout });

    this.readline.on("line", (line) => {
      this.handleResponseLine(line);
    });

    child.stderr.on("data", (chunk: Buffer) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk.toString("utf8")}`.slice(-8000);
    });

    child.on("error", (error) => {
      this.failAllPending(new Error(`Python renderer worker process error: ${error.message}`));
    });

    child.on("close", (code, signal) => {
      const details = this.stderrBuffer.trim();
      this.process = undefined;
      this.readline?.close();
      this.readline = undefined;
      this.failAllPending(
        new Error(
          `Python renderer worker exited unexpectedly (code=${code ?? "null"}, signal=${
            signal ?? "null"
          })${details ? `\n${details}` : ""}`
        )
      );
    });
  }

  private handleResponseLine(line: string): void {
    let payload: WorkerResponse;

    try {
      payload = JSON.parse(line) as WorkerResponse;
    } catch {
      this.failAllPending(new Error(`Python renderer worker returned invalid JSON: ${line}`));
      return;
    }

    if (!payload.id) {
      return;
    }

    const pending = this.pending.get(payload.id);
    if (!pending) {
      return;
    }

    this.pending.delete(payload.id);

    if (!payload.ok || !payload.output_path) {
      const details = [payload.error, payload.traceback, this.stderrBuffer.trim()]
        .filter(Boolean)
        .join("\n");
      pending.reject(new Error(`Python renderer worker failed${details ? `:\n${details}` : ""}`));
      return;
    }

    pending.resolve({
      durationMs: payload.duration_ms,
      outputPath: payload.output_path
    });
  }

  private failAllPending(error: Error): void {
    const pendings = [...this.pending.values()];
    this.pending.clear();
    for (const pending of pendings) {
      pending.reject(error);
    }
  }
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
