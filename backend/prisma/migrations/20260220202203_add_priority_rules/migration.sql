-- CreateTable
CREATE TABLE "priority_rules" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "team_level_weight" INTEGER NOT NULL DEFAULT 30,
    "season_status_weight" INTEGER NOT NULL DEFAULT 25,
    "event_type_weight" INTEGER NOT NULL DEFAULT 25,
    "home_away_weight" INTEGER NOT NULL DEFAULT 20,
    "team_level_scores" JSONB NOT NULL DEFAULT '{"VARSITY":100,"JV":60,"FRESHMAN":30}',
    "season_status_scores" JSONB NOT NULL DEFAULT '{"IN_SEASON":100,"OFF_SEASON":30}',
    "event_type_scores" JSONB NOT NULL DEFAULT '{"GAME":100,"PRACTICE":40}',
    "home_away_scores" JSONB NOT NULL DEFAULT '{"HOME":100,"AWAY":20,"NEUTRAL":50}',
    "facility_overrides" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priority_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "priority_rule_audits" (
    "id" TEXT NOT NULL,
    "priority_rule_id" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "field_changed" TEXT NOT NULL,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,

    CONSTRAINT "priority_rule_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "priority_rules_school_id_key" ON "priority_rules"("school_id");

-- CreateIndex
CREATE INDEX "priority_rule_audits_priority_rule_id_idx" ON "priority_rule_audits"("priority_rule_id");

-- AddForeignKey
ALTER TABLE "priority_rules" ADD CONSTRAINT "priority_rules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority_rule_audits" ADD CONSTRAINT "priority_rule_audits_priority_rule_id_fkey" FOREIGN KEY ("priority_rule_id") REFERENCES "priority_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
