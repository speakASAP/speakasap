"use client";

import { useState } from "react";
import { callGateway } from "@/lib/api-client";

type PlaybackResponse = {
  access?: { url?: string };
};

function playbackUrl(data: unknown): string | null {
  const access = (data as PlaybackResponse | null)?.access;
  return typeof access?.url === "string" ? access.url : null;
}

export default function LearnerPage() {
  const [token, setToken] = useState("");
  const [lessonUuid, setLessonUuid] = useState("");
  const [result, setResult] = useState<string>("No request executed yet.");

  async function runState(): Promise<void> {
    const path = `/api/v1/lessons/${lessonUuid.trim()}/record`;
    const response = await callGateway({ path, token });
    setResult(JSON.stringify({ path, status: response.status, ok: response.ok, data: response.data }, null, 2));
  }

  async function runPlayback(): Promise<void> {
    const path = `/api/v1/lessons/${lessonUuid.trim()}/record/playback`;
    const response = await callGateway({ path, token });
    setResult(JSON.stringify({ path, status: response.status, ok: response.ok, data: response.data }, null, 2));
  }

  async function runRangeDownload(): Promise<void> {
    const playbackPath = `/api/v1/lessons/${lessonUuid.trim()}/record/playback`;
    const playback = await callGateway({ path: playbackPath, token });
    const url = playbackUrl(playback.data);
    if (!url) {
      setResult(JSON.stringify({ path: playbackPath, status: playback.status, ok: playback.ok, data: playback.data }, null, 2));
      return;
    }
    const response = await callGateway({ path: url, token, headers: { Range: "bytes=0-31" } });
    setResult(JSON.stringify({ path: url, status: response.status, ok: response.ok, contentType: response.contentType, data: response.data }, null, 2));
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Learner Portal</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Bearer token
          <input
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste JWT token"
          />
        </label>
        <label className="block text-sm font-medium">
          Lesson UUID
          <input
            className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
            value={lessonUuid}
            onChange={(event) => setLessonUuid(event.target.value)}
            placeholder="Recorded lesson UUID"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={runState} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Record state
        </button>
        <button onClick={runPlayback} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Playback token
        </button>
        <button onClick={runRangeDownload} className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
          Range check
        </button>
      </div>
      <pre className="mt-6 overflow-auto rounded-xl border bg-zinc-50 p-4 text-xs dark:bg-zinc-950">{result}</pre>
    </main>
  );
}
