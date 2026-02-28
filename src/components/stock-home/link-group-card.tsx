import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface LinkGroupCardProps {
  title: string;
  links: Array<{ href: string; label: string }>;
}

export function LinkGroupCard({ title, links }: LinkGroupCardProps) {
  return (
    <Card className="rounded-3xl border border-border shadow-sm">
      <CardContent className="p-5">
        <h3 className="mb-3 text-base font-semibold text-foreground">{title}</h3>
        <div className="space-y-1.5">
          {links.map((link) => (
            <Link
              key={`${link.href}-${link.label}`}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-[hsl(var(--surface-2))] hover:text-foreground"
            >
              <span>{link.label}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
