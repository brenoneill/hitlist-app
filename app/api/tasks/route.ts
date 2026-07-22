import { addTask, listTasks } from "@/app/lib/tasks";

export async function GET() {
  return Response.json(await listTasks());
}

export async function POST(request: Request) {
  const { title } = await request.json();
  if (typeof title !== "string" || !title.trim()) {
    return Response.json({ error: "title required" }, { status: 400 });
  }
  return Response.json(await addTask(title.trim()), { status: 201 });
}
