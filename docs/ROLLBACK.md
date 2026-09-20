# Rolling the live site back

Every version that was published has a tag, `live/vNN`, put there by the `pages`
workflow after it confirmed the live page reports that version. Publishing a tag
again is a rollback.

## When

Only for a blocker: she cannot work at all. The page will not load, a file will
not process, the download fails. Anything less waits for a normal fix. During a
freeze before a client session this is the only deploy allowed.

Roll back first, diagnose second.

## How

```
git ls-remote --tags origin "refs/tags/live/*"      # what can be published
gh workflow run pages.yml -f ref=live/v49            # publish that version
gh run watch                                         # build, deploy, verify
```

The run builds the site from the tag, runs the browser checks against it, deploys
it, and then fails unless the live page and the service worker both report `v49`.

## What she sees

Her browser fetches `sw.js` fresh on the next visit. Its contents differ, so the
browser installs it as a new service worker, which deletes the other version's
cache and serves the rolled-back files. One refresh is enough. Her saved cases are
in `localStorage` and are not touched.

A case profile written by a newer version is read by an older one as long as the
profile format has not changed; the format is version 1 in every release so far.

## After

`main` still holds the bad commit, so the next push to main would publish it
again. Revert it on a branch, through a PR, before anything else is merged:

```
git revert <bad-commit>     # or the merge commit, with -m 1
```

## What this does not do

It does not undo anything in her browser beyond the app files: a case she saved
with the bad version stays saved. If the bad version wrote something harmful into
a case profile, that needs its own fix.
