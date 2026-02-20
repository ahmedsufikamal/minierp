import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModuleWorkbenchPlaceholderProps = {
  moduleName: string;
  description: string;
  apiHref?: string;
};

export function ModuleWorkbenchPlaceholder({
  moduleName,
  description,
  apiHref,
}: ModuleWorkbenchPlaceholderProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{moduleName}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This module is available via canonical APIs and is being completed as part of parity UI rollout.
          </p>
          {apiHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={apiHref}>
                Open API Route
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
