import { ControlPanel } from "@/components/custom/ControlPanel";
import { TaskList } from "@/components/custom/TaskList";

export default function Home() {
  return (
    <main className="min-h-screen bg-background relative">
      <div className="container mx-auto max-w-7xl pt-6">
        <TaskList />
      </div>
      <ControlPanel />
    </main>
  );
}
