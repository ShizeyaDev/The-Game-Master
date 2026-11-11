import { GameMasterUIController } from './ui/index.ts';

function bootstrap(): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    throw new Error('Root element #app not found in document.');
  }

  const controller = new GameMasterUIController(appRoot);
  controller.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
