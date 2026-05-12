"""Minimal CLI entry — fleshed out in later phases. Phase 1 just confirms importability."""
from __future__ import annotations

import argparse
import sys

from . import __version__


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ragureap", description="RAG_Ureap experiment runner.")
    parser.add_argument("--version", action="store_true", help="Print version and exit.")
    args = parser.parse_args(argv)
    if args.version:
        print(__version__)
        return 0
    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
