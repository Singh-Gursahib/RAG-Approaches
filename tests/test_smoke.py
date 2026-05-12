"""Phase 1 smoke test: package imports, settings load, version is set."""
from __future__ import annotations


def test_package_imports() -> None:
    import ragureap

    assert hasattr(ragureap, "__version__")
    assert isinstance(ragureap.__version__, str)
    assert len(ragureap.__version__) > 0


def test_settings_load_with_defaults() -> None:
    from ragureap.config import load_settings

    s = load_settings()
    assert s.llm_model == "gemini-3-flash-preview"
    assert s.budget_cap_usd == 5.0
    # Don't assert on api key — may or may not be set in the test env.


def test_cli_version(capsys) -> None:
    from ragureap.cli import main

    rc = main(["--version"])
    assert rc == 0
    captured = capsys.readouterr()
    assert captured.out.strip()  # something was printed
