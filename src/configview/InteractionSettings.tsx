import { VSCodeButton, VSCodeDropdown, VSCodeOption, VSCodeTextField } from "@vscode/webview-ui-toolkit/react";
import { useState } from 'react';
import styled from 'styled-components';
import { Settings } from '../types/Settings';
import { vscode } from './utilities/vscode';

const Container = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
`;

const DropDownContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-flow: column nowrap;
  align-items: flex-start;
  justify-content: flex-start;
  width: fit-content;
  min-width: 200px;
& label {
  display: block;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin-bottom: 2px;
  }
`;

type InteractionSettings = Required<Settings>['interactionSettings'];
export const InteractionSettings = (interactions: InteractionSettings) => {
  const [currentInteractions, setInteractions] = useState(interactions);

  const handleStreamChange = (e: any) => {
    const clone = { ...currentInteractions };
    if (e.target.value === 'true') {
      clone.codeStreaming = true;
    }
    else if (e.target.value === 'false') {
      clone.codeStreaming = false;
    }
    setInteractions(clone);
  };

  const handleChange = (e: any) => {
    const number = Number(e.target.value);
    if (!number) return;
    const field = e.target.getAttribute('data-name');
    const clone = { ...currentInteractions };
    //@ts-ignore
    clone[field] = number;
    setInteractions(clone);
  };

  const handleClick = () => {
    vscode.postMessage({
      command: 'changeInteractions',
      value: currentInteractions
    });
  };

  return (
    <Container>
      <DropDownContainer>
        <label htmlFor="code-streaming">Code streaming:</label>
        <VSCodeDropdown id="code-streaming" data-name='codeStreaming' onChange={handleStreamChange} value={currentInteractions.codeStreaming.toString()} style={{ minWidth: '200px' }}>
          <VSCodeOption>true</VSCodeOption>
          <VSCodeOption>false</VSCodeOption>
        </VSCodeDropdown>
      </DropDownContainer>
      <VSCodeTextField data-name='codeContextWindow' value={currentInteractions.codeContextWindow.toString()} onChange={handleChange}>
        Code Context Window
      </VSCodeTextField>

      <VSCodeTextField data-name='codeMaxTokens' value={currentInteractions.codeMaxTokens.toString()} onChange={handleChange}>
        Code Max Tokens
      </VSCodeTextField>

      <VSCodeTextField data-name='chatContextWindow' value={currentInteractions.chatContextWindow.toString()} onChange={handleChange}>
        Chat Context Window
      </VSCodeTextField>

      <VSCodeTextField data-name='chatMaxTokens' value={currentInteractions.chatMaxTokens.toString()} onChange={handleChange}>
        Chat Max Tokens
      </VSCodeTextField>
      <VSCodeButton onClick={handleClick}>
        Save Interactions Settings
      </VSCodeButton>
    </Container>
  );

}