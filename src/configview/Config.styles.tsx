import { VSCodeTextField as VSCodeTextFieldUI } from "@vscode/webview-ui-toolkit/react";
import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-flow: column;
  justify-content: center;
  align-items: flex-start;
  gap: 8px;
`;

export const DropDownContainer = styled.div`
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

export const ActionPanel = styled.div`
  display: flex;
  flex-flow: row nowrap;
  gap: 8px;
  align-items: center;
`;

export const VSCodeTextField = styled(VSCodeTextFieldUI)`
  min-width: 300px;
`;