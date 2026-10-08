"""Read scheduler ownership without allowing outages to start duplicate work."""
import json
import os
import time
import urllib.error
import urllib.request

class OwnershipUnavailable(RuntimeError):
    pass

def check_ownership(url, opener=urllib.request.urlopen, sleep=time.sleep):
    for attempt in range(4):
        try:
            with opener(url, timeout=15) as response:
                status = json.load(response)
            if status.get("version") != 1 or not isinstance(status.get("active"), bool):
                raise OwnershipUnavailable("Invalid scheduler response; ownership is unknown")
            return status["active"]
        except urllib.error.HTTPError as error:
            try:
                body = json.loads(error.read(4096))
            except (ValueError, OSError):
                body = {}
            if body.get("error") == "usage_exceeded":
                raise OwnershipUnavailable(
                    "Netlify hosting usage limit exceeded. Restore hosting capacity in Netlify billing; "
                    "scheduler, refresh and publication availability cannot be confirmed. "
                    "Duplicate work is blocked; retrying research will not fix this."
                ) from None
            if error.code not in (408, 429, 500, 502, 503, 504):
                raise OwnershipUnavailable(f"Scheduler endpoint HTTP {error.code}; ownership is unknown") from None
            reason = f"HTTP {error.code}"
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            reason = type(error).__name__
        except (ValueError, TypeError) as error:
            raise OwnershipUnavailable("Invalid scheduler JSON; ownership is unknown") from None
        print(f"Scheduler check attempt {attempt + 1}/4 unavailable: {reason}", flush=True)
        if attempt < 3:
            sleep((5, 10, 20)[attempt])
    raise OwnershipUnavailable("Scheduler endpoint unavailable after four attempts; duplicate work blocked")

def main():
    try:
        owned = check_ownership(os.environ["SCHEDULER_STATUS_URL"])
    except OwnershipUnavailable as error:
        message = str(error)
        print("::error::" + message, flush=True)
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                summary.write("### Scheduler ownership unavailable\n" + message + "\nNo research or refresh was started.\n")
        return 1
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("external=" + str(owned).lower() + "\n")
    print("Netlify owns scheduling: " + str(owned), flush=True)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
