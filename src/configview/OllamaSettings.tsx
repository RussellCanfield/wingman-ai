import { VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
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
  min-width: 300px;
& label {
  display: block;
  color: var(--vscode-foreground);
  cursor: pointer;
  font-size: var(--vscode-font-size);
  line-height: normal;
  margin-bottom: 2px;
  }
`;

type OllamaSection = Required<Settings>['ollama'] & { ollamaModels: string[] };
export const OllamaSettings = ({ codeModel, chatModel, ollamaModels }: OllamaSection) => {
  const [currentCodeModel, setCodeModel] = useState(codeModel);
  const [currentChatModel, setChatModel] = useState(chatModel);
  const handleChange = (e: any) => {
    if (!ollamaModels.includes(e.target.value)) return;
    setCodeModel(e.target.value);
    vscode.postMessage({
      command: 'ollamaChangeCode',
      value: e.target.value
    });
  };

  const handleChatChange = (e: any) => {
    if (!ollamaModels.includes(e.target.value)) return;
    setChatModel(e.target.value);
    vscode.postMessage({
      command: 'log',
      value: e.target.value
    });
  };


  return (
    <Container>
      <DropDownContainer>
        <label htmlFor="code-model">Code model:</label>
        <VSCodeDropdown id="code-model" value={currentCodeModel} onChange={handleChange} style={{ minWidth: '100%' }}>
          <VSCodeOption>Not loaded</VSCodeOption>
          {ollamaModels.map(ab => <VSCodeOption key={ab}>{ab}</VSCodeOption>)}
        </VSCodeDropdown>
      </DropDownContainer>
      <DropDownContainer>
        <label htmlFor="chat-model">Chat model:</label>
        <VSCodeDropdown id="chat-model" value={currentChatModel} style={{ minWidth: '100%' }} onChange={handleChatChange}>
          <VSCodeOption>Not loaded</VSCodeOption>
          {ollamaModels.map(ab => <VSCodeOption key={ab}>{ab}</VSCodeOption>)}
        </VSCodeDropdown>
      </DropDownContainer>
    </Container>
  );

}