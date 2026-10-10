# Rolling the live site back

## What the address serves now

Since 6.10.2026 the tool lives at https://inkognito.co.il/ (the owner's decision).
Its old address, https://ombed.github.io/inkognito/, serves the forward that
`scripts/build-forward.js` builds from main (`forward/`):

- `index.html`, the moved page. With nothing saved in the browser it sends the
  visitor straight to inkognito.co.il. With saved cases it offers them as one file,
  to import there with «ייבוא תיקים מקובץ», and a link to sign up.
- `404.html`, the same page, so an old deep link lands on it too.
- `sw.js`, which replaces the tool's service worker, deletes the tool's caches
  (`hedact-vNN`) and the model (`transformers-cache`), reloads the open windows and
  removes itself. It never touches `localStorage`: her saved cases stay.

The `pages` workflow publishes the forward whenever the ref it builds has
`scripts/build-forward.js`, after `e2e/moved.spec.js` passes against the built
folder. It then fails unless the live page carries
`<meta name="inkognito" content="moved">`, the live `sw.js` is `forward/sw.js` byte
for byte, and an old deep link lands on the moved page. The forward has no version
and gets no tag: versions and `live/vNN` tags now belong to the inkognito.co.il
deploys, which have their own process.

Every version of the tool that was published here before the move has a tag,
`live/vNN`, put there by the `pages` workflow after it confirmed the live page
reported that version; the last is `live/v62`. Those tags have no
`scripts/build-forward.js`, so publishing one again builds and publishes the tool
from it, exactly as before the move. That is a rollback.

## When

Only for a blocker. Before the move: she cannot work at all (the page will not
load, a file will not process, the download fails). Now also: the moved page does
not load or its file does not download, so she cannot take the cases along. Then
publish the last tool tag, and the old address serves the tool again until the
forward is fixed. Anything less waits for a normal fix. During a freeze before a
user session this is the only deploy allowed.

Roll back first, diagnose second.

## How

```
git ls-remote --tags origin "refs/tags/live/*"      # what can be published
gh workflow run pages.yml -f ref=live/v62            # publish that version of the tool
gh run watch                                         # build, deploy, verify
```

The run builds the site from the tag, runs the browser checks against it, deploys
it, and then fails unless the live page and the service worker both report `v62`.

To serve the forward again, publish main: `gh workflow run pages.yml` with no
`ref`, or let the next push to main do it. That run checks the live address as
described above, and makes no tag.

## What she sees

Rolling back to the tool: her browser fetches `sw.js` fresh on the next visit. Its
contents differ, so the browser installs it as a new service worker, which serves
the rolled-back files. One refresh is enough. If the forward's worker already ran,
the tool's files and the model are no longer cached: the tool downloads its files
again, and the model again (about 185MB) the next time it is used. Her saved cases
are in `localStorage` and are not touched, by the rollback or by the forward.

Publishing the forward (again): the next visit gets the moved page. The forward's
worker takes over from the tool's, deletes the tool's caches and the model, reloads
the open windows and removes itself. Her saved cases stay, and the moved page offers
them as one file.

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
a case profile, that needs its own fix. It does not touch inkognito.co.il either.
