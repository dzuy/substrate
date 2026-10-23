import { createHmac, timingSafeEqual } from "node:crypto";
import { createProviders } from "../prototypes/face-scan/providers.mjs";
import { loadDatabaseCatalog } from "../prototypes/face-scan/catalog/database.mjs";
import { refreshReportProducts } from "./report-products.mjs";
import { buildReport } from "./report-builder.mjs";
import { renderReportPdf } from "./report-pdf.mjs";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
async function readBody(req) {
  const limit = 5_000_000;
  if (Number(req.headers["content-length"]) > limit)
    throw Error("The image is too large. Choose a smaller photo.");
  if (req.body) {
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(raw) > limit) throw Error("Request is too large.");
    return JSON.parse(raw);
  }
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += Buffer.byteLength(c);
    if (size > limit) throw Error("Request is too large.");
    chunks.push(c);
  }
  return JSON.parse(
    Buffer.concat(chunks.map((c) => Buffer.from(c))).toString(),
  );
}
export function createReportHandler({
  env = process.env,
  fetcher = fetch,
  providers = createProviders(env, fetcher),
  allowLocalOrigins = false,
} = {}) {
  return async (req, res) => {
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(data));
    };
    if (req.method !== "POST") return send(405, { error: "POST required." });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(415, { error: "JSON required." });
    if (req.headers.origin) {
      try {
        if (
          new URL(req.headers.origin).host !== req.headers.host &&
          !(
            allowLocalOrigins &&
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
              req.headers.origin,
            )
          )
        )
          return send(403, { error: "Cross-origin request rejected." });
      } catch {
        return send(403, { error: "Invalid origin." });
      }
    }
    const authorization = req.headers.authorization;
    if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization || ""))
      return send(401, { error: "Sign in to create or open your report." });
    if (
      !env.EXPO_PUBLIC_SUPABASE_URL ||
      !env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return send(503, { error: "Report service is not configured." });
    const headers = {
      apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization,
      "Content-Type": "application/json",
    };
    const db = async (
      path,
      method = "GET",
      body,
      resolution = "merge-duplicates",
    ) => {
      const response = await fetcher(
        new URL("/rest/v1/" + path, env.EXPO_PUBLIC_SUPABASE_URL),
        {
          method,
          headers: {
            ...headers,
            Prefer: `return=representation,resolution=${resolution}`,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!response.ok)
        throw Error(
          "Cloud report storage is unavailable. Your report can still be saved on this device.",
        );
      return response.status === 204 ? [] : response.json();
    };
    try {
      const auth = await fetcher(
        new URL("/auth/v1/user", env.EXPO_PUBLIC_SUPABASE_URL),
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!auth.ok)
        return send(401, { error: "Your session expired. Sign in again." });
      const user = await auth.json();
      if (!uuid.test(user.id)) return send(401, { error: "Invalid account." });
      const body = await readBody(req);
      const secret =
        env.REPORT_SIGNING_SECRET ||
        env.FACE_SCAN_SIGNING_SECRET ||
        env.OPENAI_API_KEY;
      const signature = (data) =>
        createHmac("sha256", secret)
          .update("report-scan-v1:" + data)
          .digest("base64url");
      if (body.action === "scan") {
        if (!secret) throw Error("Photo analysis is not configured.");
        const scan = await providers.openai(
          body.image,
          env.OPENAI_VISION_MODEL || "gpt-5.6-sol",
        );
        const { analysis, model, promptVersion, imageHash } = scan;
        const payload = Buffer.from(
          JSON.stringify({
            analysis,
            model,
            promptVersion,
            imageHash,
            userId: user.id,
            expires: Date.now() + 86400000,
          }),
        ).toString("base64url");
        return send(200, {
          scan: { analysis, model, promptVersion, imageHash },
          scanToken: payload + "." + signature(payload),
        });
      }
      if (body.action === "generate") {
        if (
          !secret ||
          typeof body.scanToken !== "string" ||
          body.scanToken.length > 150000
        )
          throw Error("Take a new photo before generating your report.");
        const [payload, sig, extra] = body.scanToken.split(".");
        const expected = Buffer.from(signature(payload));
        const actual = Buffer.from(sig || "");
        if (
          extra ||
          expected.length !== actual.length ||
          !timingSafeEqual(expected, actual)
        )
          throw Error("Invalid scan reference. Take a new photo.");
        const scan = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (scan.userId !== user.id || scan.expires < Date.now())
          throw Error("Your scan expired. Take a new photo.");
        if (!["optimize", "fresh"].includes(body.mode))
          throw Error("Choose a routine mode.");
        const ids = Array.isArray(body.productIds)
          ? [...new Set(body.productIds)]
          : [];
        if (ids.length > 30 || ids.some((id) => !uuid.test(id)))
          throw Error("Select up to 30 products.");
        let wardrobe = [];
        if (ids.length) {
          const rows = await db(
            "products?select=id,name,brand:brands(name)&id=in.(" +
              ids.join(",") +
              ")",
          );
          wardrobe = rows.map((p) => ({
            id: p.id,
            name: p.name,
            brand: p.brand?.name || "",
          }));
          if (wardrobe.length !== ids.length)
            throw Error(
              "Some selected products are no longer accessible. Refresh your selection.",
            );
        }
        const unlisted = body.unlisted || [];
        if (
          !Array.isArray(unlisted) ||
          unlisted.length > 20 ||
          unlisted.some(
            (n) => typeof n !== "string" || !n.trim() || n.length > 160,
          )
        )
          throw Error("Check your manually entered product names.");
        wardrobe.push(
          ...unlisted.map((name) => ({ name, brand: "", id: null })),
        );
        const catalog = await loadDatabaseCatalog(env, fetcher, authorization);
        if (
          ["database-unavailable", "sign-in-required"].includes(catalog.version)
        )
          return send(503, {
            error:
              "The product catalog is unavailable. Your scan is preserved; try generating again shortly.",
          });
        const report = buildReport({
          scan,
          answers: body.answers,
          catalog,
          wardrobe,
          mode: body.mode,
        });
        if(body.experience === 'daily-summary-v1') {report.experience='daily-summary-v1';report.price=0;report.title='Your Skin Summary';}
        return send(200, { report });
      }
      if (body.action === "delete") {
        if (!uuid.test(body.id)) throw Error("Invalid report.");
        await db("rpc/permanently_delete_skin_report", "POST", {
          target_id: body.id,
        });
        return send(200, { deleted: true });
      }
      if (["get", "save", "unlock"].includes(body.action)) {
        const reportId = body.action === "save" ? body.report?.id : body.id;
        if (!uuid.test(reportId || "")) throw Error("Invalid report.");
        const deleted = await db(
          "deleted_skin_reports?select=id&id=eq." + reportId,
        );
        if (deleted.length)
          return send(410, {
            error: "This report was permanently deleted.",
            code: "REPORT_DELETED",
          });
      }
      if (body.action === "list")
        return send(200, {
          deletedIds: (await db("deleted_skin_reports?select=id")).map(
            (row) => row.id,
          ),
          reports: await db(
            "skin_reports?select=id,created_at,simulated_unlocked,payload->name,payload->summary&order=created_at.desc&limit=30",
          ),
        });
      if (body.action === "get") {
        if (!uuid.test(body.id)) throw Error("Invalid report.");
        const rows = await db("skin_reports?select=*&id=eq." + body.id);
        if (!rows.length) return send(404, { error: "Report not found." });
        const saved = rows[0].payload;
        const catalog = await loadDatabaseCatalog(env, fetcher, authorization);
        const report = refreshReportProducts(saved, catalog);
        if (report !== saved) {
          await db("skin_reports?id=eq." + body.id, "PATCH", {
            payload: report,
          });
        }
        return send(200, {
          report: { ...report, unlocked: rows[0].simulated_unlocked },
        });
      }
      if (body.action === "save") {
        if (
          !uuid.test(body.report?.id) ||
          body.report.version !== "skin-report-v1" ||
          !Array.isArray(body.report.sections)
        )
          throw Error("Invalid report.");
        // Ownership comes from auth. Retried/device saves never replace a cloud report
        // or reset an unlock already recorded on another device.
        await db(
          "skin_reports?on_conflict=id",
          "POST",
          {
            id: body.report.id,
            user_id: user.id,
            created_at: body.report.createdAt,
            payload: body.report,
          },
          "ignore-duplicates",
        );
        return send(200, { saved: true });
      }
      if (body.action === "unlock") {
        if (!uuid.test(body.id)) throw Error("Invalid report.");
        const rows = await db("skin_reports?id=eq." + body.id, "PATCH", {
          simulated_unlocked: true,
        });
        if (!rows.length) return send(404, { error: "Report not found." });
        return send(200, { unlocked: true, paymentMode: "simulation" });
      }
      if (body.action === "pdf") {
        const report = body.report;
        if (
          report?.version !== "skin-report-v1" ||
          report.unlocked !== true ||
          !Array.isArray(report.sections) ||
          report.sections.length > 20 ||
          report.sections.some(
            (s) =>
              typeof s.title !== "string" ||
              !Array.isArray(s.items) ||
              s.items.length > 100,
          )
        )
          throw Error("Unlock a valid report before exporting.");
        const pdf = await renderReportPdf(report, body.theme);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="Substrate-Skin-Report.pdf"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        return res.end(pdf);
      }
      return send(400, { error: "Unknown report action." });
    } catch (error) {
      return send(400, {
        error:
          error.name === "TimeoutError"
            ? "The service took too long. Your inputs are preserved; try again."
            : error instanceof SyntaxError
              ? "Invalid request."
              : error.message || "Unable to complete the report.",
      });
    }
  };
}
