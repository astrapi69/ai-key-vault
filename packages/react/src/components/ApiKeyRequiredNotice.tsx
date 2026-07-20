/**
 * ApiKeyRequiredNotice — inline notice + settings link rendered above an
 * AI-gated action button when the active provider has no key, so the user
 * sees the blocker BEFORE clicking (rather than getting an error toast
 * after). Compact mode renders a single line for dense layouts.
 */

import { useAiSettingsContext } from "../context";

export interface ApiKeyRequiredNoticeProps {
    /** Compact one-line layout for tight UI contexts. Default false. */
    compact?: boolean;
    /** Per-feature subject line (e.g. "to analyze conversations"). */
    feature?: string;
    /** Settings link target. Default "/settings?tab=ai". */
    settingsHref?: string;
}

export function ApiKeyRequiredNotice({
    compact = false,
    feature,
    settingsHref = "/settings?tab=ai",
}: ApiKeyRequiredNoticeProps) {
    const { t, Link } = useAiSettingsContext();
    const body = feature
        ? t("ui.api_key.required_with_feature", "API key required {feature}.").replace(
              "{feature}",
              feature,
          )
        : t("ui.api_key.required", "API key required.");
    const settingsLabel = t("ui.api_key.open_settings", "Open Settings");

    if (compact) {
        return (
            <p
                className="api-key-required-compact m-0 mb-2 flex items-center gap-[0.4rem] text-sm text-warning"
                data-testid="api-key-required-notice"
            >
                <span aria-hidden="true">⚠</span>
                <span>{body}</span>
                <Link
                    to={settingsHref}
                    data-testid="api-key-required-link"
                    className="ml-auto text-accent"
                >
                    {settingsLabel} →
                </Link>
            </p>
        );
    }
    return (
        <div
            className="api-key-required-notice mb-3 flex items-start gap-2 rounded-app border border-warning bg-[var(--warning-bg)] px-[0.9rem] py-[0.6rem] text-[0.9rem] text-warning"
            data-testid="api-key-required-notice"
            role="status"
        >
            <span aria-hidden="true" className="mt-0.5 shrink-0">
                ⚠
            </span>
            <div className="flex-1">
                <strong>{body}</strong>{" "}
                <span>
                    {t(
                        "ui.api_key.required_long",
                        "Configure a provider key in Settings to enable this action.",
                    )}
                </span>
                <div className="mt-[0.4rem]">
                    <Link
                        to={settingsHref}
                        data-testid="api-key-required-link"
                        className="font-semibold text-accent underline"
                    >
                        {settingsLabel} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
