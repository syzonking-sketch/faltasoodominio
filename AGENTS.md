<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the installable PWA manifest and its screenshots/icons as static `public/` files so all assets resolve on Netlify and Lovable; do not add an app-shell service worker without an offline requirement.
- Keep shared brand and field imagery under `public/` with file extensions matching their actual formats, and use local root-relative URLs; Netlify does not serve Lovable's `/__l5e/assets-v1/` routes.
- Decode iPhone HEIC/HEIF photos in the browser before existing WebP compression; storage accepts only the compressed WebP, avoiding unsupported uploads.
