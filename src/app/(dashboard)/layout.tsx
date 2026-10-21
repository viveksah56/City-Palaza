import { requireUser } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/rbac/permission";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { NAV_ITEMS } from "@/lib/rbac/navigation";
import { fullName } from "@/lib/format";
import { AppShell } from "@/components/layout/app-shell";
import { getNotifications } from "@/server/dashboard.service";
import { getSettings } from "@/server/settings.service";
import { logoutAction } from "@/server/actions";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, notes] = await Promise.all([getSettings(), getNotifications()]);
  const nav = NAV_ITEMS.filter((n) => hasPermission(user.role, n.permission)).map(({ title, href, icon }) => ({ title, href, icon }));
  return (
    <AppShell
      nav={nav}
      user={{ name: fullName(user), email: user.email, roleLabel: ROLE_LABELS[user.role] }}
      shopName={settings.shopName}
      notifications={{ count: notes.lowStockCount, items: notes.items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity })) }}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
