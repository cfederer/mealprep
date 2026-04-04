import React, { useState, useEffect } from 'react';
import { MealPrepAPI } from '../api/types';

interface SettingsPageProps {
  onClose?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
  const [claudeKey, setClaudeKey] = useState('');
  const [userPreferences, setUserPreferences] = useState('');
  const [oauthClientId, setOauthClientId] = useState('');
  const [oauthClientSecret, setOauthClientSecret] = useState('');
  const [oauthConnected, setOauthConnected] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    checkOauth();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const key = await window.mealPrepAPI.settings.getClaudeApiKey();
      if (key) setClaudeKey(key);

      const prefs = await window.mealPrepAPI.settings.getUserPreferences();
      if (prefs) setUserPreferences(prefs);

      const oauthConfig = await window.mealPrepAPI.oauth.getConfig();
      if (oauthConfig) {
        setOauthClientId(oauthConfig.clientId);
        setOauthClientSecret(oauthConfig.clientSecret);
      }

      const tokenStatus = await window.mealPrepAPI.oauth.hasTokens();
      setOauthConnected(tokenStatus);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkOauth = async () => {
    try {
      const tokenStatus = await window.mealPrepAPI.oauth.hasTokens();
      setOauthConnected(tokenStatus);
    } catch (err) {
      console.error('Failed to check Google OAuth status:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaved(false);
      setError(null);

      if (!claudeKey.trim()) {
        setError('Claude API key is required');
        return;
      }

      await window.mealPrepAPI.settings.setClaudeApiKey(claudeKey);
      await window.mealPrepAPI.settings.setUserPreferences(userPreferences);

      if (oauthClientId.trim() && oauthClientSecret.trim()) {
        await window.mealPrepAPI.oauth.setConfig({
          clientId: oauthClientId,
          clientSecret: oauthClientSecret,
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    }
  };

  const handleAuthenticate = async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await window.mealPrepAPI.oauth.startAuthFlow();
      if (result?.success) {
        setOauthConnected(true);
      } else {
        setError(result?.message || 'Google OAuth failed.');
      }
    } catch (err) {
      console.error('OAuth failed:', err);
      setError('Google OAuth failed. Please review your Client ID/Secret.');
      setOauthConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await window.mealPrepAPI.oauth.disconnect();
      setOauthConnected(false);
    } catch (err) {
      console.error('Failed to disconnect OAuth:', err);
      setError('Failed to disconnect Google OAuth');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 font-semibold"
            >
              ← Back
            </button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">API Keys</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claude API Key *
            </label>
            <input
              type="password"
              value={claudeKey}
              onChange={(e) => setClaudeKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-600 mt-2">
              Get your API key from{' '}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                console.anthropic.com
              </a>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Google Drive OAuth</h2>

          <div className="mb-4">
            <p className="text-sm text-gray-700 mb-2">
              Status: {oauthConnected ? (
                <span className="text-green-600 font-semibold">Connected</span>
              ) : (
                <span className="text-red-600 font-semibold">Not connected</span>
              )}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google OAuth Client ID</label>
                <input
                  type="text"
                  value={oauthClientId}
                  onChange={(e) => setOauthClientId(e.target.value)}
                  placeholder="YOUR_GOOGLE_CLIENT_ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google OAuth Client Secret</label>
                <input
                  type="password"
                  value={oauthClientSecret}
                  onChange={(e) => setOauthClientSecret(e.target.value)}
                  placeholder="YOUR_GOOGLE_CLIENT_SECRET"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAuthenticate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
                >
                  Connect Google Drive
                </button>
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
                  disabled={!oauthConnected}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Set your Google Cloud OAuth2 credentials, then click Connect. The app will open an authorization
            window and store refresh tokens securely.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Meal Planning Preferences</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Custom Preferences
            </label>
            <textarea
              value={userPreferences}
              onChange={(e) => setUserPreferences(e.target.value)}
              placeholder="e.g., High protein, avoid nuts, prefer Mediterranean cuisine, with servings needed per meal..."
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            />
            <p className="text-xs text-gray-600 mt-2">
              These preferences will be used to customize meal generation. Examples: dietary restrictions,
              favorite cuisines, protein goals, allergy information.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            Settings saved successfully!
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            Save Settings
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-semibold"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">About</h3>
          <p className="text-sm text-gray-600">
            Meal Prep Planner v0.1.0 • Built with Claude AI, Google Drive, and Instacart integration
          </p>
        </div>
      </div>
    </div>
  );
};
