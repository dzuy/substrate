-- Run against a disposable local/test database AFTER the proposed migration.
-- The fixture uses the actual trigger function but writes only a temporary table.
BEGIN;
CREATE TEMP TABLE image_guard_fixture (LIKE public.products INCLUDING DEFAULTS) ON COMMIT DROP;
ALTER TABLE image_guard_fixture ALTER COLUMN brand_id SET DEFAULT gen_random_uuid(), ALTER COLUMN category SET DEFAULT 'serum';
INSERT INTO image_guard_fixture(id,name,status,catalog_visible,recommendation_enabled,product_type,is_bundle,formula_status,image_url)
VALUES ('11111111-2222-4333-8444-555555555555','Image fixture','needs_review',false,false,'topical',false,'missing',NULL),
('11111111-2222-4333-8444-555555555556','Visible legacy fixture','needs_review',true,false,'topical',false,'missing',NULL);
CREATE TRIGGER fixture_guard BEFORE INSERT OR UPDATE ON image_guard_fixture
FOR EACH ROW EXECUTE FUNCTION public.guard_catalog_recommendations();
DO $$
DECLARE saved jsonb; actual jsonb; target uuid := '11111111-2222-4333-8444-555555555555';
BEGIN
 SELECT to_jsonb(p)-'image_url'-'updated_at' INTO saved FROM image_guard_fixture p WHERE id=target;
 UPDATE image_guard_fixture SET image_url='https://example.com/one.webp' WHERE id=target;
 SELECT to_jsonb(p)-'image_url'-'updated_at' INTO actual FROM image_guard_fixture p WHERE id=target;
 IF actual IS DISTINCT FROM saved THEN RAISE EXCEPTION 'Image insertion changed other fields'; END IF;
 UPDATE image_guard_fixture SET image_url='https://example.com/two.webp',updated_at=now()+interval '1 second' WHERE id=target;
 SELECT to_jsonb(p)-'image_url'-'updated_at' INTO actual FROM image_guard_fixture p WHERE id=target;
 IF actual IS DISTINCT FROM saved THEN RAISE EXCEPTION 'Image replacement changed other fields'; END IF;
 UPDATE image_guard_fixture SET image_url=NULL WHERE id=target;
 IF (SELECT status<>'needs_review' FROM image_guard_fixture WHERE id=target) THEN RAISE EXCEPTION 'Image removal normalized status'; END IF;
 -- Existing development-visible rows must not become reviewed through photography.
 UPDATE image_guard_fixture SET image_url='https://example.com/visible.webp' WHERE id='11111111-2222-4333-8444-555555555556';
 IF (SELECT status<>'needs_review' OR NOT catalog_visible OR recommendation_enabled FROM image_guard_fixture WHERE id='11111111-2222-4333-8444-555555555556') THEN RAISE EXCEPTION 'Visible legacy row changed approval'; END IF;
 -- Image + recommendation change must run the original guard, not bypass it.
 UPDATE image_guard_fixture SET image_url='https://example.com/three.webp',recommendation_enabled=true WHERE id=target;
 IF (SELECT recommendation_enabled OR status<>'draft' FROM image_guard_fixture WHERE id=target) THEN RAISE EXCEPTION 'Mixed recommendation edit bypassed guard'; END IF;
 -- Explicit review edits alongside an image stay subject to original normalization.
 UPDATE image_guard_fixture SET image_url='https://example.com/four.webp',status='verified' WHERE id=target;
 IF (SELECT status<>'draft' FROM image_guard_fixture WHERE id=target) THEN RAISE EXCEPTION 'Mixed status edit bypassed guard'; END IF;
 UPDATE image_guard_fixture SET image_url='https://example.com/five.webp',archived_at=now(),catalog_visible=true WHERE id=target;
 IF (SELECT catalog_visible OR recommendation_enabled OR status<>'draft' FROM image_guard_fixture WHERE id=target) THEN RAISE EXCEPTION 'Archive edit bypassed guard'; END IF;
 -- INSERT must still reject direct publication even with an image.
 BEGIN
  INSERT INTO image_guard_fixture(id,name,status,catalog_visible,recommendation_enabled,product_type,is_bundle,formula_status,image_url)
  VALUES(gen_random_uuid(),'Invalid published fixture','verified',true,false,'device',false,'not_applicable','https://example.com/new.webp');
  RAISE EXCEPTION 'Published insert accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Save a draft before publishing.' THEN RAISE; END IF;
 END;
END $$;
SELECT 'PASS: image add/replace/remove, timestamp, mixed recommendation/status/archive edits, published INSERT' AS result;
ROLLBACK;
-- Also run existing supabase/tests/catalog_publishing.sql and brand_catalog.sql
-- to cover real publication completeness, formula invalidation, audit and RLS.
