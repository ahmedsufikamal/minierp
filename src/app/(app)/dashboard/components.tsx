"use client";

import { useTransition } from "react";
import { initChartOfAccountsAction } from "./actions";
import { Button } from "@/components/ui/button";

export function InitAccountsButton() {
  const [pending, start] = useTransition();

  return (
    <Button
      onClick={() =>
        start(() => {
          void initChartOfAccountsAction();
        })
      }
      disabled={pending}
      variant="outline"
    >
      {pending ? "Initializing..." : "Init chart of accounts"}
    </Button>
  );
}
