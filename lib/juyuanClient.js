'use strict';

const fetch = global.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

class JuyuanAIDBClient {
  constructor({ appKey, appSecret, env = 'prd' }) {
    this.appKey = appKey;
    this.appSecret = appSecret;
    this.env = env;

    if (env === 'sandbox') {
      this.baseUrl = 'https://sandbox.hs.net/gildatacustomization/v1';
      this.authUrl = 'https://sandbox.hscloud.cn/oauth2/oauth2/token';
    } else {
      this.baseUrl = 'https://open.hs.net/gildatacustomization/v1';
      this.authUrl = 'https://open.hscloud.cn/oauth2/oauth2/token';
    }

    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.appKey}:${this.appSecret}`, 'utf8').toString('base64');

    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to get access token: ${res.status} ${text}`);
    }

    const data = await res.json();
    this.accessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    this.tokenExpiresAt = new Date(Date.now() + (expiresIn - 300) * 1000);
    return this.accessToken;
  }

  async getHeaders() {
    const token = await this.getAccessToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async nlQuery({ query, answerType = 2, limit = 10 }) {
    const url = `${this.baseUrl}/nl_query`;
    const payload = {
      query,
      answerType,
      limit: Math.min(limit, 10000),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Juyuan nl_query failed: ${res.status} ${text}`);
    }

    const result = await res.json();

    if (result.answer || result.data || result.querySql) {
      return result;
    }
    if (result.code === 200 || result.success) {
      return result.data || result;
    }

    throw new Error(`Juyuan nl_query error: ${JSON.stringify(result)}`);
  }
}

function createJuyuanClientFromEnv() {
  const appKey = process.env.JUYUAN_APP_KEY;
  const appSecret = process.env.JUYUAN_APP_SECRET;
  const env = process.env.JUYUAN_ENV || 'prd';

  if (!appKey || !appSecret) {
    throw new Error('JUYUAN_APP_KEY or JUYUAN_APP_SECRET not set in environment');
  }

  return new JuyuanAIDBClient({ appKey, appSecret, env });
}

module.exports = {
  JuyuanAIDBClient,
  createJuyuanClientFromEnv,
};
