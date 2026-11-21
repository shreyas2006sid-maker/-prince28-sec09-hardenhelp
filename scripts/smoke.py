"""Basic production smoke tests for HardenHelp."""

import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


def check_endpoint(base_url: str, path: str) -> bool:
    url = f"{base_url.rstrip('/')}{path}"

    try:
        with urlopen(url, timeout=20) as response:
            print(f"PASS: {path} - HTTP {response.status}")
            return response.status == 200

    except HTTPError as error:
        print(f"FAIL: {path} - HTTP {error.code}")
    except (URLError, TimeoutError) as error:
        print(f"FAIL: {path} - {error}")

    return False


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python scripts/smoke.py https://your-app.onrender.com")
        return 1

    base_url = sys.argv[1].rstrip("/")

    endpoints = ["/health", "/ready", "/docs"]
    results = [check_endpoint(base_url, path) for path in endpoints]

    if all(results):
        print("\nAll smoke tests passed!")
        return 0

    print("\nSome smoke tests failed.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
