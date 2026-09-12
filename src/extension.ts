import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new DuckViewProvider(context.extensionUri, context);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('duckTamagotchiView', provider)
  );

  // Detecta digitação de código
  vscode.workspace.onDidChangeTextDocument((e) => {
    if (e.contentChanges.length > 0) {
      const addedText = e.contentChanges.reduce((acc, change) => acc + change.text.length, 0);
      provider.sendToWebview({ type: 'CODE_TYPED', volume: addedText });
    }
  });

  // Detecta encerramento de tarefas no terminal (compilação/testes)
  vscode.tasks.onDidEndTaskProcess((e) => {
    if (e.exitCode === 0) {
      provider.sendToWebview({ type: 'COMPILATION_SUCCESS' });
    } else if (e.exitCode && e.exitCode > 0) {
      provider.sendToWebview({ type: 'COMPILATION_ERROR' });
    }
  });

  // Detecta erros de linter/compilação nos arquivos abertos
  vscode.languages.onDidChangeDiagnostics(() => {
    let hasErrors = false;
    vscode.languages.getDiagnostics().forEach(([_, diagnostics]) => {
      if (diagnostics.some(d => d.severity === vscode.DiagnosticSeverity.Error)) {
        hasErrors = true;
      }
    });
    if (hasErrors) {
      provider.sendToWebview({ type: 'COMPILATION_ERROR' });
    }
  });
}

class DuckViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtmlForWebview();
  }

  public sendToWebview(message: any) {
    this._view?.webview.postMessage(message);
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <style>
        body { margin: 0; padding: 10px; background: transparent; overflow: hidden; text-align: center; font-family: sans-serif; color: var(--vscode-foreground); }
        #canvas-container { width: 100%; height: 180px; position: relative; border-bottom: 2px dashed var(--vscode-panel-border, #555); }
        #duck { position: absolute; bottom: 10px; left: 50%; font-size: 42px; transition: left 0.5s linear, transform 0.2s; }
        .status { margin-top: 10px; font-size: 12px; opacity: 0.9; }
        .bubble { position: absolute; top: -35px; left: 50%; transform: translateX(-50%); font-size: 13px; background: #fff; color: #000; padding: 3px 8px; border-radius: 10px; white-space: nowrap; display: none; font-weight: bold; box-shadow: 0px 2px 4px rgba(0,0,0,0.3); }
      </style>
    </head>
    <body>
      <div id="canvas-container">
        <div id="duck">
          <div id="bubble" class="bubble"></div>
          <span id="sprite">🐤</span>
        </div>
      </div>
      <div class="status">
        <p id="state-text">Estado: De boa</p>
      </div>

      <script>
        const duck = document.getElementById('duck');
        const sprite = document.getElementById('sprite');
        const bubble = document.getElementById('bubble');
        const stateText = document.getElementById('state-text');

        let posX = 40;
        let isSick = false;

        // Animação de caminhada aleatória
        setInterval(() => {
          if (isSick) return;

          const delta = (Math.random() - 0.5) * 25;
          posX = Math.max(5, Math.min(75, posX + delta));
          
          duck.style.left = posX + '%';
          sprite.style.transform = delta > 0 ? 'scaleX(1)' : 'scaleX(-1)';

          if (Math.random() < 0.2) {
            showThought(['Quack!', 'Mais código!', 'Vibe coding...', 'E o push?'][Math.floor(Math.random() * 4)]);
          }
        }, 3000);

        function showThought(text) {
          bubble.innerText = text;
          bubble.style.display = 'block';
          setTimeout(() => { bubble.style.display = 'none'; }, 2000);
        }

        window.addEventListener('message', event => {
          const message = event.data;
          switch (message.type) {
            case 'COMPILATION_SUCCESS':
              isSick = false;
              sprite.innerText = '🥳';
              stateText.innerText = 'Estado: Build Passou!';
              showThought('SUCESSO!');
              setTimeout(() => { sprite.innerText = '🐥'; stateText.innerText = 'Estado: De boa'; }, 4000);
              break;

            case 'COMPILATION_ERROR':
              isSick = true;
              sprite.innerText = '🤢';
              stateText.innerText = 'Estado: Passando mal com o erro!';
              showThought('SOCORRO, BUG!');
              break;

            case 'CODE_TYPED':
              if (!isSick && Math.random() < 0.05) {
                showThought('Nhom nhom!');
              }
              break;
          }
        });
      </script>
    </body>
    </html>`;
  }
}