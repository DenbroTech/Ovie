import { Hammer } from 'lucide-react';
import { PageHeader } from '../shell/PageHeader';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/States';

/** Honest placeholder for a section that hasn't been built yet. No fake controls. */
export function ComingSoon({ title, step }: { title: string; step: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card as="div">
        <EmptyState icon={<Hammer size={32} aria-hidden="true" />} title={`${title} isn’t built yet`}>
          It’s {step} in the build plan. Nothing here is stored yet.
        </EmptyState>
      </Card>
    </>
  );
}
