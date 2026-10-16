import json
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory, TestCase, override_settings
from django.utils import timezone

from .admin import BulletinAdmin, PublicImportAdmin
from .knowledge import GroundingError, gemini_quotes, normalize, retrieve
from .models import Assessment, AuditControl, Bulletin, Case, Event, Procedure, Profile, PublicImport, Source


class WorkspaceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("owner@example.test", "owner@example.test", "Strong-test-password-928!")
        cls.other = User.objects.create_user("other@example.test", "other@example.test", "Strong-test-password-928!")
        Profile.objects.create(user=cls.user, activity="installation")
        Profile.objects.create(user=cls.other, activity="logiciel")
        cls.source = Source.objects.create(
            id="ref:test", title="Agrément installateur", text="La durée de l'agrément installateur est de trois ans. Vérifier la source primaire.",
            search_text=normalize("Agrément installateur durée trois ans"), path="donnees/reference.md",
            locator="P08", fingerprint="a" * 64, kind="reference",
        )
        cls.procedure = Procedure.objects.create(
            id="P08", title="Agrément installateur", description="Pièces et durée à vérifier.",
            activities=["installation"], source=cls.source,
            steps=["Qualifier", "Préparer"], published=True,
        )
        AuditControl.objects.create(id="C001", domain="Titres", text="Titre valide", condition="Si applicable", source_ref="P08", critical=True)
        AuditControl.objects.create(id="C101", domain="Marché", text="DAO vérifié", condition="Marché", source_ref="P55", critical=True)

    def setUp(self):
        cache.clear()
        self.media = tempfile.mkdtemp(prefix="telecom-test-")
        self.override = override_settings(MEDIA_ROOT=Path(self.media))
        self.override.enable()
        self.client.force_login(self.user)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media)

    def post(self, url, data, client=None):
        return (client or self.client).post(f"/workspace-api/{url}", data=json.dumps(data), content_type="application/json")

    def create_case(self):
        response = self.post("cases/", {"procedure": "P08"})
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()["case"]["id"]

    def upload(self, pk, expires=""):
        return self.client.post(f"/workspace-api/cases/{pk}/evidence/", {
            "file": SimpleUploadedFile("preuve.pdf", b"%PDF-1.4\npublic test content", "application/pdf"),
            "expires_on": expires,
        })

    def test_auth_registration_password_validation_and_login(self):
        client = Client()
        self.assertEqual(self.post("register/", {"email": "new@example.test", "password": "123"}, client).status_code, 400)
        response = self.post("register/", {"email": "new@example.test", "password": "Independent-test-8793!"}, client)
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()["user"]["staff"])
        self.assertEqual(self.post("logout/", {}, client).status_code, 200)
        self.assertEqual(client.get("/workspace-api/cases/").status_code, 401)
        self.assertEqual(self.post("login/", {"email": "new@example.test", "password": "Independent-test-8793!"}, client).status_code, 200)

    def test_csrf_required_and_supported(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(self.post("login/", {"email": "x", "password": "x"}, client).status_code, 403)
        csrf = client.get("/workspace-api/session/").json()["csrf"]
        result = client.post("/workspace-api/login/", data=json.dumps({
            "email": self.user.email, "password": "Strong-test-password-928!",
        }), content_type="application/json", HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(result.status_code, 200)

    def test_other_user_cannot_read_or_change_cases_and_files(self):
        pk = self.create_case()
        uploaded = self.upload(pk)
        eid = uploaded.json()["case"]["evidence"][0]["id"]
        other = Client()
        other.force_login(self.other)
        self.assertEqual(other.get("/workspace-api/cases/").json()["cases"], [])
        self.assertEqual(self.post(f"cases/{pk}/", {"done": [True, True], "status": "pret"}, other).status_code, 404)
        self.assertEqual(other.get(f"/workspace-api/evidence/{eid}/").status_code, 404)
        self.assertEqual(other.delete(f"/workspace-api/evidence/{eid}/").status_code, 404)
        self.assertEqual(self.post("audit/", {"control": "C001", "applicability": "OUI", "status": "CONFORME",
                                             "evidence": eid, "justification": "Validée"}, other).status_code, 404)

    def test_case_persists_with_snapshot_and_declared_status(self):
        pk = self.create_case()
        result = self.post(f"cases/{pk}/", {"done": [True, True], "status": "depot_declare",
                                          "receipt": "DEPOT-TEST", "due_date": "2027-02-01"})
        self.assertEqual(result.status_code, 200)
        self.procedure.description = "Nouvelle version"
        self.procedure.version = 2
        self.procedure.save()
        loaded = self.client.get("/workspace-api/cases/").json()["cases"][0]
        self.assertEqual(loaded["description"], "Pièces et durée à vérifier.")
        self.assertTrue(loaded["outdated"])
        self.assertEqual(loaded["status"], "depot_declare")

    def test_fake_deposit_and_invalid_steps_are_rejected(self):
        pk = self.create_case()
        self.assertEqual(self.post(f"cases/{pk}/", {"done": [True, True], "status": "decision"}).status_code, 400)
        self.assertEqual(self.post(f"cases/{pk}/", {"done": [True], "status": "pret"}).status_code, 400)
        self.assertEqual(self.post(f"cases/{pk}/", {"done": [False, True], "status": "pret"}).status_code, 400)
        self.assertEqual(Case.objects.get(pk=pk).status, "preparation")

    def test_private_document_download_and_expiry(self):
        pk = self.create_case()
        response = self.upload(pk, "2000-01-01")
        proof = response.json()["case"]["evidence"][0]
        self.assertTrue(proof["expired"])
        result = self.client.get(proof["url"])
        self.assertEqual(result.status_code, 200)
        self.assertIn("attachment", result["Content-Disposition"])
        self.assertIn("no-store", result["Cache-Control"].split(", "))
        self.assertIn("private", result["Cache-Control"].split(", "))
        self.assertTrue(b"".join(result.streaming_content).startswith(b"%PDF"))

    def test_upload_rejects_unsupported_file_and_invalid_date(self):
        pk = self.create_case()
        response = self.client.post(f"/workspace-api/cases/{pk}/evidence/", {
            "file": SimpleUploadedFile("attack.html", b"<script>alert(1)</script>"),
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.upload(pk, "not-a-date").status_code, 400)

    def test_budget_preserves_unknown_and_separates_periods_and_taxes(self):
        pk = self.create_case()
        for amount, category, tax in [("1000", "initial", "HT"), ("2000", "annuel", "TTC"),
                                      ("5000", "garantie", "inconnu"), ("", "annuel", "TTC")]:
            response = self.post(f"cases/{pk}/budget/", {
                "label": "Poste", "amount": amount, "category": category, "tax": tax, "basis": "Devis local à confirmer",
            })
            self.assertEqual(response.status_code, 201)
        item = response.json()["case"]
        self.assertEqual(item["unknown_amounts"], 1)
        self.assertEqual(item["totals"], {"initial · HT": "1000.00", "annuel · TTC": "2000.00", "garantie · inconnu": "5000.00"})
        for value in ["NaN", "-1", "Infinity"]:
            self.assertEqual(self.post(f"cases/{pk}/budget/", {
                "label": "Bad", "amount": value, "category": "annuel", "tax": "HT", "basis": "Test",
            }).status_code, 400)

    def test_initial_audit_has_no_score_and_blocks_unknown_critical(self):
        summary = self.client.get("/workspace-api/audit/").json()["summaries"]
        self.assertIsNone(summary["reglementaire"]["score"])
        self.assertEqual(summary["reglementaire"]["coverage"], 0)
        self.assertEqual(summary["reglementaire"]["blocking"], 1)
        self.assertEqual(summary["marche"]["total"], 1)

    def test_audit_requires_valid_owned_evidence_and_justification(self):
        pk = self.create_case()
        proof = self.upload(pk).json()["case"]["evidence"][0]["id"]
        data = {"control": "C001", "applicability": "OUI", "status": "CONFORME"}
        self.assertEqual(self.post("audit/", data).status_code, 400)
        data.update(evidence=proof, justification="Périmètre vérifié pour le test")
        response = self.post("audit/", data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["summaries"]["reglementaire"]["score"], 100)
        self.assertEqual(response.json()["summaries"]["reglementaire"]["blocking"], 0)
        self.client.delete(f"/workspace-api/evidence/{proof}/")
        self.assertIsNone(self.client.get("/workspace-api/audit/").json()["summaries"]["reglementaire"]["score"])

    def test_expired_proof_never_yields_conformity(self):
        proof = self.upload(self.create_case(), "2000-01-01").json()["case"]["evidence"][0]["id"]
        result = self.post("audit/", {"control": "C001", "applicability": "OUI", "status": "CONFORME",
                                     "evidence": proof, "justification": "Ancien document"})
        self.assertEqual(result.status_code, 400)

    def test_all_excluded_is_not_100_percent(self):
        result = self.post("audit/", {"control": "C001", "applicability": "NON", "status": "NON_EVALUE",
                                     "justification": "Activité hors champ documentée"})
        summary = result.json()["summaries"]["reglementaire"]
        self.assertEqual(summary["total"], 0)
        self.assertIsNone(summary["score"])

    def test_bulletins_are_published_verified_and_targeted(self):
        notice = Bulletin.objects.create(title="Installation", body="Exemple", source=self.source,
                                        activity="installation", action="Vérifier", consequence="À établir")
        self.assertEqual(self.client.get("/workspace-api/bulletins/").json()["bulletins"], [])
        notice.verified = True
        notice.published_at = timezone.now()
        notice.save()
        self.assertEqual(len(self.client.get("/workspace-api/bulletins/").json()["bulletins"]), 1)
        self.post("bulletins/", {"id": notice.pk})
        self.assertTrue(self.client.get("/workspace-api/bulletins/").json()["bulletins"][0]["read"])
        notice.revision += 1
        notice.save()
        self.assertFalse(self.client.get("/workspace-api/bulletins/").json()["bulletins"][0]["read"])
        self.client.force_login(self.other)
        self.assertEqual(self.client.get("/workspace-api/bulletins/").json()["bulletins"], [])

    def test_admin_edit_withdraws_notice_until_republication(self):
        bulletin = Bulletin.objects.create(title="Public", body="Texte", source=self.source, activity="all",
                                           action="Action", consequence="Limite", verified=True, published_at=timezone.now())
        request = RequestFactory().post("/admin/")
        request.user = self.user
        form = MagicMock(changed_data=["body"])
        BulletinAdmin(Bulletin, AdminSite()).save_model(request, bulletin, form, True)
        bulletin.refresh_from_db()
        self.assertFalse(bulletin.verified)
        self.assertIsNone(bulletin.published_at)
        bulletin.verified = True
        BulletinAdmin(Bulletin, AdminSite()).save_model(request, bulletin, MagicMock(changed_data=["verified"]), True)
        self.assertTrue(Bulletin.objects.get(pk=bulletin.pk).verified)

    def test_public_search_and_no_external_request_in_local_mode(self):
        self.assertEqual(retrieve("agrement installateur")[0].pk, self.source.pk)
        with patch("workspace.knowledge.urllib.request.urlopen") as network:
            response = self.post("assistant/", {"question": "agrément installateur", "mode": "local"})
        network.assert_not_called()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["sources"])

    @override_settings(GEMINI_API_KEY="")
    def test_unconfigured_gemini_is_explicit(self):
        response = self.post("assistant/", {"question": "agrément installateur", "mode": "gemini", "public_question": True})
        self.assertEqual(response.status_code, 503)
        self.assertIn("non configuré", response.json()["error"])

    def test_unknown_question_does_not_call_provider(self):
        with patch("workspace.knowledge.urllib.request.urlopen") as network:
            response = self.post("assistant/", {"question": "zzzinexistant987", "mode": "gemini"})
        network.assert_not_called()
        self.assertEqual(response.json()["sources"], [])
        self.assertIn("Aucune source", response.json()["message"])

    @override_settings(GEMINI_API_KEY="test-not-a-real-key")
    def test_gemini_requires_explicit_public_question(self):
        response = self.post("assistant/", {"question": "agrément installateur", "mode": "gemini"})
        self.assertEqual(response.status_code, 400)

    @override_settings(GEMINI_API_KEY="test-not-a-real-key")
    def test_model_only_returns_exact_local_quotes_and_payload_has_no_private_files(self):
        self.upload(self.create_case())
        generated = {"citations": [{"id": self.source.pk, "quote": self.source.text}]}
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({
            "candidates": [{"content": {"parts": [{"text": json.dumps(generated)}]}}],
        }).encode()
        with patch("workspace.knowledge.urllib.request.urlopen", return_value=response) as network:
            result = gemini_quotes("agrément installateur", [self.source])
        self.assertEqual(result, generated["citations"])
        payload = json.loads(network.call_args.args[0].data)
        self.assertNotIn("tools", payload)
        encoded = json.dumps(payload)
        self.assertNotIn(self.user.email, encoded)
        self.assertNotIn("public test content", encoded)
        self.assertNotIn("private_media", encoded)

    @override_settings(GEMINI_API_KEY="test-not-a-real-key")
    def test_fabricated_quote_and_unknown_citation_are_rejected(self):
        for item in [{"id": "other", "quote": self.source.text},
                     {"id": self.source.pk, "quote": "Une nouvelle taxe inventée s'applique à toutes les sociétés."}]:
            response = MagicMock()
            response.__enter__.return_value.read.return_value = json.dumps({
                "candidates": [{"content": {"parts": [{"text": json.dumps({"citations": [item]})}]}}],
            }).encode()
            with patch("workspace.knowledge.urllib.request.urlopen", return_value=response):
                with self.assertRaises(GroundingError):
                    gemini_quotes("agrément", [self.source])

    def test_private_api_and_admin_require_login(self):
        client = Client()
        response = client.get("/workspace-api/history/")
        self.assertEqual(response.status_code, 401)
        self.assertIn("no-store", response["Cache-Control"].split(", "))
        self.assertEqual(client.get("/admin/").status_code, 302)
        self.assertEqual(self.client.get("/admin/").status_code, 302)

    @override_settings(EMAIL_HOST="", DEFAULT_FROM_EMAIL="")
    def test_unconfigured_password_reset_is_not_reported_sent(self):
        response = self.post("password-reset/", {"email": self.user.email})
        self.assertEqual(response.status_code, 503)

    def test_invalid_json_and_unknown_modes_report_errors(self):
        self.assertEqual(self.client.post("/workspace-api/profile/", data="{bad", content_type="application/json").status_code, 400)
        self.assertEqual(self.post("assistant/", {"question": "test", "mode": "web"}).status_code, 400)
        self.assertEqual(self.post("profile/", {"kind": "superuser", "activity": "telecom"}).status_code, 400)
        self.assertFalse(User.objects.get(pk=self.user.pk).is_staff)

    def test_login_attempts_are_limited(self):
        client = Client()
        for _ in range(12):
            self.post("login/", {"email": "none@example.test", "password": "incorrect"}, client)
        self.assertEqual(self.post("login/", {"email": "none@example.test", "password": "incorrect"}, client).status_code, 429)

    def test_drafts_are_excluded_from_search_journeys_and_watch(self):
        pk = self.create_case()
        self.source.draft = True
        self.source.save()
        Bulletin.objects.create(title="Retirée", body="Texte", source=self.source, activity="all",
                                action="Action", consequence="Inconnue", verified=True, published_at=timezone.now())
        self.assertEqual(retrieve("agrément installateur"), [])
        self.assertEqual(self.client.get("/workspace-api/procedures/").json()["procedures"], [])
        self.assertEqual(self.client.get("/workspace-api/bulletins/").json()["bulletins"], [])
        self.assertEqual(self.post("cases/", {"procedure": "P08"}).status_code, 404)
        self.assertTrue(self.client.get("/workspace-api/cases/").json()["cases"][0]["outdated"])

    def test_admin_publication_action_requires_review_and_renotifies(self):
        item = Bulletin.objects.create(title="À relire", body="Texte", source=self.source,
                                       activity="all", action="Vérifier", consequence="Non établie")
        request = RequestFactory().post("/admin/")
        request.user = self.user
        model_admin = BulletinAdmin(Bulletin, AdminSite())
        with patch.object(model_admin, "message_user"):
            model_admin.publish(request, Bulletin.objects.filter(pk=item.pk))
            item.refresh_from_db()
            self.assertIsNone(item.published_at)
            item.verified = True
            item.save()
            model_admin.publish(request, Bulletin.objects.filter(pk=item.pk))
        item.refresh_from_db()
        self.assertIsNotNone(item.published_at)
        self.assertEqual(item.revision, 2)
        self.assertEqual(item.published_by, self.user)

    def test_admin_public_source_requires_approval_and_edits_withdraw_it(self):
        item = PublicImport.objects.create(title="Test public", reference="Test sans valeur juridique",
                                          document=SimpleUploadedFile("source.md", b"Source publique de test pour agrement installateur."))
        request = RequestFactory().post("/admin/")
        request.user = self.user
        model_admin = PublicImportAdmin(PublicImport, AdminSite())
        with patch.object(model_admin, "message_user"):
            model_admin.index_public(request, PublicImport.objects.filter(pk=item.pk))
            self.assertFalse(Source.objects.filter(pk=f"public:{item.pk}").exists())
            item.public_confirmed = True
            item.save()
            model_admin.index_public(request, PublicImport.objects.filter(pk=item.pk))
        source = Source.objects.get(pk=f"public:{item.pk}")
        self.assertFalse(source.draft)
        model_admin.save_model(request, item, MagicMock(changed_data=["document"]), True)
        source.refresh_from_db()
        self.assertTrue(source.draft)
        self.assertIsNone(item.imported_at)


class CorpusLifecycleTests(TestCase):
    def test_import_is_repeatable_and_changed_sources_require_revalidation(self):
        call_command("import_corpus", verbosity=0)
        self.assertEqual(Procedure.objects.count(), 76)
        self.assertEqual(AuditControl.objects.count(), 110)
        self.assertEqual(Bulletin.objects.count(), 12)
        self.assertFalse(Bulletin.objects.filter(published_at__isnull=False).exists())
        count = Source.objects.count()
        procedure = Procedure.objects.select_related("source").get(pk="P08")
        original_version = procedure.version
        procedure.source.fingerprint = "simulated-old-version"
        procedure.source.save()
        user = User.objects.create_user("import@example.test")
        control = AuditControl.objects.get(pk="C001")
        control.text = "Ancien contrôle"
        control.save()
        Assessment.objects.create(owner=user, control=control, applicability="NON", justification="Ancien périmètre")
        call_command("import_corpus", verbosity=0)
        procedure.refresh_from_db()
        self.assertFalse(procedure.published)
        self.assertEqual(procedure.version, original_version + 1)
        self.assertEqual(Assessment.objects.get(owner=user).applicability, "A_DETERMINER")
        call_command("import_corpus", verbosity=0)
        self.assertEqual(Source.objects.count(), count)
        self.assertEqual(Procedure.objects.count(), 76)
        self.assertEqual(Bulletin.objects.count(), 12)
        procedure.refresh_from_db()
        self.assertEqual(procedure.version, original_version + 1)
