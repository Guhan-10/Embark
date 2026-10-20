/** Only allows same-site paths like "/tasks?x=1", so ?next= can't send people to another website. */
export function safeRedirectPath(next: string | string[] | undefined | null, fallback = "/dashboard") {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
