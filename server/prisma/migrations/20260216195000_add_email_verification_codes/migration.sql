CREATE TABLE "EmailVerificationCode" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerificationCode_email_createdAt_idx"
ON "EmailVerificationCode"("email", "createdAt");

CREATE INDEX "EmailVerificationCode_email_expiresAt_usedAt_idx"
ON "EmailVerificationCode"("email", "expiresAt", "usedAt");
