export class RequestBodyError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestBodyError('Use an application/json request body.', 415);
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError('Provide a JSON request body.', 400);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new RequestBodyError('Request body is too large.', 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError('Malformed JSON request body.', 400);
  } finally {
    reader.releaseLock();
  }
}
