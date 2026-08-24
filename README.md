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
| `data/reference/*.json` | RAMS-derived safety-awareness datasets with explicit local-review status |
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
"studentPublicationMode": "all-sops"
```

Every enabled SOP is accessible in Student view for safety awareness. No Student SOP is labelled as a draft or hidden because local review is pending.

Accessibility is not permission to operate equipment or carry out a process. Restricted records are prominently labelled `REFERENCE ONLY • STUDENTS DO NOT OPERATE`; records with age, maturity, training or supervision limits are labelled `TEACHER PERMISSION REQUIRED`.

To approve a record after a local equipment/RAMS review, update its `local` object:

```json
"local": {
  "reviewed": true,
  "studentUseApproved": true
}
```

Do not mark records approved solely because they are accessible. Approval should follow the school's normal local review process for the actual equipment, room, students, supervision and current requirements.

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

The validator checks dataset paths, IDs, routes, Student access and wording, referenced images, PPE keys/icons, section icons, QR coverage, the QR index, legacy terminology and repository structure.

## Safety and source note

Student summaries support teaching and do not authorise equipment use. Teacher instruction, training, permission, supervision, machine-specific controls, manufacturer information, safety data sheets, school procedures and current New Zealand requirements remain authoritative.

Legacy RAMS/source extracts are retained as historical provenance. Active Teacher controls should use current New Zealand guidance. For respiratory hazards, eliminate or minimise exposure with effective engineering controls such as LEV/on-tool extraction before relying on RPE. Where RPE is required, select and use it under AS/NZS 1715:2009, use devices complying with AS/NZS 1716:2012, fit-test tight-fitting RPE, seal-check it each use, and account for facial hair or other factors that prevent an effective seal.
