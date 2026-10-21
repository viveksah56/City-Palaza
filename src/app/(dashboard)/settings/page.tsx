import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/features/settings/settings-form";
import { readSettings } from "@/server/settings.service";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePermission(PERMISSION.SETTINGS_VIEW);
  const settings = await readSettings();
  return (<><PageHeader title="Settings" description="Shop details used on receipts, plus sales rules." /><SettingsForm defaults={settings} canEdit={hasPermission(user.role, PERMISSION.SETTINGS_UPDATE)} /></>);
}
