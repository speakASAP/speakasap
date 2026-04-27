"use client";

import { useState } from "react";
import { callGateway } from "@/lib/api-client";

const learnerActions = [
  { label: "Content feed", path: "/api/v1/languages" },
  { label: "Learning progress", path: "/api/v1/student-courses" },
  { label: "Assessment attempts", path: "/api/v1/language-user-tests" },
  { label: "Achievements", path: "/api/v1/course-certificates" },
];

export default function LearnerPage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<string>("No request executed yet.");

  async function run(path: string): Promise<void> {
    const response = await callGateway({ path, token });
    setResult(JSON.stringify({ path, status: response.status, ok: response.ok, data: response.data }, null, 2));
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Learner Portal</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Initial TASK-71 flows mapped to gateway routes for learner use-cases.
      </p>
      <label className="mt-6 block text-sm font-medium">
        Bearer token
        <input
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste JWT token"
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        {learnerActions.map((action) => (
          <button
            key={action.path}
            onClick={() => run(action.path)}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {action.label}
          </button>
        ))}
      </div>
      <pre className="mt-6 overflow-auto rounded-xl border bg-zinc-50 p-4 text-xs dark:bg-zinc-950">{result}</pre>
    </main>
  );
}
