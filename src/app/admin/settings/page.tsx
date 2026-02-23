"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Save, Loader2, CloudUpload, Download, Upload, Plug } from "lucide-react";
import { toast } from "sonner";
import { getSiteConfig, setConfigValue } from "@/app/admin/_actions/media";
import {
  saveWebDAVConfig,
  getBackupInfo,
  testWebDAVConnection,
  backupToWebDAV,
  importData,
  exportData,
} from "@/app/admin/_actions/backup";

const configFields = [
  { key: "site_title", label: "站点名称", placeholder: "追剧清单", type: "text" },
  { key: "site_description", label: "站点描述", placeholder: "个人追剧/观影进度管理", type: "text" },
  { key: "items_per_page", label: "每页显示数量", placeholder: "20", type: "number" },
  { key: "default_play_url_template", label: "默认播放链接模板", placeholder: "https://example.com/play/{tmdb_id}", type: "text" },
];

export default function SettingsPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Backup state
  const [webdavUrl, setWebdavUrl] = useState("");
  const [webdavUsername, setWebdavUsername] = useState("");
  const [webdavPassword, setWebdavPassword] = useState("");
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [savingWebDAV, setSavingWebDAV] = useState(false);
  const [testing, setTesting] = useState(false);
  const [backing, setBacking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const [data, backupInfo] = await Promise.all([
        getSiteConfig(),
        getBackupInfo(),
      ]);
      setConfig(data as Record<string, string>);
      setWebdavUrl(backupInfo.webdavUrl);
      setWebdavUsername(backupInfo.webdavUsername);
      setWebdavPassword(backupInfo.webdavPassword);
      setLastBackupTime(backupInfo.lastBackupTime);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const field of configFields) {
        const value = config[field.key];
        if (value !== undefined && value !== null) {
          await setConfigValue(field.key, value);
        }
      }
      toast.success("设置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWebDAV = async () => {
    setSavingWebDAV(true);
    try {
      await saveWebDAVConfig({
        url: webdavUrl,
        username: webdavUsername,
        password: webdavPassword,
      });
      toast.success("WebDAV 配置已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingWebDAV(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const result = await testWebDAVConnection();
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("测试连接失败");
    } finally {
      setTesting(false);
    }
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      const result = await backupToWebDAV();
      if (result.success) {
        toast.success(result.message);
        setLastBackupTime(new Date().toISOString());
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "备份失败");
    } finally {
      setBacking(false);
    }
  };

  const handleExportLocal = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `watchlist-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("导出成功");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importData(text);
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <div className="space-y-6"><h1 className="text-2xl font-bold">系统设置</h1><p>加载中...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">站点配置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {configFields.map((field) => (
            <div key={field.key} className="space-y-2">
              <Label>{field.label}</Label>
              <Input
                type={field.type}
                value={config[field.key] || ""}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.placeholder}
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存设置
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">数据备份</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>WebDAV 地址</Label>
            <Input
              type="text"
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
              placeholder="https://dav.example.com/backup/"
            />
          </div>
          <div className="space-y-2">
            <Label>用户名</Label>
            <Input
              type="text"
              value={webdavUsername}
              onChange={(e) => setWebdavUsername(e.target.value)}
              placeholder="username"
            />
          </div>
          <div className="space-y-2">
            <Label>密码</Label>
            <Input
              type="password"
              value={webdavPassword}
              onChange={(e) => setWebdavPassword(e.target.value)}
              placeholder="password"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveWebDAV} disabled={savingWebDAV}>
              {savingWebDAV ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存配置
            </Button>
            <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plug className="mr-2 h-4 w-4" />
              )}
              测试连接
            </Button>
          </div>

          <Separator />

          {lastBackupTime && (
            <p className="text-sm text-muted-foreground">
              上次备份时间：{new Date(lastBackupTime).toLocaleString("zh-CN")}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleBackup} disabled={backing}>
              {backing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="mr-2 h-4 w-4" />
              )}
              备份到 WebDAV
            </Button>
            <Button variant="outline" onClick={handleExportLocal} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              导出到本地
            </Button>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              导入数据
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
