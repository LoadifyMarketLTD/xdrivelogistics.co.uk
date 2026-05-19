const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function fetchWithRetry<T>(
  url: RequestInfo | URL,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url);

    if (response.ok) {
      return response.json() as Promise<T>;
    }

    if (response.status !== 503) {
      throw new Error('Request failed');
    }

    await wait(2000);
  }

  throw new Error('Request failed');
}
