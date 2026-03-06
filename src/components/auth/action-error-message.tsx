import { formatAuthActionError, type AuthActionError } from "@/modules/iam/interface/action-error";

interface ActionErrorMessageProps {
  error?: AuthActionError | null;
  className?: string;
}

export function ActionErrorMessage({ error, className = "text-sm text-destructive" }: ActionErrorMessageProps) {
  if (!error) return null;
  return <p className={className}>{formatAuthActionError(error)}</p>;
}
