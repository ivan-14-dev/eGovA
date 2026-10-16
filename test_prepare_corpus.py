from contextlib import redirect_stdout
import csv
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from prepare_corpus import (
    atomic_json, build, clean_text, document_record, needs_ocr, ocr_confidence,
    page_record, process_page, split_pages,
)
from export_markdown import export, link_target, render_document, text_block


class CorpusTests(unittest.TestCase):
    def test_page_boundaries_include_empty_pages(self):
        self.assertEqual(split_pages("one\f\ftwo\f", 3), ["one", "", "two"])
        self.assertEqual(split_pages("\f", 1), [""])
        with self.assertRaises(ValueError):
            split_pages("one\ftwo\f", 3)

    def test_cleaning_preserves_legal_text_and_lines(self):
        self.assertEqual(clean_text("  Article 1.\r\n10 000 FCFA  \n"), "Article 1.\n10 000 FCFA")
        self.assertEqual(clean_text("de\u0301cret"), "décret")

    def test_headers_need_ocr(self):
        self.assertTrue(needs_ocr("20 Recueil des textes du secteur des communications"))
        self.assertTrue(needs_ocr(""))
        self.assertFalse(needs_ocr("x" * 250))

    def test_confidence_ignores_non_word_rows(self):
        tsv = "level\tconf\ttext\n1\t-1\t\n5\t90\tLoi\n5\t70\t2010\n"
        self.assertEqual(ocr_confidence(tsv), 80)
        self.assertIsNone(ocr_confidence("level\tconf\ttext\n1\t-1\t\n"))

    def test_native_and_ocr_traceability(self):
        native = page_record("abc", "Lois/a.pdf", 2, "x" * 300)
        self.assertEqual(native["page_id"], "abc:p0002")
        self.assertFalse(native["requires_review"])
        ocr = page_record("abc", "Lois/a.pdf", 2, "", "Article 1", 70)
        self.assertEqual(ocr["extraction_method"], "ocr")
        self.assertIn("confiance_ocr_faible", ocr["warnings"])
        self.assertTrue(ocr["requires_review"])

    def test_empty_ocr_does_not_erase_native_text(self):
        page = page_record("abc", "a.pdf", 1, "Texte initial", "", None)
        self.assertEqual(page["text"], "Texte initial")
        self.assertEqual(page["ocr_text"], "")
        self.assertEqual(page["extraction_method"], "native_after_ocr")
        self.assertIn("ocr_moins_complet_texte_natif_conserve", page["warnings"])

    def test_legal_metadata_is_not_invented(self):
        record = document_record(
            Path("/source/decision/Projet_decision_carte.pdf"), Path("/source"), "abc",
        )
        self.assertEqual(record["legal_status"], "projet_a_verifier")
        self.assertIsNone(record["official_reference"])
        self.assertIsNone(record["publication_date"])

    def test_statistics_are_not_normative(self):
        record = document_record(
            Path("/source/recueil de texte/RECUEIL20122013finalàDCCjuillet2016.pdf"),
            Path("/source"), "abc",
        )
        self.assertEqual(record["document_kind"], "statistiques")

    def test_shared_cache_preserves_new_source_path(self):
        with tempfile.TemporaryDirectory() as temporary:
            cache = Path(temporary)
            cached = page_record("abc", "old/a.pdf", 1, "Entete", "Texte OCR", 90)
            atomic_json(cache / "abc/0001.json", cached)
            document = {"document_id": "abc", "source_path": "new/a.pdf"}
            with patch("prepare_corpus.extract_ocr") as ocr:
                result = process_page(document, "Entete", 1, cache, cache, 300, ("", {}, []))
                ocr.assert_not_called()
                self.assertEqual(result["source_path"], "new/a.pdf")
                self.assertEqual(result["text"], "Texte OCR")
                with self.assertRaises(ValueError):
                    process_page(document, "Different", 1, cache, cache, 300, ("", {}, []))
            self.assertEqual(json.loads((cache / "abc/0001.json").read_text()), cached)

    def test_markdown_preserves_text_and_escapes_links(self):
        pdf = Path("/root/sources/loi [1] (test).pdf")
        target = Path("/root/md/loi.md")
        self.assertEqual(
            link_target(pdf, target, 2),
            "../sources/loi%20%5B1%5D%20%28test%29.pdf#page=2",
        )
        document = document_record(pdf, pdf.parent, "abc")
        document["page_count"] = 2
        text = "Article 1.\n```\n<script>texte</script>\n10 000 FCFA"
        pages = [
            page_record("abc", pdf.name, 1, text),
            page_record("abc", pdf.name, 2, "", "", None),
        ]
        rendered = render_document(document, pages, pdf, target)
        self.assertIn(text_block(text), rendered)
        self.assertIn("````text\n" + text + "\n````", rendered)
        self.assertIn("#page=2", rendered)
        self.assertIn("Aucun texte obtenu", rendered)
        self.assertEqual(rendered.count("## Page "), 2)
        self.assertIn("confiance_ocr_faible", rendered)

    def test_exports_deduplicate_preserve_pages_and_resume(self):
        def fake_run(command, *args, **kwargs):
            if command[0] == "pdfinfo":
                return "Pages: 2\n"
            if command[0] == "pdftotext" and command[1] == "-layout":
                return ("Article 1. " * 40) + "\fEntete\f"
            return "test tool version\n"

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            source.mkdir()
            for name, content in (("a.pdf", b"same"), ("b.pdf", b"same"), ("c.pdf", b"other")):
                (source / name).write_bytes(content)
            output = root / "output"
            with (
                patch("prepare_corpus.run", side_effect=fake_run),
                patch("prepare_corpus.shutil.which", return_value="/bin/tool"),
                patch("prepare_corpus.ocr_environment", return_value=("tesseract", {}, [])),
                patch("prepare_corpus.extract_ocr", return_value=("Texte OCR " * 50, 95)) as ocr,
                redirect_stdout(io.StringIO()),
            ):
                build(source, output, workers=2, dpi=300)
                self.assertEqual(ocr.call_count, 2)
                first_pages = (output / "pages.jsonl").read_text()
                ocr.reset_mock()
                build(source, output, workers=2, dpi=300)
                ocr.assert_not_called()
                self.assertEqual((output / "pages.jsonl").read_text(), first_pages)
            pages = [json.loads(line) for line in first_pages.splitlines()]
            docs = [
                json.loads(line)
                for line in (output / "documents.jsonl").read_text().splitlines()
            ]
            self.assertEqual(len(pages), 4)
            self.assertEqual(len({p["page_id"] for p in pages}), 4)
            self.assertEqual(len(docs), 2)
            self.assertEqual(docs[0]["source_paths"], ["a.pdf", "b.pdf"])
            self.assertEqual(docs[0]["document_id"], hashlib.sha256(b"same").hexdigest())
            self.assertEqual([p["page_number"] for p in pages], [1, 2, 1, 2])
            with (output / "catalogue.csv").open(encoding="utf-8-sig", newline="") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 2)
            self.assertEqual(json.loads(rows[0]["source_paths"]), ["a.pdf", "b.pdf"])
            report = json.loads((output / "rapport_qualite.json").read_text())
            self.assertEqual(report["source_pdf_count"], 3)
            self.assertEqual(report["duplicate_file_count"], 1)
            self.assertEqual(report["ocr_page_count"], 2)
            self.assertEqual((source / "a.pdf").read_bytes(), b"same")
            with redirect_stdout(io.StringIO()):
                manifest = export([output], root / "markdown", source)
            self.assertEqual(manifest["source_pdf_count"], 3)
            self.assertEqual(manifest["unique_document_count"], 2)
            self.assertEqual(manifest["page_sections"], 6)
            self.assertTrue((root / "markdown/b.pdf.md").exists())
            self.assertIn("b.pdf#page=2", (root / "markdown/b.pdf.md").read_text())
            (source / "a.pdf").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "PDF changed"):
                export([output], root / "markdown", source)


if __name__ == "__main__":
    unittest.main()
