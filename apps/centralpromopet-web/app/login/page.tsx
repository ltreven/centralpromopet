import { Brand } from '@/components/brand';
import { AuthForm } from '@/components/auth-form';
import { GoogleSignIn } from '@/components/google-sign-in';
export default function Login() {
  return <main className="auth-shell"><Brand /><section className="auth-card"><span className="eyebrow">BEM-VINDO DE VOLTA</span><h1>Entre na sua conta</h1><p>Acesse a Central Promo Pet com seu e-mail e senha.</p><GoogleSignIn /><div className="auth-divider">ou entre com sua senha</div><AuthForm /></section></main>;
}
