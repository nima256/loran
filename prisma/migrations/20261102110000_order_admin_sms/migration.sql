-- Keep delivery progress for each admin mobile without touching payment state.
ALTER TABLE "orders"
  ADD COLUMN "adminOrderSmsSentTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "adminOrderSmsLockAt" TIMESTAMP(3);
