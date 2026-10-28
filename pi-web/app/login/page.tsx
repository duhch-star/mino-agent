import { gatewayEnabled } from '@/lib/minos-gateway';
import { MinosLogin } from '@/components/MinosLogin';
import WebPasswordLogin from '@/components/WebPasswordLogin';
export const dynamic = 'force-dynamic';
export default function LoginPage() { return gatewayEnabled() ? <MinosLogin /> : <WebPasswordLogin />; }
