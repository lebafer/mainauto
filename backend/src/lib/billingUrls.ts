export function buildBillingReturnUrl(
  origin: string,
  returnPath: string | undefined,
  fallbackPath: string,
  checkoutResult?: "success" | "cancelled"
): string {
  const safeReturnPath =
    returnPath &&
    returnPath.startsWith("/") &&
    !returnPath.startsWith("//") &&
    returnPath.length <= 500
      ? returnPath
      : fallbackPath;
  const target = new URL(safeReturnPath, `${origin}/`);

  if (target.origin !== origin) {
    const fallback = new URL(fallbackPath, `${origin}/`);
    if (checkoutResult) fallback.searchParams.set("checkout", checkoutResult);
    return fallback.toString();
  }

  if (checkoutResult) {
    target.searchParams.set("checkout", checkoutResult);
  }
  return target.toString();
}
