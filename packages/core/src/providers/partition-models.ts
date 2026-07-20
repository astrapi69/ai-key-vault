/**
 * partition-models — pure split of a provider's live model list into a
 * curated "recommended" group and the rest, driving a two-group model
 * picker UX.
 *
 * A provider's ``/models`` list comes back in the provider's own order —
 * sensible for some, arbitrary for others (dozens of legacy / embedding /
 * image ids). A small static list of recommended model FAMILIES (matched as
 * id prefixes, newest-dated variant wins) pulls the same 2-3 good models to
 * the top for every provider. The families come from
 * {@link AiProviderDescriptor.recommendedModels}.
 *
 * Prefixes (not exact ids) on purpose: provider APIs return dated variants
 * (``claude-sonnet-4-20250514``, ``gpt-4o-mini-2024-07-18``) and the family
 * should match regardless of the date suffix. Order matters: more specific
 * prefixes (``gpt-4o-mini``) must precede the families they are a prefix of
 * (``gpt-4o``) so each model is claimed by its most specific family.
 */

/** Minimal shape the partition needs from a model entry. */
export interface ModelLike {
    id: string;
}

export interface PartitionedModels<T extends ModelLike> {
    /** Up to one model per recommended family, in the curated order. */
    recommended: T[];
    /** Everything else, in the provider's original order. */
    rest: T[];
}

/**
 * Split ``models`` into a curated "recommended" group (one model per family,
 * newest match per family) and the rest.
 *
 * Each model is owned by the FIRST (most specific) family it matches, so a
 * ``gpt-4o-mini`` variant can never be mis-claimed by the broader ``gpt-4o``
 * family. Falls back to the original "first 3" heuristic when NO model
 * matches any family (an unexpected provider id scheme), so the recommended
 * group is never empty when models exist.
 */
export function partitionModels<T extends ModelLike>(
    families: readonly string[],
    models: readonly T[],
): PartitionedModels<T> {
    const owningFamily = (id: string): number => {
        for (let i = 0; i < families.length; i++) {
            if (id.startsWith(families[i])) return i;
        }
        return -1;
    };
    const recommended: T[] = [];
    for (let i = 0; i < families.length; i++) {
        // Among the models OWNED by family i, prefer the newest variant
        // (lexically-largest id).
        let best: T | null = null;
        for (const m of models) {
            if (owningFamily(m.id) !== i) continue;
            if (best === null || m.id > best.id) best = m;
        }
        if (best) recommended.push(best);
    }
    const recommendedIds = new Set(recommended.map((m) => m.id));
    const rest = models.filter((m) => !recommendedIds.has(m.id));
    if (recommended.length === 0 && models.length > 0) {
        return { recommended: models.slice(0, 3), rest: models.slice(3) };
    }
    return { recommended, rest };
}
