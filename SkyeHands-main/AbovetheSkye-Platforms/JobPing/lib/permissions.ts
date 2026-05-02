export function assertAccountMatch(expectedAccountId: string | null | undefined, actualAccountId: string) {
  if (!expectedAccountId || expectedAccountId !== actualAccountId) {
    throw new Error("Unauthorized account access");
  }
}
