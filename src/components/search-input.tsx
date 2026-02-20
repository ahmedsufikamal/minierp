"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

type Props = {
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
};

const DEBOUNCE_MS = 300;

export function SearchInput({
  name = "q",
  placeholder = "Search…",
  defaultValue = "",
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = value.trim();
      const current = searchParams?.get(name) ?? "";
      if (trimmed === current) return;
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (trimmed) {
        params.set(name, trimmed);
        params.set("page", "1");
      } else {
        params.delete(name);
        params.set("page", "1");
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, name, pathname, router, searchParams]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 bg-card"
        aria-label={placeholder}
      />
    </div>
  );
}
