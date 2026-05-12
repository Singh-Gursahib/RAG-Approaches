.PHONY: help install lint test ingest run ui clean

help:  ## Show this help.
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install:  ## Install package in editable mode with dev extras.
	pip install -e ".[dev]"

lint:  ## Lint with ruff.
	ruff check src tests

test:  ## Run pytest.
	pytest

ingest:  ## (Phase 2) Build/refresh eval corpus and chunked index.
	@echo "Phase 2 — implement in src/ragureap/data/corpus.py"

run:  ## Run one approach. Usage: make run config=configs/approaches/naive.yaml
	@if [ -z "$(config)" ]; then echo "Usage: make run config=configs/approaches/<name>.yaml"; exit 2; fi
	.venv/bin/python -m ragureap.runner --config $(config)

dashboard-data:  ## Regenerate frontend/web/lib/data.json from runs/.
	.venv/bin/python scripts/build_dashboard_data.py

ui:  ## Launch the Next.js dashboard (regenerates data first).
	@$(MAKE) dashboard-data
	cd frontend/web && npm install --silent && npm run dev

clean:  ## Remove build artifacts and caches (NOT runs/ or data/).
	rm -rf build dist *.egg-info .pytest_cache .ruff_cache
	find src tests -name __pycache__ -type d -exec rm -rf {} +
