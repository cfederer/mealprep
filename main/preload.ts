import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mealPrepAPI', {
  recipes: {
    getAll: () => ipcRenderer.invoke('recipes:getAll'),
  },
  meals: {
    generate: () => ipcRenderer.invoke('meals:generate'),
    generateCategory: (category: string) => ipcRenderer.invoke('meals:generateCategory', category),
    searchRecipe: (query: string, category: string) => ipcRenderer.invoke('meals:searchRecipe', query, category),
  },
  plan: {
    save: (plan: any) => ipcRenderer.invoke('plan:save', plan),
  },
  recipe: {
    save: (recipe: any) => ipcRenderer.invoke('recipe:save', recipe),
  },
  settings: {
    getClaudeApiKey: () => ipcRenderer.invoke('settings:getClaudeApiKey'),
    setClaudeApiKey: (key: string) => ipcRenderer.invoke('settings:setClaudeApiKey', key),
    getUserPreferences: () => ipcRenderer.invoke('settings:getUserPreferences'),
    setUserPreferences: (prefs: string) => ipcRenderer.invoke('settings:setUserPreferences', prefs),
    hasClaudeApiKey: () => ipcRenderer.invoke('settings:hasClaudeApiKey'),
  },
  oauth: {
    hasTokens: () => ipcRenderer.invoke('oauth:hasTokens'),
    setConfig: (config: { clientId: string; clientSecret: string }) =>
      ipcRenderer.invoke('oauth:setConfig', config),
    getConfig: () => ipcRenderer.invoke('oauth:getConfig'),
    startAuthFlow: () => ipcRenderer.invoke('oauth:startAuthFlow'),
    disconnect: () => ipcRenderer.invoke('oauth:disconnect'),
  },
});
