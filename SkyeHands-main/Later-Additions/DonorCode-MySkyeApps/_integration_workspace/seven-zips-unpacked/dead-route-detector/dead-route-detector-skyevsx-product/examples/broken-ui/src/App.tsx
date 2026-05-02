import { routes } from './routes';
import { menu } from './menu';

function registerCommand(commandId: string, handler: () => void) {
  return { commandId, handler };
}

registerCommand('brokenUi.runHealthyThing', () => {
  console.log('healthy');
});

export function App() {
  const go = (path: string) => {
    window.location.href = path;
  };

  return (
    <main>
      <nav>
        <a href="/">Home</a>
        <a href="/ghost">Ghost</a>
        <a href="#">Placeholder</a>
        <button onClick={() => go('/reports/42')}>Open Report</button>
        <button onClick={() => go('/missing-report')}>Broken Report</button>
      </nav>
      <section>
        <button onClick={() => go('/alive')}>Alive</button>
        <button onClick={() => go('/nope')}>Nope</button>
      </section>
      <footer>
        {menu.map((item) => (
          <a key={item.label} href={item.href}>{item.label}</a>
        ))}
      </footer>
      <pre>{JSON.stringify(routes, null, 2)}</pre>
    </main>
  );
}

function executeCommand(commandId: string) {
  console.log(commandId);
}

executeCommand('brokenUi.runHealthyThing');
executeCommand('brokenUi.runGhostThing');
executeCommand('brokenUi.onlyExecuted');
