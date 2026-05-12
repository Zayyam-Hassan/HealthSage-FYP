from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Awaitable, TypeVar

T = TypeVar("T")


def run_coro_sync(awaitable: Awaitable[T]) -> T:
    """
    Run an async coroutine from sync code.

    When there is already an active event loop in this thread, execute the
    coroutine in a dedicated worker thread so sync callers can still block on
    the result safely.
    """
    # Do not call asyncio.run() inside `except RuntimeError` — Python chains
    # any raised error to that exception and logs a confusing traceback.
    in_async_thread = False
    try:
        asyncio.get_running_loop()
        in_async_thread = True
    except RuntimeError:
        pass

    if not in_async_thread:
        return asyncio.run(awaitable)

    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(awaitable)).result()
