#!/usr/bin/env python3
"""Sums up Gradle JUnit XML reports for the GitHub job summary (#35). Standard library only.

    python3 .github/scripts/junit_summary.py backend/build/test-results/test --no-skips

Prints totals (run, passed, skipped, failed) and one row per test class, and appends the same
Markdown to $GITHUB_STEP_SUMMARY when it is set. Exits 1 when there are no reports, when a test
failed, or, with --no-skips, when any test was skipped: in CI the Testcontainers (PostgreSQL)
tests skip themselves only when Docker is missing, and a skipped database test must not pass
as green.
"""

import argparse
import glob
import os
import sys
import xml.etree.ElementTree as ET


def read_suites(directory):
    suites = []
    for path in sorted(glob.glob(os.path.join(directory, "TEST-*.xml"))):
        root = ET.parse(path).getroot()
        for suite in ([root] if root.tag == "testsuite" else root.iter("testsuite")):
            tests = int(suite.get("tests", 0))
            skipped = int(suite.get("skipped", 0))
            failed = int(suite.get("failures", 0)) + int(suite.get("errors", 0))
            suites.append({"name": suite.get("name", "?"), "tests": tests, "skipped": skipped,
                           "failed": failed, "time": float(suite.get("time", 0) or 0)})
    return suites


def render(suites, no_skips):
    tests = sum(s["tests"] for s in suites)
    skipped = sum(s["skipped"] for s in suites)
    failed = sum(s["failed"] for s in suites)
    passed = tests - skipped - failed
    ok = suites and failed == 0 and not (no_skips and skipped)
    lines = [
        "### Backend tests: %s" % ("passed" if ok else "FAILED"),
        "",
        "| Run | Passed | Skipped | Failed | Classes |",
        "| ---: | ---: | ---: | ---: | ---: |",
        "| %d | %d | %d | %d | %d |" % (tests, passed, skipped, failed, len(suites)),
        "",
    ]
    if not suites:
        lines.append("No JUnit reports found: the tests did not run.")
    if no_skips and skipped:
        lines.append("Skipped tests are not allowed in CI: the Testcontainers database tests skip "
                     "themselves only when Docker is missing.")
        lines.append("")
    lines += ["<details><summary>Per test class</summary>", "",
              "| Class | Run | Skipped | Failed | Seconds |", "| --- | ---: | ---: | ---: | ---: |"]
    for s in suites:
        lines.append("| %s%s | %d | %d | %d | %.1f |" % (
            "**FAILED** " if s["failed"] else ("**SKIPPED** " if s["skipped"] else ""),
            s["name"], s["tests"], s["skipped"], s["failed"], s["time"]))
    lines += ["", "</details>", ""]
    return "\n".join(lines), ok


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("directory", help="folder with the TEST-*.xml reports")
    ap.add_argument("--no-skips", action="store_true", help="fail when any test was skipped")
    args = ap.parse_args(argv)
    text, ok = render(read_suites(args.directory), args.no_skips)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as fh:
            fh.write(text + "\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
