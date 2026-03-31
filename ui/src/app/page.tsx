import { ControlPanel } from "@/components/custom/ControlPanel";
import { TaskList } from "@/components/custom/TaskList";
import type { Task } from "@/types";

export default function Home() {
  // 服务端渲染时使用空数组，客户端会自动获取数据
  const initialTasks: Task[] = [];
  
  return (
    <main className="min-h-screen bg-background relative">
      <div className="w-full">
        <TaskList initialTasks={initialTasks} />
      </div>
      <ControlPanel />
    </main>
  );
}
