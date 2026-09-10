/*
  Warnings:

  - A unique constraint covering the columns `[doctorId,startTime]` on the table `available_slots` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "available_slots" DROP CONSTRAINT "available_slots_doctorId_fkey";

-- CreateIndex
CREATE INDEX "appointments_doctorId_date_idx" ON "appointments"("doctorId", "date");

-- CreateIndex
CREATE INDEX "appointments_userId_idx" ON "appointments"("userId");

-- CreateIndex
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX "available_slots_doctorId_isBooked_startTime_idx" ON "available_slots"("doctorId", "isBooked", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "available_slots_doctorId_startTime_key" ON "available_slots"("doctorId", "startTime");

-- AddForeignKey
ALTER TABLE "available_slots" ADD CONSTRAINT "available_slots_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
