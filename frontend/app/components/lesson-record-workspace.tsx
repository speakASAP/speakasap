"use client";

import { useMemo, useState } from "react";
import { callGateway } from "@/lib/api-client";

type PortalRole = "learner" | "teacher";

type GatewayResult = {
  label: string;
  path: string;
  status: number;
  ok: boolean;
  contentType: string;
  data: unknown;
};

type PlaybackResponse = {
  access?: {
    url?: string;
    expiresIn?: number;
    mode?: string;
  };
};

type LessonRecordWorkspaceProps = {
  role: PortalRole;
  initialLessonUuid: string;
};

function resultText(result: GatewayResult | null): string {
  if (!result) {
    return "No gateway request has been sent from this page.";
  }
  return JSON.stringify(result, null, 2);
}

function playbackUrl(data: unknown): string | null {
  const access = (data as PlaybackResponse | null)?.access;
  return typeof access?.url === "string" ? access.url : null;
}

function cleanUuid(value: string): string {
  return value.trim();
}

export function LessonRecordWorkspace({ role, initialLessonUuid }: LessonRecordWorkspaceProps) {
  const [token, setToken] = useState("");
  const [lessonUuid, setLessonUuid] = useState(initialLessonUuid);
  const [filename, setFilename] = useState("record.mp3");
  const [contentType, setContentType] = useState("audio/mpeg");
  const [size, setSize] = useState("1024");
  const [kind, setKind] = useState<"lesson" | "part">("lesson");
  const [result, setResult] = useState<GatewayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const basePath = useMemo(() => `/api/v1/lessons/${cleanUuid(lessonUuid)}/record`, [lessonUuid]);
  const isTeacher = role === "teacher";

  async function runGateway(label: string, path: string, init?: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string>; tokenRequired?: boolean }) {
    const cleanLessonUuid = cleanUuid(lessonUuid);
    if (!cleanLessonUuid) {
      setError("Lesson UUID is required before checking a recording route.");
      setResult(null);
      return null;
    }
    if (init?.tokenRequired !== false && !token.trim()) {
      setError("Bearer token is required for this protected gateway route.");
      setResult(null);
      return null;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await callGateway({
        path,
        method: init?.method,
        body: init?.body,
        headers: init?.headers,
        token: init?.tokenRequired === false ? undefined : token,
      });
      const nextResult = {
        label,
        path,
        status: response.status,
        ok: response.ok,
        contentType: response.contentType,
        data: response.data,
      };
      setResult(nextResult);
      return nextResult;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gateway request failed.");
      setResult(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function checkState() {
    await runGateway("record-state", basePath);
  }

  async function requestPlayback() {
    await runGateway("playback-token", `${basePath}/playback`);
  }

  async function verifyRange() {
    const playback = await runGateway("playback-token", `${basePath}/playback`);
    const url = playbackUrl(playback?.data);
    if (!url) {
      return;
    }
    await runGateway("range-download", url, {
      headers: { Range: "bytes=0-31" },
      tokenRequired: false,
    });
  }

  async function requestPresign() {
    const parsedSize = Number(size);
    await runGateway("teacher-presign", `${basePath}/presign`, {
      method: "POST",
      body: {
        filename: filename.trim() || "record.mp3",
        contentType: contentType.trim() || "audio/mpeg",
        kind,
        size: Number.isFinite(parsedSize) ? parsedSize : 0,
      },
    });
  }

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {isTeacher ? "Teacher recording workflow" : "Learner playback workflow"}
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold tracking-normal">
            Lesson recording gateway check
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            This route calls only the SpeakASAP API gateway. Playback uses the scoped download token returned by the gateway and never stores a permanent media URL.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Lesson UUID
              <input
                className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-200"
                value={lessonUuid}
                onChange={(event) => setLessonUuid(event.target.value)}
                placeholder="Recorded lesson UUID"
                data-testid="lesson-uuid-input"
              />
            </label>
            <label className="block text-sm font-medium">
              Bearer token
              <textarea
                className="mt-2 h-24 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-xs outline-none ring-0 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-zinc-200"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Paste a short-lived JWT for authorized checks"
                data-testid="bearer-token-input"
              />
            </label>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <button data-testid="record-state-button" onClick={checkState} disabled={busy} className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950">
              Check state
            </button>
            <button data-testid="playback-button" onClick={requestPlayback} disabled={busy} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-700">
              Request playback
            </button>
            <button data-testid="range-button" onClick={verifyRange} disabled={busy} className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-60 dark:border-zinc-700">
              Verify range
            </button>
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          {isTeacher ? (
            <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-base font-semibold">Upload presign</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium">
                  Filename
                  <input className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" value={filename} onChange={(event) => setFilename(event.target.value)} />
                </label>
                <label className="block text-sm font-medium">
                  Content type
                  <input className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" value={contentType} onChange={(event) => setContentType(event.target.value)} />
                </label>
                <label className="block text-sm font-medium">
                  Size in bytes
                  <input className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" inputMode="numeric" value={size} onChange={(event) => setSize(event.target.value)} />
                </label>
                <label className="block text-sm font-medium">
                  Kind
                  <select className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" value={kind} onChange={(event) => setKind(event.target.value as "lesson" | "part")}>
                    <option value="lesson">lesson</option>
                    <option value="part">part</option>
                  </select>
                </label>
              </div>
              <button data-testid="presign-button" onClick={requestPresign} disabled={busy} className="mt-4 rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950">
                Request upload URL
              </button>
              <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Commit, merge, and delete remain excluded from this verification route because they mutate lesson-record metadata or private objects and require explicit scoped approval before use.
              </p>
            </div>
          ) : null}

          <div className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">Gateway response</h2>
            {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-200">{error}</p> : null}
            <pre data-testid="gateway-result" className="mt-4 max-h-[520px] max-w-full overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs leading-5 dark:border-zinc-800 dark:bg-zinc-950">
              {resultText(result)}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
