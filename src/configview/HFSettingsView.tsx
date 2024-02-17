import { ApiSettingsType } from '../types/Settings';
import { InitSettings } from './App';
import { Container, VSCodeTextField } from './Config.styles';



type HFSection = InitSettings['huggingface'] & { onChange: (ollamaSettings: ApiSettingsType) => void };
export const HFSettingsView = ({ codeModel, chatModel, baseUrl, apiKey, onChange }: HFSection) => {
  const paths = { codeModel, chatModel, baseUrl, apiKey };
  const handleChangeInput = (e: any) => {
    const field = e.target.getAttribute('data-name');
    const clone = { ...paths };
    //@ts-ignore
    clone[field] = e.target.value;
    onChange(clone);
  };

  return (
    <Container>
      <VSCodeTextField onChange={handleChangeInput} value={codeModel} data-name='codeModel' title="HF Code Model">
        Code Model:
      </VSCodeTextField>
      <VSCodeTextField onChange={handleChangeInput} value={chatModel} data-name='chatModel' title="HF Chat Model">
        Chat Model:
      </VSCodeTextField>
      <VSCodeTextField onChange={handleChangeInput} value={baseUrl} data-name='baseUrl' title="HF base url">
        Base url:
      </VSCodeTextField>
      <VSCodeTextField onChange={handleChangeInput} value={apiKey} data-name='apiPath' title="HF api key">
        Api key:
      </VSCodeTextField>
    </Container>
  );

}