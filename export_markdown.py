"""Export every source PDF as cited Markdown from existing page-level corpora."""

import argparse
from collections import defaultdict
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import quote

from prepare_corpus import ROOT, atomic_json


def link_target(target: Path, markdown: Path, page: int | None = None) -> str:
    relative = Path(os.path.relpath(target, markdown.parent)).as_posix()
    return quote(relative, safe="/.-_") + (f"#page={page}" if page is not None else "")


def label(text: str) -> str:
    return re.sub(r"([\\`*{}\[\]<>()!_#|])", r"\\\1", text).replace("\n", " ")


def text_block(text: str) -> str:
    longest = max((len(m[0]) for m in re.finditer(r"`+", text)), default=0)
    fence = "`" * max(3, longest + 1)
    return f"{fence}text\n{text}\n{fence}"


def render_document(document: dict, pages: list[dict], pdf: Path, target: Path) -> str:
    metadata = {
        "document_id": document["document_id"],
        "source_pdf": link_target(pdf, target),
        "page_count": document["page_count"],
        "document_kind": document["document_kind"],
        "legal_status": document["legal_status"],
        "title_source": document["title_source"],
        "warnings": document["warnings"],
    }
    lines = ["---"]
    lines.extend(f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in metadata.items())
    lines.extend([
        "---", "", f"# {label(pdf.stem)}", "",
        f"[Ouvrir le PDF source]({link_target(pdf, target)})", "",
        "> Transcription documentaire, pas un avis juridique. Le titre provient du nom",
        "> du fichier. References, dates, montants et delais doivent etre verifies",
        "> dans le PDF. Un score OCR eleve ne garantit pas leur exactitude.", "",
        f"- Nature documentaire : `{document['document_kind']}`",
        f"- Statut juridique : `{document['legal_status']}`",
        "- Avertissements : " + ", ".join(f"`{w}`" for w in document["warnings"]),
        "- Pagination : pages physiques du PDF, a partir de 1.",
        "- Le texte est conserve dans des blocs pour ne pas interpreter son contenu",
        "  comme du Markdown ou du HTML. Les tableaux restent du texte brut.", "",
        "## Sommaire des pages", "",
    ])
    lines.extend(
        f"- [Page {p['page_number']}](#page-{p['page_number']})" for p in pages
    )
    for page in pages:
        number = page["page_number"]
        lines.extend([
            "", f'<a id="page-{number}"></a>', "", f"## Page {number}", "",
            f"[Source : PDF, page {number}]({link_target(pdf, target, number)})", "",
            f"- Identifiant de citation : `{page['page_id']}`",
            f"- Extraction : `{page['extraction_method']}`",
        ])
        if page["ocr_text"] is not None:
            confidence = page["ocr_mean_word_confidence"]
            score = f"{confidence}/100" if confidence is not None else "indisponible"
            lines.append(f"- Confiance OCR moyenne : {score}")
        if page["warnings"]:
            lines.append("- Controle : " + ", ".join(f"`{w}`" for w in page["warnings"]))
        lines.append("")
        if page["text"]:
            lines.append(text_block(page["text"]))
        else:
            lines.append("> Aucun texte obtenu. Page conservee ; consulter le PDF source.")
    return "\n".join(lines) + "\n"


def read_jsonl(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream]


def export(corpora: list[Path], output: Path, source_base: Path) -> dict:
    output = output.resolve()
    source_base = source_base.resolve()
    exports: list[tuple[dict, list[dict], Path, Path]] = []
    targets: set[Path] = set()
    for corpus in corpora:
        report = json.loads((corpus / "rapport_qualite.json").read_text(encoding="utf-8"))
        source = Path(report["source_directory"])
        documents = read_jsonl(corpus / "documents.jsonl")
        pages = read_jsonl(corpus / "pages.jsonl")
        by_document: dict[str, list[dict]] = defaultdict(list)
        for page in pages:
            by_document[page["document_id"]].append(page)
        ids = {d["document_id"] for d in documents}
        if len(ids) != len(documents) or set(by_document) != ids:
            raise ValueError(f"Duplicate documents or orphan pages in {corpus}")
        for document in documents:
            selected = sorted(by_document[document["document_id"]], key=lambda p: p["page_number"])
            if [p["page_number"] for p in selected] != list(range(1, document["page_count"] + 1)):
                raise ValueError(f"Incomplete or duplicate pages: {document['source_path']}")
            for page in selected:
                expected_id = f"{document['document_id']}:p{page['page_number']:04d}"
                if page["page_id"] != expected_id or page["source_path"] != document["source_path"]:
                    raise ValueError(f"Inconsistent page provenance: {page['page_id']}")
            for alias in document["source_paths"]:
                pdf = (source / alias).resolve()
                relative = pdf.relative_to(source_base)
                with pdf.open("rb") as stream:
                    digest = hashlib.file_digest(stream, "sha256").hexdigest()
                if digest != document["document_id"] or digest != document["sha256"]:
                    raise ValueError(f"PDF changed since extraction: {pdf}")
                # Retaining ".pdf" makes the filename mapping unambiguous, including ".pdf.pdf".
                target = output / relative.parent / (relative.name + ".md")
                if target in targets:
                    raise ValueError(f"Duplicate Markdown target: {target}")
                targets.add(target)
                exports.append((document, selected, pdf, target))
        disk_pdfs = {p.resolve() for p in source.rglob("*.pdf")}
        indexed_pdfs = {(source / p).resolve() for d in documents for p in d["source_paths"]}
        if disk_pdfs != indexed_pdfs:
            raise ValueError(f"Corpus no longer matches the source PDF inventory: {source}")
    if not exports:
        raise ValueError("No documents to export")
    output.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source_pdf_count": len(exports),
        "unique_document_count": len({d["document_id"] for d, _, _, _ in exports}),
        "page_sections": sum(len(pages) for _, pages, _, _ in exports),
        "files": [],
    }
    index = [
        "# Corpus Markdown - Reglementations et publications", "",
        f"{len(exports)} PDF transcrits. Un fichier Markdown par PDF, y compris les copies.", "",
        "Chaque page comporte un lien vers le PDF original et un identifiant de citation.",
        "Les publications, statistiques et appels d'offres ne sont pas presentes comme des lois.",
        "Les extractions OCR et les textes juridiques ne sont pas valides manuellement.", "",
    ]
    groups: dict[str, list[str]] = defaultdict(list)
    with tempfile.TemporaryDirectory(prefix=".markdown-", dir=output.parent) as temporary:
        staging = Path(temporary)
        for document, pages, pdf, target in exports:
            relative = target.relative_to(output)
            staged = staging / relative
            staged.parent.mkdir(parents=True, exist_ok=True)
            staged.write_text(render_document(document, pages, pdf, target), encoding="utf-8")
            manifest["files"].append({
                "markdown_path": relative.as_posix(),
                "source_pdf": pdf.relative_to(source_base).as_posix(),
                "document_id": document["document_id"],
                "page_count": len(pages),
            })
            groups[relative.parent.as_posix()].append(
                f"- [{label(pdf.name)}]({link_target(target, output / 'INDEX.md')})"
                f" - {len(pages)} pages ; `{document['document_kind']}`"
            )
        for group, entries in sorted(groups.items()):
            index.extend([f"## {label(group)}", "", *entries, ""])
        (staging / "INDEX.md").write_text("\n".join(index), encoding="utf-8")
        atomic_json(staging / "manifest.json", manifest)
        for file in sorted(staging.rglob("*")):
            if file.is_file():
                destination = output / file.relative_to(staging)
                destination.parent.mkdir(parents=True, exist_ok=True)
                file.replace(destination)
    print(json.dumps({k: v for k, v in manifest.items() if k != "files"}), flush=True)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--corpus", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path, default=ROOT / "donnees/markdown")
    parser.add_argument("--source-base", type=Path, default=ROOT / "Reglementations")
    args = parser.parse_args()
    export(args.corpus, args.output, args.source_base)


if __name__ == "__main__":
    main()
