import { Button } from "../../components/Button";

export default function SettingsPage() {
  return (
    <main data-page-type="settings" data-purpose="Configure agent-safe operational defaults">
      <h1>Settings</h1>
      <Button id="save_settings" data-action-intent="save_settings" data-risk="medium" data-side-effects="state_change">
        Save Settings
      </Button>
    </main>
  );
}
