-- CreateTable
CREATE TABLE "blackbaud_connections" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token_type" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" TEXT,
    "environment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blackbaud_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blackbaud_connections_school_id_key" ON "blackbaud_connections"("school_id");

-- AddForeignKey
ALTER TABLE "blackbaud_connections" ADD CONSTRAINT "blackbaud_connections_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
