# ai-key-vault monorepo — task entry points.
# Release discipline mirrors learn-content-engine: `publish` is gated on
# `release-check` (lint + typecheck + tests + build) so a red gate blocks
# the publish, never the other way around.
#
# `publish` / `publish-dry` skip any package whose version is already on npm,
# so a partial release (only the package that actually changed bumped) does
# not abort on the unchanged, already-published ones.

.PHONY: install lint typecheck test build release-check publish-dry publish clean help

install:
	npm install

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

build:
	npm run build

release-check: lint typecheck test build
	@echo "release-check passed"

publish-dry: release-check
	@for pkg in passphrase-vault core react; do \
		name=$$(node -p "require('./packages/$$pkg/package.json').name"); \
		ver=$$(node -p "require('./packages/$$pkg/package.json').version"); \
		if npm view "$$name@$$ver" version >/dev/null 2>&1; then \
			echo "skip (already published): $$name@$$ver"; \
		else \
			echo "would publish: $$name@$$ver"; \
			npm publish --dry-run --workspace packages/$$pkg; \
		fi; \
	done

publish: release-check
	@for pkg in passphrase-vault core react; do \
		name=$$(node -p "require('./packages/$$pkg/package.json').name"); \
		ver=$$(node -p "require('./packages/$$pkg/package.json').version"); \
		if npm view "$$name@$$ver" version >/dev/null 2>&1; then \
			echo "skip (already published): $$name@$$ver"; \
		else \
			npm publish --workspace packages/$$pkg; \
		fi; \
	done

clean:
	rm -rf packages/*/dist node_modules packages/*/node_modules

help:
	@grep -E '^[a-z-]+:' Makefile | cut -d: -f1 | sort -u
