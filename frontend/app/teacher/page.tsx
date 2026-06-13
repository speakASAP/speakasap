"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function TeacherPage() {
  const [lessonUuid, setLessonUuid] = useState("");
  const href = useMemo(() => `/teacher/lessons/${lessonUuid.trim() || "lesson-uuid"}/record`, [lessonUuid]);

  return (
    <main className="min-h-full bg-zinc-50 px-4 py-10 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6">
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Teacher portal</p>
        <h1 className="mt-2 text-2xl font-semibold">Lesson recording tools</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Open a teacher lesson-record route to check state, request scoped playback, verify range streaming, and request a private upload URL through the API gateway.
        </p>
        <label className="mt-6 block text-sm font-medium">
          Lesson UUID
          <input
            className="mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={lessonUuid}
            onChange={(event) => setLessonUuid(event.target.value)}
            placeholder="Recorded lesson UUID"
          />
        </label>
        <Link href={href} className="mt-5 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-950">
          Open teacher recording route
        </Link>
      </section>
    </main>
  );
}
