import { Code2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function ApiDocsPage() {
    return (
        <div className="min-h-screen bg-background p-6 md:p-8 pb-[100px]">
            <div className="max-w-4xl mx-auto space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500 flex items-center gap-3">
                        <Code2 className="w-8 h-8 text-primary" />
                        API 文档
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        通过 REST API 直接调用生成任务并获取结果，无需通过网页操作。
                    </p>
                </div>

                <div className="grid gap-6">
                    {/* Create Task */}
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 text-sm px-3 py-1 rounded-xl">POST</Badge>
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                /api/generate
                            </h2>
                        </div>
                        <p className="text-muted-foreground mb-6">创建一个新的图片生成任务并加入队列。</p>
                        
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-foreground/80">请求体参数 (application/json)</h3>
                            <div className="bg-secondary/30 rounded-2xl border border-border/50 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-secondary/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">参数名</th>
                                            <th className="px-4 py-3 font-medium">类型</th>
                                            <th className="px-4 py-3 font-medium">必填</th>
                                            <th className="px-4 py-3 font-medium">说明</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">prompt</td>
                                            <td className="px-4 py-3 text-muted-foreground">string</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10">是</Badge></td>
                                            <td className="px-4 py-3">正向提示词</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">negative_prompt</td>
                                            <td className="px-4 py-3 text-muted-foreground">string</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">反向提示词</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">steps</td>
                                            <td className="px-4 py-3 text-muted-foreground">number</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">生成步数，默认 30</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">width</td>
                                            <td className="px-4 py-3 text-muted-foreground">number</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">图片宽度，默认 896</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">height</td>
                                            <td className="px-4 py-3 text-muted-foreground">number</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">图片高度，默认 1152</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">batch_size</td>
                                            <td className="px-4 py-3 text-muted-foreground">number</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">单次批次大小，默认 1</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">n_iter</td>
                                            <td className="px-4 py-3 text-muted-foreground">number</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">生成批次次数，默认 4</td>
                                        </tr>
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">override_settings</td>
                                            <td className="px-4 py-3 text-muted-foreground">object</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-muted-foreground">否</Badge></td>
                                            <td className="px-4 py-3">覆盖设置，如 {`{ sd_model_checkpoint: "model.safetensors" }`}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">调用示例 (cURL)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`curl -X POST http://localhost:3000/api/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "1girl, beautiful, masterpiece",
    "negative_prompt": "lowres, bad anatomy",
    "steps": 25,
    "width": 1024,
    "height": 1024
  }'`}
                                </pre>
                            </div>

                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">响应示例 (JSON)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`{
  "success": true,
  "data": {
    "task": {
      "id": "cm7ymm...",
      "prompt": "1girl, beautiful, masterpiece",
      "status": "pending",
      "createdAt": "2024-03-20T12:00:00.000Z"
    }
  }
}`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Get Tasks */}
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 text-sm px-3 py-1 rounded-xl">GET</Badge>
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                /api/tasks
                            </h2>
                        </div>
                        <p className="text-muted-foreground mb-6">获取最近生成的任务列表及其图片信息。</p>
                        
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">调用示例 (JavaScript / Fetch)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`fetch('http://localhost:3000/api/tasks')
  .then(res => res.json())
  .then(data => console.log(data));`}
                                </pre>
                            </div>

                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">响应示例 (JSON)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`[
  {
    "id": "cm7ymm...",
    "prompt": "1girl, beautiful, masterpiece",
    "status": "completed",
    "images": [
      {
        "id": "cm7ymm_img...",
        "path": "C:\\path\\to\\image.png",
        "createdAt": "2024-03-20T12:00:10.000Z"
      }
    ],
    "createdAt": "2024-03-20T12:00:00.000Z"
  }
]`}
                                </pre>
                            </div>
                        </div>
                    </div>

                    {/* Delete Task */}
                    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20 text-sm px-3 py-1 rounded-xl">DELETE</Badge>
                            <h2 className="text-xl font-semibold flex items-center gap-2">
                                /api/tasks
                            </h2>
                        </div>
                        <p className="text-muted-foreground mb-6">删除指定的生成任务及相关图片文件。</p>
                        
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm text-foreground/80">请求体参数 (application/json)</h3>
                            <div className="bg-secondary/30 rounded-2xl border border-border/50 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-secondary/50 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">参数名</th>
                                            <th className="px-4 py-3 font-medium">类型</th>
                                            <th className="px-4 py-3 font-medium">必填</th>
                                            <th className="px-4 py-3 font-medium">说明</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        <tr className="hover:bg-secondary/40 transition-colors">
                                            <td className="px-4 py-3 font-mono text-primary">id</td>
                                            <td className="px-4 py-3 text-muted-foreground">string</td>
                                            <td className="px-4 py-3"><Badge variant="outline" className="text-red-500 border-red-500/20 bg-red-500/10">是</Badge></td>
                                            <td className="px-4 py-3">需要删除的任务 ID</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">调用示例 (Python)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`import requests

url = "http://localhost:3000/api/tasks"
payload = {"id": "task_1234567890"}

response = requests.delete(url, json=payload)
print(response.json())`}
                                </pre>
                            </div>

                            <h3 className="font-semibold text-sm text-foreground/80 mt-6">响应示例 (JSON)</h3>
                            <div className="bg-zinc-950 rounded-2xl p-4 overflow-x-auto border border-zinc-800">
                                <pre className="text-zinc-300 text-sm font-mono leading-relaxed">
{`{
  "success": true,
  "data": {
    "deleted": true
  }
}`}
                                </pre>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}
