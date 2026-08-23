# Updating the TechSOP GitHub repository

## Recommended method: GitHub Desktop

1. Keep the downloaded ZIP as your backup copy.
2. Open GitHub Desktop and clone `pukekohetech/techsop` if it is not already on the computer.
3. Close any editor that currently has the repository open.
4. Extract this ZIP to a temporary folder.
5. Copy everything from the extracted folder into the local `techsop` repository folder, allowing files to be replaced.
6. Delete these three obsolete files from the local repository root if they are still present:
   - `building.json`
   - `food.json`
   - `shared-definitions.json`
7. Confirm that `assets/qrcodes/student/` contains QR `.svg` files and `index.json`, but no `.webp` machine images.
8. In GitHub Desktop, inspect the changed-files list. It should show replacements, new icon/script files and the intended deletions.
9. Use the commit message: `Clean SOP structure, repair QR codes and add WebP icons`.
10. Commit to `main`, then select **Push origin**.
11. Wait approximately 2–10 minutes for GitHub Pages to refresh.
12. Open <https://pukekohetech.github.io/techsop/> in a private/incognito tab and complete the checks below.

## Post-upload checks

- Student mode opens and shows Engineering by default.
- The Building section buttons display their active maroon colour.
- Open an Engineering SOP and confirm the five new section icons appear.
- Confirm PPE uses the new WebP symbols.
- Open Food Technology and test **Blast chiller** and **Tunnel oven** QR previews.
- In Teacher mode, open the QR-label page and confirm it shows 115 labels while publication mode remains `curated-drafts`.
- Print-preview one Student SOP and one QR-label page.
- Confirm draft labels remain visible until the corresponding local reviews are completed.

## If you only use the GitHub website

Uploading files through the website does not automatically delete old files. Upload the extracted files into their matching folders, then manually delete the three obsolete root JSON files and every `.webp` file from `assets/qrcodes/student/`. Do not delete the QR `.svg` files or `index.json`.

GitHub Desktop is strongly recommended for this update because it applies all file replacements and deletions together in one reviewable commit.
