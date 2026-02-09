"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSiteConfig, setConfigValue } from "@/app/admin/_actions/media";

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

  useEffect(() => {
    async function load() {
      const data = await getSiteConfig();
      setConfig(data as Record<string, string>);
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
    </div>
  );
}
