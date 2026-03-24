import { ControlPanel } from "@/components/custom/ControlPanel";
import { TaskList } from "@/components/custom/TaskList";

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative">
      <div className="w-full">
        <TaskList />
      </div>
      <ControlPanel />
    </main>
  );
}
