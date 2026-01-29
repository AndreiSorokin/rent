/*
  Warnings:

  - The values [EDIT_CONTRACTS] on the enum `Permission` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Permission_new" AS ENUM ('VIEW_PAVILIONS', 'CREATE_PAVILIONS', 'EDIT_PAVILIONS', 'DELETE_PAVILIONS', 'VIEW_PAYMENTS', 'CREATE_PAYMENTS', 'EDIT_PAYMENTS', 'CALCULATE_PAYMENTS', 'VIEW_CHARGES', 'CREATE_CHARGES', 'EDIT_CHARGES', 'DELETE_CHARGES', 'VIEW_CONTRACTS', 'UPLOAD_CONTRACTS', 'DELETE_CONTRACTS', 'INVITE_USERS', 'ASSIGN_PERMISSIONS');
ALTER TABLE "StoreUser" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING ("permissions"::text::"Permission_new"[]);
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "public"."Permission_old";
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role";
