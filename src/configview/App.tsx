import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { AppMessage } from '../types/Message';
import { Settings } from '../types/Settings';
import { AiProvider } from './AiProvider';
import { InteractionSettings } from './InteractionSettings';
import { vscode } from './utilities/vscode';

const Container = styled.div`
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  align-items: stretch;
`;

const Section = styled.section`
  padding: 16px;
  border-radius: 8px;
  border: 1px solid gray;
  width: 350px;
`;
export type InitSettings = Settings & { ollamaModels: string[] };
export const App = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<InitSettings | null>(null);
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
        setSettings(JSON.parse(value as string) as InitSettings);
        setLoading(false);
        return;
    }
  };

  if (loading) {
    return <h3>Loading ...</h3>;
  }

  if (!settings) {
    return <h3>Error loading settings</h3>;
  }

  return (
    <Container>
      <Section>
        <AiProvider {...settings} />
      </Section>
      <Section>
        <InteractionSettings {...settings.interactionSettings} />
      </Section>
    </Container>
  );
};