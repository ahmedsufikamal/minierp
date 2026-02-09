/**
 * Standardised result type for server actions.
 * Use this instead of throwing for validation/business errors.
 */
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string | Record<string, string[]> };

export function success<T>(data?: T): ActionResult<T> {
  return data !== undefined ? { ok: true, data } : { ok: true };
}

export function failure(error: string | Record<string, string[]>): ActionResult<never> {
  return { ok: false, error };
}

export function isSuccess<T>(result: ActionResult<T>): result is { ok: true; data?: T } {
  return result.ok === true;
}

export function isFailure<T>(result: ActionResult<T>): result is { ok: false; error: string | Record<string, string[]> } {
  return result.ok === false;
}

/**
 * Wraps an async action that needs companyId. Catches redirect (re-throws),
 * returns ActionResult on validation/expected errors.
 */
export async function withCompanyAction<T>(
  getCompanyId: () => Promise<string>,
  fn: (companyId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    const companyId = await getCompanyId();
    return await fn(companyId);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) {
      throw e;
    }
    return failure(typeof e === "string" ? e : "An error occurred");
  }
}

// Backwards compatibility
export const withOrgAction = withCompanyAction;
