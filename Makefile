# ai-key-vault monorepo — task entry points.
# Release discipline mirrors learn-content-engine: `publish` is gated on
# `release-check` (lint + typecheck + tests + build) so a red gate blocks
# the publish, never the other way around.

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
	npm publish --dry-run --workspace packages/passphrase-vault
	npm publish --dry-run --workspace packages/core
	npm publish --dry-run --workspace packages/react

publish: release-check
	npm publish --workspace packages/passphrase-vault
	npm publish --workspace packages/core
	npm publish --workspace packages/react

clean:
	rm -rf packages/*/dist node_modules packages/*/node_modules

help:
	@grep -E '^[a-z-]+:' Makefile | cut -d: -f1 | sort -u
