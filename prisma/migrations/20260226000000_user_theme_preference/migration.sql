-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "uiThemePreference" "ThemeMode" NOT NULL DEFAULT 'SYSTEM';
