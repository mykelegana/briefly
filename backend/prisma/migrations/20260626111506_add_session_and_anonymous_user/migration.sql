-- CreateTable
CREATE TABLE "anonymoususer" (
    "id" TEXT NOT NULL,

    CONSTRAINT "anonymoususer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" SERIAL NOT NULL,
    "rawInput" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "handoff" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anonymousUserId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_anonymousUserId_fkey" FOREIGN KEY ("anonymousUserId") REFERENCES "anonymoususer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
