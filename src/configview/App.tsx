import {
  VSCodeDivider,
  VSCodeTextArea,
  VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react";
import { useEffect, useState } from 'react';
import { AppMessage } from '../types/Message';
import { Settings } from '../types/Settings';
import { InteractionSettings } from './InteractionSettings';
import { OllamaSettings } from './OllamaSettings';
import { vscode } from './utilities/vscode';

export const App = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    vscode.postMessage({
      command: 'init'
    });
    window.addEventListener("message", handleResponse);
    return () => {
      window.removeEventListener("message", handleResponse);
    };
  }, []);

  const handleResponse = (event: MessageEvent<AppMessage>) => {
    const { command, value } = event.data;
    switch (command) {
      case 'init':
        setSettings(JSON.parse(value as string) as Settings);
        setLoading(false);
        return;
    }
  }

  if (loading) {
    return <h3>Loading ...</h3>;
  }

  if (!settings) {
    return <h3>Error loading settings</h3>;
  }

  return (
    <div>
      <h3>Provider: {settings.aiProvider}</h3>
      {settings.ollama && 'ollamaModels' in settings && <OllamaSettings {...settings.ollama} ollamaModels={settings.ollamaModels as string[]} />}
      <VSCodeDivider />
      <InteractionSettings {...settings.interactionSettings} />
    </div>
  )
}