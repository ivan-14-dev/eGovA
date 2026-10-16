"""Build a local, page-addressable legal corpus without changing source PDFs."""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unicodedata


ROOT = Path(__file__).resolve().parent
PIPELINE_VERSION = "1"
MIN_NATIVE_CHARACTERS = 250
MIN_OCR_CONFIDENCE = 80
CATEGORIES = {
    "Arrete": "arrete",
    "Décret": "decret",
    "Lois": "loi",
    "decision": "decision",
    "directives": "directive_ou_document_technique",
    "recueil de texte": "recueil",
    "rapport et étude": "recueil",
    "communiqué": "communique",
    "Appel d'offre": "appel_offres_ou_consultation",
    "Nouvelle de l'ART": "bulletin_information",
    "observatoire": "statistiques",
    "rapports": "rapport",
}
STATISTICS = {
    "RECUEIL20122013finalàDCCjuillet2016.pdf",
    "Recueil-statistique-2007-2011-copie-DCC-juillet-2016.pdf",
}


def run(
    command: list[str], env: dict[str, str] | None = None,
    combine_output: bool = False,
) -> str:
    result = subprocess.run(
        command, stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT if combine_output else subprocess.PIPE,
        text=True, env=env, timeout=300,
        encoding="utf-8", errors="replace",
    )
    if result.returncode:
        raise RuntimeError(f"Command failed: {command!r}\n{result.stderr}")
    if result.stderr and result.stderr.strip():
        print(f"TOOL WARNING ({command[0]}): {result.stderr.strip()}", flush=True)
    return result.stdout


def clean_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text).replace("\r\n", "\n")
    text = text.replace("\x00", "").replace("\x0c", "")
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def character_count(text: str) -> int:
    return len(re.sub(r"\s", "", text))


def split_pages(text: str, expected: int) -> list[str]:
    pages = text.split("\x0c")
    if len(pages) > 1 and not pages[-1].strip():
        pages.pop()
    if len(pages) != expected:
        raise ValueError(f"Expected {expected} PDF pages, got {len(pages)}")
    return [clean_text(page) for page in pages]


def needs_ocr(text: str) -> bool:
    # Sparse text can consist solely of headers over a scanned page.
    return character_count(text) < MIN_NATIVE_CHARACTERS


def ocr_confidence(tsv: str) -> float | None:
    values = []
    for row in csv.DictReader(io.StringIO(tsv), delimiter="\t", quoting=csv.QUOTE_NONE):
        if row.get("level") == "5" and row.get("text", "").strip():
            value = float(row["conf"])
            if value >= 0:
                values.append(value)
    return round(sum(values) / len(values), 2) if values else None


def atomic_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8",
    )
    temporary.replace(path)


def ocr_environment() -> tuple[str, dict[str, str], list[str]]:
    env = dict(os.environ)
    env["OMP_THREAD_LIMIT"] = "1"
    local = ROOT / ".tools/tesseract/usr"
    binary = local / "bin/tesseract"
    extra: list[str] = []
    if binary.exists():
        libraries = str(local / "lib/x86_64-linux-gnu")
        env["LD_LIBRARY_PATH"] = libraries + (
            ":" + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else ""
        )
        extra = ["--tessdata-dir", str(local / "share/tesseract-ocr/5/tessdata")]
        executable = str(binary)
    else:
        executable = shutil.which("tesseract") or ""
    if not executable:
        raise RuntimeError("Install tesseract-ocr, tesseract-ocr-fra and tesseract-ocr-eng.")
    languages = run([executable, *extra, "--list-langs"], env).splitlines()
    if not {"fra", "eng"}.issubset(set(languages)):
        raise RuntimeError("Tesseract requires both fra and eng language models.")
    return executable, env, extra


def extract_ocr(
    pdf: Path, page: int, dpi: int,
    engine: tuple[str, dict[str, str], list[str]],
) -> tuple[str, float | None]:
    executable, env, extra = engine
    with tempfile.TemporaryDirectory(prefix="legal-corpus-") as temporary:
        prefix = Path(temporary) / "page"
        run([
            "pdftoppm", "-f", str(page), "-l", str(page), "-singlefile",
            "-r", str(dpi), "-gray", str(pdf), str(prefix),
        ])
        run([
            executable, str(prefix.with_suffix(".pgm")), str(prefix),
            *extra, "-l", "fra+eng", "--psm", "3", "txt", "tsv",
        ], env)
        text = clean_text(prefix.with_suffix(".txt").read_text(encoding="utf-8"))
        confidence = ocr_confidence(
            prefix.with_suffix(".tsv").read_text(encoding="utf-8"),
        )
        return text, confidence


def page_record(
    document_id: str, source_path: str, page: int, native: str,
    ocr: str | None = None, confidence: float | None = None,
) -> dict:
    warnings = []
    method = "native"
    text = native
    if ocr is not None:
        method = "ocr"
        text = ocr
        warnings.append("ocr_non_revu")
        if confidence is None or confidence < MIN_OCR_CONFIDENCE:
            warnings.append("confiance_ocr_faible")
        if character_count(ocr) < character_count(native):
            text = native
            method = "native_after_ocr"
            warnings.append("ocr_moins_complet_texte_natif_conserve")
    if character_count(text) < MIN_NATIVE_CHARACTERS:
        warnings.append("contenu_limite_a_verifier")
    return {
        "schema_version": PIPELINE_VERSION,
        "page_id": f"{document_id}:p{page:04d}",
        "document_id": document_id,
        "source_path": source_path,
        "page_number": page,
        "text": text,
        "native_text": native if ocr is not None else None,
        "ocr_text": ocr,
        "extraction_method": method,
        "character_count": character_count(text),
        "ocr_mean_word_confidence": confidence,
        "requires_review": bool(warnings),
        "warnings": warnings,
    }


def document_record(pdf: Path, source: Path, digest: str) -> dict:
    relative = pdf.relative_to(source).as_posix()
    kind = CATEGORIES.get(pdf.parent.name, "non_classe")
    warnings = ["validite_juridique_non_verifiee"]
    if pdf.name in STATISTICS:
        kind = "statistiques"
    elif pdf.name == "DEFINITIONS-DES-PARAMETRES-TECHNIQUES-Directives.pdf":
        kind = "guide_technique"
    status = "non_verifie"
    if pdf.name.startswith(("Projet_decision_", "Projet-")):
        status = "projet_a_verifier"
        warnings.append("ne_pas_presenter_comme_texte_adopte")
    return {
        "schema_version": PIPELINE_VERSION,
        "document_id": digest,
        "sha256": digest,
        "source_path": relative,
        "source_paths": [relative],
        "display_title": pdf.name.removesuffix(".pdf").removesuffix(".pdf"),
        "title_source": "nom_de_fichier_non_verifie",
        "category": pdf.parent.name,
        "document_kind": kind,
        "official_title": None,
        "official_reference": None,
        "publication_date": None,
        "issuing_authority": None,
        "official_source_url": None,
        "legal_status": status,
        "metadata_status": "a_completer_et_verifier",
        "warnings": warnings,
    }


def process_page(
    record: dict, native: str, page: int, source: Path, cache: Path,
    dpi: int, engine: tuple[str, dict[str, str], list[str]],
) -> dict:
    cache_file = cache / record["document_id"] / f"{page:04d}.json"
    if cache_file.exists():
        cached = json.loads(cache_file.read_text(encoding="utf-8"))
        if (
            cached["document_id"] != record["document_id"]
            or cached["page_number"] != page
            or cached["native_text"] != native
        ):
            raise ValueError(f"Cache does not match source page: {cache_file}")
        return {**cached, "source_path": record["source_path"]}
    text, confidence = extract_ocr(source / record["source_path"], page, dpi, engine)
    result = page_record(
        record["document_id"], record["source_path"], page, native, text, confidence,
    )
    atomic_json(cache_file, result)
    return result


def write_jsonl(path: Path, records: list[dict]) -> None:
    with path.open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False) + "\n")


def build(
    source: Path, output: Path, workers: int, dpi: int,
    cache_root: Path | None = None,
) -> None:
    for tool in ("pdfinfo", "pdftotext", "pdftoppm"):
        if not shutil.which(tool):
            raise RuntimeError(f"Missing tool: {tool}. Install poppler-utils.")
    engine = ocr_environment()
    versions = {
        "tesseract": run([engine[0], "--version"], engine[1]).splitlines()[0],
        "pdftotext": run(["pdftotext", "-v"], combine_output=True).splitlines()[0],
    }
    pdfs = sorted(source.rglob("*.pdf"))
    if not pdfs:
        raise ValueError(f"No PDF files found in {source}")
    documents: dict[str, dict] = {}
    for pdf in pdfs:
        with pdf.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest in documents:
            documents[digest]["source_paths"].append(pdf.relative_to(source).as_posix())
        else:
            documents[digest] = document_record(pdf, source, digest)
    output.mkdir(parents=True, exist_ok=True)
    # Engine/configuration changes invalidate OCR caches.
    config = {
        "pipeline": PIPELINE_VERSION, "dpi": dpi, "languages": "fra+eng",
        "psm": 3, "native_threshold": MIN_NATIVE_CHARACTERS, "versions": versions,
    }
    fingerprint = hashlib.sha256(
        json.dumps(config, sort_keys=True).encode("utf-8"),
    ).hexdigest()[:16]
    cache = (cache_root if cache_root is not None else output / ".cache") / fingerprint
    pages: dict[tuple[str, int], dict] = {}
    jobs: list[tuple[dict, str, int]] = []
    for index, record in enumerate(documents.values(), 1):
        pdf = source / record["source_path"]
        info = run(["pdfinfo", str(pdf)])
        match = re.search(r"^Pages:\s+(\d+)", info, re.MULTILINE)
        if match is None:
            raise ValueError(f"Missing page count: {pdf}")
        record["page_count"] = int(match[1])
        text = run(["pdftotext", "-layout", str(pdf), "-"])
        native_pages = split_pages(text, record["page_count"])
        if len(record["source_paths"]) > 1:
            record["warnings"].append("doublons_binaires_regroupes")
        if any("Loi_2013-013_" in name for name in record["source_paths"]):
            record["warnings"].append("alias_2013_incorrect_contenu_loi_2010_013")
        for number, native in enumerate(native_pages, 1):
            if needs_ocr(native):
                jobs.append((record, native, number))
            else:
                pages[(record["document_id"], number)] = page_record(
                    record["document_id"], record["source_path"], number, native,
                )
        print(f"Native {index}/{len(documents)}: {record['source_path']}", flush=True)
    print(f"OCR: {len(jobs)} pages, {workers} workers, {dpi} DPI", flush=True)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(process_page, doc, native, number, source, cache, dpi, engine):
            (doc["document_id"], number)
            for doc, native, number in jobs
        }
        for completed, future in enumerate(as_completed(futures), 1):
            key = futures[future]
            pages[key] = future.result()
            if completed % 25 == 0 or completed == len(jobs):
                print(f"OCR {completed}/{len(jobs)}", flush=True)
    ordered_pages = []
    for record in documents.values():
        doc_pages = [
            pages[(record["document_id"], number)]
            for number in range(1, record["page_count"] + 1)
        ]
        ordered_pages.extend(doc_pages)
        record["ocr_page_count"] = sum(p["ocr_text"] is not None for p in doc_pages)
        record["review_page_count"] = sum(p["requires_review"] for p in doc_pages)
        record["empty_page_count"] = sum(not p["text"] for p in doc_pages)
    report = {
        "schema_version": PIPELINE_VERSION,
        "completed_at_utc": datetime.now(timezone.utc).isoformat(),
        "source_directory": str(source),
        "configuration": config,
        "source_pdf_count": len(pdfs),
        "unique_document_count": len(documents),
        "duplicate_file_count": len(pdfs) - len(documents),
        "page_count": len(ordered_pages),
        "ocr_page_count": len(jobs),
        "extraction_methods": dict(Counter(p["extraction_method"] for p in ordered_pages)),
        "page_warning_counts": dict(Counter(w for p in ordered_pages for w in p["warnings"])),
        "empty_page_count": sum(not p["text"] for p in ordered_pages),
        "duplicates": [d["source_paths"] for d in documents.values() if len(d["source_paths"]) > 1],
        "limitations": [
            "Aucune verification juridique ni consolidation des textes modifies.",
            "Les metadonnees issues des noms de fichiers ne font pas autorite.",
            "Une confiance OCR elevee ne garantit pas les references, montants ou delais.",
            "La detection OCR par densite peut manquer des pages partiellement scannees.",
            "Les pages PDF ne correspondent pas toujours aux numeros imprimes.",
            "Tableaux, colonnes et ordre de lecture doivent etre controles visuellement.",
        ],
    }
    # Publish exports only after every page was processed successfully.
    with tempfile.TemporaryDirectory(prefix=".export-", dir=output) as staging:
        stage = Path(staging)
        write_jsonl(stage / "documents.jsonl", list(documents.values()))
        write_jsonl(stage / "pages.jsonl", ordered_pages)
        fields = [
            "document_id", "display_title", "category", "document_kind", "source_path",
            "source_paths", "page_count", "ocr_page_count", "review_page_count",
            "empty_page_count", "official_title", "official_reference", "publication_date",
            "issuing_authority", "official_source_url", "legal_status", "metadata_status",
            "warnings",
        ]
        with (stage / "catalogue.csv").open("w", encoding="utf-8-sig", newline="") as stream:
            writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for record in documents.values():
                writer.writerow({
                    **record,
                    "source_paths": json.dumps(record["source_paths"], ensure_ascii=False),
                    "warnings": json.dumps(record["warnings"], ensure_ascii=False),
                })
        atomic_json(stage / "rapport_qualite.json", report)
        for name in ("documents.jsonl", "pages.jsonl", "catalogue.csv", "rapport_qualite.json"):
            (stage / name).replace(output / name)
    print(json.dumps({k: report[k] for k in (
        "unique_document_count", "page_count", "ocr_page_count", "empty_page_count",
    )}), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=ROOT / "Reglementations/reglementation")
    parser.add_argument("--output", type=Path, default=ROOT / "donnees")
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--cache-root", type=Path, help="Reuse an existing OCR cache directory")
    args = parser.parse_args()
    if args.workers < 1 or args.dpi < 150:
        parser.error("--workers must be positive and --dpi must be at least 150")
    build(
        args.source.resolve(), args.output.resolve(), args.workers, args.dpi,
        args.cache_root.resolve() if args.cache_root is not None else None,
    )


if __name__ == "__main__":
    main()
