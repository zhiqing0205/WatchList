export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

function authHeader(config: WebDAVConfig): string {
  return "Basic " + Buffer.from(`${config.username}:${config.password}`).toString("base64");
}

function fileUrl(config: WebDAVConfig, filename: string): string {
  const base = config.url.endsWith("/") ? config.url : config.url + "/";
  return base + filename;
}

export async function webdavPut(
  config: WebDAVConfig,
  filename: string,
  data: string
): Promise<void> {
  const res = await fetch(fileUrl(config, filename), {
    method: "PUT",
    headers: {
      Authorization: authHeader(config),
      "Content-Type": "application/json; charset=utf-8",
    },
    body: data,
  });
  if (!res.ok) {
    throw new Error(`WebDAV PUT failed: ${res.status} ${res.statusText}`);
  }
}

export async function webdavGet(
  config: WebDAVConfig,
  filename: string
): Promise<string> {
  const res = await fetch(fileUrl(config, filename), {
    method: "GET",
    headers: {
      Authorization: authHeader(config),
    },
  });
  if (!res.ok) {
    throw new Error(`WebDAV GET failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function webdavTestConnection(
  config: WebDAVConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(config.url, {
      method: "OPTIONS",
      headers: {
        Authorization: authHeader(config),
      },
    });
    if (res.ok) {
      return { ok: true, message: "连接成功" };
    }
    return { ok: false, message: `HTTP ${res.status}: ${res.statusText}` };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "连接失败",
    };
  }
}
