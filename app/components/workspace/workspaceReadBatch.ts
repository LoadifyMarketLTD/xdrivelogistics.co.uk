export type WorkspaceReadTask = { run: () => Promise<void>; onError: (error: unknown) => void };
/** Run independent, already-authorised reads concurrently, at most three at a time. */
export async function runWorkspaceReadBatch(tasks: readonly WorkspaceReadTask[]): Promise<void> {
  let cursor = 0;
  const workers = Array.from({length: Math.min(3, tasks.length)}, async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      try { await task.run(); } catch (error) { task.onError(error); }
    }
  });
  await Promise.all(workers);
}
