import Link from "next/link";
import { getGatewayBaseUrl } from "@/lib/gateway";

export default function Home() {
  const gatewayBaseUrl = getGatewayBaseUrl();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
      <main className="w-full max-w-4xl rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-950">
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          SpeakASAP Frontend Scaffold
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Frontend calls must go through the API gateway only.
        </p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Active gateway base URL: <code>{gatewayBaseUrl ?? "NOT_CONFIGURED"}</code>
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/learner">
            Learner portal shell
          </Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/teacher">
            Teacher portal shell
          </Link>
          <Link className="rounded-xl border px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900" href="/admin">
            Admin portal shell
          </Link>
        </div>
      </main>
    </div>
  );
}
