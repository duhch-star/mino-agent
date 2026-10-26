import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { I18nProvider } from "@/hooks/useI18n";
import { gatewayEnabled } from '@/lib/minos-gateway';
import { MinosWorkspace } from '@/components/MinosWorkspace';
export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <Suspense>
      <I18nProvider>
        {gatewayEnabled() ? <MinosWorkspace /> : <AppShell />}
      </I18nProvider>
    </Suspense>
  );
}
