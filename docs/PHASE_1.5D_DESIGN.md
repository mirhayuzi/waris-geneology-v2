# Phase 1.5D — Relationship Taxonomy

## Goal
Compute specific Malay kinship labels (Datuk Saudara, Biras, 3 Pupu, Ipar Saudara, etc.) for any two family members. Replace generic mahram labels with culturally accurate terms.

## Architecture
- `lib/relationships.ts` — graph traversal + label resolution
- `lib/__tests__/relationships.test.ts` — test cases
- `lib/mahram.ts` — modified to consume relationship labels
- `app/(tabs)/tools/mahram-checker.tsx` — modified to show both perspectives

## API

```typescript
export function getRelationships(
  personA: string,
  personB: string,
  family: FamilyData
): RelationshipResult;

export type RelationshipResult = {
  aToB: RelationshipLabel[];   // all applicable, primary first
  bToA: RelationshipLabel[];
  primary?: { aToB: RelationshipLabel; bToA: RelationshipLabel };
};

export type RelationshipLabel = {
  category: 'core' | 'darah' | 'saudara' | 'perkahwinan' | 'tiri' | 'angkat';
  labelBm: string;             // "Datuk sebelah ibu"
  side?: 'sebelah_ibu' | 'sebelah_bapa' | null;
  degree?: number;             // 1=sepupu, 2=dua pupu, 3=tiga pupu, 4=empat pupu
  via?: string;                // member ID for traversal path (biras, ipar saudara)
};
```

## Design decisions
- **Scope**: full taxonomy (~40 labels) across 4 chunks
- **Multiple labels**: show ALL applicable, primary first (blood beats marriage)
- **Direction**: both perspectives returned in one call (`aToB` = "A is B's ___", `bToA` = "B is A's ___")
- **Side suffix**: applies to datuk/nenek/pakcik/makcik (where culturally relevant)
- **Performance**: on-demand computation (fine for 61-member dataset)
- **API & category tweaks pending**: user wanted to refine but didn't specify — TBD when revisited

## Chunking plan
- **Chunk 1** (this): skeleton + ~10 direct labels (parent/child/sibling/spouse, ancestors/descendants 2 levels)
- **Chunk 2**: sideling labels (pakcik, sepupu, pupu 1-4, datuk saudara, anak saudara, cucu saudara)
- **Chunk 3**: in-law expansion (biras, ipar saudara, besan) + tiri labels
- **Chunk 4**: integrate with mahram.ts, update UI to show both perspectives + all labels, ship Phase 1.5D APK

## Full 40-label taxonomy
[Include the categorized list of all 40 labels with their detection rules — copy from session notes]

## Test plan
Minimum 40 cases — one per label + edge cases (multi-marriage, half-siblings, deceased relations, missing data).
