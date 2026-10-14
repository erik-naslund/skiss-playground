# Releasing

The site itself needs no release: every push to `main` deploys it (`deploy.yml`). A release is a name for what is deployed: a version in `package.json`, a section in the changelog, and a GitHub Release that carries that section as its notes.

1. Bump the version in `package.json`.
2. Move the `Unreleased` entries in `CHANGELOG.md` under a new `X.Y.Z` heading with today's date and a one-line lead, and add the link references at the foot of the file: point `[Unreleased]` at `compare/vX.Y.Z...HEAD` and add `[X.Y.Z]` as the compare view against the version before it (the first release links its tag).
3. Commit on a branch and merge it to `main` through a pull request with green CI.
4. The tech lead tags the merge commit `vX.Y.Z` and pushes the tag (`git fetch origin main && git tag vX.Y.Z FETCH_HEAD && git push origin vX.Y.Z`), per [skiss ADR-0011](https://github.com/erik-naslund/skiss/blob/main/docs/adr/0011-tech-lead-tags-releases.md). Drafting the release on GitHub (Releases → Draft a new release → create the tag on `main` → Publish) arrives the same way and is the fallback when a push is not possible.
5. The Release workflow (`release.yml`) checks that the tag matches `package.json`, runs `pnpm verify`, and creates the GitHub Release with the changelog section as its notes. A release drafted on GitHub is updated in place rather than duplicated.

Versions stay at `0.x` while the language underneath is: the playground follows `@eriknaslund/skiss`, which is itself still deciding what it is.
