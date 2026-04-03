-- CreateTable
CREATE TABLE "DealerWebsiteFeedToken" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenLast4" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerWebsiteFeedToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealerWebsiteFeedToken_dealerId_key" ON "DealerWebsiteFeedToken"("dealerId");

-- CreateIndex
CREATE UNIQUE INDEX "DealerWebsiteFeedToken_tokenHash_key" ON "DealerWebsiteFeedToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DealerWebsiteFeedToken_createdByUserId_idx" ON "DealerWebsiteFeedToken"("createdByUserId");

-- AddForeignKey
ALTER TABLE "DealerWebsiteFeedToken" ADD CONSTRAINT "DealerWebsiteFeedToken_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerWebsiteFeedToken" ADD CONSTRAINT "DealerWebsiteFeedToken_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
