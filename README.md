# Pukekohe High School Technology Safety Hub

A static, data-driven GitHub Pages site containing concise Student SOPs, fuller Teacher SOP/RAMS references, direct machine links and printable QR labels.

Live site: <https://pukekohetech.github.io/techsop/>

## Repository structure

| Path | Purpose |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | Main Student/Teacher Safety Hub interface |
| `qr-labels.html`, `qr-labels.js`, `qr-labels.css` | Printable Student SOP QR-label page |
| `data/manifest.json` | Enabled datasets, display order, public URL and publication settings |
| `data/departments/*.json` | Department SOP records |
| `data/reference/*.json` | Teacher-only reference datasets |
| `data/shared-definitions.json` | PPE/preparation icons, section icons, hazard types and fallback symbols |
| `assets/images/` | Tool, machine and activity WebP images |
| `assets/icons/ppe/` | PPE and preparation icons |
| `assets/icons/sections/` | Hazards, before-start, safe, unsafe and stop icons |
| `assets/qrcodes/student/` | Generated Student SOP QR SVGs and `index.json` |
| `scripts/` | QR generation and repository validation tools |

Only the files referenced through `data/manifest.json` are active datasets. Do not add department JSON files to the repository root.

## Student publication setting

`data/manifest.json` contains:

```json
"studentPublicationMode": "curated-drafts"
```

- `curated-drafts` preserves the current site behaviour: curated summaries appear with a visible draft/review-pending badge unless locally approved.
- `approved-only` publishes only records where both local review and student approval have been recorded.

To approve a record after a local equipment/RAMS review, update its `local` object:

```json
"local": {
  "reviewed": true,
  "studentUseApproved": true
}
```

Do not mark records approved solely to remove a draft badge. Approval should follow the school's normal local review process for the actual equipment, room, students, supervision and current requirements.

## Generate QR codes

After changing a Student SOP ID, slug, department, visibility, approval status or public URL:

```bash
python -m pip install -r scripts/requirements.txt
python scripts/generate_qr_codes.py
```

This regenerates the complete QR collection and removes obsolete QR SVGs.

## Validate before uploading

Run:

```bash
node scripts/validate.mjs
```

The validator checks dataset paths, IDs, routes, referenced images, PPE keys/icons, section icons, QR coverage, the QR index and repository structure. Draft-approval notices are warnings; missing assets and broken structure are errors.

## Safety and source note

Student summaries support teaching and do not authorise equipment use. Teacher instruction, training, permission, supervision, machine-specific controls, manufacturer information, safety data sheets, school procedures and current New Zealand requirements remain authoritative.
