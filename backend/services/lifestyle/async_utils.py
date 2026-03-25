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
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable)

    with ThreadPoolExecutor(max_workers=1) as executor:
        return executor.submit(lambda: asyncio.run(awaitable)).result()
