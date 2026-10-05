/** Sign in with an email code (no passwords). Errors from email links arrive as ?error=… */
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm initialError={error ?? null} />;
}
