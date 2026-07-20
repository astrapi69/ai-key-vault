/**
 * SecretInput — masked text field for secrets (API keys, tokens) that must
 * NOT trigger the browser password manager / autofill.
 *
 * Why not `type="password"`: a password input invites credential autofill
 * (Chrome, 1Password, LastPass, Bitwarden, Dashlane) — wrong for API keys.
 * This renders a plain `type="text"` input via the injected Input slot,
 * suppresses every known password-manager heuristic, turns off
 * autocorrect/autocapitalize/spellcheck, masks with `-webkit-text-security`,
 * and provides its own show/hide toggle.
 */

import * as React from "react";

import { useAiSettingsContext } from "./context";

/** Attributes that opt the field out of common password managers. Applied
 *  after the caller's props so they always win. */
const AUTOFILL_OPT_OUT = {
    autoComplete: "off",
    autoCorrect: "off",
    autoCapitalize: "off",
    spellCheck: false,
    "data-1p-ignore": "",
    "data-lpignore": "true",
    "data-bwignore": "true",
    "data-form-type": "other",
} as const;

export interface SecretInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
    /** Extra classes for the positioned wrapper around input + toggle. */
    wrapperClassName?: string;
}

/** A `type="text"` secret field with autofill suppressed and a reveal toggle. */
export const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
    ({ className, wrapperClassName, disabled, ...props }, ref) => {
        const { t, Input } = useAiSettingsContext();
        const [revealed, setRevealed] = React.useState(false);
        const toggleLabel = revealed
            ? t("ui.hide_secret", "Hide value")
            : t("ui.show_secret", "Show value");
        const wrapperClass = [
            "akv-secret-input relative flex w-full items-center",
            wrapperClassName,
        ]
            .filter(Boolean)
            .join(" ");
        const inputClass = [
            "pr-11",
            revealed ? "" : "[-webkit-text-security:disc]",
            className,
        ]
            .filter(Boolean)
            .join(" ");

        return (
            <span className={wrapperClass}>
                <Input
                    ref={ref}
                    type="text"
                    disabled={disabled}
                    className={inputClass}
                    {...props}
                    {...AUTOFILL_OPT_OUT}
                />
                <button
                    type="button"
                    onClick={() => setRevealed((value) => !value)}
                    disabled={disabled}
                    aria-label={toggleLabel}
                    aria-pressed={revealed}
                    title={toggleLabel}
                    tabIndex={-1}
                    className="akv-secret-toggle absolute right-2 flex h-7 w-7 items-center justify-center rounded"
                >
                    {revealed ? "🙈" : "👁"}
                </button>
            </span>
        );
    },
);
SecretInput.displayName = "SecretInput";
