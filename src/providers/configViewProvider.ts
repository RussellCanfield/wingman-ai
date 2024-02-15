import * as vscode from 'vscode';
import { GetInteractionSettings } from '../service/base';
import { AppMessage } from '../types/Message';
import { InteractionSettings, Settings } from '../types/Settings';
export class ConfigViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'wingman.configview';
  private _view?: vscode.WebviewView;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _config: vscode.WorkspaceConfiguration) { }
  resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext<unknown>, token: vscode.CancellationToken): void | Thenable<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    this._disposables.push(
      webviewView.webview.onDidReceiveMessage((data: AppMessage) => {
        if (!data) {
          return;
        }

        const { command, value } = data;
        //@ts-ignore
        const response = this[command as keyof ConfigViewProvider](value) as string | Promise<string>;
        if (response instanceof Promise) {
          response.then(s => {
            webviewView.webview.postMessage({
              command,
              value: s
            });
          });
        }
        else if (response) {
          webviewView.webview.postMessage({
            command,
            value: response
          });
        }
      }));
  }

  private init = async (value: unknown): Promise<string> => {
    const settings = {
      aiProvider: this._config.get<Settings['aiProvider']>('Provider') ?? 'Ollama',
      interactionSettings: GetInteractionSettings(),
      ollama: this._config.get<Settings['ollama']>('Ollama'),
    } satisfies Settings;

    if (settings.ollama) {
      const modelsResponse = await fetch(`${settings.ollama.baseUrl}/api/tags`);
      const modelsJson = await modelsResponse.json() as { models: { name: string }[] };
      const modelNames = modelsJson.models.map(m => m.name);
      //@ts-ignore
      settings['ollamaModels'] = modelNames;
    }
    return JSON.stringify(settings);
  };

  private log = (value: unknown) => {
    console.log(value);
  };

  private ollamaChangeCode = (value: unknown) => {
    const ollamaConfig = this._config.get<Settings['ollama']>('Ollama');
    if (ollamaConfig) {
      const newConfig = { ...ollamaConfig };
      newConfig.codeModel = value as string;
      this._config.update('Ollama', newConfig);
    }
  };

  private ollamaChangeChat = (value: unknown) => {
    const ollamaConfig = this._config.get<Settings['ollama']>('Ollama');
    if (ollamaConfig) {
      const newConfig = { ...ollamaConfig };
      newConfig.chatModel = value as string;
      this._config.update('Ollama', newConfig);
    }
  };

  private changeInteractions = (value: unknown) => {
    const updated = { ...GetInteractionSettings(), ...value as InteractionSettings };
    this._config.update('InteractionSettings', updated);
  };

  private _getHtml = (webview: vscode.Webview) => {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "out",
        "config.es.js"
      )
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css"
      )
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
        <html lang="en" style="height: 100%">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';">
			<title>Wingman</title>
			<link rel="stylesheet" href="${codiconsUri}" nonce="${nonce}">
          </head>
          <body style="height: 100%">
            <div id="root" style="height: 100%"></div>
            <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>`;
  };

  private getNonce = () => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  dispose() {
    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

}