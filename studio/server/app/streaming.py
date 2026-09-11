"""Server-Sent Events helpers.

We run the (synchronous, CPU/IO-bound) approach pipeline in a worker thread and
stream events back over SSE as the worker emits them. The browser consumes the
stream with `fetch` (not native EventSource), so the key can travel in a POST
header. Each SSE frame: `event: <name>\\ndata: <json>\\n\\n`.
"""
from __future__ import annotations

import asyncio
import json
from typing import Callable

from starlette.responses import StreamingResponse

_SENTINEL = object()
# A comment frame sent during quiet stretches (index builds, slow model calls) so
# proxies and clients don't close an idle stream. Clients ignore comment frames.
KEEPALIVE_S = 15.0
_KEEPALIVE_FRAME = ": keepalive\n\n"


def format_sse(payload: dict) -> str:
    event = payload.get("event", "message")
    data = json.dumps(payload, default=str)
    return f"event: {event}\ndata: {data}\n\n"


def sse_response(worker: Callable[[Callable[[dict], None]], None]) -> StreamingResponse:
    """Run `worker(emit)` in a thread; stream every emitted dict as an SSE frame.

    `worker` is a blocking function that receives an `emit(payload: dict)` callable.
    """

    async def gen():
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def emit(payload: dict) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, payload)

        def run() -> None:
            try:
                worker(emit)
            except Exception as e:  # noqa: BLE001 - surface as a terminal SSE event
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"event": "fatal", "message": str(e)},
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, _SENTINEL)

        fut = loop.run_in_executor(None, run)
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_S)
                except asyncio.TimeoutError:
                    yield _KEEPALIVE_FRAME
                    continue
                if item is _SENTINEL:
                    break
                yield format_sse(item)
        finally:
            await fut

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            # no-transform stops compressing proxies (e.g. the Next dev server) from
            # buffering small events until the stream ends.
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering
        },
    )
