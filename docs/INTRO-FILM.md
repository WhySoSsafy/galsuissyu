# Opening film

`IntroCurtain` looks for these two files in `public/film/`. The component draws an animated
placeholder whenever the video is missing or a browser refuses to play it.

| File | What it is |
|---|---|
| `intro.mp4` | The opening film. H.264 in MP4 plays everywhere. |
| `intro-poster.jpg` | First frame, shown while the video loads. Optional. |

Drop them in `public/film/` and they are used automatically — no code change. The call to action
appears on the video's own `ended` event, so keep it short; under twenty seconds is plenty, and it
can always be skipped.

They are deliberately not under `public/assets/`: that path is served `immutable` for a year for
Vite's content-hashed bundles, and these two names never change. A visitor who loaded the site
before the film shipped would hold a year-long cache entry pointing at the wrong bytes.

It is heard. A page nobody has touched may not make noise, so the film waits behind a press — and
that press is the gesture the browser wants, which is what lets its own audio play. Keep the sound,
but do not depend on it: captions still carry the story for anyone who mutes it or whose browser
refuses anyway.

Subject, from the brief: a family travelling together in Daejeon, including the members who usually
get left at home — an older parent, someone using a wheelchair, a stroller — reaching a place
because the route was known in advance.
