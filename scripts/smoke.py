"""Production smoke tests for HardenHelp."""

import argparse
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def check_endpoint(base_url: str, path: str) -> bool:
    url = f"{base_url.rstrip('/')}{path}"

    try:
        with urlopen(url, timeout=20) as response:
            print(f"PASS: {path} - HTTP {response.status}")
            return response.status == 200
    except (HTTPError, URLError, TimeoutError) as error:
        print(f"FAIL: {path} - {error}")
        return False


def wait_for_version(
    base_url: str,
    expected_version: str,
    timeout: int,
    interval: int,
) -> bool:
    url = f"{base_url.rstrip('/')}/health"
    deadline = time.monotonic() + timeout

    while time.monotonic() < deadline:
        try:
            with urlopen(url, timeout=20) as response:
                data = json.loads(response.read().decode("utf-8"))
                actual_version = data.get("version")

                if actual_version == expected_version:
                    print(f"PASS: deployed version - {actual_version}")
                    return True

                print(f"WAIT: expected {expected_version}, currently running {actual_version}")

        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            print(f"WAIT: health check not ready - {error}")

        time.sleep(interval)

    print("FAIL: expected version was not deployed before timeout.")
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Run production smoke tests for HardenHelp.")
    parser.add_argument("base_url")
    parser.add_argument("--expect-version")
    parser.add_argument("--timeout", type=int, default=300)
    parser.add_argument("--interval", type=int, default=10)
    args = parser.parse_args()

    if args.timeout <= 0 or args.interval <= 0:
        parser.error("--timeout and --interval must be positive integers")

    base_url = args.base_url.rstrip("/")

    if args.expect_version and not wait_for_version(
        base_url,
        args.expect_version,
        args.timeout,
        args.interval,
    ):
        return 1

    endpoints = [
        "/health",
        "/ready",
        "/v1/documents?limit=1",
    ]

    results = [check_endpoint(base_url, path) for path in endpoints]

    if all(results):
        print("\nAll smoke tests passed!")
        return 0

    print("\nSome smoke tests failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
