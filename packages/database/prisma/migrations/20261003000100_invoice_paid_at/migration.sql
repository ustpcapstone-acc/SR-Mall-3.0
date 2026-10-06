-- Record when an invoice was actually paid. Before this, the dashboard used
-- "updatedAt", so any later edit to a paid invoice moved its payment into a
-- different month.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

-- Set automatically on every path that marks an invoice PAID (status change,
-- manual payment, raw SQL), and cleared if it goes back to unpaid.
CREATE OR REPLACE FUNCTION invoice_set_paid_at() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'PAID' THEN
    IF TG_OP = 'INSERT' OR OLD."status" IS DISTINCT FROM 'PAID' OR NEW."paidAt" IS NULL THEN
      NEW."paidAt" := COALESCE(NEW."paidAt", CURRENT_TIMESTAMP);
    END IF;
  ELSE
    NEW."paidAt" := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Invoice_set_paid_at" ON "Invoice";
CREATE TRIGGER "Invoice_set_paid_at"
  BEFORE INSERT OR UPDATE OF "status", "paidAt" ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION invoice_set_paid_at();

-- Existing paid invoices: the last-edited time is the best record we have.
UPDATE "Invoice" SET "paidAt" = "updatedAt" WHERE "status" = 'PAID' AND "paidAt" IS NULL;
