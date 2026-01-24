"use client";

import { useTransition } from "react";
import { initChartOfAccounts } from "./actions";

export function InitAccountsButton() {
  const [pending, start] = useTransition();

  return (
    <button
      onClick={() => start(() => { void initChartOfAccounts(); })}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "Initializing..." : "Init chart of accounts"}
    </button>
  );
}
