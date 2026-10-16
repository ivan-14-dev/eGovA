import csv
import hashlib
import json
import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import F

from workspace.knowledge import fingerprint, normalize
from workspace.models import Assessment, AuditControl, Bulletin, Event, Procedure, Source


class Command(BaseCommand):
    help = "Importer uniquement le corpus public local et les référentiels, sans service externe."

    @transaction.atomic
    def handle(self, *args, **options):
        root = Path(settings.CORPUS_ROOT)
        manifest = json.loads((root / "donnees/markdown/manifest.json").read_text())
        documents = {}
        pages = {}
        for directory in ["donnees", "donnees/publications"]:
            for filename, target, key in [
                ("documents.jsonl", documents, "document_id"), ("pages.jsonl", pages, "page_id"),
            ]:
                for line in (root / directory / filename).read_text().splitlines():
                    row = json.loads(line)
                    target.setdefault(row[key], row)
        sources = []
        seen = set()
        for entry in manifest["files"]:
            key = entry["document_id"]
            path = (root / "Reglementations" / entry["source_pdf"]).resolve()
            if not path.is_relative_to((root / "Reglementations").resolve()):
                raise CommandError("Chemin de PDF hors corpus.")
            if hashlib.sha256(path.read_bytes()).hexdigest() != key:
                raise CommandError(f"PDF modifié : {entry['source_pdf']}")
            if key in seen:
                continue
            seen.add(key)
            doc = documents[key]
            for number in range(1, doc["page_count"] + 1):
                page_id = f"{key}:p{number:04d}"
                if page_id not in pages:
                    raise CommandError(f"Page absente : {page_id}")
                text = pages[page_id]["text"]
                sources.append(Source(
                    id=page_id, title=doc["display_title"], text=text,
                    search_text=normalize(f"{doc['display_title']} {text}"),
                    path=str(path.relative_to(root)), locator=str(number), fingerprint=key,
                    kind=doc["document_kind"], draft=doc["legal_status"] == "projet_a_verifier",
                    warning="Source publique locale. OCR et vigueur juridique non certifiés. Une publication n'est pas une règle.",
                ))
        for folder in ["referentiel-telecom", "referentiel-publications"]:
            for path in sorted((root / "donnees" / folder).glob("*.md")):
                text = path.read_text()
                for index, block in enumerate(re.split(r"\n\n+", text)):
                    if len(block.strip()) < 50:
                        continue
                    # A table row is kept whole so amounts retain their headings and context.
                    sections = block.splitlines() if len(block) > 6500 and block.startswith("|") else [block]
                    for part, content in enumerate(sections):
                        if len(content) < 50:
                            continue
                        prefix = "\n".join(block.splitlines()[:2]) + "\n" if len(sections) > 1 else ""
                        body = prefix + content
                        sources.append(Source(
                            id=f"ref:{folder}:{path.stem}:{index}:{part}",
                            title=f"{folder} / {path.stem}", text=body,
                            search_text=normalize(body), path=str(path.relative_to(root)),
                            locator=f"Bloc {index + 1}", fingerprint=fingerprint(text), kind="reference",
                            warning="Synthèse documentaire locale, non certification. Vérifier la source primaire citée.",
                        ))
        previous = dict(Source.objects.values_list("id", "fingerprint"))
        changed = [s.pk for s in sources if s.pk in previous and s.fingerprint != previous[s.pk]]
        Procedure.objects.filter(source_id__in=changed).update(published=False, version=F("version") + 1)
        Bulletin.objects.filter(source_id__in=changed).update(verified=False, published_at=None)
        Source.objects.bulk_create(sources, update_conflicts=True, unique_fields=["id"], update_fields=[
            "title", "text", "search_text", "path", "locator", "fingerprint", "kind", "warning", "draft",
        ])
        # Retired entries remain available for old dossier provenance, but leave active retrieval.
        Source.objects.exclude(pk__startswith="public:").exclude(pk__in=[s.pk for s in sources]).update(draft=True)
        for source in sources:
            if source.kind != "reference" or not source.path.endswith(("03_procedures.md", "02_acteurs_procedures.md")):
                continue
            for line in source.text.splitlines():
                match = re.search(r'<a id="(ap|p)(\d+)"></a>(?:AP|P)\d+\s*\|(.*)', line)
                if not match:
                    continue
                cells = [cell.strip() for cell in match[3].strip("|").split("|")]
                if len(cells) != 3:
                    raise CommandError("Table des procédures incompatible.")
                title_match = re.search(r"\*\*(.*?)\*\*", cells[0])
                title = title_match[1] if title_match else re.sub(r"[*_]", "", cells[0])[:160]
                pid = f"{match[1].upper()}{int(match[2]):02d}"
                tags = ["telecom"]
                if pid in ["P01", "P55"]:
                    tags = []
                elif pid in ["P08", "P11", "P12", "P13", "P20", "P21"]:
                    tags += ["installation"]
                elif pid == "P10":
                    tags += ["commerce"]
                elif "consommateur" in normalize(cells[0]):
                    tags += ["consommateur"]
                if pid.startswith("AP"):
                    tags = [] if int(match[2]) <= 14 else ["telecom"]
                    if pid == "AP18":
                        tags += ["consommateur"]
                Procedure.objects.get_or_create(id=pid, defaults={
                    "title": title, "description": "\n\n".join(cells), "activities": tags,
                    "source_id": source.pk, "published": True,
                    "steps": ["Confirmer l'applicabilité et la version du texte",
                              "Réunir les pièces indiquées dans la procédure",
                              "Vérifier coûts, destinataire et modalités de dépôt",
                              "Préparer le dossier et conserver les justificatifs"],
                })
        path = root / "donnees/referentiel-telecom/07_grille_audit.csv"
        with path.open() as stream:
            for row in csv.DictReader(stream, delimiter=";"):
                values = {
                    "domain": row["domaine"], "text": row["controle"], "condition": row["condition_applicabilite"],
                    "source_ref": f"{row['source']} — {row['localisation']}", "critical": row["criticite"] == "CRITIQUE",
                }
                old = AuditControl.objects.filter(pk=row["id"]).first()
                if old and any(getattr(old, key) != value for key, value in values.items()):
                    assessments = Assessment.objects.filter(control=old)
                    Event.objects.bulk_create([
                        Event(owner_id=owner, action="Contrôle modifié — nouvelle évaluation requise", object_id=old.pk)
                        for owner in assessments.values_list("owner_id", flat=True)
                    ])
                    assessments.update(status="NON_EVALUE", applicability="A_DETERMINER")
                AuditControl.objects.update_or_create(id=row["id"], defaults=values)
        watch_path = root / "donnees/referentiel-publications/07_registre_veille.csv"
        with watch_path.open() as stream:
            for row in csv.DictReader(stream, delimiter=";"):
                reference = next(s for s in sources if s.kind == "reference"
                                 and s.path.endswith("04_veille_actions_sanctions.md")
                                 and f'id="{row["id"].lower()}"' in s.text)
                Bulletin.objects.get_or_create(title=row["titre"], source_id=reference.pk, defaults={
                    "body": f"{row['nature']} — publication repérée : {row['date_publication_repere']}. "
                            f"Statut documentaire : {row['statut_validation']}. {row['traitement_referentiel']}",
                    "activity": "telecom", "action": row["action_recommandee"],
                    "consequence": f"{row['consequence']}\nBase : {row['base_consequence']}",
                })
        self.stdout.write(self.style.SUCCESS(
            f"{len(sources)} passages publics, {Procedure.objects.count()} procédures, "
            f"{AuditControl.objects.count()} contrôles. Aucun bulletin publié automatiquement."
        ))
