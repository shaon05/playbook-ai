const provisionalBookStatuses = new Set(["CREATED", "UPLOAD_PENDING", "UPLOAD_FAILED"]);

export function isVisibleInLibrary(status: string) {
  return !provisionalBookStatuses.has(status);
}
