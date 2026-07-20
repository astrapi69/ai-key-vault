/**
 * AiProviderError — the package's transport/provider failure type.
 *
 * Replaces the consuming app's HTTP error class at the package boundary:
 * carries the HTTP status, a human-readable detail (already prefixed with
 * the provider label) and the provider id, so a consumer can map it onto
 * its own error/toast plumbing without string-parsing.
 */
export class AiProviderError extends Error {
    /** HTTP-ish status code (502 for provider-shape failures). */
    readonly status: number;
    /** Provider id the failure belongs to ("" when not provider-specific). */
    readonly provider: string;

    constructor(status: number, message: string, provider = "") {
        super(message);
        this.name = "AiProviderError";
        this.status = status;
        this.provider = provider;
    }
}
