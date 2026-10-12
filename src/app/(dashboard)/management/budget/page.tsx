export const dynamic = 'force-dynamic';

import BudgetManager from './BudgetManager';

export default function BudgetManagementPage() {
  const currentDate = new Date().toISOString().slice(0, 10);

  // The dashboard layout guards the route. Read through the shared SWR cache
  // so first navigation can show the form without waiting for account history.
  return <BudgetManager currentDate={currentDate} />;
}
