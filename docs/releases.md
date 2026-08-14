# Releases

DocGen uses one repository-wide semantic version. The initial version is
recorded in [`VERSION`](../VERSION) as `0.1.0`; release tags use the `v`
prefix, for example `v0.1.1`. Packages are not published independently.

## Version policy

The release workflow inspects commits merged to `main` after the newest
release tag:

- breaking conventional commits (`feat!:` or `BREAKING CHANGE`) increment the
  major version;
- `feat:` commits increment the minor version;
- `fix:` and all other merged changes increment the patch version.

If there are no commits after the newest tag, no release is created. A commit
that does not use conventional-commit syntax still receives a patch release
when it is the only change in the range.

## Automated procedure

`.github/workflows/release.yml` runs after a successful `CI` workflow on
`main`. It checks out the exact commit verified by CI, calculates the next
version, creates an annotated tag, and asks GitHub to generate release notes
from the merged pull requests and commits. The workflow has `contents: write`
only because tag and release creation require it; it does not publish packages
or deploy applications.

The workflow is safe to rerun. It serializes release jobs, checks for an
existing release before writing, and reuses an existing tag if a previous run
stopped after pushing the tag but before creating the release. A manual run is
available from the Actions tab and requires explicitly confirming that the
current `main` commit should be released.

## Recovery and rollback

If a release job fails, inspect whether the tag or GitHub Release was created
before rerunning it. Do not delete a published release to correct its notes;
edit the release description or publish a follow-up patch release. If a tag was
created without a release, rerun the workflow so it can finish the release.

To roll back an application consumer, use the prior version tag. GitHub tags
and releases are historical records and are not rewritten by this workflow.
