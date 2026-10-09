import { Card } from '../ui/Card';

export function SetupNeeded() {
  return (
    <div className="center-screen">
      <Card as="div" className="auth-card">
        <h1>Ovie isn’t configured</h1>
        <p>
          This build has no Supabase connection settings. Set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> (in <code>.env.local</code> for development, or as Cloudflare
          Pages environment variables) and rebuild.
        </p>
      </Card>
    </div>
  );
}
