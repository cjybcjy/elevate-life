import DashboardClient from './DashboardClient';

// Authentication belongs to the shared dashboard layout. Render the page shell
// immediately; SWR reuses client data and loads independent reads concurrently.
export default function DashboardPage() {
  return <DashboardClient currentDate={new Date().toISOString().slice(0, 10)} />;
}
