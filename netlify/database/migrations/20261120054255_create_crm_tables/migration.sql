CREATE TABLE "activities" (
	"id" serial PRIMARY KEY,
	"lead_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"lead_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome" text,
	"summary" text,
	"transcript" jsonb DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"score" text,
	"source" text DEFAULT 'voice' NOT NULL,
	"name" text,
	"company" text,
	"phone" text,
	"phone_digits" text,
	"email" text,
	"city" text,
	"state" text,
	"business_type" text,
	"crew_size" text,
	"monthly_volume" text,
	"current_chemical" text,
	"surfaces" text,
	"decision_maker" text,
	"timeline" text,
	"interest" text,
	"summary" text,
	"next_step" text,
	"follow_up_at" timestamp with time zone,
	"owner" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"lead_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"free_shipping" boolean DEFAULT false NOT NULL,
	"ship_to" jsonb,
	"notes" text,
	"created_by" text DEFAULT 'AI agent' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "activities_lead_idx" ON "activities" ("lead_id");--> statement-breakpoint
CREATE INDEX "calls_lead_idx" ON "calls" ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_phone_digits_idx" ON "leads" ("phone_digits");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" ("status");--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_lead_id_leads_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE;