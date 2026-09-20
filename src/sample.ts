/**
 * What the page holds when it opens. Small enough to read at a glance and
 * wide enough to show what the notation is for: two classes in a system, a
 * reference between them, an enum, a comment, a doubt, and inheritance.
 */
export const SAMPLE = `Character @Catalog     # Someone in the films
    id*
    name
    homeworld: Planet
    species: human|droid|wookiee   ? More?

Planet @Catalog
    id*
    name
    climate: arid|temperate|frozen

Jedi < Character
    rank: padawan|knight|master
`;
