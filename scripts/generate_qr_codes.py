#!/usr/bin/env python3
"""Generate every published Student SOP QR code from data/manifest.json."""

from __future__ import annotations

import json
from pathlib import Path

import qrcode
from qrcode.image.svg import SvgPathImage


ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "data" / "manifest.json"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def student_visible(tool: dict, modes: list[str], publication_mode: str) -> bool:
    if "student" not in modes:
        return False
    if tool.get("sourceAccess") == "teacher-only":
        return False
    if tool.get("studentVisible") is False:
        return False
    if tool.get("student", {}).get("summaryStatus") != "curated":
        return False

    approval = tool.get("local", {}).get("studentUseApproved")
    if approval is False:
        return False
    if publication_mode == "approved-only" and approval is not True:
        return False
    return True


def main() -> None:
    manifest = load_json(MANIFEST_PATH)
    site = manifest.get("site", {})
    base_url = str(site.get("publicBaseUrl", "")).rstrip("/") + "/"
    publication_mode = (
        "approved-only"
        if site.get("studentPublicationMode") == "approved-only"
        else "curated-drafts"
    )
    output_dir = ROOT / site.get("qrCodeDirectory", "assets/qrcodes/student")
    output_dir.mkdir(parents=True, exist_ok=True)

    entries: list[dict] = []
    seen_ids: set[str] = set()

    datasets = sorted(
        (item for item in manifest.get("datasets", []) if item.get("enabled") is not False),
        key=lambda item: item.get("order", 1000),
    )

    for dataset in datasets:
        modes = dataset.get("modes", ["student", "teacher"])
        if "student" not in modes:
            continue

        data = load_json(ROOT / "data" / dataset["file"])
        department = data["department"]
        for tool in data.get("tools", []):
            if not student_visible(tool, modes, publication_mode):
                continue

            tool_id = tool["id"]
            if tool_id in seen_ids:
                raise ValueError(f"Duplicate tool id: {tool_id}")
            seen_ids.add(tool_id)

            slug = tool.get("slug") or tool_id
            url = f"{base_url}#/{department['id']}/{slug}"
            file_name = f"{tool_id}.svg"
            approved = (
                tool.get("local", {}).get("reviewed") is True
                and tool.get("local", {}).get("studentUseApproved") is True
            )

            qr = qrcode.QRCode(
                version=None,
                error_correction=qrcode.constants.ERROR_CORRECT_M,
                box_size=10,
                border=4,
            )
            qr.add_data(url)
            qr.make(fit=True)
            image = qr.make_image(image_factory=SvgPathImage)
            image.save(output_dir / file_name)

            entries.append(
                {
                    "id": tool_id,
                    "department": department["id"],
                    "name": tool["name"],
                    "url": url,
                    "file": f"{site.get('qrCodeDirectory', 'assets/qrcodes/student')}/{file_name}",
                    "approved": approved,
                }
            )

    expected_files = {f"{entry['id']}.svg" for entry in entries}
    for qr_file in output_dir.glob("*.svg"):
        if qr_file.name not in expected_files:
            qr_file.unlink()

    with (output_dir / "index.json").open("w", encoding="utf-8") as handle:
        json.dump(entries, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    print(f"Generated {len(entries)} Student SOP QR codes in {output_dir.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
