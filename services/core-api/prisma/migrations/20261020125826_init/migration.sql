-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SsoProvider" AS ENUM ('google', 'microsoft');

-- CreateEnum
CREATE TYPE "LinkStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ADMIN_DISABLED');

-- CreateEnum
CREATE TYPE "Device" AS ENUM ('desktop', 'mobile', 'tablet', 'bot', 'unknown');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTER', 'USER_LOGIN', 'USER_LOGIN_BLOCKED', 'USER_BAN', 'USER_UNBAN', 'USER_ROLE_CHANGE', 'LINK_DISABLE', 'LINK_ENABLE', 'DOMAIN_BLOCK', 'DOMAIN_UNBLOCK', 'API_KEY_CREATE', 'API_KEY_REVOKE');

-- CreateEnum
CREATE TYPE "AuditTarget" AS ENUM ('USER', 'LINK', 'DOMAIN', 'API_KEY');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SsoProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "links" (
    "id" SERIAL NOT NULL,
    "user_id" UUID,
    "short_code" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "original_host" TEXT NOT NULL,
    "status" "LinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3),
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clicks" (
    "id" BIGSERIAL NOT NULL,
    "link_id" INTEGER NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "referer" TEXT,
    "country" TEXT,
    "device" "Device" NOT NULL DEFAULT 'unknown',
    "os" TEXT,
    "browser" TEXT,
    "clicked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_daily_stats" (
    "link_id" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "link_daily_stats_pkey" PRIMARY KEY ("link_id","day")
);

-- CreateTable
CREATE TABLE "blocked_domains" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "reason" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" UUID,
    "action" "AuditAction" NOT NULL,
    "target_type" "AuditTarget",
    "target_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sso_identities_provider_subject_key" ON "sso_identities"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "sso_identities_user_id_provider_key" ON "sso_identities"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "links_short_code_key" ON "links"("short_code");

-- CreateIndex
CREATE INDEX "links_user_id_created_at_idx" ON "links"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "links_original_host_idx" ON "links"("original_host");

-- CreateIndex
CREATE INDEX "clicks_link_id_clicked_at_idx" ON "clicks"("link_id", "clicked_at");

-- CreateIndex
CREATE INDEX "clicks_clicked_at_idx" ON "clicks"("clicked_at");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_domains_domain_key" ON "blocked_domains"("domain");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "sso_identities" ADD CONSTRAINT "sso_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "links" ADD CONSTRAINT "links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clicks" ADD CONSTRAINT "clicks_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_daily_stats" ADD CONSTRAINT "link_daily_stats_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_domains" ADD CONSTRAINT "blocked_domains_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CHECK constraint (Prisma schema เขียนไม่ได้) — ดู docs/er-diagram.md
ALTER TABLE "users"            ADD CONSTRAINT users_email_lowercase_chk         CHECK ("email" = lower("email"));
ALTER TABLE "links"            ADD CONSTRAINT links_original_host_lowercase_chk CHECK ("original_host" = lower("original_host"));
ALTER TABLE "blocked_domains"  ADD CONSTRAINT blocked_domains_domain_chk        CHECK ("domain" = lower("domain") AND "domain" ~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$');
ALTER TABLE "clicks"           ADD CONSTRAINT clicks_country_chk                CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$');
ALTER TABLE "link_daily_stats" ADD CONSTRAINT link_daily_stats_clicks_chk       CHECK ("clicks" >= 0);
ALTER TABLE "links"            ADD CONSTRAINT links_click_count_chk             CHECK ("click_count" >= 0);
